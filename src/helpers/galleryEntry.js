const gallery = require('../lib/gallery.js')

module.exports = function (school, year, slug, options = {}) {
    const root = options.data?.root || this
    return gallery.entry(root, school, String(year), String(slug), root)
}
