const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { isDeepStrictEqual } = require('node:util')
const yaml = require('js-yaml')
const {
    formatHungarianDate,
    galleryCount,
    parseDateFromSlug,
    parseGalleryFolder,
    resolveGalleryAsset,
} = require('../../src/lib/gallery-utils.cjs')

const SOURCE_ID = 'gallery-events'

function sourcePaths(root, config, sourceId) {
    if (sourceId !== SOURCE_ID) {
        throw new Error('Ez a galériaforrás nincs engedélyezve.')
    }
    const source = config['frontMatter.data.files']?.find(
        (file) => file.id === sourceId
    )
    const data = path.join(root, 'src/data/gallery_events.yml')
    if (!source || path.resolve(source.file.replace('[[workspace]]', root)) !== data) {
        throw new Error('A galériaforrás fájlútvonala nem a gallery_events.yml fájlra mutat.')
    }
    return { data, runtime: path.join(root, '.frontmatter/runtime') }
}

function readEvents(file) {
    if (!fs.existsSync(file)) return []
    const entries = yaml.load(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(entries)) throw new Error('A galérialista nem YAML-lista.')
    return entries
}

function atomicWrite(file, text) {
    const temporary = `${file}.${randomUUID()}.tmp`
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(temporary, text, 'utf8')
        fs.renameSync(temporary, file)
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
}

function acquireLock(lock) {
    try {
        const descriptor = fs.openSync(lock, 'wx')
        try {
            fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid }))
        } catch (error) {
            fs.closeSync(descriptor)
            fs.unlinkSync(lock)
            throw error
        }
        return descriptor
    } catch (error) {
        if (error.code !== 'EEXIST') throw error
        throw new Error(
            'Másik galériamentés van folyamatban. Próbáld újra néhány másodperc múlva.'
        )
    }
}

function pagePaths(root, record) {
    return {
        page: path.join(
            root,
            'src/pages',
            record.school,
            'galeriak',
            record.year,
            `${record.slug}.html`
        ),
        main: path.join(root, 'src/pages', record.school, 'galeriak.html'),
    }
}

function validateModel(root, config, model) {
    const folder = parseGalleryFolder(model?.folder)
    const record = {
        folder: folder
            ? `${folder.school}/${folder.year}/${folder.slug}`
            : '',
        school: folder?.school || model?.school,
        year: folder?.year || String(model?.year || ''),
        slug: folder?.slug || String(model?.slug || ''),
        title: String(model?.title || '').trim(),
        alt: String(model?.alt || '').trim(),
        date: String(model?.date || '').trim(),
    }
    if (!['ps', 'bs'].includes(record.school)) throw new Error('Érvénytelen iskola.')
    if (!/^\d{4}-\d{2}$/.test(record.year)) throw new Error('Érvénytelen tanév.')
    if (!record.slug || /[/\\]/.test(record.slug)) throw new Error('Érvénytelen galéria-slug.')
    if (!record.title) throw new Error('A galéria címe kötelező.')
    if (!record.date) {
        const parsed = parseDateFromSlug(record.slug)
        record.date = parsed ? formatHungarianDate(parsed) : ''
    }
    if (!record.date) throw new Error('A galéria dátuma kötelező.')
    if (!record.alt) record.alt = record.title

    const directory = resolveGalleryAsset(
        root,
        record.school,
        record.year,
        record.slug
    ).directory
    if (!fs.existsSync(directory)) {
        throw new Error(
            'A kiválasztott galériamappa nem található az assets/img alatt. Előbb futtasd a resizer.py programot.'
        )
    }
    if (!fs.existsSync(path.join(directory, 'thumb', '01_thumb.jpg'))) {
        throw new Error('A galériamappában nincs thumb/01_thumb.jpg. Futtasd a resizer.py programot.')
    }
    if (galleryCount(root, record.school, record.year, record.slug) < 1) {
        throw new Error('A galériamappa nem tartalmaz feldolgozott képeket.')
    }
    return record
}

function renderFrontMatter(fields) {
    return [
        '---',
        yaml.dump(fields, { lineWidth: -1, noRefs: true }).trimEnd(),
        '---',
    ].join('\n')
}

function renderEventPage(record) {
    return (
        renderFrontMatter({
            layout: `two_columns_${record.school}`,
            page: 'galeriak_root',
            galleryRoot: true,
            title: record.title,
            alt: record.alt,
            date: record.date,
            schoolKey: record.school,
            slug: record.slug,
            year: record.year,
        }) +
        '\n\n{{> gallery-breadcrumb}} {{> common-galery-from-yaml}}\n'
    )
}

