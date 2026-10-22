const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const { randomUUID } = require('node:crypto')
const yaml = require('js-yaml')

function sourcePaths(root, config, sourceId) {
    const source = config['frontMatter.data.files']?.find(file => file.id === sourceId)
    if (!source || !/^news-\d{4}-\d{2}$/.test(sourceId)) {
        throw new Error('Ez a hírforrás nincs engedélyezve a Front Matter beállításaiban.')
    }
    const data = path.join(root, 'src/data', `${sourceId}.yml`)
    if (path.resolve(source.file.replace('[[workspace]]', root)) !== data) {
        throw new Error('A hírforrás fájlútvonala nem a tanévi hírlistára mutat.')
    }
    return {
        data,
        content: path.join(root, 'src/content', `common-news-content-${sourceId.slice(5)}.md`),
        runtime: path.join(root, '.frontmatter/runtime'),
    }
}

function nextNewsId(entries, markdown) {
    const ids = [
        ...entries.map(entry => entry.content),
        ...Array.from(markdown.matchAll(/\{\{#ifequal\s+hir\s+["'](news\d+)["']\s*\}\}/g), match => match[1]),
    ]
    let maximum = 0
    for (const id of ids) {
        const match = /^news(\d+)$/.exec(id || '')
        if (!match) continue
        const number = Number(match[1])
        if (!Number.isSafeInteger(number) || number >= Number.MAX_SAFE_INTEGER) {
            throw new Error('A hír sorszáma túl nagy az automatikus kiosztáshoz.')
        }
        maximum = Math.max(maximum, number)
    }
    return `news${String(maximum + 1).padStart(2, '0')}`
}

function validateModel(root, config, model) {
    const fields = ['title', 'site', 'img', 'align', 'imgclass', 'contentclass']
    const record = {}
    for (const field of fields) {
        if (typeof model?.[field] !== 'string' || !model[field].trim()) {
            throw new Error(`A(z) ${field} mező kitöltése kötelező.`)
        }
        record[field] = model[field].trim()
    }
    if (!['ps', 'bs', 'common'].includes(record.site)) throw new Error('Érvénytelen iskola.')
    if (!['left', 'center', 'right'].includes(record.align)) throw new Error('Érvénytelen képigazítás.')
    const folder = config['frontMatter.content.publicFolder']
    const imageRoot = path.resolve(root, (typeof folder === 'string' ? folder : folder.path).replace('[[workspace]]', root))
    if (record.img !== 'nincs' && (
        /[/\\]/.test(record.img) ||
        !/\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(record.img) ||
        !fs.existsSync(path.join(imageRoot, record.img))
    )) throw new Error('A kiválasztott hírkép nem található. Frissítsd a képlistát.')
    return record
}

function atomicWrite(file, text) {
    const temporary = `${file}.${randomUUID()}.tmp`
    try {
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
        // Never remove another writer's lock automatically: two windows trying
        // to recover a crashed writer could otherwise delete a new live lock.
        throw new Error('Másik hírmentés van folyamatban. Próbáld újra néhány másodperc múlva.')
    }
}

// The lock covers the fresh read, allocation and both writes, including saves
// from another VS Code window. Markdown reserves an ID even after YAML deletion.
function saveNews(root, config, request, options = {}) {
    const files = sourcePaths(root, config, request.sourceId)
    fs.mkdirSync(files.runtime, { recursive: true })
    const lock = path.join(files.runtime, `${request.sourceId}.lock`)
    const descriptor = acquireLock(lock)
    try {
        options.assertClean?.([files.data, files.content])
        const oldData = fs.readFileSync(files.data, 'utf8')
        const oldContent = fs.readFileSync(files.content, 'utf8')
        const entries = yaml.load(oldData)
        if (!Array.isArray(entries)) throw new Error('A tanévi hírlista nem YAML-lista.')
        const record = validateModel(root, config, request.model)
        let content = oldContent
        let id
        if (request.baseline) {
            id = request.baseline.content
            const matches = entries.filter(entry => entry.content === id)
            if (matches.length !== 1 || !isDeepStrictEqual(matches[0], request.baseline)) {
                throw new Error('Ezt a hírt közben módosították. Nyisd meg újra az adatforrást a mentés előtt.')
            }
            if (request.model.content !== id) throw new Error('Meglévő hír azonosítója nem változtatható meg.')
            Object.assign(matches[0], record)
        } else {
            if (request.model.content) throw new Error('Új hír azonosítóját a rendszer osztja ki. Nyisd meg az új hír űrlapját.')
            id = nextNewsId(entries, oldContent)
            entries.unshift({ ...record, content: id })
            const eol = oldContent.includes('\r\n') ? '\r\n' : '\n'
            content = oldContent + (oldContent.endsWith(eol) ? eol : eol + eol) +
                [`{{#ifequal hir "${id}"}}`, '', '<!-- Ide írd a hír szövegét. -->', '', '{{/ifequal}}', ''].join(eol)
        }
        const data = yaml.dump(entries, { lineWidth: -1, noRefs: true })
        // Refuse to overwrite a file changed while preparing this operation.
        options.assertClean?.([files.data, files.content])
        if (fs.readFileSync(files.data, 'utf8') !== oldData || fs.readFileSync(files.content, 'utf8') !== oldContent) {
            throw new Error('A hírfájlok közben megváltoztak. Próbáld újra a mentést.')
        }
        const write = options.writeFile || atomicWrite
        // Reserve the ID first. Roll back that exact addition if the YAML write fails.
        if (content !== oldContent) write(files.content, content, 'utf8')
        try {
            write(files.data, data, 'utf8')
        } catch (error) {
            if (content !== oldContent && fs.readFileSync(files.content, 'utf8') === content) {
                atomicWrite(files.content, oldContent)
            }
            throw error
        }
        return { id, entries, created: !request.baseline }
    } finally {
        fs.closeSync(descriptor)
        fs.unlinkSync(lock)
    }
}

module.exports = { nextNewsId, saveNews, sourcePaths }
