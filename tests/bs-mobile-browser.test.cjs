const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')


const browser = process.env.PDF_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
// UA checks exercise routing in Chromium, not the actual Samsung or Safari engines.
for (const profile of ['megosztott/szmsz', 'orarend']) {
    test(`BS mobile page: ${profile}`, { skip: !fs.existsSync(browser), timeout: 45000 }, async t => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-browser-'))
        let child, finish
        const result = new Promise(resolve => { finish = resolve })
        const server = http.createServer(async (req, res) => {
            if (req.url === '/result') {
                let body = ''
                for await (const chunk of req) body += chunk
                finish(JSON.parse(body)); res.end('ok'); return
            }
            if (req.url === '/') {
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                // Test the generated page and local assets; unrelated third-party resources are blocked.
                res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'")
                const html = fs.readFileSync(path.join('dist', profile + '.html'), 'utf8')
                res.end(html.replace('</body>', `<script>
                (async () => {
                    let stage='init';
                    const wait=async fn=>{for(let i=0;i<600;i++){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('timeout '+stage)};
                    try {
                        await wait(()=>window.jQuery && window.jQuery('[data-responsive-toggle]').data('zfPlugin'));
                        await new Promise(r=>setTimeout(r,1200));
                        const menu=document.querySelector('#example-animated-menu');
                        if(getComputedStyle(menu).display!=='none') throw Error('mobile menu initially open');
                        const sidebar=document.querySelector('main .accordion-menu').parentElement;
                        if(getComputedStyle(sidebar).display!=='none') throw Error('duplicate desktop menu visible');
                        const button=document.querySelector('#menuicon');
                        button.click(); stage='menu opening'; await wait(()=>getComputedStyle(menu).display!=='none');
                        await new Promise(r=>setTimeout(r,500));
                        button.click(); stage='menu closing'; await wait(()=>getComputedStyle(menu).display==='none');
                        stage='PDF rendering';
                        const root=document.querySelector('.pdf-reader');
                        await wait(()=>root.querySelector('canvas')?.getAttribute('aria-label') && !root.querySelector('.pdf-status').textContent);
                        const canvas=root.querySelector('canvas');
                        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
                        if(!pixels.some((v,i)=>i%4!==3&&v<200)) throw Error('blank PDF');
                        const main=document.querySelector('main');
                        const rect=root.getBoundingClientRect();
                        if(rect.top>=main.getBoundingClientRect().bottom) throw Error('PDF below visible main area');
                        fetch('/result',{method:'POST',body:JSON.stringify({ok:true})});
                    }catch(e){fetch('/result',{method:'POST',body:JSON.stringify({error:e.message})})}
                })();</script></body>`))
                return
            }
            const file = path.join(process.cwd(), 'dist', decodeURIComponent(req.url.split('?')[0]))
            if (!file.startsWith(path.join(process.cwd(), 'dist') + path.sep) || !fs.existsSync(file)) { res.statusCode=404;res.end();return }
            res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/pdf')
            fs.createReadStream(file).pipe(res)
        })
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
        t.after(async () => {
            if(child && child.exitCode===null){child.kill();await new Promise(resolve=>child.once('close',resolve))}
            server.closeAllConnections()
            await new Promise(resolve=>server.close(resolve))
            assert.equal(path.dirname(temp), path.resolve(os.tmpdir()))
            fs.rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100})
        })
        child = spawn(browser,['--headless','--disable-gpu','--no-first-run',`--user-data-dir=${temp}`,
            '--window-size=390,844', '--user-agent=Mozilla/5.0 Android Chrome',
            `http://127.0.0.1:${server.address().port}/`],{windowsHide:true,stdio:'ignore'})
        child.on('error',error=>finish({error:error.message}))
        assert.deepEqual(await result,{ok:true})
    })
}
