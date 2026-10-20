// Aktív menüpont jelölő blokk helper
//
// Használat (menu-item.html):
//     {{#ifpageInMenu page folder}}current is-active{{/ifpageInMenu}}
//
// Viselkedés:
//  - Az elem akkor aktív, ha a `page` mezője egyezik a nyitott oldal nevével,
//    ÉS - ha az oldal front matterében meg van adva a `menu:` kulcs
//    (megosztott aloldal) - az elem `folder` mezője egyezik azzal.
//
// Így a több fő menüpontban is szereplő (megosztott) aloldalnál csak az a
// menü nyílik ki és lesz aktív, amelyikből az oldalt megnyitották: a
// bemutatkozas/szmsz.html oldalon a `menu: bemutatkozas`, a
// kozzeteli_lista/szmsz.html oldalon a `menu: kozzeteli_lista` szerepel.
//
// Ha az oldal front matterében NINCS `menu:` kulcs (normál oldal), a helper
// pontosan úgy működik, mint a korábbi {{#ifpage}} - csak az oldalnév számít.

module.exports = function (page, folder, options) {
    const root = (options && options.data && options.data.root) || this || {}

    if (page !== root.page) {
        return options.inverse ? options.inverse(this) : ''
    }

    // Megosztott aloldal: csak a saját fő menüjében aktív
    if (root.menu && folder && root.menu !== folder) {
        return options.inverse ? options.inverse(this) : ''
    }

    return options.fn(this)
}
