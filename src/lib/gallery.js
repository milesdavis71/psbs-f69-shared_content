const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const {
    galleryCount,
    galleryCover,
    galleryDirectory,
    resolveGalleryAsset,
} = require('./gallery-utils.cjs')

const EVENTS_FILE = path.join(process.cwd(), 'src/data/gallery_events.yml')

function rootOf(options) {
    return options?.data?.root || this
}

function projectRootOf(root) {
    if (typeof root === 'string') return root
    if (typeof root?.projectPath === 'string') return root.projectPath
    return process.cwd()
}

function loadEvents(root) {
    if (Array.isArray(root?.gallery_events)) return root.gallery_events
    if (!fs.existsSync(EVENTS_FILE)) return []
    const data = yaml.load(fs.readFileSync(EVENTS_FILE, 'utf8'))
    return Array.isArray(data) ? data : []
}

function yearLabel(year) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(year || ''))
    if (!match) return String(year || '')
    return `${match[1]}–${match[1].slice(0, 2)}${match[2]}`
}

function normalizeEvent(event, projectRoot) {
    if (!event || !['ps', 'bs'].includes(event.school)) return null
    if (!event.year || !event.slug) return null
    const cover = galleryCover(projectRoot, event.school, event.year, event.slug)
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
    return loadEvents(root)
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
    const event =
        eventsFor(root, school, year).find((item) => item.slug === slug) || {}
    const asset = resolveGalleryAsset(projectRoot, school, year, slug)
    const title = event.title || fallback.title || slug
    const date = event.date || fallback.date || ''
    const alt = event.alt || fallback.alt || title
    const count =
        galleryCount(projectRoot, school, year, slug) || Number(fallback.count) || 0
    return {
        ...fallback,
        ...event,
        school,
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
        directory: asset.directory || galleryDirectory(projectRoot, school, year, slug),
    }
}

module.exports = {
    EVENTS_FILE,
    cards,
    entry,
    eventsFor,
    loadEvents,
    normalizeEvent,
    rootOf,
    sections,
    yearLabel,
    years,
}
