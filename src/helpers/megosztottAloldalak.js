// Megosztott aloldalak feloldó helper
//
// Cél: azok az aloldalak, amelyek egyszerre jelennek meg több fő menüpontban
// (pl. a Közzétételi listában és a saját fő menüpontjukban), EGYSZER
// definiálhatók a src/data/pages/99_megosztott_aloldalak.yml fájlban
// (cím, oldalnév, URL). Így az oldal tartalma egyetlen oldalfájl-párosban
// (azonos fájlnevek, különböző mappák) szerkeszthető, és a menü mindkét
// helyen ugyanarra az oldalra mutat.
//
// A menü-adatfájlokban (pl. 02b_bemutatkozas.yml, 04b_kozzeteteli_lista.yml)
// az adott aloldal helyén csak egy rövid hivatkozás áll:
//
//     - shared: szmsz
//       folder: kozzeteli_lista     <- az adott menü mappája (URL-hez)
//
// A helper ezt cseréli le a központi definícióra, megtartva a menübeli
// pozíciót. Egy-egy menüben felülírható bármely mező (pl. title, folder).
//
// Az aktív állapot megjelenítése az {{#ifpageInMenu}} helperrel működik:
// az oldal front matterében lévő `menu:` kulcs dönti el, melyik menü aktív.
//
// Használat a menu-item.html-ben:
//     {{#each (megosztottAloldalak items)}}
//         {{> menu-item this}}
//     {{/each}}
//
// A helper rekurzív: a beágyazott `items` listákon belül is feloldja a
// `shared:` hivatkozásokat (így a breadcrumbs.js is használhatja).

const _ = require('lodash')

// A központi definíciós fájl neve (src/data/pages/99_megosztott_aloldalak.yml)
// és a benne lévő lista kulcsa
const SHARED_DATA_KEY = '99_megosztott_aloldalak'
const SHARED_LIST_KEY = 'megosztott_aloldalak'

function getSharedEntries(root) {
    const table = root ? root[SHARED_DATA_KEY] : null
    const list = table ? table[SHARED_LIST_KEY] : null
    return Array.isArray(list) ? list : null
}

function resolveList(list, sharedEntries) {
    return list.map((item) => {
        if (!item || typeof item !== 'object') {
            return item
        }

        let resolved = item
        if (item.shared) {
            const entry = sharedEntries.find((e) => e && e.key === item.shared)
            if (entry) {
                // A központi definíció az alap; a menübeli helyi mezők
                // (pl. folder) felülírhatják. Új objektum készül, az eredeti
                // (build közben közös) adat nem módosul.
                resolved = _.assign({}, entry, _.omit(item, ['shared']))
            }
                // A `?m=` query paraméter jelöli, melyik fő menüből történt
                // a kattintás - az app.js eszeren jelöli ki az aktív menüt.
                if (resolved.menu) {
                    resolved.query = '?m=' + encodeURIComponent(resolved.menu)
                }
        }

        if (resolved && Array.isArray(resolved.items)) {
            resolved = _.assign({}, resolved, {
                items: resolveList(resolved.items, sharedEntries),
            })
        }

        return resolved
    })
}

module.exports = function (items, options) {
    const root = (options && options.data && options.data.root) || this
    const sharedEntries = getSharedEntries(root)

    if (!Array.isArray(items) || !sharedEntries) {
        // Nincs feloldandó hivatkozás (vagy nem elérhető a központi lista):
        // az eredeti lista változatlanul megy tovább.
        return items || []
    }

    return resolveList(items, sharedEntries)
}
