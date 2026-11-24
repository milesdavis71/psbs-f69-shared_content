const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const filterNews = require('../src/helpers/filterNews')
const composeConfig = require('../frontmatter.config.cjs')

const projectRoot = path.resolve(__dirname, '..')
const baseConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'frontmatter.json'), 'utf8')
)
const config = composeConfig(baseConfig)

test('image choices follow uploads and removals without modifying the base config', (t) => {
    const folder = fs.mkdtempSync(
        path.join(os.tmpdir(), 'frontmatter-media-test-')
    )
    const firstImage = path.join(folder, 'régi kép.JPG')
    const newImage = path.join(folder, 'új-kép.png')
    const video = path.join(folder, 'video.mp4')
    const subfolder = path.join(folder, 'album.jpg')
    t.after(() => {
        for (const file of [firstImage, newImage, video]) {
            if (fs.existsSync(file)) fs.unlinkSync(file)
        }
        fs.rmdirSync(subfolder)
        fs.rmdirSync(folder)
    })
    fs.writeFileSync(firstImage, '')
    fs.writeFileSync(video, '')
    fs.mkdirSync(subfolder)
    fs.utimesSync(firstImage, new Date(0), new Date(0))
    const unrelatedFile = {
        id: 'authors',
        schema: { type: 'object', properties: { img: { type: 'string' } } },
    }
    const input = {
        ...baseConfig,
        'frontMatter.content.publicFolder': folder,
        'frontMatter.data.files': [
            ...baseConfig['frontMatter.data.files'],
            unrelatedFile,
        ],
    }
    const before = structuredClone(input)
    const choices = () =>
        composeConfig(input)['frontMatter.data.files'][0].schema.properties.img
            .enum

    assert.deepEqual(choices(), ['nincs', 'régi kép.JPG'])
    fs.writeFileSync(newImage, '')
    assert.deepEqual(choices(), ['nincs', 'új-kép.png', 'régi kép.JPG'])
    fs.unlinkSync(firstImage)
    assert.deepEqual(choices(), ['nincs', 'új-kép.png'])
    assert.deepEqual(input, before)
    assert.deepEqual(
        composeConfig(input)['frontMatter.data.files'].at(-1),
        unrelatedFile
    )
})

function select(newsData, school, extra = {}) {
    let result
    filterNews(school, {
        data: { root: { root: '../../' } },
        hash: { newsData, ...extra },
        fn: ({ items }) => {
            result = items
            return ''
        },
    })
    return result
}

test('Data form records reach the selected school, in list order', () => {
    const entries = yaml.load(
        yaml.dump([
            { site: 'bs', title: 'Bálint', content: 'news03' },
            { site: 'common', title: 'Közös', content: 'news02' },
            { site: 'ps', title: 'Petőfi', content: 'news01' },
        ])
    )
    assert.deepEqual(
        select(entries, 'ps').map((item) => item.content),
        ['news02', 'news01']
    )
    assert.deepEqual(
        select(entries, 'bs').map((item) => item.content),
        ['news03', 'news02']
    )
    assert.ok(select(entries, 'ps').every((item) => item.root === '../../'))
})

test('explicit numeric sorting remains available to callers that request it', () => {
    const entries = [
        { site: 'common', title: 'Közös', content: 'news99' },
        { site: 'bs', title: 'Bálint', content: 'news10' },
        { site: 'ps', title: 'Petőfi', content: 'news09' },
    ]
    // This opt-in mode sorts even records appended to the data file.
    entries.push({ site: 'bs', title: 'Új Bálint hír', content: 'news100' })
    entries.push({ site: 'common', title: 'Új közös hír', content: 'news101' })
    const before = structuredClone(entries)
    const newestFirst = { newestFirst: true }

    assert.deepEqual(
        select(entries, 'bs', newestFirst).map((item) => item.content),
        ['news101', 'news100', 'news99', 'news10']
    )
    assert.deepEqual(
        select(entries, 'ps', newestFirst).map((item) => item.content),
        ['news101', 'news99', 'news09']
    )
    // An existing news item keeps its position when its title is edited.
    entries[1].title = 'Javított Bálint cím'
    assert.deepEqual(
        select(entries, 'bs', newestFirst).map((item) => item.content),
        ['news101', 'news100', 'news99', 'news10']
    )
    before[1].title = entries[1].title
    assert.deepEqual(entries, before, 'rendering must not reorder the data file')
    assert.deepEqual(
        select(entries, 'bs').map((item) => item.content),
        ['news99', 'news10', 'news100', 'news101'],
        'callers without newestFirst retain their original order'
    )
})

