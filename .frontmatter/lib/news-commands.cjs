const fs = require('node:fs')
const path = require('node:path')
const { finalizePendingNews, saveNews, sourcePaths } = require('./news-store.cjs')

let registration
let current
let watcherRegistration
let finalizeTimer

// Loaded by Front Matter's dynamic configuration in the VS Code extension host.
// Refreshes replace the configuration without registering duplicate commands.
function registerNewsCommands(vscode, root, config) {
    current = { root, config }
    if (registration) return
    registration = vscode.commands.registerCommand('psbs.news.save', async request => {
        if (!request || !/^[a-f0-9-]{36}$/.test(request.requestId)) return
        if (!vscode.workspace.isTrusted) return
        const { root, config } = current
        const runtime = path.join(root, '.frontmatter/runtime')
        const response = path.join(runtime, `news-${request.requestId}.json`)
        fs.mkdirSync(runtime, { recursive: true })
        // A repeated command URI must not create another news item.
        if (fs.existsSync(response)) return
        let result
        try {
            result = {
                ok: true,
                ...saveNews(root, config, request, {
                    assertClean(files) {
                        const fileKey = file => process.platform === 'win32'
                            ? path.resolve(file).toLowerCase()
                            : path.resolve(file)
                        if (vscode.workspace.textDocuments.some(document =>
                            document.isDirty && files.some(file => fileKey(document.uri.fsPath) === fileKey(file))
                        )) throw new Error('Előbb mentsd a hírlista és a hírszöveg megnyitott, módosított fájljait, majd próbáld újra.')
                    },
                }),
            }
        } catch (error) {
            result = { ok: false, message: error.message }
        }
        const temporary = response + '.tmp'
        fs.writeFileSync(temporary, JSON.stringify(result), 'utf8')
        fs.renameSync(temporary, response)
    })
    vscode.commands.registerCommand('psbs.news.openText', async request => {
        if (!vscode.workspace.isTrusted || !/^news\d+$/.test(request?.id || '')) return
        try {
            const { root, config } = current
            const file = sourcePaths(root, config, request.sourceId).content
            const document = await vscode.workspace.openTextDocument(file)
            const editor = await vscode.window.showTextDocument(document)
            const position = document.getText().indexOf(`{{#ifequal hir "${request.id}"}}`)
            if (position >= 0) {
                const start = document.positionAt(position)
                editor.selection = new vscode.Selection(start, start)
                editor.revealRange(new vscode.Range(start, start))
            }
        } catch (error) {
            vscode.window.showErrorMessage(error.message)
        }
    })
    watchPendingNews(vscode)
}

function watchPendingNews(vscode) {
    if (watcherRegistration || !current) return
    try {
        const RelativePattern = vscode.RelativePattern
        const createWatcher = vscode.workspace?.createFileSystemWatcher
        if (!RelativePattern || typeof vscode.Uri?.file !== 'function' || typeof createWatcher !== 'function') return
        const pattern = new RelativePattern(vscode.Uri.file(current.root), 'src/data/news-*.yml')
        const watcher = createWatcher.call(vscode.workspace, pattern)
        watcherRegistration = watcher
        const schedule = () => {
            clearTimeout(finalizeTimer)
            finalizeTimer = setTimeout(() => finalizeNow(vscode), 800)
        }
        watcher.onDidChange(schedule)
        watcher.onDidCreate(schedule)
    } catch {
        watcherRegistration = undefined
    }
}

async function finalizeNow(vscode) {
    if (!current) return
    // A concurrent save holds the lock for a moment: retry briefly.
    for (let attempt = 0; attempt < 12; attempt++) {
        try {
            const created = finalizePendingNews(current.root, current.config)
            for (const item of created) {
                vscode.window?.showInformationMessage?.(`Hír létrehozva: ${item.id}. A szövegblokk elkészült.`)
            }
            return
        } catch (error) {
            if (!/folyamatban/.test(error.message || '')) {
                vscode.window?.showErrorMessage?.(`Hír véglegesítési hiba: ${error.message}`)
                return
            }
            await new Promise(resolve => setTimeout(resolve, 500))
        }
    }
}

module.exports = { registerNewsCommands }
