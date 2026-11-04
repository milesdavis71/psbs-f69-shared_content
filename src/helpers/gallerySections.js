const gallery = require('../lib/gallery.js')

module.exports = function (school, options = {}) {
    const root = options.data?.root || this
    const all = gallery.sections(root, school)
    const year = options.hash?.year
    return year ? all.filter((section) => section.year === String(year)) : all
}
