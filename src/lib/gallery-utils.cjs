const fs = require('node:fs')
const path = require('node:path')

const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|webp)$/i
const GALLERY_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i

function galleryRoot(root) {
    return path.join(root, 'src/assets/img')
}

function parseGalleryFolder(folder) {
    if (typeof folder !== 'string') return null
    const parts = folder.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts.length !== 3) return null
    const [school, year, slug] = parts
    if (!['ps', 'bs'].includes(school)) return null
    if (!/^\d{4}-\d{2}$/.test(year)) return null
    if (!slug || /[/\\]/.test(slug)) return null
    return { school, year, slug }
}

function parseDateFromSlug(slug) {
    const match = /^(\d{4})[_ -](\d{2})[_ -](\d{2})/.exec(String(slug || ''))
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return { year, month, day }
}

function formatHungarianDate(date) {
    return `${date.year}. ${String(date.month).padStart(2, '0')}. ${String(date.day).padStart(2, '0')}.`
}

function schoolYearForDate(date) {
    const start = date.month >= 9 ? date.year : date.year - 1
    return `${start}-${String(start + 1).slice(-2)}`
}

function titleFromSlug(slug) {
    const withoutDate = String(slug || '').replace(
        /^\d{4}[_ -]\d{2}[_ -]\d{2}(?:[_ -]+|$)/,
        ''
    )
    const title = withoutDate.replace(/[_ -]+/g, ' ').trim()
    if (!title) return String(slug || '')
    return title[0].toUpperCase() + title.slice(1)
}

function galleryDirectory(root, school, year, slug) {
    return path.join(galleryRoot(root), school, 'galeriak', year, slug)
}

function imageIndexes(directory) {
    if (!fs.existsSync(directory)) return []
    return fs
        .readdirSync(directory)
        .map((name) => /^(\d+)_(?:full|thumb)\.(?:jpe?g|png|webp)$/i.exec(name))
        .filter(Boolean)
        .map((match) => Number(match[1]))
        .filter((value) => Number.isSafeInteger(value) && value > 0)
}

function normalizeTitleKey(slug) {
    return String(slug || '')
        .replace(/^\d{4}[_ -]\d{2}[_ -]\d{2}(?:[_ -]+|$)/, '')
        .toLocaleLowerCase('hu')
        .replace(/[^a-z0-9áéíóöőúüű]+/gi, ' ')
        .trim()
}

