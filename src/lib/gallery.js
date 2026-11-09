const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const {
    formatHungarianDate,
    galleryCount,
    galleryCover,
    galleryDirectory,
    galleryFolders,
    parseDateFromSlug,
    parseGalleryFolder,
    resolveGalleryAsset,
    titleFromSlug,
} = require('./gallery-utils.cjs')

const EVENTS_FILE = path.join(process.cwd(), 'src/data/gallery_events.yml')
const SCHOOLS = ['ps', 'bs']

function rootOf(options) {
    return options?.data?.root || this
}

function projectRootOf(root) {
    if (typeof root === 'string') return root
    if (typeof root?.projectPath === 'string') return root.projectPath
    return process.cwd()
}

// A front matter beolvasása az eseményoldalakról.
function readFrontMatter(file) {
    try {
        const source = fs.readFileSync(file, 'utf8')
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
        if (!match) return {}
        const data = yaml.load(match[1])
        return data && typeof data === 'object' ? data : {}
    } catch {
        return {}
    }
}

// Az eseményoldalak fájlnévlistája: iskola/tanév/slug.
function pageEventFiles(root, school) {
    const base = path.join(projectRootOf(root), 'src/pages', school, 'galeriak')
    if (!fs.existsSync(base)) return []
    const files = []
    for (const yearEntry of fs.readdirSync(base, { withFileTypes: true })) {
        if (!yearEntry.isDirectory() || !/^\d{4}-\d{2}$/.test(yearEntry.name)) {
            continue
        }
        const yearRoot = path.join(base, yearEntry.name)
        for (const fileEntry of fs.readdirSync(yearRoot, { withFileTypes: true })) {
            if (!fileEntry.isFile() || !fileEntry.name.endsWith('.html')) continue
            files.push({
                school,
                year: yearEntry.name,
                slug: fileEntry.name.slice(0, -'.html'.length),
            })
        }
    }
    return files
}

function readPageEvent(root, school, year, slug) {
    const projectRoot = projectRootOf(root)
    const file = path.join(
        projectRoot,
        'src/pages',
        school,
        'galeriak',
        year,
        `${slug}.html`
    )
    if (!fs.existsSync(file)) return null
    const data = readFrontMatter(file)
    // A feldolgozott képmappa helye dönt: ha a képek a másik iskola
    // mappájában vannak, az esemény is oda tartozik.
    const asset = resolveGalleryAsset(projectRoot, school, year, slug)
    const owner = asset?.school || school
    const title = data.title || titleFromSlug(slug)
    return {
        folder: `${owner}/${year}/${slug}`,
        school: owner,
        year,
        slug,
        title,
        date: data.date || '',
        alt: data.alt || title,
    }
}

function eventKey(event) {
    return `${event.school}/${event.year}/${event.slug}`
}

// A galériamappa útvonala kanonikus: ha a registry bejegyzésben eltér a
// school vagy a year mező, a mappa előtagja az irányadó. Így a kézzel
// szerkesztett bejegyzés is a helyes iskolához kerül.
function normalizeRegistryEntry(entry) {
    const parsed = parseGalleryFolder(entry?.folder)
    if (!parsed) return entry
    return {
        ...entry,
        school: parsed.school,
        year: parsed.year,
        slug: parsed.slug,
    }
}

function dateKey(value) {
    const match = /^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?$/.exec(
        String(value || '').trim()
    )
    return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

// A legfrissebb események kerüljenek előre; az azonos dátumúak a
// registry eredeti sorrendjét tartják meg.
function sortEvents(events) {
    return events
        .map((event, index) => ({ event, index }))
        .sort((left, right) => {
            const a = dateKey(left.event.date)
            const b = dateKey(right.event.date)
            if (a && b && a !== b) return b.localeCompare(a)
            if (a && !b) return -1
            if (!a && b) return 1
            return left.index - right.index
        })
        .map((item) => item.event)
}

function readRegistry(root) {
    if (Array.isArray(root?.gallery_events)) return root.gallery_events
    if (!fs.existsSync(EVENTS_FILE)) return []
    const data = yaml.load(fs.readFileSync(EVENTS_FILE, 'utf8'))
    return Array.isArray(data) ? data : []
}

// A galéria eseményei: a registry (cím, dátum, alt), az eseményoldalak és a
// feldolgozott képmappák egyesítése. Így egy új tanév első galériája akkor is
// automatikusan megjelenik a főoldalon, ha az eseményoldalt még nem regisztráltuk.
function loadEvents(root, includeAssets = false) {
    const byKey = new Map()
    // 1. A feldolgozott képmappák (ezek jelzik a legfrissebb tanéveket).
    if (includeAssets) {
        for (const folder of galleryFolders(projectRootOf(root))) {
            const key = `${folder.school}/${folder.year}/${folder.slug}`
            if (byKey.has(key)) continue
            const parsed = parseDateFromSlug(folder.slug)
            const title = titleFromSlug(folder.slug)
            byKey.set(key, {
                folder: key,
                school: folder.school,
                year: folder.year,
                slug: folder.slug,
                title,
                date: parsed ? formatHungarianDate(parsed) : '',
                alt: title,
            })
        }
    }
    // 2. A registry: a mappa útvonala kanonikus, ezért a bejegyzés a
    // helyes iskolához kerül.
    for (const raw of readRegistry(root)) {
        if (!raw?.school || !raw?.slug || !raw?.year) continue
        const event = normalizeRegistryEntry(raw)
        byKey.set(eventKey(event), { ...byKey.get(eventKey(event)), ...event })
    }
    // 3. Az eseményoldalak front matterje: a kézzel szerkesztett oldal nyer,
    // és a képmappa helye dönti el, melyik iskolához tartozik az esemény.
    for (const school of SCHOOLS) {
        for (const file of pageEventFiles(root, school)) {
            const event = readPageEvent(root, school, file.year, file.slug)
            if (!event) continue
            const key = eventKey(event)
            const previous = byKey.get(key)
            const merged = { ...previous, ...event }
            // A mappanévből generált cím nem írhatja felül a kézzel
            // szerkesztettet (pl. a másik iskolában maradt példány).
            const generated = titleFromSlug(event.slug)
            if (
                previous?.title &&
                event.title === generated &&
                previous.title !== generated
            ) {
                merged.title = previous.title
                merged.alt = previous.alt || previous.title
            }
            byKey.set(key, merged)
        }
    }
    return sortEvents([...byKey.values()])
}

function yearLabel(year) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(year || ''))
    if (!match) return String(year || '')
    return `${match[1]}–${match[1].slice(0, 2)}${match[2]}`
}

