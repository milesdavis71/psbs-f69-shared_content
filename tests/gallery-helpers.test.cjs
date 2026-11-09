const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const gallery = require('../src/lib/gallery.js')
const composeConfig = require('../frontmatter.config.cjs')
const {
    parseDateFromSlug,
    schoolYearForDate,
    titleFromSlug,
} = require('../src/lib/gallery-utils.cjs')

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-helper-test-'))
    const directory = path.join(root, 'src/assets/img/ps/galeriak/2026-27/2026_09_10_teszt')
    fs.mkdirSync(path.join(directory, 'full'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'thumb'), { recursive: true })
    for (const number of ['01', '02']) {
        fs.writeFileSync(path.join(directory, 'full', `${number}_full.jpg`), '')
        fs.writeFileSync(path.join(directory, 'thumb', `${number}_thumb.jpg`), '')
    }
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    return {
        root,
        projectPath: root,
        gallery_events: [
            {
                school: 'ps',
                year: '2026-27',
                date: '2026. 09. 10.',
                slug: '2026_09_10_teszt',
                title: 'Teszt',
                alt: 'Teszt alt',
            },
            {
                school: 'bs',
                year: '2025-26',
                date: '2026. 05. 01.',
                slug: '2026_05_01_bs',
                title: 'Bálint esemény',
                alt: 'Bálint alt',
            },
            {
                school: 'ps',
                year: '2025-26',
                date: '2026. 04. 01.',
                slug: '2026_04_01_ps',
                title: 'Petőfi esemény',
                alt: 'Petőfi alt',
            },
        ],
    }
}

test('cards filter by school and year and expose the cover path', (t) => {
    const root = fixture(t)
    const cards = gallery.cards(root, 'ps', '2026-27')
    assert.equal(cards.length, 1)
    assert.equal(cards[0].href, '/galeriak/2026-27/2026_09_10_teszt')
    assert.equal(
        cards[0].cover,
        '/assets/img/ps/galeriak/2026-27/2026_09_10_teszt/thumb/01_thumb.jpg'
    )
})

test('sections and years are newest first', (t) => {
    const root = fixture(t)
    const sections = gallery.sections(root, 'ps')
    assert.deepEqual(
        sections.map((section) => section.year),
        ['2026-27', '2025-26']
    )
    assert.deepEqual(
        gallery.years(root, 'ps').map((item) => item.label),
        ['2026–2027', '2025–2026']
    )
})

test('entry falls back to page front matter and counts processed images', (t) => {
    const root = fixture(t)
    const entry = gallery.entry(root, 'ps', '2026-27', '2026_09_10_teszt', {
        title: 'Frontmatter cím',
        date: '2026. 09. 10.',
        count: 9,
    })
    assert.equal(entry.title, 'Teszt')
    assert.equal(entry.count, 2)
    assert.equal(entry.school, 'ps')
})

test('a processed image folder appears even without a registry entry', (t) => {
    const root = fixture(t)
    // Nincs registry bejegyzés: a feldolgozott képmappa önmagában is
    // megjelenik a galériában (így kerül be az új tanév is).
    root.gallery_events = []
    const cards = gallery.cards(root, 'ps', '2026-27')
    assert.equal(cards.length, 1)
    assert.equal(cards[0].slug, '2026_09_10_teszt')
    assert.equal(cards[0].title, 'Teszt')
    assert.equal(cards[0].date, '2026. 09. 10.')
    assert.deepEqual(
        gallery.years(root, 'ps').map((item) => item.year),
        ['2026-27']
    )
})

test('the gallery folder path decides the school of a registry entry', (t) => {
    const root = fixture(t)
    root.gallery_events = [
        {
            // Az iskola mező ellentmond a mappa előtagjának.
            school: 'ps',
            folder: 'bs/2026-27/2026_09_10_teszt',
            year: '2026-27',
            slug: '2026_09_10_teszt',
            title: 'Teszt',
            alt: 'Teszt',
            date: '2026. 09. 12.',
        },
    ]
    const bs = gallery.cards(root, 'bs', '2026-27')
    assert.equal(bs.length, 1)
    assert.equal(bs[0].title, 'Teszt')
    assert.equal(bs[0].date, '2026. 09. 12.')
    // A ps galériában csak a képmappa jelenik meg, a registry bejegyzés nem.
    const ps = gallery.cards(root, 'ps', '2026-27')
    assert.equal(ps.length, 1)
    assert.equal(ps[0].date, '2026. 09. 10.')
})

