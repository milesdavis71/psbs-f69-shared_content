const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const {
    saveGallery,
    sourcePaths,
    syncGalleryPages,
    withGalleryRetry,
} = require('../.frontmatter/lib/gallery-store.cjs')

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-store-test-'))
    const folder = 'ps/2026-27/2026_09_10_teszt_esemeny'
    const directory = path.join(root, 'src/assets/img/ps/galeriak/2026-27/2026_09_10_teszt_esemeny')
    fs.mkdirSync(path.join(directory, 'full'), { recursive: true })
    fs.mkdirSync(path.join(directory, 'thumb'), { recursive: true })
    for (const number of ['01', '02', '03']) {
        fs.writeFileSync(path.join(directory, 'full', `${number}_full.jpg`), '')
        fs.writeFileSync(path.join(directory, 'thumb', `${number}_thumb.jpg`), '')
    }
    const config = {
        'frontMatter.data.files': [
            {
                id: 'gallery-events',
                file: '[[workspace]]/src/data/gallery_events.yml',
            },
        ],
    }
    const files = sourcePaths(root, config, 'gallery-events')
    fs.mkdirSync(path.dirname(files.data), { recursive: true })
    fs.writeFileSync(files.data, '[]\n')
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const model = {
        folder,
        school: 'ps',
        year: '2026-27',
        slug: '2026_09_10_teszt_esemeny',
        title: 'Teszt esemény',
        date: '',
        alt: '',
    }
    return { root, config, files, folder, directory, model }
}

function read(file) {
    return yaml.load(fs.readFileSync(file, 'utf8'))
}

test('an abandoned process lock is recovered by the next save', (t) => {
    const f = fixture(t)
    const { execFileSync } = require('node:child_process')
    const deadPid = Number(execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))']))
    fs.mkdirSync(f.files.runtime, { recursive: true })
    const lock = path.join(f.files.runtime, 'gallery-events.lock')
    fs.writeFileSync(lock, JSON.stringify({ pid: deadPid }))
    assert.equal(saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model }).ok, true)
    assert.equal(fs.existsSync(lock), false)
})

test('a live lock is preserved; GUI saves and rebuilds wait until it is released', async (t) => {
    const f = fixture(t)
    fs.mkdirSync(f.files.runtime, { recursive: true })
    const lock = path.join(f.files.runtime, 'gallery-events.lock')
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }))
    // Old modification time must not allow stealing a live owner's lock.
    fs.utimesSync(lock, new Date(0), new Date(0))
    assert.throws(() => syncGalleryPages(f.root, f.config), { code: 'GALLERY_BUSY' })
    await assert.rejects(withGalleryRetry(() => syncGalleryPages(f.root, f.config), {
        timeout: 40, delay: 10,
    }), { code: 'GALLERY_BUSY' })
    assert.equal(fs.existsSync(lock), true)
    const release = setTimeout(() => fs.unlinkSync(lock), 80)
    t.after(() => clearTimeout(release))
    const [saved] = await Promise.all([
        withGalleryRetry(() => saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })),
        withGalleryRetry(() => syncGalleryPages(f.root, f.config)),
    ])
    assert.equal(saved.ok, true)
    assert.equal(read(f.files.data).length, 1)
    assert.equal(fs.existsSync(lock), false)
})

test('case-only duplicate slugs converge and preserve the GUI metadata', (t) => {
    const f = fixture(t)
    const saved = saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const entry = read(f.files.data)[0]
    fs.writeFileSync(f.files.data, yaml.dump([
        { ...entry, folder: undefined, slug: entry.slug.toUpperCase(), title: 'Inferred title' },
        entry,
    ]))
    syncGalleryPages(f.root, f.config)
    assert.deepEqual(read(f.files.data), [entry])
    const files = [saved.page, f.files.data, path.join(f.root, 'src/data/gallery_state.json')]
    const timestamp = new Date('2020-01-01T00:00:00Z')
    for (const file of files) fs.utimesSync(file, timestamp, timestamp)
    for (let i = 0; i < 3; i++) syncGalleryPages(f.root, f.config)
    for (const file of files) assert.equal(fs.statSync(file).mtimeMs, timestamp.getTime())
    assert.match(fs.readFileSync(saved.page, 'utf8'), /title: Teszt/)
})

test('dashboard-only date and alt edits update the page once', (t) => {
    const f = fixture(t)
    const saved = saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const entries = read(f.files.data)
    entries[0].alt = 'Changed alt'
    entries[0].date = '2026. 09. 12.'
    fs.writeFileSync(f.files.data, yaml.dump(entries))
    syncGalleryPages(f.root, f.config)
    assert.match(fs.readFileSync(saved.page, 'utf8'), /alt: Changed alt/)
    assert.match(fs.readFileSync(saved.page, 'utf8'), /date: 2026\. 09\. 12\./)
    const timestamp = new Date('2020-01-01T00:00:00Z')
    fs.utimesSync(saved.page, timestamp, timestamp)
    syncGalleryPages(f.root, f.config)
    assert.equal(fs.statSync(saved.page).mtimeMs, timestamp.getTime())
})

