// Project-local integration for the Front Matter Data form. The gallery form
// uses the same message bridge as the news form; it never acquires the VS Code
// API itself, because Front Matter owns that single acquisition.
const SCHOOLS = ['ps', 'bs']

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
    const fallback = folder?.getAttribute('placeholder')?.match(/gallery-events/)
    return fallback ? 'gallery-events' : null
}

function field(form, name) {
    return form.querySelector(`[name="${name}"]`)
}

function setField(form, name, value, force = false) {
    const input = field(form, name)
    // Az üres értéket is be kell állítani: iskolaváltáskor a korábbi
    // mappát és az automatikus mezőket törölni kell.
    // A force a programozott mezőbejelenítést kényszeríti ki, akkor is,
    // ha az űrlap értéke egyébként nem változna.
    if (!input || (!force && input.value === value)) return
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

function isAutoTitle(form) {
    return field(form, 'title')?.dataset.galleryAuto === '1'
}

function setAutoTitle(form, value) {
    const title = field(form, 'title')
    if (!title) return
    setField(form, 'title', value)
    title.dataset.galleryAuto = '1'
}

// Csak a mappanévből automatikusan kitöltött címet töröljük; a felhasználó
// által beírt cím megmarad.
function clearAutoTitle(form) {
    const title = field(form, 'title')
    if (!title || title.dataset.galleryAuto !== '1') return
    setField(form, 'title', '')
    delete title.dataset.galleryAuto
}

function fillFromFolder(form) {
    const value = field(form, 'folder')?.value || ''
    const parts = value.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts.length !== 3) return
    const [school, year, slug] = parts
    // Az iskola-választó kövesse a mappát, hogy a mentés mindig a helyes
    // iskolához kerüljön, akkor is, ha a form mezői ellentmondanak.
    const schoolSelect = form.parentElement?.querySelector(
        '[data-gallery-school]'
    )
    if (schoolSelect && schoolSelect.value !== school) {
        schoolSelect.value = school
        setField(form, 'school', school, true)
    }
    // A tanév-választó kövesse a mappa évét, ha az eltér.
    const yearSelect = form.parentElement?.querySelector(
        '[data-gallery-year]'
    )
    if (yearSelect && yearSelect.value !== year) {
        yearSelect.value = year
        setField(form, 'year', year, true)
    }
    setField(form, 'slug', slug)
    setField(form, 'date', dateFromSlug(slug))
    const title = field(form, 'title')
    if (!title?.value?.trim() || isAutoTitle(form)) {
        setAutoTitle(form, titleFromSlug(slug))
    }
}

// A felhasználó kézi szövegbevitelével megszűnik az automatikus jelölés,
// így a cím már nem ugrik vissza a mappanévre. Az isTrusted csak a valódi
// felhasználói bevitelt engedi át: a programozott setField eseménye nem.
document.addEventListener(
    'input',
    event => {
        if (event.target?.name !== 'title') return
        if (!event.isTrusted) return
        delete event.target.dataset.galleryAuto
    },
    true
)

const SCHOOL_NAMES = { ps: 'Petőfi', bs: 'Bálint' }

function schoolOf(form) {
    // A saját, látható iskola-választó az elsődleges forrás: a felhasználó
    // választása azonnal érvényesül. A rejtett Uniforms mező csak akkor
    // kell, ha a saját választó még nem létezik (első megjelenés).
    const own = form.parentElement
        ?.querySelector('[data-gallery-school]')
        ?.value
    if (SCHOOLS.includes(own)) return own
    const value = field(form, 'school')?.value
    return SCHOOLS.includes(value) ? value : 'ps'
}

function currentSchoolYear() {
    const now = new Date()
    const start = now.getFullYear() - (now.getMonth() < 8 ? 1 : 0)
    return `${start}-${String(start + 1).slice(-2)}`
}

// A szűrés csak a megjelenítést érinti; a dashboard teljes adatlistája megmarad.
const galleryState = { school: 'ps', year: '' }
let galleryEntries = null
let galleryEntriesLoading = false

// A bejegyzés az aktuális iskolához és tanévhez tartozik-e?
function isCurrentGalleryEntry(entry) {
    if (!entry) return false
    const parts = String(entry.folder || '').split('/')
    const school = entry.school || parts[0] || ''
    const year = String(entry.year || parts[1] || '')
    if (school !== galleryState.school) return false
    return !galleryState.year || year === galleryState.year
}

