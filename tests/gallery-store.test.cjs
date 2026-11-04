const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const {
    saveGallery,
    sourcePaths,
    syncGalleryPages,
} = require('../.frontmatter/lib/gallery-store.cjs')

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-store-test-'))
    const folder = 'ps/2026-27/2026_09_10_teszt_esemeny'
    const directory = path.join(root, 'src/assets/img/ps/galeriak/2026-27/2026_09_10_teszt_esemeny')
    fs.mkdirSync(path.join(directory, 'full'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'thumb'), { recursive: true })
    for (const number of ['01', '02', '03']) {
        fs.writeFileSync(path.join(directory, 'full', `${number}_full.jpg`), '')
        fs.writeFileSync(path.join(directory, 'thumb', `${number}_thumb.jpg`), '')
    }
    const config = {
        'frontMatter.data.files': [
            {
                id: 'gallery-events',
                file: '[[workspace]]/src/data/gallery_events.yml',
            },
        ],
    }
    const files = sourcePaths(root, config, 'gallery-events')
    fs.mkdirSync(path.dirname(files.data), { recursive: true })
    fs.writeFileSync(files.data, '[]\n')
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const model = {
        folder,
        school: 'ps',
        year: '2026-27',
        slug: '2026_09_10_teszt_esemeny',
        title: 'Teszt esemény',
        date: '',
        alt: '',
    }
    return { root, config, files, folder, directory, model }
}

function read(file) {
    return yaml.load(fs.readFileSync(file, 'utf8'))
}

test('a gallery save creates the registry entry, event page and main grid', (t) => {
    const f = fixture(t)
    const result = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: f.model,
    })
    assert.equal(result.created, true)
    assert.equal(result.id, '2026_09_10_teszt_esemeny')
    assert.equal(result.mainCreated, true)
    const entries = read(f.files.data)
    assert.equal(entries.length, 1)
    assert.deepEqual(entries[0], {
        folder: 'ps/2026-27/2026_09_10_teszt_esemeny',
        school: 'ps',
        year: '2026-27',
        slug: '2026_09_10_teszt_esemeny',
        title: 'Teszt esemény',
        alt: 'Teszt esemény',
        date: '2026. 09. 10.',
    })
    const page = fs.readFileSync(
        path.join(f.root, 'src/pages/ps/galeriak/2026-27/2026_09_10_teszt_esemeny.html'),
        'utf8'
    )
    assert.match(page, /layout: two_columns_ps/)
    assert.match(page, /page: galeriak_root/)
    assert.match(page, /common-galery-from-yaml/)
    const main = fs.readFileSync(path.join(f.root, 'src/pages/ps/galeriak.html'), 'utf8')
    assert.match(main, /common-gallery-index/)
})

test('re-saving the same folder updates one entry and preserves the page body', (t) => {
    const f = fixture(t)
    saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const pageFile = path.join(
        f.root,
        'src/pages/ps/galeriak/2026-27/2026_09_10_teszt_esemeny.html'
    )
    fs.appendFileSync(pageFile, '\n<!-- saját megjegyzés -->\n')
    const result = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: { ...f.model, title: 'Módosított cím', date: '2026. 09. 11.' },
    })
    assert.equal(result.created, false)
    const entries = read(f.files.data)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].title, 'Módosított cím')
    assert.equal(entries[0].date, '2026. 09. 11.')
    assert.match(fs.readFileSync(pageFile, 'utf8'), /saját megjegyzés/)
})

test('invalid folders and stale baselines are rejected', (t) => {
    const f = fixture(t)
    assert.throws(
        () =>
            saveGallery(f.root, f.config, {
                sourceId: 'gallery-events',
                model: { ...f.model, folder: 'ps/2026-27/2026_09_10_nincs_ilyen' },
            }),
        /nem található/
    )
    saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const baseline = read(f.files.data)[0]
    assert.throws(
        () =>
            saveGallery(f.root, f.config, {
                sourceId: 'gallery-events',
                model: { ...f.model, title: 'Új' },
                baseline: { ...baseline, title: 'Közben módosult' },
            }),
        /közben módosították/
    )
})

test('dashboard fallback sync creates missing event pages', (t) => {
    const f = fixture(t)
    fs.writeFileSync(
        f.files.data,
        yaml.dump([
            {
                school: 'ps',
                year: '2026-27',
                date: '2026. 09. 10.',
                slug: '2026_09_10_teszt_esemeny',
                title: 'Kézi bejegyzés',
                alt: 'Kézi bejegyzés',
            },
        ])
    )
    const created = syncGalleryPages(f.root, f.config)
    assert.equal(created.length, 1)
    assert.match(fs.readFileSync(created[0], 'utf8'), /Kézi bejegyzés/)
})
