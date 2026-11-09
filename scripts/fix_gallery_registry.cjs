#!/usr/bin/env node
// A galéria registry tisztítása:
//  - a mappa útvonala kanonikus (a school/year/slug mezőt felülírja),
//  - az üres bejegyzések (mappa és cím nélkül) törlődnek,
//  - az azonos mappájú duplikátumok összevonódnak (a nem üres cím nyer).
//
// Használat: npm run gallery:fix-registry
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const yaml = require('js-yaml')
const {
    formatHungarianDate,
    parseDateFromSlug,
    parseGalleryFolder,
} = require('../src/lib/gallery-utils.cjs')

const file = path.join(process.cwd(), 'src/data/gallery_events.yml')
const entries = yaml.load(fs.readFileSync(file, 'utf8'))
if (!Array.isArray(entries)) throw new Error('A galérialista nem YAML-lista.')

// Az eseményoldalak front matterje: a kézzel szerkesztett cím, dátum és
// alt innen származik. A tanév/slug a kulcs, az iskolától függetlenül, mert
// az eseményoldal még a másik iskola mappájában maradhat.
function pageFields(root) {
    const fields = new Map()
    for (const school of ['bs', 'ps']) {
        const base = path.join(root, 'src/pages', school, 'galeriak')
        if (!fs.existsSync(base)) continue
        for (const year of fs.readdirSync(base, { withFileTypes: true })) {
            if (!year.isDirectory()) continue
            const yearRoot = path.join(base, year.name)
            for (const file of fs.readdirSync(yearRoot, { withFileTypes: true })) {
                if (!file.isFile() || !file.name.endsWith('.html')) continue
                const source = fs.readFileSync(path.join(yearRoot, file.name), 'utf8')
                const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)
                if (!match) continue
                const data = yaml.load(match[1])
                if (!data || !data.title) continue
                fields.set(`${year.name}/${file.name.slice(0, -'.html'.length)}`, {
                    title: String(data.title).trim(),
                    alt: String(data.alt || data.title).trim(),
                    date: String(data.date || '').trim(),
                })
            }
        }
    }
    return fields
}

const pageData = pageFields(process.cwd())

const byKey = new Map()
const notes = []
for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
        notes.push('üres bejegyzés')
        continue
    }
    const parsed = parseGalleryFolder(entry.folder)
    const school = parsed?.school || entry.school
    const year = String(parsed?.year || entry.year || '')
    const slug = String(parsed?.slug || entry.slug || '')
    const title = String(entry.title || '').trim()
    if (!school || !year || !slug || !title) {
        notes.push(`hiányos bejegyzés (${school || '?'}/${year || '?'}/${slug || '?'})`)
        continue
    }
    const key = `${school}/${year}/${slug}`
    const record = {
        ...entry,
        school,
        year,
        slug,
        title,
        alt: String(entry.alt || title).trim(),
        date: String(entry.date || '').trim(),
    }
    // Az eseményoldal front matterje felülírja a címet és a dátumot, ha van.
    const fromPage = pageData.get(`${year}/${slug}`)
    if (fromPage) {
        if (fromPage.title && fromPage.title !== record.title) {
            notes.push(`cím javítva (${key}): ${record.title} -> ${fromPage.title}`)
        }
        record.title = fromPage.title || record.title
        record.alt = fromPage.alt || record.alt
        record.date = fromPage.date || record.date
    }
    if (!record.date) {
        const parsedDate = parseDateFromSlug(slug)
        if (parsedDate) record.date = formatHungarianDate(parsedDate)
    }
    const previous = byKey.get(key)
    if (previous) {
        // A későbbi bejegyzés nyer: a felhasználó utolsó szerkesztése érvényes.
        byKey.set(key, record)
        notes.push(`duplikátum (${key})`)
        continue
    }
    byKey.set(key, record)
}

if (!notes.length && byKey.size === entries.length) {
    console.log('A galérialista rendben van, nem kell javítani.')
    process.exit(0)
}

const temporary = `${file}.${randomUUID()}.tmp`
fs.writeFileSync(
    temporary,
    yaml.dump([...byKey.values()], { lineWidth: -1, noRefs: true }),
    'utf8'
)
fs.renameSync(temporary, file)
console.log(`Javítva: ${byKey.size} bejegyzés maradt, ${notes.length} javítás.`)
for (const note of notes) console.log(`  ${note}`)