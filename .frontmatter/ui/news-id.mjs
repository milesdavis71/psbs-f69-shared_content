// Project-local integration for Front Matter's Data form. Command URIs are
// enabled by its dashboard; disk access stays in the VS Code extension host.
let entries = null
let busy = false

window.addEventListener('message', event => {
    if (event.data?.command === 'dataFileEntries' && Array.isArray(event.data.payload)) {
        entries = structuredClone(event.data.payload)
    }
})

function commandLink(command, payload) {
    const link = document.createElement('a')
    link.href = `command:${command}?${encodeURIComponent(JSON.stringify([payload]))}`
    return link
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
        const link = commandLink('psbs.news.openText', saved)
        link.textContent = ' Hír szövegének megnyitása'
        link.style.color = 'var(--vscode-textLink-foreground)'
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

document.addEventListener('submit', async event => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    const marker = form.querySelector('[data-news-source]')
    if (!marker) return
    // Capture before React submits the whole (potentially stale) data array.
    event.preventDefault()
    event.stopImmediatePropagation()
    if (busy) return
    const sourceId = marker.dataset.newsSource
    const model = Object.fromEntries(new FormData(form))
    const matches = model.content ? entries?.filter(entry => entry.content === model.content) : []
    if (model.content && matches?.length !== 1) {
        status(form, 'A hír eredeti adatai nem egyértelműek. Zárd be és válaszd ki újra az adatforrást.', true)
        return
    }
    const requestId = crypto.randomUUID()
    const link = commandLink('psbs.news.save', {
        requestId, sourceId, model, baseline: matches?.[0] || null,
    })
    busy = true
    const section = form.closest('section') || form
    section.inert = true
    status(form, 'Hír mentése és azonosító ellenőrzése…')
    try {
        document.body.appendChild(link)
        link.click()
        link.remove()
        const result = await responseFor(requestId)
        if (!result.ok) throw new Error(result.message)
        if (form.isConnected) {
            window.dispatchEvent(new MessageEvent('message', {
                data: { command: 'dataFileEntries', payload: result.entries },
            }))
            // Uniforms remounts the form when it resets after receiving entries.
            await new Promise(resolve => setTimeout(resolve, 0))
            const currentMarker = document.querySelector('[data-news-source]')
            const currentForm = currentMarker?.closest('form')
            if (currentForm && currentMarker.dataset.newsSource === sourceId) {
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
