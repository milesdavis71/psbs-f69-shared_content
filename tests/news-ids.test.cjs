const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { spawn } = require('node:child_process')
const test = require('node:test')
const yaml = require('js-yaml')
const { finalizePendingNews, nextNewsId, saveNews, sourcePaths } = require('../.frontmatter/lib/news-store.cjs')

function fixture(t) {
    const temporaryRoot = path.resolve(os.tmpdir())
    const root = fs.mkdtempSync(path.join(temporaryRoot, 'news-id-test-'))
    const config = {
        'frontMatter.content.publicFolder': 'src/assets/img/hirfolyam',
        'frontMatter.data.files': [{ id: 'news-2026-27', file: '[[workspace]]/src/data/news-2026-27.yml' }],
    }
    const sourceId = 'news-2026-27'
    const files = sourcePaths(root, config, sourceId)
    fs.mkdirSync(path.dirname(files.data), { recursive: true })
    fs.mkdirSync(path.dirname(files.content), { recursive: true })
    fs.writeFileSync(files.data, '[]\n')
    fs.writeFileSync(files.content, '{{#ifequal hir "news07"}}\r\nSzöveg\r\n{{/ifequal}}\r\n')
    t.after(() => {
        assert.equal(path.dirname(path.resolve(root)), temporaryRoot)
        fs.rmSync(root, { recursive: true, force: true })
    })
    const model = { title: 'Új hír', site: 'bs', img: 'nincs', align: 'center', imgclass: 'medium-3', contentclass: 'medium-9', content: '' }
    return { root, config, sourceId, files, model, read: () => yaml.load(fs.readFileSync(files.data, 'utf8')) }
}

test('IDs use the maximum across both schools and Markdown, with canonical padding', () => {
    assert.equal(nextNewsId([], ''), 'news01')
    assert.equal(nextNewsId([{ site: 'ps', content: 'news07' }, { site: 'bs', content: 'news007' }], ''), 'news08')
    assert.equal(nextNewsId([{ content: 'news99' }], ''), 'news100')
    assert.equal(nextNewsId([{ content: 'news100' }], '{{#ifequal hir \'news123\'}}'), 'news124')
    assert.throws(() => nextNewsId([{ content: 'news99999999999999999' }], ''), /túl nagy/)
})

test('successive saves allocate new IDs and create matching content blocks', t => {
    const f = fixture(t)
    const request = { sourceId: f.sourceId, model: f.model }
    assert.equal(saveNews(f.root, f.config, request).id, 'news08')
    assert.equal(saveNews(f.root, f.config, request).id, 'news09')
    assert.deepEqual(f.read().map(item => item.content), ['news09', 'news08'])
    const text = fs.readFileSync(f.files.content, 'utf8')
    for (const id of ['news07', 'news08', 'news09']) {
        assert.equal(text.split(`{{#ifequal hir "${id}"}}`).length, 2)
    }
    assert.ok(text.includes('\r\n<!-- Ide írd'))
    // Removing an entry must not reuse the number reserved by its text block.
    fs.writeFileSync(f.files.data, yaml.dump(f.read().slice(1)))
    assert.equal(saveNews(f.root, f.config, request).id, 'news10')
})

test('editing preserves the ID, legacy fields and Markdown; stale edits are rejected', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news07', id: 'legacy-id', school: 'Tagiskola' }
    fs.writeFileSync(f.files.data, yaml.dump([baseline]))
    const oldText = fs.readFileSync(f.files.content, 'utf8')
    const request = { sourceId: f.sourceId, model: { ...f.model, content: 'news07', title: 'Javított cím' }, baseline }
    const result = saveNews(f.root, f.config, request)
    assert.equal(result.id, 'news07')
    assert.equal(result.created, false)
    assert.equal(result.entries[0].id, 'legacy-id')
    assert.equal(result.entries[0].school, 'Tagiskola')
    assert.equal(fs.readFileSync(f.files.content, 'utf8'), oldText)
    assert.throws(() => saveNews(f.root, f.config, request), /közben módosították/)
    assert.equal(f.read()[0].title, 'Javított cím')
    const renamed = saveNews(f.root, f.config, { ...request, baseline: result.entries[0], model: { ...request.model, content: ' news08 ' } })
    assert.equal(renamed.id, 'news08')
    assert.equal(renamed.created, false)
    assert.equal(renamed.entries.length, 1)
    assert.equal(renamed.entries[0].id, 'legacy-id')
    assert.equal(fs.readFileSync(f.files.content, 'utf8'), oldText.replace('news07', 'news08'))
})