for (const school of ['ps', 'bs']) {
    test(`${school} watcher handles GUI saves from another process and settles`, { timeout: 15000 }, async (t) => {
        const f = fixture(t)
        const projectRoot = path.resolve(__dirname, '..')
        const source = fs.readFileSync(path.join(projectRoot, 'gulpfile.babel.js'), 'utf8')
        const gulp = require('gulp')
        const panini = require('panini')
        const vm = require('node:vm')
        const { spawn } = require('node:child_process')
        const model = { ...f.model, school, folder: f.model.folder.replace(/^ps\//, `${school}/`) }
        if (school === 'bs') {
            fs.cpSync(f.directory, f.directory.replace(`${path.sep}ps${path.sep}`, `${path.sep}bs${path.sep}`), { recursive: true })
            fs.rmSync(path.join(f.root, 'src/assets/img/ps'), { recursive: true })
        }
        fs.writeFileSync(path.join(f.root, 'frontmatter.json'), JSON.stringify(f.config))
        for (const dir of ['layouts', 'partials', 'helpers', 'content', 'pages/kozos']) {
            fs.mkdirSync(path.join(f.root, 'src', dir), { recursive: true })
        }
        fs.writeFileSync(path.join(f.root, `src/layouts/two_columns_${school}.html`), '{{> body}}')
        for (const name of ['gallery-breadcrumb', 'title', 'common-gallery-index']) {
            fs.writeFileSync(path.join(f.root, `src/partials/${name}.html`), '')
        }
        fs.writeFileSync(path.join(f.root, 'src/partials/common-galery-from-yaml.html'), '{{title}}|{{alt}}|{{date}}')
        saveGallery(f.root, f.config, { sourceId: 'gallery-events', model })
        let watcher, reloads = 0, lockWaits = 0
        const errors = []
        const noop = done => done()
        const rootRequire = require('node:module').createRequire(path.join(projectRoot, 'gulpfile.babel.js'))
        const context = {
            require(id) {
                const module = rootRequire(id)
                if (id !== './.frontmatter/lib/gallery-store.cjs') return module
                return { ...module, syncGalleryPages(...args) {
                    try { return module.syncGalleryPages(...args) }
                    catch (error) {
                        if (error.code === 'GALLERY_BUSY') lockWaits++
                        throw error
                    }
                } }
            },
            process, fs, path, panini, mergeStream: require('merge-stream'),
            PATHS: { assets: [], dist: path.join(f.root, 'dist') },
            currentSchool: school, SHARED_DIR: 'kozos',
            browser: { reload() { reloads++ } },
            console: { error(...args) { errors.push(args) } },
            copy: noop, sassBuild: noop, javascript: noop, images: noop, styleGuide: noop,
            gulp: {
                src: gulp.src, dest: gulp.dest, series: gulp.series,
                watch(pattern, ...args) {
                    if (Array.isArray(pattern) && pattern.some(item => item.includes('src/pages/'))) {
                        watcher = gulp.watch(pattern, ...args)
                        watcher.on('error', error => errors.push(error))
                    }
                },
            },
        }
        vm.createContext(context)
        for (const name of ['syncGalleries', 'resetPages', 'pagesSchool', 'reload', 'rebuildSchool', 'watchSchool']) {
            const match = source.match(new RegExp(`(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))
            assert.ok(match, name)
            vm.runInContext(match[0], context)
        }
        const previousCwd = process.cwd()
        process.chdir(f.root)
        try {
            panini.refresh()
            context.watchSchool()
            await new Promise(resolve => watcher.once('ready', resolve))
            const child = spawn(process.execPath, ['-e', `
                const { saveGallery, withGalleryRetry } = require(${JSON.stringify(path.join(projectRoot, '.frontmatter/lib/gallery-store.cjs'))});
                (async () => {
                    for (let i = 0; i < 3; i++) {
                        await withGalleryRetry(() => saveGallery(${JSON.stringify(f.root)}, ${JSON.stringify(f.config)}, {
                            sourceId: 'gallery-events', model: { ...${JSON.stringify(model)}, title: 'GUI update ' + i }
                        }));
                        if (i === 0) {
                            const fs = require('fs');
                            const lock = ${JSON.stringify(path.join(f.files.runtime, 'gallery-events.lock'))};
                            fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }), { flag: 'wx' });
                            await new Promise(resolve => setTimeout(resolve, 1600));
                            fs.unlinkSync(lock);
                        }
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                })().catch(error => { console.error(error); process.exitCode = 1; });
            `], { stdio: ['ignore', 'ignore', 'pipe'] })
            let stderr = ''
            child.stderr.on('data', data => { stderr += data })
            assert.equal(await new Promise(resolve => child.once('exit', resolve)), 0, stderr)
            const output = path.join(f.root, 'dist/galeriak', model.year, `${model.slug}.html`)
            const waitFor = async predicate => {
                const deadline = Date.now() + 7000
                while (!predicate()) {
                    assert.ok(Date.now() < deadline, 'watcher failed to publish the edit')
                    await new Promise(resolve => setTimeout(resolve, 100))
                }
            }
            await waitFor(() => fs.existsSync(output) && fs.readFileSync(output, 'utf8').includes('GUI update 2'))
            assert.ok(lockWaits > 0, 'the rebuild must wait for the other process lock')
            // A malformed intermediate edit must not kill the watcher.
            fs.writeFileSync(f.files.data, '[invalid YAML')
            await waitFor(() => errors.length === 1)
            // A second dashboard edit proves the watcher remains responsive.
            const entries = [{ ...model, title: 'Dashboard edit', alt: model.title, date: '2026. 09. 10.' }]
            entries[0].title = 'Dashboard edit'
            fs.writeFileSync(f.files.data, yaml.dump(entries))
            await waitFor(() => fs.readFileSync(output, 'utf8').includes('Dashboard edit'))
            await new Promise(resolve => setTimeout(resolve, 1800))
            const settled = reloads
            await new Promise(resolve => setTimeout(resolve, 1500))
            assert.equal(reloads, settled, 'reload loop continued after the edit settled')
            assert.ok(reloads > 0 && reloads <= 5, `unexpected reload count: ${reloads}`)
            assert.equal(errors.length, 1)
            assert.match(errors[0][0], /rebuild failed/)
        } finally {
            await watcher?.close()
            process.chdir(previousCwd)
            panini.refresh()
        }
    })
}

test('dashboard deletion removes HTML and cards while preserving images across syncs', (t) => {
    const f = fixture(t)
    const saved = saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    syncGalleryPages(f.root, f.config)
    const output = path.join(f.root, 'dist/galeriak', f.model.year, `${f.model.slug}.html`)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, 'old HTML')
    fs.writeFileSync(f.files.data, '[]\n')
    syncGalleryPages(f.root, f.config)
    syncGalleryPages(f.root, f.config)
    assert.equal(fs.existsSync(saved.page), false)
    assert.equal(fs.existsSync(output), false)
    assert.equal(fs.existsSync(path.join(f.directory, 'full/01_full.jpg')), true)
    assert.deepEqual(read(f.files.data), [])
    const gallery = require('../src/lib/gallery.js')
    assert.deepEqual(gallery.cards({ projectPath: f.root, gallery_events: [] }, 'ps'), [])
    saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    syncGalleryPages(f.root, f.config)
    assert.equal(fs.existsSync(saved.page), true)
    assert.equal(gallery.cards({ projectPath: f.root, gallery_events: read(f.files.data) }, 'ps').length, 1)
})

test('a gallery save creates the registry entry, event page and main grid', (t) => {
    const f = fixture(t)
    const result = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: f.model,
    })
    assert.equal(result.created, true)
    assert.equal(result.id, '2026_09_10_teszt_esemeny')
    assert.equal(result.mainCreated, true)
    const entries = read(f.files.data)
    assert.equal(entries.length, 1)
    assert.deepEqual(entries[0], {
        folder: 'ps/2026-27/2026_09_10_teszt_esemeny',
        school: 'ps',
        year: '2026-27',
        slug: '2026_09_10_teszt_esemeny',
        title: 'Teszt esemény',
        alt: 'Teszt esemény',
        date: '2026. 09. 10.',
    })
    const page = fs.readFileSync(
        path.join(f.root, 'src/pages/ps/galeriak/2026-27/2026_09_10_teszt_esemeny.html'),
        'utf8'
    )
    assert.match(page, /layout: two_columns_ps/)
    assert.match(page, /page: galeriak_root/)
    assert.match(page, /common-galery-from-yaml/)
    const main = fs.readFileSync(path.join(f.root, 'src/pages/ps/galeriak.html'), 'utf8')
    assert.match(main, /common-gallery-index/)
})

test('re-saving the same folder updates one entry and preserves the page body', (t) => {
    const f = fixture(t)
    saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const pageFile = path.join(
        f.root,
        'src/pages/ps/galeriak/2026-27/2026_09_10_teszt_esemeny.html'
    )
    fs.appendFileSync(pageFile, '\n<!-- saját megjegyzés -->\n')
    const result = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: { ...f.model, title: 'Módosított cím', date: '2026. 09. 11.' },
    })
    assert.equal(result.created, false)
    const entries = read(f.files.data)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].title, 'Módosított cím')
    assert.equal(entries[0].date, '2026. 09. 11.')
    assert.match(fs.readFileSync(pageFile, 'utf8'), /saját megjegyzés/)
})

test('sync after an update stops writing once the gallery is current', (t) => {
    const f = fixture(t)
    saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const saved = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: { ...f.model, title: 'Updated gallery' },
    })
    syncGalleryPages(f.root, f.config)
    const files = [saved.page, f.files.data, path.join(f.root, 'src/data/gallery_state.json')]
    const timestamp = new Date('2020-01-01T00:00:00Z')
    for (const file of files) fs.utimesSync(file, timestamp, timestamp)
    for (let i = 0; i < 3; i++) {
        assert.deepEqual(syncGalleryPages(f.root, f.config), [])
    }
    for (const file of files) assert.equal(fs.statSync(file).mtimeMs, timestamp.getTime())
})

test('invalid folders and stale baselines are rejected', (t) => {
    const f = fixture(t)
    assert.throws(
        () =>
            saveGallery(f.root, f.config, {
                sourceId: 'gallery-events',
                model: { ...f.model, folder: 'ps/2026-27/2026_09_10_nincs_ilyen' },
            }),
        /nem található/
    )
    saveGallery(f.root, f.config, { sourceId: 'gallery-events', model: f.model })
    const baseline = read(f.files.data)[0]
    assert.throws(
        () =>
            saveGallery(f.root, f.config, {
                sourceId: 'gallery-events',
                model: { ...f.model, title: 'Új' },
                baseline: { ...baseline, title: 'Közben módosult' },
            }),
        /közben módosították/
    )
})

test('the chosen school decides the gallery and mismatches are rejected', (t) => {
    const f = fixture(t)
    const bsDirectory = path.join(
        f.root,
        'src/assets/img/bs/galeriak/2026-27/2026_09_10_teszt_esemeny'
    )
    fs.mkdirSync(path.join(bsDirectory, 'full'), { recursive: true })
    fs.mkdirSync(path.join(bsDirectory, 'thumb'), { recursive: true })
    fs.writeFileSync(path.join(bsDirectory, 'full', '01_full.jpg'), '')
    fs.writeFileSync(path.join(bsDirectory, 'thumb', '01_thumb.jpg'), '')

    // A ps mappa ps iskolához tartozik.
    const psResult = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: f.model,
    })
    assert.equal(psResult.school, 'ps')

    // A bs mappa bs iskolához tartozik.
    const bsResult = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: {
            ...f.model,
            folder: 'bs/2026-27/2026_09_10_teszt_esemeny',
            school: 'bs',
            year: '2026-27',
        },
    })
    assert.equal(bsResult.school, 'bs')
    assert.equal(bsResult.year, '2026-27')

    // A galériamappa kanonikus: még ha a form iskolája ellentmond is,
    // a bejegyzés a mappa iskolájához kerül.
    const canonical = saveGallery(f.root, f.config, {
        sourceId: 'gallery-events',
        model: {
            ...f.model,
            folder: 'bs/2026-27/2026_09_10_teszt_esemeny',
            school: 'ps',
        },
    })
    assert.equal(canonical.school, 'bs')
    assert.equal(canonical.year, '2026-27')
    assert.equal(canonical.slug, '2026_09_10_teszt_esemeny')
    const entries = read(f.files.data)
    assert.equal(entries.filter((entry) => entry.school === 'bs').length, 1)

    // A mappával nem egyező tanév nem választható.
    assert.throws(
        () =>
            saveGallery(f.root, f.config, {
                sourceId: 'gallery-events',
                model: {
                    ...f.model,
                    folder: 'ps/2026-27/2026_09_10_teszt_esemeny',
                    school: 'ps',
                    year: '2025-26',
                },
            }),
        /nem felel meg a galériamappának/
    )
})

test('dashboard fallback sync creates missing event pages', (t) => {
    const f = fixture(t)
    fs.writeFileSync(
        f.files.data,
        yaml.dump([
            {
                school: 'ps',
                year: '2026-27',
                date: '2026. 09. 10.',
                slug: '2026_09_10_teszt_esemeny',
                title: 'Kézi bejegyzés',
                alt: 'Kézi bejegyzés',
            },
        ])
    )
    const created = syncGalleryPages(f.root, f.config)
    assert.equal(created.length, 1)
    assert.match(fs.readFileSync(created[0], 'utf8'), /Kézi bejegyzés/)
})