// Front Matter 10.13: a SortableItem data-test értéke selectedIndex-crntIndex.
// A teljes sort rejtjük el, a szerkesztés/törlés gombjaival együtt. Az indexet
// minden alkalommal újra olvassuk, így azonos címek és törlés után is helyes.
function refreshGalleryList(form) {
    if (!galleryEntries) return
    const section = form?.closest('section')
    if (!section) return
    for (const node of section.querySelectorAll('li.sortable_item[data-test]')) {
        const match = /^(?:null|\d+)-(\d+)$/.exec(node.getAttribute('data-test'))
        if (!match) continue
        const entry = galleryEntries[Number(match[1])]
        node.style.display = isCurrentGalleryEntry(entry) ? '' : 'none'
    }
}

// Ha a script a dashboard első adatüzenete után indul, a registryből pótoljuk
// a hiányzó listát. A későbbi adatüzenetek tartják naprakészen a szűrést.
async function loadGalleryEntries(form) {
    if (galleryEntries || galleryEntriesLoading) return
    galleryEntriesLoading = true
    try {
        const requestId = crypto.randomUUID()
        runCommand('psbs.gallery.entries', { requestId })
        const result = await responseFor(requestId)
        if (!result.ok) {
            throw new Error(result.message || 'A galérialista betöltése nem sikerült.')
        }
        // A közben beérkezett dashboard-adatok frissebbek a fájlból olvasottnál.
        if (!galleryEntries) {
            galleryEntries = Array.isArray(result.entries) ? result.entries : []
        }
        updateGalleryList(form)
        scheduleFilter()
    } catch {
        // A szűrés elmarad, de a dashboard ettől még működik.
    } finally {
        galleryEntriesLoading = false
    }
}

// A lista frissítése (iskola- vagy tanévváltáskor, illetve a gomb hatására).
function updateGalleryList(form) {
    if (form) {
        const school = schoolOf(form)
        if (school) galleryState.school = school
        const year = yearOf(form)
        galleryState.year = year
    }
    refreshGalleryList(form)
}

// Saját iskola-választó a form elején. A Uniforms saját select mezőjét
// elrejtjük, mert annak értékét a dashboard modellje írja vissza, így
// közvetlenül a Uniforms change eseményére épülő megoldás nem stabil.
// Ez a választó viszont közvetlenül a modellbe ír, és azonnal
// átszűri a galériamappa listát.
function schoolSelector(form) {
    const hidden = field(form, 'school')
    if (!hidden) return null

    let select = form.parentElement.querySelector('[data-gallery-school]')
    if (!select) {
        const wrapper = document.createElement('div')
        wrapper.className = 'gallery-select-field'
        const label = document.createElement('label')
        label.textContent = 'Iskola'
        select = document.createElement('select')
        select.dataset.gallerySchool = ''
        select.className = 'gallery-school-select'
        select.setAttribute('aria-label', 'Iskola')
        for (const school of SCHOOLS) {
            const option = document.createElement('option')
            option.value = school
            option.textContent = `${SCHOOL_NAMES[school]} (${school})`
            select.appendChild(option)
        }
        select.addEventListener('change', () => {
            setField(form, 'school', select.value, true)
            galleryState.school = select.value
            // A bal oldali lista is kövesse az iskolaváltást.
            updateGalleryList(form)
            // A korábbi mappa és az automatikus mezők érvénytelenek.
            setField(form, 'folder', '', true)
            setField(form, 'year', '', true)
            setField(form, 'slug', '', true)
            setField(form, 'date', '', true)
            clearAutoTitle(form)
            // Az új iskolához tartozó tanévek betöltése.
            if (form.__galleryData) {
                applyFolders(form, form.__galleryData.folders)
            }
            refreshFolderList(form)
        })
        wrapper.appendChild(label)
        wrapper.appendChild(select)
        form.parentElement.insertBefore(wrapper, form)
        select.value = hidden.value || 'ps'
        galleryState.school = select.value
    }

    // A saját választó értékét nem írjuk felül a rejtett mezőből: a
    // Uniforms modellje csak a change esemény után frissül, így az
    // visszaírás elvenné a felhasználó választását.
    const container = hidden.closest('.autoform__field') || hidden
    container.style.display = 'none'
    return select
}

function yearOf(form) {
    // A saját tanév-választó az elsődleges forrás, ugyanúgy, mint az
    // iskolánál: a felhasználó választása azonnal érvényesül.
    const own = form.parentElement?.querySelector('[data-gallery-year]')
    if (own) return own.value
    const value = field(form, 'year')?.value
    return value || ''
}