test('news without a sequence keep their relative order after numbered news', () => {
    const entries = [
        { site: 'ps', title: 'Azonosító nélkül' },
        { site: 'ps', content: 'news09' },
        { site: 'ps', title: 'Régi azonosító', content: 'other' },
        { site: 'ps', content: 'news10' },
    ]
    assert.deepEqual(
        select(entries, 'ps', { newestFirst: true }).map((item) => item.content),
        ['news10', 'news09', undefined, 'other']
    )
})

test('both homepage templates render the saved manual order, including after new entries and edits', () => {
    const handlebars = require('handlebars').create()
    handlebars.registerHelper('filterNews', filterNews)
    handlebars.registerHelper('mdFile', () => '')
    for (const name of ['title', 'hir-cells', 'common-ps-korabbi-hirek']) {
        handlebars.registerPartial(name, '')
    }
    const templates = Object.fromEntries(['ps', 'bs'].map(school => [
        school,
        handlebars.compile(fs.readFileSync(
            path.join(projectRoot, 'src/pages', school, 'index.html'), 'utf8'
        )),
    ]))
    const entries = [
        { site: 'common', title: 'manual-first', content: 'news02' },
        { site: 'bs', title: 'bs-second', content: 'news100' },
        { site: 'ps', title: 'ps-second', content: 'news99' },
        { site: 'common', title: 'manual-last', content: 'news01' },
    ]
    const titles = school => [...templates[school]({ 'news-2026-27': entries })
        .matchAll(/class="title-bar"[\s\S]*?>\s*([^<]+?)\s*<\/div>/g)]
        .map(match => match[1].trim())
    const check = (bs, ps) => {
        const before = structuredClone(entries)
        assert.deepEqual(titles('bs'), bs)
        assert.deepEqual(titles('ps'), ps)
        assert.deepEqual(entries, before, 'rendering preserves the saved list')
    }
    check(['manual-first', 'bs-second', 'manual-last'], ['manual-first', 'ps-second', 'manual-last'])
    entries.unshift({ site: 'common', title: 'new-first', content: 'news101' })
    check(['new-first', 'manual-first', 'bs-second', 'manual-last'], ['new-first', 'manual-first', 'ps-second', 'manual-last'])
    // A dashboard drag moves an older item above the newest one.
    entries.unshift(entries.pop())
    entries[0].title = 'edited-first'
    check(['edited-first', 'new-first', 'manual-first', 'bs-second'], ['edited-first', 'new-first', 'manual-first', 'ps-second'])
})

test('changing the school in the form takes effect even with a legacy marker', () => {
    const entries = [{ ps: null, site: 'bs', title: 'Áthelyezett hír' }]
    assert.equal(select(entries, 'ps').length, 0)
    assert.equal(select(entries, 'bs')[0].title, 'Áthelyezett hír')
    assert.deepEqual(entries, [
        { ps: null, site: 'bs', title: 'Áthelyezett hír' },
    ])
})

test('legacy archive markers, nested overrides and explicit exclusions still work', () => {
    const entries = {
        '2025-26': [
            { bs: null, school: 'Székhely', title: 'Régi Bálint hír' },
            { common: { title: 'Közös' }, ps: { title: 'Petőfi változat' } },
            { common: { title: 'Csak Bálint' }, ps: false },
        ],
    }
    assert.deepEqual(
        select(entries, 'ps').map((item) => item.title),
        ['Petőfi változat']
    )
    assert.deepEqual(
        select(entries, 'bs').map((item) => item.title),
        ['Régi Bálint hír', 'Közös', 'Csak Bálint']
    )
})

test('older news mode also accepts Data form records', () => {
    const entries = [
        {
            older: [
                { site: 'ps', title: 'Petőfi' },
                { site: 'bs', title: 'Bálint' },
                { site: 'common', title: 'Közös' },
            ],
        },
    ]
    assert.deepEqual(
        select(entries, 'ps', { older: true }).map((item) => item.title),
        ['Petőfi', 'Közös']
    )
    assert.deepEqual(
        select(entries, 'bs', { older: true }).map((item) => item.title),
        ['Bálint', 'Közös']
    )
})

