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
    function forceOpenMenu() {
        // Keressük az aktív pontot (.current)
        var $activeItem = $('.accordion-menu li.current')

        if ($activeItem.length) {
            // Végigmegyünk az összes szülőn felfelé (3. szint -> 2. szint -> 1. szint)
            $activeItem.parents('li').each(function () {
                var $li = $(this)
                var $ul = $li.children('ul')

                // Ha van almenüje, kényszerítjük a nyitást
                if ($ul.length) {
                    $li.addClass('is-active')
                    $li.attr('aria-expanded', 'true')

                    // Kényszerített láthatóság inline stílussal a JS animációk ellen
                    $ul.addClass('is-active').attr(
                        'style',
                        'display: block !important; opacity: 1 !important; visibility: visible !important;'
                    )
                }
            })
        }
    }

    function scrollActiveMenuToCenter() {
        // Keressük az aktív menüpontot - mind a li.current, mind az a.current lehetséges
        var $activeItem = $('.accordion-menu li.current').last()

        // Ha nem találtunk li.current-et, keressük az aktív linket
        if (!$activeItem.length) {
            var $activeLink = $('.accordion-menu a.current').last()
            if ($activeLink.length) {
                $activeItem = $activeLink.closest('li')
            }
        }

        if ($activeItem.length) {
            // A menü konténer (a teljes sidebar menü)
            var $menuContainer = $('#ps-sidebar-menu')

            // Ha nincs ps-sidebar-menu, keressük az első .accordion-menu-t
            if (!$menuContainer.length) {
                $menuContainer = $('.accordion-menu').first()
            }

            if ($menuContainer.length) {
                // Kis késleltetés, hogy az almenük animációja befejeződjön
                setTimeout(function () {
                    // A menü konténer magassága
                    var containerHeight = $menuContainer.height()

                    // Az aktív elem pozíciója a konténerhez viszonyítva
                    var activeItemOffset =
                        $activeItem.offset().top -
                        $menuContainer.offset().top +
                        $menuContainer.scrollTop()

                    // Az aktív elem magassága
                    var activeItemHeight = $activeItem.outerHeight()

                    // Számoljuk ki a görgetési pozíciót úgy, hogy az aktív elem középen legyen
                    var scrollTo =
                        activeItemOffset -
                        containerHeight / 2 +
                        activeItemHeight / 2

                    // Görgetés sima animációval
                    $menuContainer.stop().animate(
                        {
                            scrollTop: scrollTo,
                        },
                        400
                    )
                }, 50)
            }
        }
    }

    // 1. Futtatás azonnal betöltéskor
    forceOpenMenu()

    // Görgetés az aktív elem középre állításához
    setTimeout(scrollActiveMenuToCenter, 100)

    // 2. Futtatás a Foundation inicializálása után (on init esemény)
    $('.accordion-menu').on('init.zf.accordionMenu', function () {
        forceOpenMenu()
        setTimeout(scrollActiveMenuToCenter, 100)
    })

    // 3. Biztonsági tartalék 300ms után (amikor az összes Panini és Foundation script lefutott)
    setTimeout(function () {
        forceOpenMenu()
        scrollActiveMenuToCenter()
    }, 300)

    // 4. Görgetés az accordion menü kinyitása/zárása után is
    $(document).on(
        'down.zf.accordionMenu up.zf.accordionMenu',
        '.accordion-menu',
        function () {
            setTimeout(scrollActiveMenuToCenter, 200)
        }
    )
})
