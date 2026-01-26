const _ = require('lodash')

module.exports = function () {
    const args = Array.from(arguments)
    const options = args.pop()
    const root = options.data?.root || options.data || this?.root || this

    if (!root) return []

    const key = options.hash?.key || 'pages'
    let out = []

    args.forEach((name) => {
        if (!name) return
        const cleanName =
            typeof name === 'string'
                ? name.replace(/\.(yml|yaml|json)$/i, '')
                : name
        const dataFile = root[cleanName]

        if (dataFile) {
            // Támogatjuk a tömböt vagy a kulcs alapú (pl. pages:) objektumot is
            const list = Array.isArray(dataFile)
                ? dataFile
                : dataFile[key] || dataFile.menu
            if (list) {
                out = out.concat(_.cloneDeep(list))
            }
        }
    })

    return out
}