test('the gallery entries command reads the registry', (t) => {
    const { readGalleryEntries } = require('../.frontmatter/lib/gallery-store.cjs')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-entries-test-'))
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const data = path.join(root, 'src/data/gallery_events.yml')
    fs.mkdirSync(path.dirname(data), { recursive: true })
    fs.writeFileSync(
        data,
        yaml.dump([
            {
                school: 'ps',
                year: '2026-27',
                slug: '2026_09_10_teszt',
                title: 'Teszt',
                alt: 'Teszt',
                date: '2026. 09. 10.',
            },
        ])
    )
    const config = {
        'frontMatter.data.files': [
            {
                id: 'gallery-events',
                file: '[[workspace]]/src/data/gallery_events.yml',
            },
        ],
    }
    const entries = readGalleryEntries(root, config)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].school, 'ps')
    assert.equal(entries[0].year, '2026-27')
    assert.equal(entries[0].title, 'Teszt')
})

test('folder names produce dates, school years and readable titles', () => {
    const date = parseDateFromSlug('2026_09_10_100_eves_az_iskola')
    assert.deepEqual(date, { year: 2026, month: 9, day: 10 })
    assert.equal(schoolYearForDate(date), '2026-27')
    assert.equal(titleFromSlug('2026_09_10_100_eves_az_iskola'), '100 eves az iskola')
})

test('legacy gallery images may live in the other school folder', (t) => {
    const root = fixture(t)
    const shared = path.join(
        root.root,
        'src/assets/img/bs/galeriak/2026-27/2026_09_10_kozös'
    )
    fs.mkdirSync(path.join(shared, 'full'), { recursive: true })
    fs.mkdirSync(path.join(shared, 'thumb'), { recursive: true })
    fs.writeFileSync(path.join(shared, 'full', '01_full.jpg'), '')
    fs.writeFileSync(path.join(shared, 'thumb', '01_thumb.jpg'), '')
    root.gallery_events.push({
        school: 'ps',
        year: '2026-27',
        date: '2026. 09. 10.',
        slug: '2026_09_10_kozös',
        title: 'Közös esemény',
        alt: 'Közös esemény',
    })
    const card = gallery.cards(root, 'ps', '2026-27').find(
        (item) => item.slug === '2026_09_10_kozös'
    )
    assert.equal(
        card.cover,
        '/assets/img/bs/galeriak/2026-27/2026_09_10_kozös/thumb/01_thumb.jpg'
    )
})

test('the Front Matter gallery source exposes processed folders', () => {
    const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../frontmatter.json'), 'utf8')
    )
    const composed = composeConfig(config)
    const source = composed['frontMatter.data.files'].find(
        (file) => file.id === 'gallery-events'
    )
    assert.ok(source)
    // A mappa és a cím nem lehet a required listában: a dashboard saját
    // validációja különben a mentés előtt elhasalna. A kötelezőséget a
    // gallery-store validációja biztosítja, pontos hibaüzenettel.
    assert.equal(source.schema.required.includes('folder'), false)
    assert.equal(source.schema.required.includes('title'), false)
    assert.equal(source.schema.required.includes('school'), true)
    // Az üres érték is érvényes a legördülőben.
    assert.equal(source.schema.properties.folder.enum[0], '')
    assert.equal(
        source.schema.properties.folder.uniforms['data-gallery-source'],
        'gallery-events'
    )
    assert.ok(
        source.schema.properties.folder.enum.includes(
            'ps/2026-27/2026_09_10_100_eves_az_iskola'
        )
    )
})

test('the gallery form filters folders by the visible school selector', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../.frontmatter/ui/gallery-form.mjs'),
        'utf8'
    )
    // A saját választó az elsődleges forrás: a Uniforms modellje csak a
    // change esemény után frissül, ezért abból olvasva későn váltana át.
    assert.match(source, /querySelector\('\[data-gallery-school\]'\)/)
    // A szűrés a mappa előtagjára épül.
    assert.match(source, /startsWith\(prefix\)/)
    // A programozott mezőbejelenítés legyen erősebb a változatlan értéknél.
    assert.match(source, /force = false/)
    assert.match(source, /setField\(form, 'school', select\.value, true\)/)
    // A listát a lemezről is újra lehet tölteni.
    assert.match(source, /psbs\.gallery\.folders/)
    // A kiválasztott mappa meghatározza az iskolát is.
    assert.match(source, /setField\(form, 'school', school, true\)/)
    // A VS Code API csak egyszer szerezhető meg, ezért a script nem használhatja.
    assert.doesNotMatch(source, /acquireVsCodeApi/)
})
