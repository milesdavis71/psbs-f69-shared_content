import $ from 'jquery'
import 'what-input'

// Foundation JS relies on a global variable. In ES6, all imports are hoisted
// to the top of the file so if we used `import` to import Foundation,
// it would execute earlier than we have assigned the global variable.
// This is why we have to use CommonJS require() here since it doesn't
// have the hoisting behavior.
window.jQuery = $
require('foundation-sites')

// Bal oldali accordion menü kezelésére vonatkozó egyedi kód (Gemini)

$(document).foundation()

// Custom JS can go here
$(document).ready(function () {
    function normalizePath(path) {
        if (!path) return ''

        // Remove query/hash, normalize slashes, and trim trailing slash
        let p = String(path).split(/[?#]/)[0]
        p = p.replace(/\\/g, '/')

        // Treat "/index.html" as "/"
        p = p.replace(/\/index\.html$/i, '/')

        // Trim trailing slash except root
        if (p.length > 1) p = p.replace(/\/$/, '')

        return p
    }

    function findActiveMenuItemByUrl() {
        const currentPath = normalizePath(window.location.pathname)
        if (!currentPath) return $()

        const $activeLink = $('.accordion-menu a[href]')
            .filter(function () {
                const href = $(this).attr('href')
                if (!href) return false

                // Ignore external/anchor links
                if (
                    href.startsWith('http://') ||
                    href.startsWith('https://') ||
                    href.startsWith('#') ||
                    href.startsWith('mailto:')
                ) {
                    return false
                }

                try {
                    const linkPath = normalizePath(
                        new URL(href, window.location.origin).pathname
                    )
                    return linkPath === currentPath
                } catch (e) {
                    return false
                }
            })
            .first()

        return $activeLink.length ? $activeLink.closest('li') : $()
    }

    function openAccordionLi($li) {
        const $ul = $li.children('ul')

        // Only accordion items have nested <ul>
        if ($ul.length) {
            $li.addClass('is-active')
            $li.attr('aria-expanded', 'true')

            // Force visibility against Foundation animation states
            $ul.addClass('is-active').attr(
                'style',
                'display: block !important; opacity: 1 !important; visibility: visible !important;'
            )
        }
    }

    function forceOpenMenu() {
        // Prefer template-marked active item, but fall back to URL matching.
        // This is important for gallery pages where "page" frontmatter is not always set.
        var $activeItem = $('.accordion-menu li.current').first()
        if (!$activeItem.length) {
            $activeItem = findActiveMenuItemByUrl()
        }

        if ($activeItem.length) {
            // Ensure the active item is marked (useful for URL-based fallback)
            $activeItem.addClass('current is-active')

            // Open all ancestor accordion items (and itself if it has a submenu)
            $activeItem
                .parents('li')
                .addBack()
                .each(function () {
                    openAccordionLi($(this))
                })
        }

        // Special rule: "Fotó archívumok" dropdown should stay open on any gallery page.
        // We detect gallery pages by URL path and open the menu item that points to /galeriak.html.
        const currentPath = normalizePath(window.location.pathname)
        if (currentPath.startsWith('/galeriak/')) {
            const $fotoArchivLi = $('.accordion-menu a[href]')
                .filter(function () {
                    const href = $(this).attr('href') || ''
                    return href.endsWith('galeriak.html')
                })
                .first()
                .closest('li')

            if ($fotoArchivLi.length) {
                openAccordionLi($fotoArchivLi)
            }
        }
    }

    // 1. Futtatás azonnal betöltéskor
    forceOpenMenu()

    // 2. Futtatás a Foundation inicializálása után (on init esemény)
    $('.accordion-menu').on('init.zf.accordionMenu', function () {
        forceOpenMenu()
    })

    // 3. Biztonsági tartalék 300ms után (amikor az összes Panini és Foundation script lefutott)
    setTimeout(forceOpenMenu, 300)
})