// Saját tanév-választó a form elején. Az opciók a kiválasztott iskola
// galériamappáinak évneveiből olvasódnak (pl. 2026-27).
function yearSelector(form) {
    const hidden = field(form, 'year')
    if (!hidden) return null

    let select = form.parentElement.querySelector('[data-gallery-year]')
    if (!select) {
        const wrapper = document.createElement('div')
        wrapper.className = 'gallery-select-field'
        const label = document.createElement('label')
        label.textContent = 'Tanév'
        select = document.createElement('select')
        select.dataset.galleryYear = ''
        select.className = 'gallery-year-select'
        select.setAttribute('aria-label', 'Tanév')
        select.addEventListener('change', () => {
            setField(form, 'year', select.value, true)
            galleryState.year = select.value
            // A bal oldali lista is kövesse a tanévváltást.
            updateGalleryList(form)
            // A korábbi mappa és az automatikus mezők érvénytelenek.
            setField(form, 'folder', '', true)
            setField(form, 'slug', '', true)
            setField(form, 'date', '', true)
            clearAutoTitle(form)
            refreshFolderList(form)
        })
        wrapper.appendChild(label)
        wrapper.appendChild(select)
        form.parentElement.insertBefore(wrapper, form)
    }

    // A saját választó értékét nem írjuk felül a rejtett mezőből.
    const container = hidden.closest('.autoform__field') || hidden
    container.style.display = 'none'
    return select
}

// A tanév-választó opciói a galériamappa listából számolódnak ki:
// a mappaútvonalak iskola/tanév/slug alakúak (pl. ps/2026-27/valami).
// Így a lista az iskolához igazodik, és nincs szükség külön letöltésre.
function refreshYearOptions(form) {
    const yearSelect = yearSelector(form)
    if (!yearSelect) return
    const folderSelect = field(form, 'folder')
    if (!folderSelect || folderSelect.tagName !== 'SELECT') return

    const school = schoolOf(form)
    const years = new Set([currentSchoolYear()])
    for (const entry of galleryEntries || []) {
        const parts = String(entry.folder || '').split('/')
        if ((entry.school || parts[0]) === school) {
            const year = String(entry.year || parts[1] || '')
            if (/^\d{4}-\d{2}$/.test(year)) years.add(year)
        }
    }
    for (const option of folderSelect.options) {
        const match = /^([a-z]{2})\/(\d{4}-\d{2})\//.exec(option.value || '')
        if (match && match[1] === school) years.add(match[2])
    }
    const selected = yearSelect.value
    // Iskolaváltáskor is maradjon meg a választott tanév, akár üres a listája.
    if (selected) years.add(selected)
    const ordered = [...years].sort((left, right) => right.localeCompare(left))
    if (Array.from(yearSelect.options, option => option.value).join('|') !== ordered.join('|')) {
        yearSelect.innerHTML = ''
        for (const year of ordered) {
            const option = document.createElement('option')
            option.value = year
            option.textContent = year
            yearSelect.appendChild(option)
        }
    }
    const wanted = selected || currentSchoolYear()
    if (wanted) {
        yearSelect.value = wanted
        setField(form, 'year', wanted)
    }
    // A bal oldali lista ugyanazt a tanévet használja.
    galleryState.year = yearSelect.value
}

// A galériamappa listát a kiválasztott iskolára és tanévre szűkíti:
// ps/2026-27 esetén csak a ps mappák 2026-27-es galériái láthatók.
function applySchoolFilter(form) {
    const select = field(form, 'folder')
    if (!select || select.tagName !== 'SELECT') return 0
    const school = schoolOf(form)
    const year = yearOf(form)
    const prefix = year ? `${school}/${year}/` : `${school}/`
    let visible = 0
    for (const option of select.options) {
        if (!option.value) continue
        const matches = option.value.startsWith(prefix)
        option.style.display = matches ? '' : 'none'
        option.disabled = !matches
        if (matches) visible++
    }
    if (select.value && !select.value.startsWith(prefix)) {
        setField(form, 'folder', '')
    }
    return visible
}

function hint(form, message) {
    let output = form.parentElement.querySelector('[data-gallery-hint]')
    if (!output) {
        output = document.createElement('p')
        output.dataset.galleryHint = ''
        output.style.color = 'var(--vscode-descriptionForeground, #888)'
        output.style.fontSize = '0.9em'
        form.after(output)
    }
    if (output.textContent !== message) output.textContent = message
    output.style.display = message ? 'block' : 'none'
}

function refreshFolderList(form) {
    const visible = applySchoolFilter(form)
    if (visible === 0) {
        const school = SCHOOL_NAMES[schoolOf(form)]
        const year = yearOf(form)
        const target = year
            ? `${school} iskolában, ${year} tanévben`
            : `${school} iskolában`
        hint(
            form,
            `Nincs feldolgozott galériamappa ${target}. ` +
                'Futtasd a resizer.py programot, majd nyomd meg a "Képlista frissítése" gombot.'
        )
    } else {
        hint(form, '')
    }
}

