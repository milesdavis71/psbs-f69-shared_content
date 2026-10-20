// Megosztott aloldal tartalmi adatait biztosító blokk helper
//
// Használat (pl. az étkezési térítési díjak oldalain):
//     {{#megosztottTartalom 'etkezes_teritesi_dijak'}}
//     {{> common-etkezesi-teritesi-dijak}}
//     {{/megosztottTartalom}}
//
// A 99_megosztott_aloldalak.yml adott kulcsú bejegyzés mezőit (pl. `date`,
// `norm-tiz`, ... - az étkezési díj adatok) a blokk contextuséba teszi a
// root (front matter + globális adat) értékek mellé. Így a megosztott oldal
// tartalmi adatai egyetlen helyen, a központi táblában szerkeszthetők, és
// az oldal minden példánya (mindkét fő menüből) ugyanazt mutatja.

const _ = require('lodash')

const SHARED_DATA_KEY = '99_megosztott_aloldalak'
const SHARED_LIST_KEY = 'megosztott_aloldalak'

module.exports = function (key, options) {
    const root = (options && options.data && options.data.root) || {}
    const table = root ? root[SHARED_DATA_KEY] : null
    const list = table ? table[SHARED_LIST_KEY] : null
    const entry = Array.isArray(list)
        ? list.find((e) => e && e.key === key)
        : null

    if (!entry) {
        return options.inverse ? options.inverse(this) : ''
    }

    // A root értékek fölé kerülnek a bejegyzés mezői (shallow másolat, az
    // eredeti adatok nem módosulnak)
    return options.fn(_.assign({}, root, entry))
}
