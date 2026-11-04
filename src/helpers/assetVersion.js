const fs = require('node:fs')
const path = require('node:path')

// A build időpontjából számított verziószám. Az ?v= paraméter miatt a
// böngésző minden deploy után újratölti a CSS-t a gyorsítótárból.
let buildStamp = null

function stamp() {
    if (buildStamp) return buildStamp
    const source = path.resolve(
        process.cwd(),
        'src/assets/scss/app.scss'
    )
    try {
        buildStamp = String(Math.floor(fs.statSync(source).mtimeMs))
    } catch {
        buildStamp = String(Date.now())
    }
    return buildStamp
}

module.exports = function assetVersion() {
    return stamp()
}
