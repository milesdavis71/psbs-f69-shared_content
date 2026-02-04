const _ = require('lodash')

/**
 * Breadcrumbs helper - builds a breadcrumb trail for the current page
 * Reads 'page' and 'dataFile' from the page's frontmatter
 * Usage: {{#breadcrumbs}}
 */
module.exports = function (options) {
    const root = options.data?.root || options.data || this?.root || this

    // Read page and dataFile from frontmatter
    const currentPage = this.page || root.page
    const dataFileName = this.dataFile || root.dataFile

    if (!root || !currentPage || !dataFileName) return []

    // Get the data file
    const dataFile = root[dataFileName.replace(/\.(yml|yaml|json)$/i, '')]
    if (!dataFile) return []

    const breadcrumbs = []

    // Add home as the first breadcrumb
    breadcrumbs.push({
        title: 'Főoldal',
        url: '../index.html',
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

    // Find the path to the current page
    const pagePath = findPagePath(dataFile, currentPage)

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
