const _ = require('lodash')
const megosztottAloldalak = require('./megosztottAloldalak.js')

/**
 * Breadcrumbs helper - builds a breadcrumb trail for the current page
 * Reads 'page' and 'dataFile' from the page's frontmatter
 * Usage: {{#breadcrumbs}}
 */
module.exports = function (options) {
    const root = options.data?.root || options.data || this?.root || this

    // Read page and menu/dataFile from frontmatter
    // A megosztott aloldalaknál a `menuFile` mutat a saját menü strukturális
    // adataira (így a breadcrumb a menünek megfelelő útvonalat mutatja)
    const currentPage = this.page || root.page
    const dataFileName =
        this.menuFile || root.menuFile || this.dataFile || root.dataFile

    if (!root || !currentPage || !dataFileName) return []

    // Get the data file - try multiple possible keys
    const cleanDataFileName = dataFileName.replace(/\.(yml|yaml|json)$/i, '')
    let dataFile = root[cleanDataFileName]

    // If not found, try with leading zero (e.g., "4p_kozzeteteli_lista" -> "04p_kozzeteteli_lista")
    if (!dataFile && /^\d[^0]/.test(cleanDataFileName)) {
        const withLeadingZero = '0' + cleanDataFileName
        dataFile = root[withLeadingZero]
    }

    // Also try the opposite: if starts with "0", try without it
    if (!dataFile && /^0\d/.test(cleanDataFileName)) {
        const withoutLeadingZero = cleanDataFileName.substring(1)
        dataFile = root[withoutLeadingZero]
    }

    if (!dataFile) return []

    const breadcrumbs = []

    // Add home as the first breadcrumb
    breadcrumbs.push({
        title: 'Főoldal',
        url: '../',
        isHome: true,
        disabled: false,
    })

    // Function to recursively search for the page in the menu structure
    function findPagePath(items, targetPage, path = []) {
        for (const item of items) {
            const currentPath = [...path, item]

            // Check if this is the page we're looking for
            if (item.page === targetPage) {
                return currentPath
            }

            // If this item has subitems, search recursively
            if (item.items && item.items.length > 0) {
                const found = findPagePath(item.items, targetPage, currentPath)
                if (found) return found
            }
        }
        return null
    }

    // A `shared:` helyőrzők feloldása, hogy a megosztott aloldalak is
    // megtalálhatók legyenek a menü-struktúrában
    const resolvedDataFile = megosztottAloldalak(dataFile, {
        data: { root: root },
    })

    // Find the path to the current page
    const pagePath = findPagePath(resolvedDataFile, currentPage)

    if (pagePath) {
        pagePath.forEach((item, index) => {
            const isLast = index === pagePath.length - 1
            const breadcrumb = {
                title: item.title,
                disabled: isLast,
                isHome: false,
            }

            // Don't add URL - intermediate items should not be linked
            // Only Home and current page (last item) are handled specially

            breadcrumbs.push(breadcrumb)
        })
    }

    return breadcrumbs
}
