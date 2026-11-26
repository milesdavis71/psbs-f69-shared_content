const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')
const handlebars = require('handlebars')

const browser = process.env.PDF_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const partial = handlebars.compile(fs.readFileSync('src/partials/pdf-viewer.html', 'utf8'))
// UA checks exercise routing in Chromium, not the actual Samsung or Safari engines.
for (const profile of ['Android Chrome', 'Android SamsungBrowser', 'iPhone Safari', 'desktop', 'Android missing PDF']) {
    test(`PDF rendering: ${profile}`, { skip: !fs.existsSync(browser), timeout: 45000 }, async t => {
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
                res.end(`<meta name="viewport" content="width=device-width,initial-scale=1">
                    <style>body{margin:0;width:375px}*{box-sizing:border-box}</style>
                    ${partial({ pdfUrl: profile === 'Android missing PDF' ? '/missing.pdf' : '/assets/pdf/common/bemutatkozas/hazirend-2026.pdf', fitWidth: true })}
                    <script>
                    (async function () {
                        let stage = 'load'; const wait = async fn => { for(let i=0;i<600;i++){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('timeout: '+stage) };
                        try {
                            const root = document.querySelector('.pdf-reader');
                            const click = async action => { stage = action; const button=root.querySelector('[data-action='+action+']'); await wait(()=>!button.disabled); button.click(); };
                            if (${JSON.stringify(profile)} === 'Android missing PDF') {
                                await wait(()=>root.querySelector('.pdf-status').textContent.includes('nem jeleníthető'));
                                if(!root.querySelector('a[href="/missing.pdf"]')) throw Error('missing fallback link');
                            } else if (${JSON.stringify(profile)} === 'desktop') {
                                await wait(()=>root.querySelector('embed'));
                                if(!root.querySelector('embed').src.endsWith('#zoom=page-width')) throw Error('desktop zoom');
                            } else {
                                const status = root.querySelector('.pdf-status');
                                const canvas = root.querySelector('canvas') || await (async()=>{await wait(()=>root.querySelector('canvas'));return root.querySelector('canvas')})();
                                await wait(()=>canvas.getAttribute('aria-label') && !status.textContent);
                                const initial = canvas.style.width;
                                const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
                                if(!pixels.some((v,i)=>i%4!==3 && v<200)) throw Error('blank PDF');
                                await click('next');
                                await wait(()=>canvas.getAttribute('aria-label')==='PDF 2. oldal' && !status.textContent);
                                await click('in');
                                await wait(()=>parseFloat(canvas.style.width)>parseFloat(initial) && !status.textContent);
                                await click('out');
                                await wait(()=>canvas.style.width===initial && !status.textContent);
                                stage='resize'; document.body.style.width='600px';
                                await wait(()=>parseFloat(canvas.style.width)>parseFloat(initial) && !status.textContent);
                                await click('prev');
                                await wait(()=>canvas.getAttribute('aria-label')==='PDF 1. oldal' && !status.textContent);
                                if(canvas.width*canvas.height>4000000) throw Error('canvas memory limit');
                            }
                            fetch('/result',{method:'POST',body:JSON.stringify({ok:true})});
                        } catch(e) { fetch('/result',{method:'POST',body:JSON.stringify({error:e.message})}); }
                    })();</script>`)
                return
            }
            const file = path.join(process.cwd(), 'dist', decodeURIComponent(req.url))
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
            ...(profile==='desktop'?[]:[`--user-agent=Mozilla/5.0 ${profile}`]),
            `http://127.0.0.1:${server.address().port}/`],{windowsHide:true,stdio:'ignore'})
        child.on('error',error=>finish({error:error.message}))
        assert.deepEqual(await result,{ok:true})
    })
}
