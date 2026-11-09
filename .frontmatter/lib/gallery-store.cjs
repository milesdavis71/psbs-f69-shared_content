const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { isDeepStrictEqual } = require('node:util')
const yaml = require('js-yaml')
const {
    formatHungarianDate,
    galleryCount,
    galleryFolders,
    parseDateFromSlug,
    parseGalleryFolder,
    resolveGalleryAsset,
    titleFromSlug,
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

// A registry bejegyzései (iskola, tanév, slug, cím, dátum, alt). A dashboard
// bal oldali listáját ezek alapján rendezzük.
function readGalleryEntries(root, config) {
    const files = sourcePaths(root, config, SOURCE_ID)
    if (!fs.existsSync(files.data)) return []
    return readEvents(files.data).map((entry) =>
        entry && typeof entry === 'object' ? entry : null
    )
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

// Az esemény oldalfájlja már létezik valamelyik iskolában? Ha igen, azt
// használjuk, hogy a kézzel szerkesztett példány maradjon.
function findEventPage(root, record) {
    const schools = [record.school, record.school === 'ps' ? 'bs' : 'ps']
    for (const school of schools) {
        const file = path.join(
            root,
            'src/pages',
            school,
            'galeriak',
            record.year,
            `${record.slug}.html`
        )
        if (fs.existsSync(file)) return file
    }
    return null
}

// A fájl front matterje egyezik a bejegyzéssel? Csak eltérés esetén írunk,
// hogy a feleslegesen módosított fájlok ne keletkezzenek. Az alt és a date
// mező formázása eltérhet, ezért ezek nem triggerelnek újraírást.
function pageMatches(file, record) {
    try {
        const source = fs.readFileSync(file, 'utf8')
        const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)
        if (!match) return false
        const fields = yaml.load(match[1]) || {}
        return (
            String(fields.title || '') === record.title &&
            String(fields.schoolKey || '') === record.school &&
            String(fields.slug || '') === record.slug &&
            String(fields.year || '') === record.year
        )
    } catch {
        return false
    }
}

function validateModel(root, config, model) {
    // A galériamappa kanonikus: belőle származtatjuk az iskolát, a tanévet és
    // a slugot. Így a bejegyzés akkor is a helyes iskolához kerül, ha a
    // form mezői ellentmondanak egymásnak.
    const folder = parseGalleryFolder(model?.folder)
    if (!folder) {
        throw new Error(
            'Válassz ki egy feldolgozott galériamappát a kiválasztott iskolából.'
        )
    }
    const school = folder.school
    const selectedYear = String(model?.year || '').trim()
    if (selectedYear && selectedYear !== folder.year) {
        throw new Error(
            'A kiválasztott tanév nem felel meg a galériamappának. Válaszd ki újra a tanévet.'
        )
    }
    const record = {
        folder: `${folder.school}/${folder.year}/${folder.slug}`,
        school,
        year: folder.year,
        slug: folder.slug,
        title: String(model?.title || '').trim(),
        alt: String(model?.alt || '').trim(),
        date: String(model?.date || '').trim(),
    }
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
// A kézzel felvett képmappákból is létrehozza a hiányzó eseményoldalt és a
// registrybejegyzést, így az új tanév automatikusan megjelenik a főoldalon.
function syncGalleryPages(root, config) {
    const files = sourcePaths(root, config, SOURCE_ID)
    if (!fs.existsSync(files.data)) return []
    const created = []
    const entries = readEvents(files.data)
    const known = new Set()
    for (const entry of entries) {
        if (!entry) continue
        const parsed = parseGalleryFolder(entry.folder)
        // A mappa útvonala kanonikus, ezért ez az iskola érvényesül.
        const school = parsed?.school || entry.school
        const year = String(parsed?.year || entry.year || '')
        const slug = String(parsed?.slug || entry.slug || '')
        if (school && year && slug) known.add(`${school}/${year}/${slug}`)
        const record = {
            school,
            year,
            slug,
            title: String(entry.title || ''),
            alt: String(entry.alt || entry.title || ''),
            date: String(entry.date || ''),
        }
        if (!['ps', 'bs'].includes(school)) continue
        if (!/^\d{4}-\d{2}$/.test(record.year) || !record.slug || !record.title) continue
        const paths = pagePaths(root, record)
        // Az esemény oldalfájlja: ha már létezik (akár a másik iskolában),
        // a front matterjét frissítjük, de a saját tartalma megmarad.
        const existing = findEventPage(root, record)
        if (existing) {
            if (!pageMatches(existing, record)) writePage(existing, record)
        } else if (ensureFile(paths.page, renderEventPage(record))) {
            created.push(paths.page)
        }
        ensureFile(paths.main, renderMainPage(record.school))
    }

    // A képmappákból még hiányzó események: eseményoldal + registrybejegyzés.
    const added = []
    for (const folder of galleryFolders(root)) {
        const key = `${folder.school}/${folder.year}/${folder.slug}`
        if (known.has(key)) continue
        known.add(key)
        const parsed = parseDateFromSlug(folder.slug)
        const title = titleFromSlug(folder.slug)
        const record = {
            school: folder.school,
            year: folder.year,
            slug: folder.slug,
            title,
            alt: title,
            date: parsed ? formatHungarianDate(parsed) : '',
        }
        const paths = pagePaths(root, record)
        if (ensureFile(paths.page, renderEventPage(record))) created.push(paths.page)
        ensureFile(paths.main, renderMainPage(record.school))
        added.push(record)
    }
    if (added.length) {
        const data = yaml.dump([...added, ...entries], { lineWidth: -1, noRefs: true })
        atomicWrite(files.data, data)
    }
    return created
}

module.exports = {
    SOURCE_ID,
    pagePaths,
    readEvents,
    readGalleryEntries,
    saveGallery,
    sourcePaths,
    syncGalleryPages,
    validateModel,
}

