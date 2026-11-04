// One-time migration: builds the unified gallery event registry from the
// existing per-school/per-year gallery pages. Safe to re-run.
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const {
    formatHungarianDate,
    parseDateFromSlug,
    titleFromSlug,
} = require('../src/lib/gallery-utils.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'src/data/gallery_events.yml')

function frontMatter(file) {
    const source = fs.readFileSync(file, 'utf8')
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
    if (!match) return null
    return yaml.load(match[1]) || {}
}

function dateKey(date) {
    const match = /^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?$/.exec(String(date || ''))
    if (!match) return '0000-00-00'
    return `${match[1]}-${match[2]}-${match[3]}`
}

const events = []
for (const school of ['ps', 'bs']) {
    const schoolRoot = path.join(ROOT, 'src/pages', school, 'galeriak')
    if (!fs.existsSync(schoolRoot)) continue
    for (const yearEntry of fs.readdirSync(schoolRoot, { withFileTypes: true })) {
        if (!yearEntry.isDirectory()) continue
        const year = yearEntry.name
        if (!/^\d{4}-\d{2}$/.test(year)) continue
        const yearRoot = path.join(schoolRoot, year)
        for (const pageEntry of fs.readdirSync(yearRoot, { withFileTypes: true })) {
            if (!pageEntry.isFile() || !pageEntry.name.endsWith('.html')) continue
            const slug = pageEntry.name.slice(0, -'.html'.length)
            const data = frontMatter(path.join(yearRoot, pageEntry.name))
            if (!data) continue
            const parsed = parseDateFromSlug(slug)
            const date = data.date || (parsed ? formatHungarianDate(parsed) : '')
            const title = data.title || titleFromSlug(slug)
            const alt =
                data.alt && !/^lórum ipse$/i.test(String(data.alt).trim())
                    ? data.alt
                    : title
            events.push({
                folder: `${school}/${year}/${slug}`,
                school,
                year,
                date,
                slug,
                title,
                alt,
            })
        }
    }
}

events.sort(
    (left, right) =>
        dateKey(right.date).localeCompare(dateKey(left.date)) ||
        left.school.localeCompare(right.school) ||
        left.year.localeCompare(right.year) ||
        left.slug.localeCompare(right.slug, 'hu')
)

fs.writeFileSync(
    OUT,
    yaml.dump(events, { lineWidth: -1, noRefs: true, sortKeys: false }),
    'utf8'
)
console.log(`Wrote ${events.length} gallery events to ${path.relative(ROOT, OUT)}`)