test('renaming preserves list order and only changes the matching block header', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news07' }
    const entries = [{ ...f.model, content: 'news09' }, baseline]
    const markdown = "{{#ifequal hir 'news09'}}\r\nMásik hír\r\n{{/ifequal}}\r\n{{#ifequal  hir 'news07' }}\r\nSzöveg news07 hivatkozással\r\n{{/ifequal}}\r\n"
    fs.writeFileSync(f.files.data, yaml.dump(entries))
    fs.writeFileSync(f.files.content, markdown)
    saveNews(f.root, f.config, { sourceId: f.sourceId, baseline, model: { ...baseline, content: 'news42' } })
    assert.deepEqual(f.read().map(entry => entry.content), ['news09', 'news42'])
    assert.equal(fs.readFileSync(f.files.content, 'utf8'), markdown.replace("hir 'news07'", "hir 'news42'"))
})

test('invalid, empty or occupied rename targets leave both files unchanged', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news08' }
    fs.writeFileSync(f.files.data, yaml.dump([baseline, { ...f.model, content: 'news09' }]))
    fs.appendFileSync(f.files.content, '{{#ifequal hir "news08"}}Szöveg{{/ifequal}}')
    const before = [f.files.data, f.files.content].map(file => fs.readFileSync(file, 'utf8'))
    for (const content of ['news07', 'news09', '', '  ', 'invalid']) {
        assert.throws(() => saveNews(f.root, f.config, { sourceId: f.sourceId, baseline, model: { ...baseline, content } }))
        assert.deepEqual([f.files.data, f.files.content].map(file => fs.readFileSync(file, 'utf8')), before)
    }
})

test('missing or duplicate original blocks prevent a rename', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news08' }
    fs.writeFileSync(f.files.data, yaml.dump([baseline]))
    const block = '{{#ifequal hir "news08"}}Szöveg{{/ifequal}}\n'
    for (const markdown of ['', block + block]) {
        fs.writeFileSync(f.files.content, markdown)
        assert.throws(() => saveNews(f.root, f.config, { sourceId: f.sourceId, baseline, model: { ...baseline, content: 'news42' } }), /szövegblokkja/)
        assert.equal(f.read()[0].content, 'news08')
        assert.equal(fs.readFileSync(f.files.content, 'utf8'), markdown)
    }
})

test('a broken content reference can reconnect to one unclaimed existing block', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news14' }
    fs.writeFileSync(f.files.data, yaml.dump([baseline]))
    const markdown = '{{#ifequal hir "news13"}}\r\nA hír meglévő szövege\r\n{{/ifequal}}\r\n'
    fs.writeFileSync(f.files.content, markdown)
    const result = saveNews(f.root, f.config, { sourceId: f.sourceId, baseline, model: { ...baseline, content: 'news13' } })
    assert.equal(result.id, 'news13')
    assert.equal(result.created, false)
    assert.equal(f.read().length, 1)
    assert.equal(f.read()[0].content, 'news13')
    assert.equal(fs.readFileSync(f.files.content, 'utf8'), markdown)
})

