// Egyszerű egyenlőség ellenőrző helper
// Használat: {{#equals value1 value2}} ... {{/equals}}
// vagy {{#equals value1 value2}} ... {{else}} ... {{/equals}}

module.exports = function (value1, value2, options) {
    if (value1 == value2) {
        return options.fn(this)
    } else {
        return options.inverse ? options.inverse(this) : ''
    }
}
