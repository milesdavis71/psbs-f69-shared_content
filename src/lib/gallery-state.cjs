const fs = require('node:fs')
const path = require('node:path')
const { parseGalleryFolder } = require('./gallery-utils.cjs')

function eventKey(entry) {
    const record = parseGalleryFolder(entry?.folder) || entry
    if (!record || !['ps', 'bs'].includes(record.school) ||
        !/^\d{4}-\d{2}$/.test(String(record.year)) ||
        !record.slug || /[/\\]/.test(record.slug) || ['.', '..'].includes(record.slug)) return null
    return `${record.school}/${record.year}/${record.slug}`
}

function readState(root) {
    const file = path.join(root, 'src/data/gallery_state.json')
    return fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf8'))
        : { known: [], deleted: [] }
}

module.exports = { eventKey, readState }