test('reconnecting refuses duplicate target blocks or a block used by another news item', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news14' }
    const block = '{{#ifequal hir "news13"}}Szöveg{{/ifequal}}\n'
    for (const [entries, markdown] of [
        [[baseline], block + block],
        [[baseline, { ...f.model, content: 'news13' }], block],
    ]) {
        fs.writeFileSync(f.files.data, yaml.dump(entries))
        fs.writeFileSync(f.files.content, markdown)
        assert.throws(() => saveNews(f.root, f.config, { sourceId: f.sourceId, baseline, model: { ...baseline, content: 'news13' } }))
        assert.deepEqual(f.read(), entries)
        assert.equal(fs.readFileSync(f.files.content, 'utf8'), markdown)
    }
})

test('a failed rename rolls back the original Markdown block', t => {
    const f = fixture(t)
    const baseline = { ...f.model, content: 'news07' }
    fs.writeFileSync(f.files.data, yaml.dump([baseline]))
    const original = fs.readFileSync(f.files.content, 'utf8')
    assert.throws(() => saveNews(f.root, f.config, { sourceId: f.sourceId, baseline, model: { ...baseline, content: 'news42' } }, {
        writeFile(file, text) {
            if (file === f.files.data) throw new Error('disk failure')
            fs.writeFileSync(file, text)
        },
    }), /disk failure/)
    assert.equal(f.read()[0].content, 'news07')
    assert.equal(fs.readFileSync(f.files.content, 'utf8'), original)
})

test('manual IDs create matching blocks and advance subsequent automatic allocation', t => {
    const f = fixture(t)
    const request = { sourceId: f.sourceId, model: { ...f.model, content: ' news42 ' } }
    const result = saveNews(f.root, f.config, request)
    assert.equal(result.id, 'news42')
    assert.equal(result.created, true)
    assert.equal(f.read()[0].content, 'news42')
    assert.ok(fs.readFileSync(f.files.content, 'utf8').includes('{{#ifequal hir "news42"}}'))
    assert.equal(saveNews(f.root, f.config, { ...request, model: { ...f.model, content: '   ' } }).id, 'news43')
    // A free ID below the maximum can also be chosen explicitly.
    assert.equal(saveNews(f.root, f.config, { ...request, model: { ...f.model, content: 'news03' } }).id, 'news03')
})

test('manual IDs reserved by YAML or Markdown are rejected without changing files', t => {
    const f = fixture(t)
    fs.writeFileSync(f.files.data, yaml.dump([{ ...f.model, content: 'news08' }]))
    const before = [f.files.data, f.files.content].map(file => fs.readFileSync(file, 'utf8'))
    for (const content of ['news07', 'news08']) {
        assert.throws(() => saveNews(f.root, f.config, {
            sourceId: f.sourceId, model: { ...f.model, content },
        }), /már foglalt/)
        assert.deepEqual([f.files.data, f.files.content].map(file => fs.readFileSync(file, 'utf8')), before)
    }
})

test('invalid manual IDs and invalid forms do not write files', t => {
    const f = fixture(t)
    const request = { sourceId: f.sourceId, model: { ...f.model, content: 'news07' } }
    for (const content of ['other42', 'news', 'news-1', 'news42"', 'news99999999999999999']) {
        assert.throws(() => saveNews(f.root, f.config, { ...request, model: { ...f.model, content } }), /érvényes sorszám/)
    }
    for (const changes of [{ title: '' }, { site: 'other' }, { img: '../picture.jpg' }, { img: 'missing.jpg' }, { align: 'other' }]) {
        assert.throws(() => saveNews(f.root, f.config, { ...request, model: { ...f.model, ...changes } }))
    }
    assert.deepEqual(f.read(), [])
    assert.throws(() => saveNews(f.root, f.config, { ...request, sourceId: '../other' }), /nincs engedélyezve/)
})

test('dirty documents and an active lock block writes without consuming an ID', t => {
    const f = fixture(t)
    const request = { sourceId: f.sourceId, model: f.model }
    assert.throws(() => saveNews(f.root, f.config, request, { assertClean() { throw new Error('unsaved') } }), /unsaved/)
    const lock = path.join(f.files.runtime, `${f.sourceId}.lock`)
    assert.equal(fs.existsSync(lock), false)
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }))
    assert.throws(() => saveNews(f.root, f.config, request), /folyamatban/)
    fs.unlinkSync(lock)
    assert.equal(saveNews(f.root, f.config, request).id, 'news08')
})

