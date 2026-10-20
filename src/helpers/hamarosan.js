// "Hamarosan" kapcsoló (blokk helper)
//
// Cél: az oldalakon a valódi tartalom (vagy tartalom-partial) fixen a kódban
// marad, és csak az oldal front matterében lévő true/false kapcsoló dönti el,
// hogy a tartalom vagy helyette a "Hamarosan…" felirat jelenik-e meg.
//
// Használat:
//   ---
//   layout: default_bs
//   title: Fogadóórák
//   hamarosan: true   # true = "Hamarosan…" felirat; false / nincs beállítva = valódi tartalom
//   ---
//   {{> breadcrumb}}
//   {{> title}}
//   {{#hamarosan}}
//   {{> schooldata-fogadoorak}}
//   {{/hamarosan}}
//
// Viselkedés:
//  - Front matterben `hamarosan: true` -> a blokk tartalma NEM renderelődik,
//    helyette a common-hamarosan partial ("Hamarosan…" felirat) jelenik meg.
//  - `hamarosan: false` vagy hiányzó kulcs -> a blokk valódi tartalma jelenik meg.
//
// A felirat mindig a common-hamarosan partialből készül, így ha a partialt
// módosítod, a helper kimenete is automatikusan követi azt.

const Handlebars = require('handlebars')

// Tartalék felirat, ha a common-hamarosan partial valamiért nem elérhető
const FALLBACK_LABEL = '<p class="h5 subheader text-center">Hamarosan…</p>'

// A "Hamarosan…" felirat előállítása a common-hamarosan partialből
function renderHamarosanLabel() {
    const partial = Handlebars.partials['common-hamarosan']
    if (typeof partial === 'function') {
        return partial({})
    }
    if (typeof partial === 'string') {
        return Handlebars.compile(partial)({})
    }
    return FALLBACK_LABEL
}

module.exports = function (options) {
    // A front matter (és a globális data) értékek a root contextben érhetők el
    const root = (options && options.data && options.data.root) || this
    const isHamarosan = root.hamarosan === true || root.hamarosan === 'true'

    // Blokkon kívüli ({{hamarosan}}) használat: csak a feliratot adjuk vissza,
    // ha a kapcsoló be van kapcsolva
    if (!options || typeof options.fn !== 'function') {
        return isHamarosan ? renderHamarosanLabel() : ''
    }

    // Kapcsoló kikapcsolva (vagy nincs beállítva): a blokk valódi tartalma jelenik meg
    if (!isHamarosan) {
        return options.fn(this)
    }

    // Kapcsoló bekapcsolva: a felirat jelenik meg a blokk tartalma helyett
    return renderHamarosanLabel()
}