test('the YAML snippet creates a root list and preserves quoted Hungarian titles', () => {
    const snippet =
        config['frontMatter.content.snippets'][
            'HIR - YAML bejegyzés (news-*.yml)'
        ]
    const fields = {
        site: 'bs',
        title: 'Hír: "Idézet" & ünnepség',
        img: 'nincs',
        imgclass: 'medium-3',
        contentclass: 'medium-9',
        content: 'news07',
    }
    const rendered = snippet.body
        .join('\n')
        .replace(/\[\[&?(\w+)\]\]/g, (_, key) => fields[key])
    const entries = yaml.load(rendered + '\n- site: ps\n  title: Meglévő hír\n')
    assert.equal(entries.length, 2)
    assert.equal(entries[0].title, fields.title)
    assert.equal(select(entries, 'bs')[0].content, 'news07')
    assert.equal(select(entries, 'ps').length, 1)
})

test('registered news files have forms and unique, matching content blocks', () => {
    for (const file of config['frontMatter.data.files'].filter((item) =>
        item.id.startsWith('news-')
    )) {
        const schema =
            file.schema ||
            config['frontMatter.data.types']?.find(
                (type) => type.id === file.type
            )?.schema
        assert.ok(schema, `${file.id}: the dashboard requires a schema`)
        assert.equal(schema.type, 'object')
        assert.ok(
            schema.properties[file.labelField],
            `${file.id}: readable list labels`
        )
        assert.equal(file.singleEntry, false)
        const entries = yaml.load(
            fs.readFileSync(
                file.file.replace('[[workspace]]', projectRoot),
                'utf8'
            )
        )
        assert.ok(Array.isArray(entries), `${file.id}: a root list is required`)
        const contentPath = path.join(
            projectRoot,
            'src/content',
            `common-news-content-${file.id.slice(5)}.md`
        )
        const source = fs.readFileSync(contentPath, 'utf8')
        const blocks = [
            ...source.matchAll(/\{\{#ifequal hir "(news\d+)"\}\}/g),
        ].map((match) => match[1])
        assert.equal(
            new Set(blocks).size,
            blocks.length,
            'unique content blocks'
        )
        assert.equal(
            new Set(entries.map((item) => item.content)).size,
            entries.length,
            'unique content IDs'
        )
        for (const item of entries) {
            assert.ok(
                schema.properties.img.enum.includes(item.img),
                `${item.content}: current image is selectable in the Data form`
            )
            assert.ok(
                schema.properties.site.enum.includes(item.site),
                `${item.content}: supported school`
            )
            assert.ok(
                blocks.includes(item.content),
                `${item.content}: matching Markdown block`
            )
            assert.ok(
                item.img === 'nincs' ||
                    fs.existsSync(
                        path.join(
                            projectRoot,
                            'src/assets/img/hirfolyam',
                            item.img
                        )
                    ),
                `${item.content}: existing image`
            )
        }
    }
})


test('the dashboard script saves through runCommand messages, not command links', () => {
    const source = fs.readFileSync(
        path.join(projectRoot, '.frontmatter/ui/news-id.mjs'),
        'utf8'
    )
    assert.match(source, /runCommand/)
    assert.match(source, /psbs\.news\.save/)
    // The VS Code API can be acquired only once: consuming it would break
    // the dashboard, so the script must never acquire it.
    assert.doesNotMatch(source, /acquireVsCodeApi/)
    assert.match(source, /__vscode_post_message__/)
    assert.doesNotMatch(source, /command:psbs\.news/)
    assert.doesNotMatch(source, /\.click\(\)/)
})

test('the auto-assigned content field cannot block the Add form', () => {
    const file = config['frontMatter.data.files'][0]
    const content = file.schema.properties.content
    assert.equal(content.pattern, undefined)
    assert.ok(!file.schema.required.includes('content'))
    assert.equal(file.schema.properties.img.default, 'nincs')
    assert.notEqual(content.uniforms.readOnly, true)
    assert.equal(content.uniforms['data-news-source'], file.id)
    assert.equal(
        content.uniforms.placeholder.match(/news-\d{4}-\d{2}/)[0],
        file.id
    )
})

test('the dashboard list keeps new entries first and respects manual order', () => {
    const source = fs.readFileSync(
        path.join(projectRoot, '.frontmatter/ui/news-id.mjs'),
        'utf8'
    )
    assert.match(source, /pendingFirst/)
    assert.match(source, /isPending/)
    // No automatic re-sorting: a manual drag & drop order must stay intact.
    assert.doesNotMatch(source, /sortNewestFirst/)
    // Reordering must be skipped while an entry is being edited.
    assert.match(source, /content\.value\.trim\(\)/)
})

function newsForm(t, { selected = 'null', content = '', bridge = true, records, wrapped = true, response } = {}) {
    const { JSDOM } = require('jsdom')
    const dom = new JSDOM(`<section><ul><li class="sortable_item" data-test="${selected}-0"></li></ul>
        <div><form><input name="content" data-news-source="news-2026-27" placeholder="news-2026-27"><input name="title" value="Új hír"></form></div>
        </section>`, { runScripts: 'outside-only' })
    const { window } = dom
    const observers = []
    const NativeObserver = window.MutationObserver
    window.MutationObserver = class extends NativeObserver {
        constructor(callback) { super(callback); observers.push(this) }
    }
    t.after(() => {
        observers.forEach(observer => observer.disconnect())
        window.close()
    })
    Object.defineProperty(window, 'crypto', { value: { randomUUID: require('node:crypto').randomUUID } })
    const form = window.document.querySelector('form')
    form.elements.content.value = content
    window.structuredClone = structuredClone
    // Keep the response poll pending; these tests inspect the dispatched save.
    window.setTimeout = response ? callback => queueMicrotask(callback) : () => 1
    if (response) window.fetch = async () => ({ ok: true, json: async () => response })
    const messages = []
    if (bridge) window.__vscode_post_message__ = (_, payload) => messages.push(payload.message)
    window.eval(fs.readFileSync(path.join(projectRoot, '.frontmatter/ui/news-id.mjs'), 'utf8')
        .replace('import.meta.url', JSON.stringify('https://example.test/.frontmatter/ui/news-id.mjs')))
    window.dispatchEvent(new window.MessageEvent('message', {
        data: { command: 'dataFileEntries', payload: wrapped
            ? { file: '[[workspace]]/src/data/news-2026-27.yml', entries: records || [{ content: 'news07', title: 'Meglévő' }] }
            : records || [{ content: 'news07', title: 'Meglévő' }] },
    }))
    function submit() {
        const event = new window.Event('submit', { bubbles: true, cancelable: true })
        form.dispatchEvent(event)
        return event
    }
    return { window, form, messages, submit }
}

test('image search filters filenames without changing the saved image or adding model fields', async t => {
    const ui = newsForm(t)
    const select = ui.window.document.createElement('select')
    select.name = 'img'
    select.innerHTML = '<option>nincs</option><option selected>régi.jpg</option><option>ÁRVÍZ.JPG</option><option>sulivaro.png</option>'
    ui.form.appendChild(select)
    await Promise.resolve()
    const input = ui.form.querySelector('input[type="search"]')
    const visible = () => Array.from(select.options).filter(option => !option.hidden).map(option => option.value)
    const search = value => {
        input.value = value
        input.dispatchEvent(new ui.window.Event('input', { bubbles: true }))
    }
    search(' arviz ')
    assert.deepEqual(visible(), ['nincs', 'régi.jpg', 'ÁRVÍZ.JPG'])
    assert.equal(select.value, 'régi.jpg')
    search('missing')
    assert.deepEqual(visible(), ['nincs', 'régi.jpg'])
    assert.match(ui.form.querySelector('[role="status"]').textContent, /Nincs találat/)
    const enter = new ui.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.dispatchEvent(enter)
    assert.equal(enter.defaultPrevented, true)
    input.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    assert.equal(input.value, '')
    assert.equal(visible().length, 4)
    search('arviz')
    select.value = 'ÁRVÍZ.JPG'
    select.dispatchEvent(new ui.window.Event('change', { bubbles: true }))
    assert.deepEqual(visible(), ['nincs', 'ÁRVÍZ.JPG'])
    ui.submit()
    assert.deepEqual(Object.keys(ui.messages[0].payload.args.model).sort(), ['content', 'img', 'title'])
    assert.equal(ui.messages[0].payload.args.model.img, 'ÁRVÍZ.JPG')
})

test('image search follows refreshed choices and remounted forms without duplicate controls', async t => {
    const ui = newsForm(t)
    ui.form.insertAdjacentHTML('beforeend', '<select name="img"><option>nincs</option><option>old.jpg</option></select>')
    await Promise.resolve()
    const input = ui.form.querySelector('input[type="search"]')
    input.value = 'new'
    input.dispatchEvent(new ui.window.Event('input', { bubbles: true }))
    ui.form.elements.img.insertAdjacentHTML('beforeend', '<option>new.jpg</option><option>other.jpg</option>')
    await Promise.resolve()
    assert.equal(ui.form.elements.img.options[2].hidden, false)
    assert.equal(ui.form.elements.img.options[3].hidden, true)
    assert.equal(ui.form.querySelectorAll('input[type="search"]').length, 1)
    ui.form.reset()
    assert.equal(input.value, '')
    assert.equal(Array.from(ui.form.elements.img.options).some(option => option.hidden), false)
    ui.form.innerHTML = '<input name="content" placeholder="news-2026-27"><select name="img"><option>nincs</option></select>'
    await Promise.resolve()
    assert.equal(ui.form.querySelectorAll('input[type="search"]').length, 1)
    assert.equal(ui.form.querySelector('input[type="search"]').value, '')
    const unrelated = ui.window.document.createElement('form')
    unrelated.innerHTML = '<select name="img"><option>other.jpg</option></select>'
    ui.window.document.body.appendChild(unrelated)
    await Promise.resolve()
    assert.equal(unrelated.querySelector('input[type="search"]'), null)
})

test('Add sends manual IDs as new records even when the ID matches an existing record', t => {
    for (const content of ['', 'news42', 'news07']) {
        const ui = newsForm(t, { content })
        assert.equal(ui.form.elements.content.readOnly, false)
        assert.equal(ui.submit().defaultPrevented, true)
        const request = ui.messages[0].payload.args
        assert.equal(request.model.content, content)
        assert.equal(request.baseline, null, 'a duplicate ID must not turn Add into Update')
    }
})

test('Update allows typing a new ID while retaining the original baseline', async t => {
    const ui = newsForm(t, { selected: '0', content: 'news07' })
    assert.equal(ui.form.elements.content.readOnly, false)
    // A stale schema must not relock the field after a React render.
    ui.form.elements.content.readOnly = true
    await Promise.resolve()
    assert.equal(ui.form.elements.content.readOnly, false)
    ui.form.elements.content.value = 'news42'
    ui.form.elements.content.dispatchEvent(new ui.window.Event('input', { bubbles: true }))
    ui.submit()
    assert.equal(ui.messages[0].payload.args.baseline.content, 'news07')
    assert.equal(ui.messages[0].payload.args.model.content, 'news42')
})

test('legacy array messages still identify the record being renamed', t => {
    const ui = newsForm(t, { selected: '0', content: 'news42', wrapped: false })
    ui.submit()
    assert.equal(ui.messages[0].payload.args.baseline.content, 'news07')
})

test('10.14 receives the renamed entries with the original file envelope', async t => {
    const response = { ok: true, id: 'news42', created: false, entries: [{ content: 'news42', title: 'Új hír' }] }
    const ui = newsForm(t, { selected: '0', content: 'news42', response })
    const received = []
    ui.window.addEventListener('message', event => received.push(event.data))
    ui.submit()
    for (let i = 0; i < 15; i++) await Promise.resolve()
    const saved = received.find(message => message.command === 'dataFileEntries')
    assert.equal(saved.payload.file, '[[workspace]]/src/data/news-2026-27.yml')
    assert.equal(saved.payload.entries[0].content, 'news42')
    assert.match(ui.window.document.querySelector('[data-news-status]').textContent, /Mentve: news42/)
    assert.equal(ui.form.closest('section').inert, false)
})

test('messages for other data files cannot replace the news edit baseline', t => {
    const ui = newsForm(t, { selected: '0', content: 'news42' })
    ui.window.dispatchEvent(new ui.window.MessageEvent('message', {
        data: { command: 'dataFileEntries', payload: { file: '[[workspace]]/src/data/gallery_events.yml', entries: [{ title: 'Galéria' }] } },
    }))
    ui.submit()
    assert.equal(ui.messages[0].payload.args.baseline.content, 'news07')
})

test('an empty list accepts a manual ID for the first news item', t => {
    const ui = newsForm(t, { content: 'news01', records: [] })
    ui.window.document.querySelector('li').remove()
    ui.submit()
    assert.equal(ui.messages[0].payload.args.baseline, null)
})

test('missing bridge blocks manual IDs but preserves the automatic fallback', t => {
    const manual = newsForm(t, { content: 'news42', bridge: false })
    assert.equal(manual.submit().defaultPrevented, true)
    assert.match(manual.window.document.querySelector('[data-news-status]').textContent, /Reload Window/)
    const automatic = newsForm(t, { bridge: false })
    assert.equal(automatic.submit().defaultPrevented, false)
    const rename = newsForm(t, { selected: '0', content: 'news42', bridge: false })
    assert.equal(rename.submit().defaultPrevented, true)
})
