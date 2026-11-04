const fs = require('node:fs')
const path = require('node:path')
const { saveGallery, syncGalleryPages } = require('./gallery-store.cjs')

let registration
let current
let watcherRegistration
let syncTimer

function fileKey(file) {
    const resolved = path.resolve(file)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isInside(root, file) {
    const relative = path.relative(root, path.resolve(file))
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function registerGalleryCommands(vscode, root, config) {
    current = { root, config }
    if (registration) return
    registration = vscode.commands.registerCommand('psbs.gallery.save', async request => {
        if (!request || !/^[a-f0-9-]{36}$/.test(request.requestId)) return
        if (!vscode.workspace.isTrusted) return
        const { root, config } = current
        const runtime = path.join(root, '.frontmatter/runtime')
        const response = path.join(runtime, `gallery-${request.requestId}.json`)
        fs.mkdirSync(runtime, { recursive: true })
        if (fs.existsSync(response)) return
        let result
        try {
            result = saveGallery(root, config, request, {
                assertClean(files) {
                    if (
                        vscode.workspace.textDocuments.some(
                            document =>
                                document.isDirty &&
                                files.some(file => fileKey(document.uri.fsPath) === fileKey(file))
                        )
                    ) {
                        throw new Error(
                            'Előbb mentsd a galérialista vagy a nyitott eseményoldal módosításait, majd próbáld újra.'
                        )
                    }
                },
            })
        } catch (error) {
            result = { ok: false, message: error.message }
        }
        const temporary = response + '.tmp'
        fs.writeFileSync(temporary, JSON.stringify(result), 'utf8')
        fs.renameSync(temporary, response)
    })
    vscode.commands.registerCommand('psbs.gallery.openPage', async request => {
        if (!vscode.workspace.isTrusted || !request?.page) return
        try {
            const file = path.resolve(request.page)
            if (!isInside(current.root, file) || !fs.existsSync(file)) return
            const document = await vscode.workspace.openTextDocument(file)
            await vscode.window.showTextDocument(document)
        } catch (error) {
            vscode.window.showErrorMessage(error.message)
        }
    })
    vscode.commands.registerCommand('psbs.gallery.openImages', async request => {
        if (!vscode.workspace.isTrusted || !request?.school) return
        try {
            const directory = path.resolve(
                current.root,
                'src/assets/img',
                request.school,
                'galeriak',
                String(request.year || ''),
                String(request.slug || '')
            )
            if (!isInside(current.root, directory) || !fs.existsSync(directory)) {
                throw new Error('A galériamappa nem található.')
            }
            await vscode.env.openExternal(vscode.Uri.file(directory))
        } catch (error) {
            vscode.window.showErrorMessage(error.message)
        }
    })
    watchGalleryData(vscode)
}

function watchGalleryData(vscode) {
    if (watcherRegistration || !current) return
    try {
        const RelativePattern = vscode.RelativePattern
        const createWatcher = vscode.workspace?.createFileSystemWatcher
        if (!RelativePattern || typeof vscode.Uri?.file !== 'function' || typeof createWatcher !== 'function') return
        const pattern = new RelativePattern(vscode.Uri.file(current.root), 'src/data/gallery_events.yml')
        const watcher = createWatcher.call(vscode.workspace, pattern)
        watcherRegistration = watcher
        const schedule = () => {
            clearTimeout(syncTimer)
            syncTimer = setTimeout(() => syncNow(vscode), 800)
        }
        watcher.onDidChange(schedule)
        watcher.onDidCreate(schedule)
    } catch {
        watcherRegistration = undefined
    }
}

async function syncNow(vscode) {
    if (!current) return
    for (let attempt = 0; attempt < 12; attempt++) {
        try {
            const created = syncGalleryPages(current.root, current.config)
            for (const file of created) {
                vscode.window?.showInformationMessage?.(
                    `Galériaoldal létrehozva: ${path.basename(file)}`
                )
            }
            return
        } catch (error) {
            if (!/folyamatban/.test(error.message || '')) {
                vscode.window?.showErrorMessage?.(`Galéria szinkronizálási hiba: ${error.message}`)
                return
            }
            await new Promise(resolve => setTimeout(resolve, 500))
        }
    }
}

module.exports = { registerGalleryCommands }
