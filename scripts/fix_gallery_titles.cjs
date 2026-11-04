// Fills placeholder "Cím" gallery titles from the legacy gal_picts_*.yml files.
// Updates both the event page front matter and src/data/gallery_events.yml.
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const { titleFromSlug } = require('../src/lib/gallery-utils.cjs')

const ROOT = path.resolve(__dirname, '..')

function loadLegacyTitles() {
    const titles = new Map()
    const dataDir = path.join(ROOT, 'src/data')
    for (const name of fs.readdirSync(dataDir)) {
        const match = /^gal_picts_(ps|bs)_(\d{4})_(\d{2})\.yml$/.exec(name)
        if (!match) continue
        const school = match[1]
        const year = `${match[2]}-${match[3]}`
        const data = yaml.load(fs.readFileSync(path.join(dataDir, name), 'utf8'))
        for (const card of data?.cards || []) {
            if (card.slug && card.title) {
                titles.set(`${school}/${year}/${card.slug}`, card.title)
            }
        }
    }
    return titles
}

function isPlaceholder(value) {
    const text = String(value || '').trim()
    return !text || text === 'Cím' || /^lórum ipse$/i.test(text)
}

const titles = loadLegacyTitles()

// Registry
const eventsFile = path.join(ROOT, 'src/data/gallery_events.yml')
const events = yaml.load(fs.readFileSync(eventsFile, 'utf8'))
let registryChanges = 0
for (const event of events) {
    const key = `${event.school}/${event.year}/${event.slug}`
    const title = titles.get(key)
    if (!title) continue
    if (isPlaceholder(event.title) && event.title !== title) {
        event.title = title
        registryChanges++
    }
    if (isPlaceholder(event.alt)) event.alt = event.title
}
fs.writeFileSync(
    eventsFile,
    yaml.dump(events, { lineWidth: -1, noRefs: true }),
    'utf8'
)

// Event pages
let pageChanges = 0
for (const school of ['ps', 'bs']) {
    const schoolRoot = path.join(ROOT, 'src/pages', school, 'galeriak')
    if (!fs.existsSync(schoolRoot)) continue
    for (const yearEntry of fs.readdirSync(schoolRoot, { withFileTypes: true })) {
        if (!yearEntry.isDirectory()) continue
        const year = yearEntry.name
        const yearRoot = path.join(schoolRoot, year)
        for (const pageEntry of fs.readdirSync(yearRoot, { withFileTypes: true })) {
            if (!pageEntry.isFile() || !pageEntry.name.endsWith('.html')) continue
            const slug = pageEntry.name.slice(0, -'.html'.length)
            const title = titles.get(`${school}/${year}/${slug}`)
            if (!title) continue
            const file = path.join(yearRoot, pageEntry.name)
            const source = fs.readFileSync(file, 'utf8')
            const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
            if (!match) continue
            const data = yaml.load(match[1]) || {}
            if (!isPlaceholder(data.title)) continue
            data.title = title
            if (isPlaceholder(data.alt)) data.alt = title
            const body = source.slice(match[0].length).replace(/^\r?\n+/, '')
            fs.writeFileSync(
                file,
                `---\n${yaml.dump(data, { lineWidth: -1, noRefs: true }).trimEnd()}\n---\n\n${body}`,
                'utf8'
            )
            pageChanges++
        }
    }
}

console.log(`Registry titles updated: ${registryChanges}`)
console.log(`Event pages updated: ${pageChanges}`)
