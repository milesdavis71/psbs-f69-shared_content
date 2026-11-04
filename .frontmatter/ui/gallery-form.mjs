// Project-local integration for the Front Matter Data form. The gallery form
// uses the same message bridge as the news form; it never acquires the VS Code
// API itself, because Front Matter owns that single acquisition.
let entries = null
let busy = false

function postToExtension(message) {
    const parentGetter = Object.getOwnPropertyDescriptor(Window.prototype, 'parent')?.get
    const shell = parentGetter ? parentGetter.call(window) : null
    const bridge = shell?.__vscode_post_message__ || window.__vscode_post_message__
    if (typeof bridge !== 'function') {
        throw new Error(
            'A dashboard üzenethídja nem érhető el. Futtasd a Developer: Reload Window parancsot, majd nyisd meg újra az adatforrást.'
        )
    }
    bridge('onmessage', { message })
}

function runCommand(command, args) {
    postToExtension({ command: 'runCommand', payload: { command, args } })
}

function resolveGallerySource(form) {
    const marked = form.querySelector('[data-gallery-source]')
    if (marked?.dataset.gallerySource) return marked.dataset.gallerySource
    const folder = form.querySelector('[name="folder"]')
    const fallback = folder?.placeholder?.match(/gallery-events/)
    return fallback ? 'gallery-events' : null
}

function field(form, name) {
    return form.querySelector(`[name="${name}"]`)
}

function setField(form, name, value) {
    const input = field(form, name)
    if (!input || !value || input.value === value) return
    const prototype =
        input.tagName === 'SELECT'
            ? window.HTMLSelectElement.prototype
            : input.tagName === 'TEXTAREA'
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    if (setter) setter.call(input, value)
    else input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

function titleFromSlug(slug) {
    const withoutDate = slug.replace(/^\d{4}[_ -]\d{2}[_ -]\d{2}(?:[_ -]+|$)/, '')
    const title = withoutDate.replace(/[_ -]+/g, ' ').trim()
    return title ? title[0].toUpperCase() + title.slice(1) : slug
}

function dateFromSlug(slug) {
    const match = /^(\d{4})[_ -](\d{2})[_ -](\d{2})/.exec(slug)
    return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : ''
}

function fillFromFolder(form) {
    const value = field(form, 'folder')?.value || ''
    const parts = value.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts.length !== 3) return
    const [school, year, slug] = parts
    setField(form, 'school', school)
    setField(form, 'year', year)
    setField(form, 'slug', slug)
    setField(form, 'date', dateFromSlug(slug))
    const title = field(form, 'title')
    if (!title?.value?.trim()) setField(form, 'title', titleFromSlug(slug))
}


function status(form, message, error = false, saved) {
    let output = form.parentElement.querySelector('[data-gallery-status]')
    if (!output) {
        output = document.createElement('p')
        output.dataset.galleryStatus = ''
        output.setAttribute('role', 'status')
        form.after(output)
    }
    output.style.color = error ? 'var(--vscode-errorForeground)' : 'var(--vscode-foreground)'
    output.textContent = message
    if (saved?.page) {
        const page = document.createElement('a')
        page.href = '#'
        page.textContent = ' Eseményoldal megnyitása'
        page.style.color = 'var(--vscode-textLink-foreground)'
        page.addEventListener('click', event => {
            event.preventDefault()
            try {
                runCommand('psbs.gallery.openPage', { page: saved.page })
            } catch (openError) {
                status(form, openError.message, true)
            }
        })
        output.appendChild(page)
    }
}

async function responseFor(requestId) {
    const url = new URL(`../runtime/gallery-${requestId}.json`, import.meta.url)
    for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 250))
        try {
            url.search = `t=${Date.now()}`
            const response = await fetch(url, { cache: 'no-store' })
            if (response.ok) return await response.json()
        } catch {
            /* The command may still be preparing the response. */
        }
    }
    throw new Error(
        'Nem érkezett mentési visszajelzés. Nyisd meg újra az adatforrást, és ellenőrizd, létrejött-e a galéria.'
    )
}

document.addEventListener(
    'change',
    event => {
        const form = event.target?.closest?.('form')
        if (!form || !resolveGallerySource(form)) return
        if (event.target.name === 'folder') fillFromFolder(form)
    },
    true
)


document.addEventListener(
    'submit',
    async event => {
        const form = event.target
        if (!(form instanceof HTMLFormElement)) return
        const sourceId = resolveGallerySource(form)
        if (!sourceId) return
        fillFromFolder(form)
        if (busy) {
            event.preventDefault()
            event.stopImmediatePropagation()
            return
        }
        const model = Object.fromEntries(new FormData(form))
        const matches = model.folder
            ? entries?.filter(
                  entry =>
                      entry.school === model.school &&
                      String(entry.year) === String(model.year) &&
                      entry.slug === model.slug
              )
            : []
        const requestId = crypto.randomUUID()
        const request = { requestId, sourceId, model, baseline: matches?.[0] || null }
        let sent = false
        try {
            runCommand('psbs.gallery.save', request)
            sent = true
        } catch {
            /* No bridge: the dashboard saves the entry instead. */
        }
        if (!sent) {
            status(
                form,
                'A galéria mentése folyamatban. A visszajelzés VS Code-értesítésben jelenik meg.'
            )
            return
        }
        event.preventDefault()
        event.stopImmediatePropagation()
        busy = true
        const section = form.closest('section') || form
        section.inert = true
        status(form, 'Galéria mentése és oldal létrehozása…')
        try {
            const result = await responseFor(requestId)
            if (!result.ok) throw new Error(result.message)
            if (form.isConnected) {
                window.dispatchEvent(
                    new MessageEvent('message', {
                        data: { command: 'dataFileEntries', payload: result.entries },
                    })
                )
                await new Promise(resolve => setTimeout(resolve, 0))
                const currentForm = document.querySelector('form:has([name="folder"])')
                if (currentForm && resolveGallerySource(currentForm) === sourceId) {
                    status(
                        currentForm,
                        `Mentve: ${result.id}.${result.created ? ' Az eseményoldal elkészült.' : ' A meglévő bejegyzés frissült.'}`,
                        false,
                        result
                    )
                }
            }
        } catch (error) {
            if (form.isConnected) status(form, error.message, true)
        } finally {
            section.inert = false
            busy = false
        }
    },
    true
)

window.addEventListener('message', event => {
    if (event.data?.command !== 'dataFileEntries' || !Array.isArray(event.data.payload)) return
    entries = structuredClone(event.data.payload)
})
