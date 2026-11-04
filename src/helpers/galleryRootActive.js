// Marks the "Fotó archívumok" menu item active on every gallery page, even
// when the page front matter has no `page` field (older event pages).
module.exports = function (itemPage, options) {
    const root = options.data?.root || this
    if (itemPage !== 'galeriak_root') return ''
    if (root?.galleryRoot || root?.page === 'galeriak_root') return options.fn(this)
    if (root?.schoolKey && root?.year && root?.slug) return options.fn(this)
    return ''
}