function renderMainPage(school) {
    return (
        renderFrontMatter({
            layout: `two_columns_${school}`,
            title: 'Fotógalériák',
            page: 'galeriak_root',
            galleryRoot: true,
            schoolKey: school,
        }) +
        '\n\n{{> title}} {{> common-gallery-index schoolKey=schoolKey }}\n'
    )
}

function replaceFrontMatter(current, fields) {
    const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(current)
    const body = match
        ? current.slice(match[0].length).replace(/^\r?\n+/, '')
        : '{{> gallery-breadcrumb}} {{> common-galery-from-yaml}}\n'
    return `${renderFrontMatter(fields)}\n\n${body}`
}

function writePage(file, record) {
    const fields = {
        layout: `two_columns_${record.school}`,
        page: 'galeriak_root',
        galleryRoot: true,
        title: record.title,
        alt: record.alt,
        date: record.date,
        schoolKey: record.school,
        slug: record.slug,
        year: record.year,
    }
    const content = fs.existsSync(file)
        ? replaceFrontMatter(fs.readFileSync(file, 'utf8'), fields)
        : renderEventPage(record)
    atomicWrite(file, content)
}

function ensureFile(file, content) {
    if (fs.existsSync(file)) return false
    atomicWrite(file, content)
    return true
}

function saveGallery(root, config, request, options = {}) {
    const files = sourcePaths(root, config, request.sourceId)
    fs.mkdirSync(files.runtime, { recursive: true })
    const lock = path.join(files.runtime, `${SOURCE_ID}.lock`)
    const descriptor = acquireLock(lock)
    try {
        options.assertClean?.([files.data])
        const oldData = fs.existsSync(files.data)
            ? fs.readFileSync(files.data, 'utf8')
            : '[]\n'
        const entries = yaml.load(oldData)
        if (!Array.isArray(entries)) throw new Error('A galérialista nem YAML-lista.')
        const record = validateModel(root, config, request.model)
        const paths = pagePaths(root, record)
        options.assertClean?.([files.data, paths.page])
        const same = (entry) =>
            entry &&
            entry.school === record.school &&
            String(entry.year) === record.year &&
            entry.slug === record.slug
        let existing
        if (request.baseline) {
            const matches = entries.filter(same)
            if (matches.length !== 1 || !isDeepStrictEqual(matches[0], request.baseline)) {
                throw new Error(
                    'Ezt a galériát közben módosították. Nyisd meg újra az adatforrást a mentés előtt.'
                )
            }
            existing = matches[0]
        } else {
            const matches = entries.filter(same)
            if (matches.length > 1) {
                throw new Error('Több azonos galériabejegyzés van a listában.')
            }
            existing = matches[0]
        }

        writePage(paths.page, record)
        const mainCreated = ensureFile(paths.main, renderMainPage(record.school))
        const created = !existing
        if (existing) {
            Object.assign(existing, record)
        } else {
            entries.unshift(record)
        }
        const data = yaml.dump(entries, { lineWidth: -1, noRefs: true })
        options.assertClean?.([files.data])
        if (fs.existsSync(files.data) && fs.readFileSync(files.data, 'utf8') !== oldData) {
            throw new Error('A galérialista közben megváltozott. Próbáld újra a mentést.')
        }
        atomicWrite(files.data, data)
        return {
            ok: true,
            id: record.slug,
            entries,
            created,
            mainCreated,
            page: paths.page,
            school: record.school,
            year: record.year,
            slug: record.slug,
        }
    } finally {
        fs.closeSync(descriptor)
        fs.unlinkSync(lock)
    }
}

// Fallback for entries saved by the dashboard itself: create any missing page
// files from the registry. Safe to repeat.
function syncGalleryPages(root, config) {
    const files = sourcePaths(root, config, SOURCE_ID)
    if (!fs.existsSync(files.data)) return []
    const created = []
    for (const entry of readEvents(files.data)) {
        if (!entry) continue
        const parsed = parseGalleryFolder(entry.folder)
        const school = entry.school || parsed?.school
        if (!['ps', 'bs'].includes(school)) continue
        const record = {
            school,
            year: String(entry.year || parsed?.year || ''),
            slug: String(entry.slug || parsed?.slug || ''),
            title: String(entry.title || ''),
            alt: String(entry.alt || entry.title || ''),
            date: String(entry.date || ''),
        }
        if (!/^\d{4}-\d{2}$/.test(record.year) || !record.slug || !record.title) continue
        const paths = pagePaths(root, record)
        if (ensureFile(paths.page, renderEventPage(record))) created.push(paths.page)
        ensureFile(paths.main, renderMainPage(record.school))
    }
    return created
}

module.exports = {
    SOURCE_ID,
    pagePaths,
    readEvents,
    saveGallery,
    sourcePaths,
    syncGalleryPages,
    validateModel,
}

