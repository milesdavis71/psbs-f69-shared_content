;(function () {
    'use strict'
    function loadLibrary() {
        if (!window.schoolPdfLibrary) {
            window.schoolPdfLibrary = new Promise(function (resolve, reject) {
                var script = document.createElement('script')
                script.src = '/assets/pdf-viewer/pdf.min.js'
                script.onload = function () {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf-viewer/pdf.worker.min.js'
                    resolve(window.pdfjsLib)
                }
                script.onerror = reject
                document.head.appendChild(script)
            })
        }
        return window.schoolPdfLibrary
    }
    document.querySelectorAll('.pdf-reader:not([data-initialized])').forEach(function (root) {
        root.dataset.initialized = 'true'
        var surface = root.querySelector('.pdf-surface')
        var status = root.querySelector('.pdf-status')
        var controls = root.querySelector('.pdf-controls')
        var url = root.dataset.pdfUrl
        function failure(error) {
            status.textContent = 'A PDF nem jeleníthető meg. Nyissa meg a fenti hivatkozással.'
            console.error('PDF megjelenítési hiba:', error)
        }
        if (!url) { failure('Hiányzó PDF URL'); return }
        // Includes tablets and iPadOS desktop mode.
        var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            navigator.maxTouchPoints > 0 || window.matchMedia('(max-width: 639px)').matches
        if (!mobile && navigator.pdfViewerEnabled === true) {
            var embed = document.createElement('embed')
            embed.type = 'application/pdf'
            embed.src = url + (root.dataset.fitWidth === 'true' ? '#zoom=page-width' : '')
            embed.title = 'PDF dokumentum'
            surface.appendChild(embed)
            status.textContent = ''
            return
        }
        controls.hidden = false
        var canvas = document.createElement('canvas')
        canvas.setAttribute('role', 'img')
        surface.appendChild(canvas)
        var pdf, pageNumber = 1, zoom = 1, rendering = false, pending = false
        var previousPage
        function buttons(disabled) {
            controls.querySelector('[data-action="prev"]').disabled = disabled || pageNumber <= 1
            controls.querySelector('[data-action="next"]').disabled = disabled || pageNumber >= pdf.numPages
            controls.querySelector('[data-action="out"]').disabled = disabled || zoom <= 1
            controls.querySelector('[data-action="in"]').disabled = disabled || zoom >= 3
        }
        async function render() {
            if (!pdf) return
            if (rendering) { pending = true; return }
            // Closed tabs are rendered when ResizeObserver reports a visible width.
            if (!surface.clientWidth) return
            rendering = true
            buttons(true)
            status.textContent = 'PDF betöltése…'
            try {
                var page = await pdf.getPage(pageNumber)
                if (previousPage && previousPage !== page) previousPage.cleanup()
                previousPage = page
                var original = page.getViewport({ scale: 1 })
                var viewport = page.getViewport({ scale: surface.clientWidth / original.width * zoom })
                // Limit canvas memory and dimensions on mobile, especially iOS.
                var ratio = Math.min(window.devicePixelRatio || 1, 2,
                    Math.sqrt(4000000 / (viewport.width * viewport.height)),
                    4096 / viewport.width, 4096 / viewport.height)
                canvas.width = Math.max(1, Math.floor(viewport.width * ratio))
                canvas.height = Math.max(1, Math.floor(viewport.height * ratio))
                canvas.style.width = viewport.width + 'px'
                canvas.style.height = viewport.height + 'px'
                await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport,
                    transform: [ratio, 0, 0, ratio, 0, 0] }).promise
                canvas.setAttribute('aria-label', 'PDF ' + pageNumber + '. oldal')
                root.querySelector('.pdf-page').textContent = pageNumber + ' / ' + pdf.numPages
                status.textContent = ''
            } catch (error) { failure(error) }
            finally {
                rendering = false
                buttons(false)
                if (pending) { pending = false; render() }
            }
        }
        controls.addEventListener('click', function (event) {
            var action = event.target.dataset.action
            if (!pdf || rendering || !action || event.target.disabled) return
            if (action === 'prev') pageNumber--
            if (action === 'next') pageNumber++
            if (action === 'in') zoom = Math.min(3, zoom + .5)
            if (action === 'out') zoom = Math.max(1, zoom - .5)
            surface.scrollTop = 0
            render()
        })
        var resizeTimer, lastWidth = 0
        function resized() {
            if (surface.clientWidth === lastWidth) return
            lastWidth = surface.clientWidth
            clearTimeout(resizeTimer)
            resizeTimer = setTimeout(render, 120)
        }
        if (window.ResizeObserver) new ResizeObserver(resized).observe(surface)
        else window.addEventListener('resize', resized)
        loadLibrary().then(function (lib) {
            return lib.getDocument({ url: url, isEvalSupported: false,
                cMapUrl: '/assets/pdf-viewer/cmaps/', cMapPacked: true,
                standardFontDataUrl: '/assets/pdf-viewer/standard_fonts/' }).promise
        }).then(function (document) { pdf = document; render() }).catch(failure)
    })
})()
