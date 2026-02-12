/**
 * Handlebars helper that checks if the current page is in a space-separated list of pages
 * ONLY works for "Fotó archívum" menu where childPages contains many page names including 'fooldal'
 * @param {string} pageList - Space-separated list of page names (can have spaces, newlines, or other whitespace)
 * @param {object} options - Handlebars options object
 * @example
 * {{#ifpageInList 'index about contact'}}Current page is index, about, or contact{{/ifpageInList}}
 */
module.exports = function (pageList, options) {
    // Get the current page from the root context
    // In Panini, the current page is available in options.data.root.page
    const root = options.data?.root || options.data || this?.root || this
    const currentPage = root.page || root.slug // Support both 'page' and 'slug' fields

    if (!currentPage || !pageList) {
        return ''
    }

    // Split the string by any whitespace (spaces, newlines, tabs, etc.)
    // and filter out empty strings
    const pages = pageList.split(/\s+/).filter((page) => page.trim() !== '')

    // This helper should only work for "Fotó archívum" menu
    // Identify gallery lists: they have many pages (at least 10 elements)
    // This includes both parent gallery lists and nested year lists
    const isGalleryList = pages.length >= 10

    // If not a gallery list, return empty (do not activate accordion)
    if (!isGalleryList) {
        return ''
    }

    // Check if current page is in the list
    if (pages.includes(currentPage)) {
        return options.fn(this)
    }

    return ''
}
