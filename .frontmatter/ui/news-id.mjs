// Project-local integration for Front Matter's Data form. The dashboard talks
// to the VS Code extension through Front Matter's own message bridge. Command
// links cannot be used: VS Code ignores synthetic clicks (isTrusted is false),
// so a clicked command link navigates the webview and blanks the dashboard.
let entries = null
let entriesFile = null
let busy = false
let extensionBridge = null

let sorting = false

// A new entry has no content id until the save assigns one. It always belongs
// at the top; every other entry keeps the file's order, so a manual drag & drop
// in the Data list is respected and never re-sorted automatically.
function isPending(entry) {
    return !(typeof entry?.content === 'string' && entry.content.trim())
}

function pendingFirst(list) {
    const pending = list.filter(isPending)
    if (pending.length === 0) return [...list]
    return [...pending, ...list.filter(entry => !isPending(entry))]
}

function sameOrder(left, right) {
    return left.length === right.length && left.every((entry, index) => entry === right[index])
}

window.addEventListener('message', event => {
    if (event.data?.command !== 'dataFileEntries') return
    // 10.14 wraps the list in { file, entries }; older versions send an array.
    const payload = event.data.payload
    const list = Array.isArray(payload) ? payload : payload?.entries
    if (!Array.isArray(list)) return
    if (!Array.isArray(payload) && !/(?:^|[/\\])news-\d{4}-\d{2}\.yml$/.test(payload.file || '')) return
    entriesFile = Array.isArray(payload) ? null : payload.file
    entries = structuredClone(list)
    const ordered = pendingFirst(list)
    if (sorting || sameOrder(list, ordered)) return
    // Reordering shifts the selected index, so skip it while an entry is edited.
    const content = document.querySelector('form input[name="content"]')
    if (content && content.value.trim()) return
    // Re-dispatch so the dashboard re-renders the list with the new entry first.
    sorting = true
    window.dispatchEvent(new MessageEvent('message', {
        data: { command: 'dataFileEntries', payload: entriesPayload(ordered) },
    }))
    sorting = false
})

function entriesPayload(list) {
    return entriesFile ? { file: entriesFile, entries: list } : list
}

function postToExtension(message) {
    // VS Code shadows window.parent with window. In Chromium, the native
    // accessor is an OWN property of Window, not on Window.prototype. Obtain
    // an untouched accessor from a temporary blank frame and call it on this
    // window to reach the existing shell bridge. Do not acquire a second API.
    if (!extensionBridge && typeof window.__vscode_post_message__ === 'function') {
        extensionBridge = window.__vscode_post_message__.bind(window)
    }
    if (!extensionBridge) {
        const probe = document.createElement('iframe')
        probe.hidden = true
        try {
            document.documentElement.appendChild(probe)
            const parentGetter = Object.getOwnPropertyDescriptor(probe.contentWindow, 'parent')?.get
            const shell = parentGetter?.call(window)
            if (typeof shell?.__vscode_post_message__ === 'function') {
                extensionBridge = shell.__vscode_post_message__.bind(shell)
            }
        } finally {
            probe.remove()
        }
    }
    if (!extensionBridge) {
        throw new Error('A dashboard üzenethídja nem érhető el. Futtasd a Developer: Reload Window parancsot, majd nyisd meg újra az adatforrást.')
    }
    extensionBridge('onmessage', { message })
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

// Front Matter's list rows expose selectedIndex-currentIndex. The selected
// index distinguishes Add from Update independently of the editable content ID.
function selectedIndex(form) {
    const row = form.closest('section')?.querySelector('li.sortable_item[data-test]')
    return row?.getAttribute('data-test')?.match(/^(null|\d+)-\d+$/)?.[1]
}

function baselineFor(form) {
    const index = selectedIndex(form)
    if (index === 'null' || (Array.isArray(entries) && entries.length === 0)) return null
    const baseline = index === undefined ? null : entries?.[Number(index)]
    if (!baseline) throw new Error('A hír eredeti adatai nem egyértelműek. Zárd be és válaszd ki újra az adatforrást.')
    return isPending(baseline) ? null : baseline
}

const imageSearches = new WeakMap()

function searchText(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').trim()
}

function refreshImageSearch(form) {
    const select = form.querySelector('select[name="img"]')
    if (!select) return
    let search = imageSearches.get(select)
    if (!search) {
        const wrapper = document.createElement('div')
        wrapper.className = 'news-image-search'
        const label = document.createElement('label')
        label.textContent = 'Hírkép keresése'
        const input = document.createElement('input')
        input.type = 'search'
        input.placeholder = 'Keresés fájlnévre…'
        input.autocomplete = 'off'
        // No name: this is a filter, never part of the saved news model.
        label.appendChild(input)
        const hint = document.createElement('small')
        hint.setAttribute('role', 'status')
        wrapper.append(label, hint)
        select.before(wrapper)
        const filter = () => {
            const query = searchText(input.value)
            let matches = 0
            for (const option of select.options) {
                const matchesQuery = searchText(option.textContent).includes(query)
                if (option.value && option.value !== 'nincs' && matchesQuery) matches++
                // Keep the current value in the native select so filtering can
                // never silently change either FormData or Uniforms' model.
                option.hidden = Boolean(query) && !matchesQuery &&
                    !option.selected && option.value !== 'nincs' && option.value !== ''
            }
            const message = query
                ? (matches ? `${matches} találat. A kiválasztott kép és a „nincs” is elérhető.` : 'Nincs találat. A kiválasztott kép és a „nincs” továbbra is elérhető.')
                : ''
            if (hint.textContent !== message) hint.textContent = message
        }
        input.addEventListener('input', filter)
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') event.preventDefault()
            if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                input.value = ''
                filter()
            }
        })
        select.addEventListener('change', filter)
        form.addEventListener('reset', () => {
            input.value = ''
            filter()
        })
        search = { wrapper, filter }
        imageSearches.set(select, search)
    }
    if (search.wrapper.nextElementSibling !== select) select.before(search.wrapper)
    search.filter()
}

function refreshContentField() {
    for (const form of document.querySelectorAll('form')) {
        if (!resolveNewsSource(form)) continue
        const input = form.querySelector('input[name="content"]')
        // Also clear a readOnly flag left by a previously loaded schema.
        if (input?.readOnly) input.readOnly = false
        refreshImageSearch(form)
    }
}

new MutationObserver(refreshContentField).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['readonly'],
})
refreshContentField()

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
    let baseline
    try {
        baseline = baselineFor(form)
    } catch (error) {
        event.preventDefault()
        event.stopImmediatePropagation()
        status(form, error.message, true)
        return
    }
    const requestId = crypto.randomUUID()
    const request = { requestId, sourceId, model, baseline }
    // Fast path: hand the save to the extension through Front Matter's bridge.
    let sent = false
    try {
        runCommand('psbs.news.save', request)
        sent = true
    } catch { /* No bridge: the dashboard saves the entry instead (fallback). */ }
    if (!sent) {
        // The watcher only finalizes empty IDs. A manual ID must go through
        // saveNews for collision checks and creation of its matching text block.
        if ((!baseline && model.content?.trim()) || (baseline && model.content !== baseline.content)) {
            event.preventDefault()
            event.stopImmediatePropagation()
            status(form, 'A kézi azonosító mentéséhez futtasd a Developer: Reload Window parancsot, majd nyisd meg újra az adatforrást.', true)
            return
        }
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
                data: { command: 'dataFileEntries', payload: entriesPayload(result.entries) },
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
