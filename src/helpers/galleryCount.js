const { galleryCount } = require('../lib/gallery-utils.cjs')

module.exports = function (school, year, slug) {
    const root = process.cwd()
    return galleryCount(root, String(school), String(year), String(slug))
}