function labelForFolder(value) {
    const parts = value.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts.length !== 3) return value
    const [, year, slug] = parts
    const pretty = year.replace(/^(\d{4})-(\d{2})$/, '$1–$2')
    return `${pretty} – ${titleFromSlug(slug)}`
}

function applyFolders(form, folders) {
    // A letöltött adatok megőrzése, hogy iskolaváltáskor újra felhasználhatók
    // legyenek újraruomás nélkül.
    form.__galleryData = { folders }

    const select = field(form, 'folder')
    if (!select || select.tagName !== 'SELECT') return
    const selected = select.value
    select.innerHTML = ''
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = '— válassz galériamappát —'
    select.appendChild(empty)
    for (const school of SCHOOLS) {
        for (const value of folders[school] || []) {
            const option = document.createElement('option')
            option.value = value
            option.textContent = labelForFolder(value)
            select.appendChild(option)
        }
    }
    if (selected && folders[schoolOf(form)]?.includes(selected)) {
        select.value = selected
    }
    // A tanév-lista az új mappalistából számolódik ki.
    refreshYearOptions(form)
    refreshFolderList(form)
    updateGalleryList(form)
}

function refreshButton(form) {
    let button = form.parentElement.querySelector('[data-gallery-refresh]')
    if (button) return button
    button = document.createElement('button')
    button.dataset.galleryRefresh = ''
    button.type = 'button'
    button.className = 'vscode-button'
    button.style.marginTop = '0.4rem'
    button.textContent = 'Képlista frissítése'
    button.addEventListener('click', async () => {
        button.disabled = true
        const previous = button.textContent
        button.textContent = 'Frissítés…'
        try {
            const requestId = crypto.randomUUID()
            runCommand('psbs.gallery.folders', { requestId })
            const result = await responseFor(requestId)
            if (!result.ok) throw new Error(result.message || 'A frissítés nem sikerült.')
            applyFolders(form, result.folders)
            updateGalleryList(form)
            const created = Array.isArray(result.created) ? result.created : []
            if (created.length) {
                status(
                    form,
                    `${created.length} új galériaoldal létrehozva (${created.join(', ')}). ` +
                        'Az új tanév már megjelenik a galéria főoldalán.'
                )
            }
        } catch (error) {
            hint(form, error.message)
        } finally {
            button.disabled = false
            button.textContent = previous
        }
    })
    form.after(button)
    return button
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
        if (event.target.name === 'folder') {
            fillFromFolder(form)
            refreshFolderList(form)
            updateGalleryList(form)
        }
        if (event.target.name === 'school') {
            // A rejtett Uniforms mező programozott változása: ugyanaz a
            // folyamat, mint a látható iskola-választó használatakor.
            setField(form, 'folder', '', true)
            setField(form, 'year', '', true)
            setField(form, 'slug', '', true)
            setField(form, 'date', '', true)
            clearAutoTitle(form)
            refreshFolderList(form)
        }
    },
    true
)

// A dashboard a Uniforms újrarenderelésekor újraépíti a formot, ezért a
// szűkítést minden DOM-változás után újra alkalmazzuk.
let filterTimer = null
function scheduleFilter() {
    if (filterTimer) clearTimeout(filterTimer)
    filterTimer = setTimeout(() => {
        filterTimer = null
        document.querySelectorAll('form').forEach((form) => {
            if (!resolveGallerySource(form)) return
            schoolSelector(form)
            yearSelector(form)
            refreshYearOptions(form)
            refreshFolderList(form)
            refreshButton(form)
            // A bal oldali lista a kiválasztott iskola és tanév szerint
            // szűrődik, ezért a form minden változása után frissítjük.
            updateGalleryList(form)
            void loadGalleryEntries(form)
        })
    }, 60)
}

if (document.body && window.MutationObserver) {
    new MutationObserver(scheduleFilter).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-test'],
    })
}

scheduleFilter()


document.addEventListener(
    'submit',
    async event => {
        const form = event.target
        if (!(form instanceof HTMLFormElement)) return
        const sourceId = resolveGallerySource(form)
        if (!sourceId) return
        fillFromFolder(form)
        refreshFolderList(form)
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
    // A dashboard a teljes listát küldi mentés, törlés és átrendezés után is.
    // Más adatforrás (például hírek) bejegyzéseit nem használjuk galériaként.
    if (entries.length && entries.every(entry =>
        entry && (SCHOOLS.includes(entry.school) || /^(ps|bs)\//.test(entry.folder || ''))
    )) {
        galleryEntries = entries
    } else {
        galleryEntries = null
    }
    scheduleFilter()
})
