const gallery = require('../lib/gallery.js')

module.exports = function (school, options = {}) {
    const root = options.data?.root || this
    return gallery.years(root, school)
}
