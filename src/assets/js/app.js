import $ from 'jquery'
import 'what-input'

// Foundation JS relies on a global variable. In ES6, all imports are hoisted
// to the top of the file so if we used `import` to import Foundation,
// it would execute earlier than we have assigned the global variable.
// This is why we have to use CommonJS require() here since it doesn't
// have the hoisting behavior.
window.jQuery = $
require('foundation-sites')

// If you want to pick and choose which modules to include, comment out the above and uncomment
// the line below
//import './lib/foundation-explicit-pieces';

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

    // 1. Futtatás azonnal betöltéskor
    forceOpenMenu()

    // 2. Futtatás a Foundation inicializálása után (on init esemény)
    $('.accordion-menu').on('init.zf.accordionMenu', function () {
        forceOpenMenu()
    })

    // 3. Biztonsági tartalék 300ms után (amikor az összes Panini és Foundation script lefutott)
    setTimeout(forceOpenMenu, 300)
})
