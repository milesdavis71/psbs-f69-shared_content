// Használat: {{#schoolData schoolKey "tanarok"}} ... {{/schoolData}}
// A schoolKey a front matter-ből származó változó neve (pl. "schoolKey"),
// amelynek értéke "ps" vagy "bs"
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

module.exports = function (schoolKeyVar, fileKey, options) {
    // A gyökér context (összes data + front matter)
    const root =
        options && options.data && options.data.root ? options.data.root : this

    // Ha schoolKeyVar egy string (pl. "schoolKey"), akkor feloldjuk a root-ból
    // hogy megkapjuk a tényleges school értéket (pl. "ps" vagy "bs")
    let actualSchoolKey = schoolKeyVar

    // Ha a schoolKeyVar egy változó név (string), akkor feloldjuk
    if (typeof schoolKeyVar === 'string' && root[schoolKeyVar]) {
        actualSchoolKey = root[schoolKeyVar]
    }

    // Ha még mindig nincs meg, próbáljuk közvetlenül
    if (!actualSchoolKey || typeof actualSchoolKey !== 'string') {
        return `<!-- schoolKey változó nem található vagy érvénytelen: "${schoolKeyVar}" -->`
    }

    // Elérjük a school-specifikus adatokat: először root.ps/bs objektumból
    let data = null
    if (root[actualSchoolKey] && root[actualSchoolKey][fileKey]) {
        data = root[actualSchoolKey][fileKey]
    } else {
        // Ha nem található a root-ban, akkor közvetlenül beolvassuk a YAML fájlból
        try {
            const yamlPath = path.join(
                process.cwd(),
                'src',
                'data',
                actualSchoolKey,
                `${fileKey}.yml`
            )
            if (fs.existsSync(yamlPath)) {
                const fileContents = fs.readFileSync(yamlPath, 'utf8')
                data = yaml.load(fileContents)
            }
        } catch (e) {
            return `<!-- Hiba a YAML betöltésekor: ${e.message} -->`
        }
    }

    if (!data) {
        return `<!-- "${fileKey}" adat nem található "${actualSchoolKey}"-ben -->`
    }

    // Blokk helper: a blokk tartalmát a kiválasztott data contextjével rendereljük
    return options.fn(data)
}