test('a failed YAML write rolls back the new text block and releases the lock', t => {
    const f = fixture(t)
    const original = fs.readFileSync(f.files.content, 'utf8')
    assert.throws(() => saveNews(f.root, f.config, { sourceId: f.sourceId, model: f.model }, {
        writeFile(file, text) {
            if (file === f.files.data) throw new Error('disk failure')
            fs.writeFileSync(file, text)
        },
    }), /disk failure/)
    assert.equal(fs.readFileSync(f.files.content, 'utf8'), original)
    assert.deepEqual(f.read(), [])
    assert.equal(saveNews(f.root, f.config, { sourceId: f.sourceId, model: f.model }).id, 'news08')
})

test('two independent writers cannot allocate the same ID', async t => {
    const f = fixture(t)
    const store = path.resolve(__dirname, '../.frontmatter/lib/news-store.cjs')
    const worker = `
        const {saveNews} = require(process.argv[1]);
        const input = JSON.parse(process.argv[2]);
        (async () => {
            for (let attempt=0; attempt<50; attempt++) {
                try {
                    const result=saveNews(input.root,input.config,{sourceId:input.sourceId,model:input.model});
                    console.log(result.id); return;
                } catch (error) {
                    if (!error.message.includes('folyamatban')) throw error;
                    await new Promise(resolve=>setTimeout(resolve,20));
                }
            }
            throw new Error('lock timeout');
        })().catch(error=>{console.error(error);process.exitCode=1});`
    const run = () => new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['-e', worker, store, JSON.stringify(f)], { windowsHide: true })
        let output = '', errors = ''
        child.stdout.on('data', data => output += data)
        child.stderr.on('data', data => errors += data)
        child.on('error', reject)
        child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors)))
    })
    assert.deepEqual((await Promise.all([run(), run()])).sort(), ['news08', 'news09'])
    assert.equal(f.read().length, 2)
})

test('VS Code command registration is refresh-safe and requests are idempotent', async t => {
    const f = fixture(t)
    const handlers = new Map()
    const vscode = {
        commands: { registerCommand(name, handler) {
            assert.equal(handlers.has(name), false)
            handlers.set(name, handler)
            return { dispose() {} }
        } },
        workspace: { isTrusted: true, textDocuments: [] },
    }
    const { registerNewsCommands } = require('../.frontmatter/lib/news-commands.cjs')
    registerNewsCommands(vscode, f.root, f.config)
    registerNewsCommands(vscode, f.root, f.config)
    const request = { requestId: randomUUID(), sourceId: f.sourceId, model: f.model }
    await handlers.get('psbs.news.save')(request)
    await handlers.get('psbs.news.save')(request)
    assert.equal(f.read().length, 1)
    const response = JSON.parse(fs.readFileSync(path.join(f.files.runtime, `news-${request.requestId}.json`), 'utf8'))
    assert.equal(response.ok, true)
    assert.equal(response.id, 'news08')
    const dirtyPath = process.platform === 'win32' ? f.files.content.toUpperCase() : f.files.content
    vscode.workspace.textDocuments = [{ isDirty: true, uri: { fsPath: dirtyPath } }]
    request.requestId = randomUUID()
    await handlers.get('psbs.news.save')(request)
    const rejected = JSON.parse(fs.readFileSync(path.join(f.files.runtime, `news-${request.requestId}.json`), 'utf8'))
    assert.equal(rejected.ok, false)
    assert.match(rejected.message, /Előbb mentsd/)
    assert.equal(f.read().length, 1)
})

