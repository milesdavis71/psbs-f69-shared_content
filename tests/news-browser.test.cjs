const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn } = require('node:child_process')
const test = require('node:test')
const yaml = require('js-yaml')
const { saveNews, sourcePaths } = require('../.frontmatter/lib/news-store.cjs')

// JSDOM's Window descriptors differ from Chromium's. Exercise the real native
// parent accessor and the complete browser -> command -> files -> response flow.
const browser = process.env.NEWS_TEST_CHROME || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(file => fs.existsSync(file))

for (const originalId of ['news13', 'news14']) {
    test(`Chromium Update ${originalId} -> news42 crosses the shadowed VS Code bridge`, {
        skip: !browser, timeout: 30000,
    }, async t => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-browser-'))
        const sourceId = 'news-2026-27'
        const config = {
            'frontMatter.content.publicFolder': 'src/assets/img/hirfolyam',
            'frontMatter.data.files': [{ id: sourceId, file: '[[workspace]]/src/data/news-2026-27.yml' }],
        }
        const files = sourcePaths(root, config, sourceId)
        for (const file of [files.data, files.content]) fs.mkdirSync(path.dirname(file), { recursive: true })
        const baseline = { title: 'Próbahír', site: 'ps', img: 'nincs', align: 'center', imgclass: 'medium-3', contentclass: 'medium-9', content: originalId }
        const textId = originalId === 'news14' ? 'news42' : originalId
        const markdown = `{{#ifequal hir "${textId}"}}\nMegőrzendő szöveg\n{{/ifequal}}\n`
        fs.writeFileSync(files.data, yaml.dump([baseline]))
        fs.writeFileSync(files.content, markdown)
        const responses = new Map()
        const requests = []
        const ui = fs.readFileSync(path.join(__dirname, '../.frontmatter/ui/news-id.mjs'), 'utf8')
        const server = http.createServer(async (request, response) => {
            response.setHeader('Content-Type', 'text/html; charset=utf-8')
            if (request.url === '/') {
                response.end(`<pre id="result">pending</pre><iframe src="/dashboard"></iframe><script>
                    window.__vscode_post_message__ = (channel, data) => {
                        fetch('/command', { method: 'POST', body: JSON.stringify(data.message) });
                    };
                    window.addEventListener('message', event => {
                        if (event.data?.testResult) document.querySelector('#result').textContent = JSON.stringify(event.data);
                    });
                </script>`)
            } else if (request.url === '/dashboard') {
                response.end(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'">
                    <script>const shell = window.parent; window.reportResult = value => shell.postMessage(value, '*'); window.parent = window;</script>
                    <section><li class="sortable_item" data-test="0-0"></li><div><form>
                    ${Object.entries(baseline).map(([name, value]) => `<input name="${name}" value="${value}" ${name === 'content' ? 'readonly data-news-source="news-2026-27"' : ''}>`).join('')}
                    <input type="submit" value="Update"></form></div></section>
                    <script type="module">
                        import '/ui/news-id.mjs';
                        const form = document.querySelector('form');
                        window.dispatchEvent(new MessageEvent('message', { data: {
                            command: 'dataFileEntries', payload: { file: '[[workspace]]/src/data/news-2026-27.yml', entries: [${JSON.stringify(baseline)}] }
                        }}));
                        let savedId;
                        window.addEventListener('message', event => {
                            if (event.data?.command === 'dataFileEntries') savedId = event.data.payload.entries[0].content;
                        });
                        new MutationObserver(() => {
                            const status = document.querySelector('[data-news-status]')?.textContent || '';
                            if (status.startsWith('Mentve:')) window.reportResult({ testResult: true, savedId, editable: !form.elements.content.readOnly });
                        }).observe(document, { childList: true, subtree: true });
                        form.elements.content.value = 'news42';
                        form.elements.content.dispatchEvent(new Event('input', { bubbles: true }));
                        form.requestSubmit();
                    </script>`)
            } else if (request.url === '/ui/news-id.mjs') {
                response.setHeader('Content-Type', 'text/javascript')
                response.end(ui)
            } else if (request.url === '/command') {
                let body = ''
                for await (const chunk of request) body += chunk
                const message = JSON.parse(body)
                const args = message.payload.args
                requests.push(args)
                let result
                try { result = { ok: true, ...saveNews(root, config, args) } }
                catch (error) { result = { ok: false, message: error.message } }
                responses.set(args.requestId, result)
                response.end('{}')
            } else {
                const id = request.url.match(/^\/runtime\/news-([a-f0-9-]+)\.json/)
                response.setHeader('Content-Type', 'application/json')
                response.statusCode = id && responses.has(id[1]) ? 200 : 404
                response.end(JSON.stringify(id ? responses.get(id[1]) : null))
            }
        })
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
        let child
        t.after(async () => {
            if (child && child.exitCode === null) {
                child.kill()
                await new Promise(resolve => child.once('close', resolve))
            }
            server.closeAllConnections()
            await new Promise(resolve => server.close(resolve))
            // This directory was freshly created for this test only.
            assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
            fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
        })
        let output = '', errors = ''
        child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
            `--user-data-dir=${path.join(root, 'browser')}`, '--virtual-time-budget=5000', '--dump-dom',
            `http://127.0.0.1:${server.address().port}/`], { windowsHide: true })
        child.stdout.on('data', chunk => output += chunk)
        child.stderr.on('data', chunk => errors += chunk)
        await new Promise((resolve, reject) => {
            child.once('error', reject)
            child.once('close', resolve)
        })
        assert.match(output, /"testResult":true,"savedId":"news42","editable":true/, errors.slice(-1200))
        assert.equal(requests.length, 1)
        assert.equal(requests[0].baseline.content, originalId)
        assert.equal(yaml.load(fs.readFileSync(files.data, 'utf8'))[0].content, 'news42')
        assert.equal(fs.readFileSync(files.content, 'utf8'), markdown.replace(textId, 'news42'))
    })
}
