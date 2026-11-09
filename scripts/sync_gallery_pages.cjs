#!/usr/bin/env node
// A galériaoldalak és a registrybejegyzések szinkronizálása a feldolgozott
// képmappák alapján. A kézzel felvett galéria (képmappa + resizer.py kimenete)
// így automatikusan eseményoldalt és főoldali tabot kap.
//
// Használat: npm run gallery:sync
const fs = require('node:fs')
const path = require('node:path')
const composeConfig = require('../frontmatter.config.cjs')
const { syncGalleryPages } = require('../.frontmatter/lib/gallery-store.cjs')

const root = process.cwd()
const base = JSON.parse(fs.readFileSync(path.join(root, 'frontmatter.json'), 'utf8'))
const config = composeConfig(base)

const created = syncGalleryPages(root, config)
if (!created.length) {
    console.log('Nincs új galériaoldal, minden feldolgozott képmappa regisztrálva van.')
    process.exit(0)
}
console.log(`Létrehozott galériaoldalak (${created.length}):`)
for (const file of created) {
    console.log(`  ${path.relative(root, file)}`)
}
console.log('A galéria főoldalon az új tanév már megjelenik a felső tabok között.')