test('untouched select fields fall back to the schema defaults', t => {
    const f = fixture(t)
    f.config['frontMatter.data.files'][0].schema = {
        properties: {
            site: { default: 'common' },
            img: { default: 'nincs' },
            align: { default: 'left' },
            imgclass: { default: 'medium-4' },
            contentclass: { default: 'medium-8' },
        },
    }
    const request = {
        sourceId: f.sourceId,
        model: { title: 'Kijelölés nélküli mentés', site: '', img: '', align: '', imgclass: '', contentclass: '', content: '' },
    }
    const result = saveNews(f.root, f.config, request)
    assert.equal(result.id, 'news08')
    assert.deepEqual(f.read()[0], {
        title: 'Kijelölés nélküli mentés',
        site: 'common',
        img: 'nincs',
        align: 'left',
        imgclass: 'medium-4',
        contentclass: 'medium-8',
        content: 'news08',
    })
})

test('dashboard-saved entries are finalized with an id, top position and text block', t => {
    const f = fixture(t)
    const existing = { site: 'ps', title: 'Meglévő', img: 'nincs', align: 'center', imgclass: 'medium-3', contentclass: 'medium-9', content: 'news07' }
    const first = { site: "bs", title: "Első dashboard hír", img: "nincs", align: "center", imgclass: "medium-3", contentclass: "medium-9", content: "" }
    const second = { site: "bs", title: "Második dashboard hír", img: "nincs", align: "center", imgclass: "medium-3", contentclass: "medium-9", content: "" }
    fs.writeFileSync(f.files.data, yaml.dump([existing, first, second]))

    const created = finalizePendingNews(f.root, f.config)
    assert.deepEqual(created, [
        { sourceId: f.sourceId, id: "news08" },
        { sourceId: f.sourceId, id: "news09" },
    ])
    const entries = f.read()
    assert.deepEqual(entries.map((e) => e.content), ["news09", "news08", "news07"])
    assert.equal(entries[0].title, "Második dashboard hír")
    const text = fs.readFileSync(f.files.content, "utf8")
    assert.equal(text.split('{{#ifequal hir "news08"}}').length, 2)
    assert.equal(text.split('{{#ifequal hir "news09"}}').length, 2)
    // Idempotent: nothing left to finalize.
    assert.deepEqual(finalizePendingNews(f.root, f.config), [])
    assert.deepEqual(f.read().map((e) => e.content), ["news09", "news08", "news07"])
})

test('a manual Data list order survives new saves', t => {
    const f = fixture(t)
    const manual = [
        { site: "ps", title: "Harmadik", img: "nincs", align: "center", imgclass: "medium-3", contentclass: "medium-9", content: "news07" },
        { site: "ps", title: "Első", img: "nincs", align: "center", imgclass: "medium-3", contentclass: "medium-9", content: "news05" },
        { site: "ps", title: "Második", img: "nincs", align: "center", imgclass: "medium-3", contentclass: "medium-9", content: "news06" },
    ]
    fs.writeFileSync(f.files.data, yaml.dump(manual))
    const result = saveNews(f.root, f.config, { sourceId: f.sourceId, model: f.model })
    assert.equal(result.id, "news08")
    assert.deepEqual(f.read().map((e) => e.content), ["news08", "news07", "news05", "news06"])
    // The watcher must not re-sort a manually ordered list.
    assert.deepEqual(finalizePendingNews(f.root, f.config), [])
    assert.deepEqual(f.read().map((e) => e.content), ["news08", "news07", "news05", "news06"])
    const baseline = f.read()[2]
    saveNews(f.root, f.config, {
        sourceId: f.sourceId, baseline,
        model: { ...baseline, title: 'Edited in place' },
    })
    assert.deepEqual(f.read().map(e => e.content), ["news08", "news07", "news05", "news06"])
    // Native dashboard fallback appends an unnumbered entry before finalization.
    fs.writeFileSync(f.files.data, yaml.dump([...f.read(), f.model]))
    finalizePendingNews(f.root, f.config)
    assert.deepEqual(f.read().map(e => e.content), ["news09", "news08", "news07", "news05", "news06"])
})
