// "Hamarosan" kapcsoló (blokk helper)
//
// Cél: az oldalakon a valódi tartalom (vagy tartalom-partial) fixen a kódban
// marad, és csak egy true/false kapcsoló dönti el, hogy a tartalom vagy
// helyette a "Hamarosan…" felirat jelenik-e meg.
//
// Használat:
//   {{#hamarosan}}
//   {{> schooldata-fogadoorak}}
//   {{/hamarosan}}
//
// A kapcsoló két helyről jöhet:
//  1. Az oldal front matteréből:  hamarosan: true / false
//  2. Megosztott aloldalaknál (azonos fájlnevű oldal-példányok) a
//     99_megosztott_aloldalak.yml központi táblájából, az oldal `page` neve
//     alapján - iskolánként is megadható (hamarosan: { bs: ..., ps: ... }).
//     Így a kapcsoló EGY helyen kapcsolható mindkét oldal-példányhoz.
//
// A felirat mindig a common-hamarosan partialből készül, így ha a partialt
// módosítod, a helper kimenete is automatikusan követi azt.

const Handlebars = require('handlebars')

// Tartalék felirat, ha a common-hamarosan partial valamiért nem elérhető
const FALLBACK_LABEL = '<p class="h5 subheader text-center">Hamarosan…</p>'

const SHARED_DATA_KEY = '99_megosztott_aloldalak'
const SHARED_LIST_KEY = 'megosztott_aloldalak'

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

// Megosztott aloldal kapcsolójának feloldása a központi táblából az oldal
// `page` neve alapján; iskolánkénti kulcs (bs/ps) esetén a front matter
// `schoolKey` mezője dönt.
function lookupSharedHamarosan(root) {
    const table = root ? root[SHARED_DATA_KEY] : null
    const list = table ? table[SHARED_LIST_KEY] : null
    if (!Array.isArray(list) || !root || !root.page) {
        return undefined
    }

    const entry = list.find((e) => e && e.page === root.page)
    if (!entry) {
        return undefined
    }

    const flag = entry.hamarosan
    if (flag && typeof flag === 'object') {
        return flag[root.schoolKey]
    }
    return flag
}

module.exports = function (options) {
    // A front matter (és a globális data) értékek a root contextben érhetők el
    const root = (options && options.data && options.data.root) || this
    const frontMatterFlag = root ? root.hamarosan : undefined
    const flag =
        frontMatterFlag !== undefined
            ? frontMatterFlag
            : lookupSharedHamarosan(root)
    const isHamarosan = flag === true || flag === 'true'

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
