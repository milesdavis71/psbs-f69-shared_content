const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { JSDOM } = require('jsdom')

const source = fs.readFileSync(path.join(__dirname, '../.frontmatter/ui/gallery-form.mjs'), 'utf8')
    .replace('import.meta.url', JSON.stringify('https://example.test/.frontmatter/ui/gallery-form.mjs'))
const records = [
    { school: 'ps', year: '2026-27', title: 'Azonos cím' },
    { school: 'bs', year: '2026-27', title: 'Azonos cím' },
    { school: 'ps', year: '2025-26', title: 'Azonos cím' },
    { folder: 'bs/2025-26/esemeny', title: 'Régi esemény' },
]

function setup(t) {
    // Front Matter 10.13 DataView / SortableItem DOM: full rows include actions.
    const dom = new JSDOM(`<ul><li class="sortable_item" data-test="null-0">Más lista</li></ul>
        <section><div><ul id="events"></ul><button id="add">Add</button></div>
        <div><div class="autoform"><form>
        <select name="school"><option>ps</option><option>bs</option></select>
        <input name="year"><input name="title"><input name="slug"><input name="date">
        <select name="folder" placeholder="gallery-events"><option value=""></option></select>
        </form></div></div></section>`, { runScripts: 'outside-only' })
    t.after(() => dom.window.close())
    const { window } = dom
    const { document } = window
    window.structuredClone = structuredClone
    window.Date = class extends Date {
        constructor(...args) { super(...(args.length ? args : ['2026-11-09T12:00:00Z'])) }
    }
    const timers = new Map()
    let timerId = 0
    window.setTimeout = callback => { timers.set(++timerId, callback); return timerId }
    window.clearTimeout = id => timers.delete(id)
    window.eval(source)

    function receive(entries) {
        document.getElementById('events').innerHTML = entries.map((entry, index) =>
            `<li class="sortable_item" data-test="null-${index}"><div><span>${entry.title}</span></div>
            <div><button>Edit</button><button>Delete</button></div></li>`).join('')
        window.dispatchEvent(new window.MessageEvent('message', {
            data: { command: 'dataFileEntries', payload: entries },
        }))
    }
    async function settle() {
        for (let attempt = 0; attempt < 8; attempt++) {
            await Promise.resolve()
            if (!timers.size) return
            const callbacks = [...timers.values()]
            timers.clear()
            callbacks.forEach(callback => callback())
        }
        assert.fail('The form keeps scheduling updates without a user change')
    }
    function change(selector, value) {
        const select = document.querySelector(selector)
        select.value = value
        select.dispatchEvent(new window.Event('change', { bubbles: true }))
    }
    const rows = () => Array.from(document.querySelectorAll('#events > li'))
    const visible = () => rows().flatMap((row, index) => row.style.display !== 'none' ? [index] : [])
    receive(records)
    return { document, receive, settle, change, rows, visible }
}

test('gallery rows follow school and year together, including duplicate titles', async t => {
    const ui = setup(t)
    await ui.settle()
    assert.equal(ui.document.querySelector('[data-gallery-year]').value, '2026-27')
    assert.deepEqual(ui.visible(), [0])
    ui.change('[data-gallery-school]', 'bs')
    assert.deepEqual(ui.visible(), [1])
    await ui.settle()
    ui.change('[data-gallery-year]', '2025-26')
    assert.deepEqual(ui.visible(), [3])
    ui.change('[data-gallery-school]', 'ps')
    assert.deepEqual(ui.visible(), [2])
    await ui.settle()
    assert.equal(ui.rows()[0].style.display, 'none')
    assert.equal(ui.document.querySelector('body > ul > li').style.display, '')
    assert.equal(ui.document.getElementById('add').style.display, '')
    assert.equal(ui.document.querySelector('form').style.display, '')
})

test('save, deletion and reordering refresh the row mapping without changing the data array', async t => {
    const ui = setup(t)
    await ui.settle()
    const updated = [records[1], records[2], { school: 'ps', year: '2026-27', title: 'Új cím' }]
    const before = structuredClone(updated)
    ui.receive(updated)
    await ui.settle()
    assert.deepEqual(ui.visible(), [2])
    assert.deepEqual(updated, before)
    const rows = ui.rows()
    rows[0].setAttribute('data-test', '2-2')
    rows[2].setAttribute('data-test', '2-0')
    await ui.settle()
    assert.deepEqual(ui.visible(), [0])
})

test('a school with no events in the selected year keeps that year and shows an empty list', async t => {
    const ui = setup(t)
    ui.receive([records[0], records[3]])
    await ui.settle()
    ui.change('[data-gallery-school]', 'bs')
    await ui.settle()
    assert.equal(ui.document.querySelector('[data-gallery-year]').value, '2026-27')
    assert.deepEqual(ui.visible(), [])
    ui.change('[data-gallery-year]', '2025-26')
    await ui.settle()
    assert.deepEqual(ui.visible(), [1])
})