function resolveGalleryAsset(root, school, year, slug) {
    const exact = galleryDirectory(root, school, year, slug)
    if (fs.existsSync(exact)) {
        return { school, year, slug, directory: exact }
    }

    const schools = [school, school === 'ps' ? 'bs' : 'ps']
    const candidates = []
    for (const candidateSchool of schools) {
        const yearRoot = path.join(
            galleryRoot(root),
            candidateSchool,
            'galeriak',
            year
        )
        if (!fs.existsSync(yearRoot)) continue
        for (const entry of fs.readdirSync(yearRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue
            const directory = path.join(yearRoot, entry.name)
            if (!fs.existsSync(path.join(directory, 'thumb', '01_thumb.jpg'))) continue
            candidates.push({
                school: candidateSchool,
                year,
                slug: entry.name,
                directory,
            })
        }
    }

    const lowerSlug = String(slug).toLocaleLowerCase('hu')
    const caseMatch = candidates.find(
        (candidate) => candidate.slug.toLocaleLowerCase('hu') === lowerSlug
    )
    if (caseMatch) return caseMatch

    const parsed = parseDateFromSlug(slug)
    const titleKey = normalizeTitleKey(slug)
    if (!titleKey) return { school, year, slug, directory: exact }
    const fuzzy = candidates.find((candidate) => {
        const candidateDate = parseDateFromSlug(candidate.slug)
        const dateMatches =
            !parsed ||
            (candidateDate &&
                candidateDate.year === parsed.year &&
                candidateDate.month === parsed.month &&
                candidateDate.day === parsed.day)
        const candidateTitle = normalizeTitleKey(candidate.slug)
        return (
            dateMatches &&
            candidateTitle &&
            (candidateTitle.startsWith(titleKey) ||
                titleKey.startsWith(candidateTitle))
        )
    })
    if (fuzzy) return fuzzy

    // Some legacy pages abbreviate words (e.g. "digitalis prezentacio" vs
    // "digit prezent"). Accept a strong token overlap on the same date.
    const tokens = new Set(titleKey.split(' ').filter((word) => word.length >= 3))
    const tokenMatch = candidates.find((candidate) => {
        const candidateDate = parseDateFromSlug(candidate.slug)
        if (
            parsed &&
            (!candidateDate ||
                candidateDate.year !== parsed.year ||
                candidateDate.month !== parsed.month ||
                candidateDate.day !== parsed.day)
        ) {
            return false
        }
        const candidateTokens = new Set(
            normalizeTitleKey(candidate.slug)
                .split(' ')
                .filter((word) => word.length >= 3)
        )
        if (!tokens.size || !candidateTokens.size) return false
        let common = 0
        for (const token of tokens) {
            if (candidateTokens.has(token)) common++
        }
        return (
            common >= 2 &&
            common / Math.min(tokens.size, candidateTokens.size) >= 0.6
        )
    })
    return tokenMatch || { school, year, slug, directory: exact }
}

function galleryCount(root, school, year, slug) {
    const asset = resolveGalleryAsset(root, school, year, slug)
    for (const variant of ['full', 'thumb']) {
        const indexes = imageIndexes(path.join(asset.directory, variant))
        if (indexes.length) return Math.max(...indexes)
    }
    return 0
}

function galleryCover(root, school, year, slug) {
    const asset = resolveGalleryAsset(root, school, year, slug)
    const candidates = [
        ['thumb', '01_thumb.jpg'],
        ['full', '01_full.jpg'],
    ]
    for (const [variant, name] of candidates) {
        if (fs.existsSync(path.join(asset.directory, variant, name))) {
            return `/assets/img/${asset.school}/galeriak/${asset.year}/${asset.slug}/${variant}/${name}`
        }
    }
    return null
}

function galleryFolders(root) {
    const base = galleryRoot(root)
    const folders = []
    for (const school of ['ps', 'bs']) {
        const schoolRoot = path.join(base, school, 'galeriak')
        if (!fs.existsSync(schoolRoot)) continue
        for (const yearEntry of fs.readdirSync(schoolRoot, { withFileTypes: true })) {
            if (!yearEntry.isDirectory() || !/^\d{4}-\d{2}$/.test(yearEntry.name)) continue
            const yearRoot = path.join(schoolRoot, yearEntry.name)
            for (const slugEntry of fs.readdirSync(yearRoot, { withFileTypes: true })) {
                if (!slugEntry.isDirectory()) continue
                const directory = path.join(yearRoot, slugEntry.name)
                const hasThumb = fs.existsSync(path.join(directory, 'thumb', '01_thumb.jpg'))
                if (!hasThumb) continue
                const modified = Math.max(
                    fs.statSync(directory).mtimeMs,
                    hasThumb
                        ? fs.statSync(path.join(directory, 'thumb', '01_thumb.jpg')).mtimeMs
                        : 0
                )
                folders.push({
                    value: `${school}/${yearEntry.name}/${slugEntry.name}`,
                    school,
                    year: yearEntry.name,
                    slug: slugEntry.name,
                    modified,
                })
            }
        }
    }
    return folders.sort(
        (left, right) =>
            right.modified - left.modified ||
            left.value.localeCompare(right.value, 'hu')
    )
}

module.exports = {
    IMAGE_EXTENSIONS,
    GALLERY_IMAGE_EXTENSIONS,
    formatHungarianDate,
    galleryCount,
    galleryCover,
    galleryDirectory,
    galleryFolders,
    galleryRoot,
    normalizeTitleKey,
    parseDateFromSlug,
    parseGalleryFolder,
    resolveGalleryAsset,
    schoolYearForDate,
    titleFromSlug,
}