function normalizeEvent(event, projectRoot) {
    if (!event || !['ps', 'bs'].includes(event.school)) return null
    if (!event.year || !event.slug) return null
    const cover = galleryCover(
        projectRoot,
        event.school,
        event.year,
        event.slug
    )
    return {
        ...event,
        year: String(event.year),
        yearLabel: yearLabel(event.year),
        anchor: `year-${event.year}`,
        href: `/galeriak/${event.year}/${event.slug}`,
        cover,
    }
}

function eventsFor(root, school, year) {
    const projectRoot = projectRootOf(root)
    // A képmappákat is bevonjuk: egy új tanév első galériája így automatikusan
    // megjelenik a főoldalon, új tabbal.
    return loadEvents(root, true)
        .filter(
            (event) =>
                event &&
                event.school === school &&
                (!year || String(event.year) === String(year))
        )
        .map((event) => normalizeEvent(event, projectRoot))
        .filter(Boolean)
}

function cards(root, school, year) {
    return eventsFor(root, school, year)
}

function sections(root, school) {
    const grouped = new Map()
    for (const event of eventsFor(root, school)) {
        if (!grouped.has(event.year)) grouped.set(event.year, [])
        grouped.get(event.year).push(event)
    }
    return [...grouped.keys()]
        .sort((left, right) => right.localeCompare(left))
        .map((year) => ({
            year,
            label: yearLabel(year),
            anchor: `year-${year}`,
            count: grouped.get(year).length,
            cards: grouped.get(year),
        }))
}

function years(root, school) {
    const counts = new Map()
    for (const event of eventsFor(root, school)) {
        counts.set(event.year, (counts.get(event.year) || 0) + 1)
    }
    return [...counts.keys()]
        .sort((left, right) => right.localeCompare(left))
        .map((year) => ({
            year,
            label: yearLabel(year),
            anchor: `year-${year}`,
            count: counts.get(year),
        }))
}

function entry(root, school, year, slug, fallback = {}) {
    const projectRoot = projectRootOf(root)
    // Közvetlenül a registryből és az eseményoldalról olvasunk, hogy egy
    // eseményoldal renderelése ne töltse be a teljes galérialistát.
    const registered = readRegistry(root)
        .map((item) => normalizeRegistryEntry(item))
        .find(
            (item) =>
                item &&
                item.school === school &&
                String(item.year) === String(year) &&
                item.slug === slug
        )
    const page = readPageEvent(projectRoot, school, year, slug) || {}
    const event = { ...page, ...(registered || {}) }
    const asset = resolveGalleryAsset(projectRoot, school, year, slug)
    const title = event.title || fallback.title || slug
    const date = event.date || fallback.date || ''
    const alt = event.alt || fallback.alt || title
    const count =
        galleryCount(projectRoot, school, year, slug) ||
        Number(fallback.count) ||
        0
    return {
        ...fallback,
        ...event,
        // A képmappa helye dönt: az esemény a tulajdonos iskolához tartozik.
        school: event.school || school,
        year: String(year),
        slug,
        assetSchool: asset.school,
        assetYear: asset.year,
        assetSlug: asset.slug,
        title,
        date,
        alt,
        count,
        href: `/galeriak/${year}/${slug}`,
        cover: event.cover || galleryCover(projectRoot, school, year, slug),
        directory:
            asset.directory ||
            galleryDirectory(projectRoot, school, year, slug),
    }
}

module.exports = {
    EVENTS_FILE,
    cards,
    entry,
    eventsFor,
    loadEvents,
    normalizeEvent,
    pageEventFiles,
    readPageEvent,
    rootOf,
    sections,
    yearLabel,
    years,
}
