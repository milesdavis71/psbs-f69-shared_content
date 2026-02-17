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
        const currentPath = normalizePath(window.location.pathname)

        // 1. Keressük meg az aktív menüelemet (minden szinten)
        var $activeItem = $('.accordion-menu li.current').first()
        if (!$activeItem.length) {
            $activeItem = findActiveMenuItemByUrl()
        }

        if ($activeItem.length) {
            $activeItem.addClass('current is-active')

            // Nyissuk ki az összes szülő accordiont rekurzívan (minden szinten)
            // Ez működik a harmadik mélységben is
            $activeItem.parents('li[data-accordion-item]').each(function () {
                openAccordionLi($(this))
            })

            // Magát az aktív elemet is nyissuk ki, ha van almenüje
            openAccordionLi($activeItem)
        }

        // 2. Keressük meg azokat az accordion elemeket, amelyeknek van aktív gyereke
        // Ez kezeli azokat az eseteket, ahol a harmadik szintű elem aktív,
        // de a második szintű szülő nem kapott current osztályt a template-től
        $('.accordion-menu li[data-accordion-item]').each(function () {
            const $parentLi = $(this)

            // Ha ennek az accordion elemnek van active gyereke (akármilyen mélyen), nyissuk ki
            if ($parentLi.find('li.current, li.is-active').length > 0) {
                openAccordionLi($parentLi)
            }

            // URL alapú ellenőrzés a folder alapján
            const $link = $parentLi.children('a.accordion-title').first()
            if ($link.length) {
                const href = $link.attr('href') || ''
                const match = href.match(/\/([^\/]+)\.html$/)
                if (match) {
                    const folderName = match[1]
                    if (currentPath.includes('/' + folderName + '/')) {
                        openAccordionLi($parentLi)
                    }
                }
            }
        })
    }

    // 1. Futtatás azonnal betöltéskor
    forceOpenMenu()

    // 2. Futtatás a Foundation inicializálása után (on init esemény)
    $('.accordion-menu').on('init.zf.accordionMenu', function () {
        forceOpenMenu()
    })

    // 3. Biztonsági tartalék több késleltetéssel
    setTimeout(forceOpenMenu, 100)
    setTimeout(forceOpenMenu, 300)
    setTimeout(forceOpenMenu, 500)
    setTimeout(forceOpenMenu, 1000)

    // 4. Accordion esemény után is nyissuk meg
    $('.accordion-menu').on(
        'down.zf.accordionMenu up.zf.accordionMenu',
        function () {
            setTimeout(forceOpenMenu, 50)
        }
    )
})
