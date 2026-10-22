// Project-local integration for Front Matter's Data form. The dashboard talks
// to the VS Code extension through Front Matter's own message bridge. Command
// links cannot be used: VS Code ignores synthetic clicks (isTrusted is false),
// so a clicked command link navigates the webview and blanks the dashboard.
let entries = null
let busy = false

let sorting = false

// The homepage shows the newest news first (filterNews newestFirst). Keep the
// Data view's left list in the same order: numbered news descending, a just
// added entry without an id first, legacy entries without a sequence last.
function newsRank(entry) {
    const content = typeof entry?.content === 'string' ? entry.content.trim() : ''
    if (!content) return Number.MAX_SAFE_INTEGER
    const match = /^news(\d+)$/.exec(content)
    return match ? Number(match[1]) : -1
}

function sortNewestFirst(list) {
    return [...list].sort((left, right) => newsRank(right) - newsRank(left))
}

function sameOrder(left, right) {
    return left.length === right.length && left.every((entry, index) => entry === right[index])
}

window.addEventListener('message', event => {
    if (event.data?.command !== 'dataFileEntries' || !Array.isArray(event.data.payload)) return
    entries = structuredClone(event.data.payload)
    const sorted = sortNewestFirst(event.data.payload)
    if (sorting || sameOrder(event.data.payload, sorted)) return
    // Sorting shifts the selected index, so skip it while an entry is edited.
    const content = document.querySelector('form input[name="content"]')
    if (content && content.value.trim()) return
    // Re-dispatch the sorted entries so the dashboard re-renders the list.
    sorting = true
    window.dispatchEvent(new MessageEvent('message', {
        data: { command: 'dataFileEntries', payload: sorted },
    }))
    sorting = false
})

function postToExtension(message) {
    // Front Matter's dashboard sends every message through the shell bridge
    // (the same vscode.postMessage channel it sets up on startup). Use that
    // channel, but never acquire the VS Code API ourselves: it can be
    // acquired only once and Front Matter needs it for its own messages.
    // This script also runs before the dashboard mounts, so acquiring it
    // here would break the dashboard entirely.
    // Front Matter's shell replaced window.parent with window; the original
    // accessor still returns the real parent window holding the bridge.
    const parentGetter = Object.getOwnPropertyDescriptor(Window.prototype, 'parent')?.get
    const shell = parentGetter ? parentGetter.call(window) : null
    const bridge = shell?.__vscode_post_message__ || window.__vscode_post_message__
    if (typeof bridge !== 'function') {
        throw new Error('A dashboard üzenethídja nem érhető el. Futtasd a Developer: Reload Window parancsot, majd nyisd meg újra az adatforrást.')
    }
    bridge('onmessage', { message })
}

// Front Matter executes dashboard `runCommand` messages as VS Code commands
// (BaseListener), so the save runs in the extension host.
function runCommand(command, args) {
    postToExtension({ command: 'runCommand', payload: { command, args } })
}

function status(form, message, error = false, saved) {
    let output = form.parentElement.querySelector('[data-news-status]')
    if (!output) {
        output = document.createElement('p')
        output.dataset.newsStatus = ''
        output.setAttribute('role', 'status')
        form.after(output)
    }
    output.style.color = error ? 'var(--vscode-errorForeground)' : 'var(--vscode-foreground)'
    output.textContent = message
    if (saved) {
        const link = document.createElement('a')
        link.href = '#'
        link.textContent = ' Hír szövegének megnyitása'
        link.style.color = 'var(--vscode-textLink-foreground)'
        link.addEventListener('click', event => {
            event.preventDefault()
            try {
                runCommand('psbs.news.openText', saved)
            } catch (openError) {
                status(form, openError.message, true)
            }
        })
        output.appendChild(link)
    }
}

async function responseFor(requestId) {
    const url = new URL(`../runtime/news-${requestId}.json`, import.meta.url)
    for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 250))
        try {
            url.search = `t=${Date.now()}`
            const response = await fetch(url, { cache: 'no-store' })
            if (response.ok) return await response.json()
        } catch { /* The command may still be preparing the response. */ }
    }
    throw new Error('Nem érkezett mentési visszajelzés. Nyisd meg újra az adatforrást, és ellenőrizd, létrejött-e a hír. Ha nem, futtasd a Developer: Reload Window parancsot.')
}

function resolveNewsSource(form) {
    const marked = form.querySelector('[data-news-source]')
    if (marked?.dataset.newsSource) return marked.dataset.newsSource
    // Fallback: the dynamic config carries the source id in the placeholder,
    // which reaches the DOM on every uniforms build.
    const content = form.querySelector('input[name="content"], textarea[name="content"]')
    const fallback = content?.placeholder?.match(/news-\d{4}-\d{2}/)
    return fallback ? fallback[0] : null
}

document.addEventListener('submit', async event => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    const sourceId = resolveNewsSource(form)
    if (!sourceId) return
    if (busy) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
    }
    const model = Object.fromEntries(new FormData(form))
    const matches = model.content ? entries?.filter(entry => entry.content === model.content) : []
    if (model.content && matches?.length !== 1) {
        event.preventDefault()
        event.stopImmediatePropagation()
        status(form, 'A hír eredeti adatai nem egyértelműek. Zárd be és válaszd ki újra az adatforrást.', true)
        return
    }
    const requestId = crypto.randomUUID()
    const request = { requestId, sourceId, model, baseline: matches?.[0] || null }
    // Fast path: hand the save to the extension through Front Matter's bridge.
    let sent = false
    try {
        runCommand('psbs.news.save', request)
        sent = true
    } catch { /* No bridge: the dashboard saves the entry instead (fallback). */ }
    if (!sent) {
        // The dashboard saves the entry itself (appended, without an id). The
        // extension's file watcher assigns the id, moves it to the top and
        // creates the text block; the confirmation is a VS Code notification.
        status(form, 'A hír mentése folyamatban. A visszajelzés VS Code-értesítésben jelenik meg.', false)
        return
    }
    // Capture before React submits the whole (potentially stale) data array.
    event.preventDefault()
    event.stopImmediatePropagation()
    busy = true
    const section = form.closest('section') || form
    section.inert = true
    status(form, 'Hír mentése és azonosító ellenőrzése…')
    try {
        const result = await responseFor(requestId)
        if (!result.ok) throw new Error(result.message)
        if (form.isConnected) {
            window.dispatchEvent(new MessageEvent('message', {
                data: { command: 'dataFileEntries', payload: result.entries },
            }))
            // Uniforms remounts the form when it resets after receiving entries.
            await new Promise(resolve => setTimeout(resolve, 0))
            const currentForm = document.querySelector('[data-news-source]')?.closest('form')
                || document.querySelector('form:has(input[name="content"])')
            const currentSource = currentForm ? resolveNewsSource(currentForm) : null
            if (currentForm && currentSource === sourceId) {
                status(currentForm, `Mentve: ${result.id}.${result.created ? ' A szövegblokk elkészült.' : ''}`, false, { sourceId, id: result.id })
            }
        }
    } catch (error) {
        if (form.isConnected) status(form, error.message, true)
    } finally {
        section.inert = false
        busy = false
    }
}, true)