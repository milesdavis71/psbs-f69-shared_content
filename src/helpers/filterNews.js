// Helper to filter news items based on school, year, and older flag
// Usage: {{#filterNews "ps"}} ... {{/filterNews}}
// or: {{#filterNews schoolKey}} ... {{/filterNews}}
// or: {{#filterNews schoolKey older=true}} ... {{/filterNews}}
// The year parameter is read from frontmatter (root.year) or can be passed as second parameter

module.exports = function (schoolKey, options) {
    // Get the root context
    const root = options.data && options.data.root ? options.data.root : this

    // Resolve school key if it's a variable name
    let actualSchoolKey = schoolKey
    if (typeof schoolKey === 'string' && root[schoolKey]) {
        actualSchoolKey = root[schoolKey]
    }

    // Validate school key
    if (
        !actualSchoolKey ||
        (actualSchoolKey !== 'ps' && actualSchoolKey !== 'bs')
    ) {
        return `<!-- Invalid school key: "${actualSchoolKey}" -->`
    }

    // Check if we should filter for older news
    const olderMode = options.hash && options.hash.older === true

    // Get year from frontmatter (root.year) or root.data.year
    let year = root.year || (root.data && root.data.year)

    // If year is not found in root, try to get it from common data
    if (!year && root.common && root.common.currentYear) {
        year = root.common.currentYear
    }

    // If still no year, use the first key from news object as default
    if (!year) {
        // We'll determine this after we get the news data
    }

    // Get the news data from common.yml (available in different contexts)
    let newsData = null

    // Try different possible locations for the news data
    if (root.common && root.common.news) {
        newsData = root.common.news
    } else if (root.global && root.global.news) {
        newsData = root.global.news
    } else if (root.news) {
        newsData = root.news
    } else if (root.data && root.data.common && root.data.common.news) {
        newsData = root.data.common.news
    }

    if (!newsData) {
        return `<!-- No news data found -->`
    }

    // newsData could be an object with year keys or an array
    let rightColumnData = []

    if (Array.isArray(newsData)) {
        // Old structure: news is directly an array
        rightColumnData = newsData
    } else if (typeof newsData === 'object') {
        // New structure: news is an object with year keys
        // Get available years
        const years = Object.keys(newsData)

        if (years.length === 0) {
            return `<!-- No news data available (empty object) -->`
        }

        // If year is specified, try to get data for that year
        if (year) {
            if (newsData[year]) {
                rightColumnData = newsData[year]
            } else {
                // Year specified but not found - try to use first available year as fallback
                console.warn(
                    `Year "${year}" not found in news data. Available years: ${years.join(', ')}. Using first available year: ${years[0]}`
                )
                year = years[0]
                rightColumnData = newsData[year]
            }
        } else {
            // If no year specified, use the first available year
            year = years[0]
            rightColumnData = newsData[year]
        }

        // If still no data found, return empty array
        if (!rightColumnData) {
            return `<!-- No news data found for year: "${year}" -->`
        }
    } else {
        return `<!-- Invalid news data structure -->`
    }

    if (!Array.isArray(rightColumnData)) {
        return `<!-- News data is not an array for year: "${year}" -->`
    }

    // Filter and merge items for the specified school
    let filteredItems = []

    if (olderMode) {
        // Older mode: collect all items from "older" arrays within the news items
        const olderItems = []

        rightColumnData.forEach((item) => {
            // Check if this item has an "older" key
            if (item.older && Array.isArray(item.older)) {
                // Add all older items to the collection
                olderItems.push(...item.older)
            } else if (
                item.ps &&
                item.ps.older &&
                Array.isArray(item.ps.older)
            ) {
                // Case: older is nested under ps
                olderItems.push(...item.ps.older)
            } else if (
                item.bs &&
                item.bs.older &&
                Array.isArray(item.bs.older)
            ) {
                // Case: older is nested under bs
                olderItems.push(...item.bs.older)
            } else if (
                item.common &&
                item.common.older &&
                Array.isArray(item.common.older)
            ) {
                // Case: older is nested under common
                olderItems.push(...item.common.older)
            }
        })

        // Now filter the older items by school
        filteredItems = olderItems
            .map((item, index) => {
                // Check the structure of the item
                if (item.common) {
                    // Case 1: Item has common section (appears in both schools)
                    const commonData = item.common || {}
                    const schoolData = item[actualSchoolKey] || {}

                    // If school-specific data is false, return null to exclude
                    if (item[actualSchoolKey] === false) {
                        return null
                    }

                    // Merge common data with school-specific overrides
                    return {
                        ...commonData,
                        ...schoolData,
                    }
                } else if (item.ps || item.bs) {
                    // Case 2: Item has only ps or bs section (school-specific only)
                    // Check if this item is for the current school
                    if (item[actualSchoolKey]) {
                        return item[actualSchoolKey]
                    } else {
                        return null
                    }
                } else {
                    // Case 3: Old structure - item is directly the data
                    return item
                }
            })
            .filter((item) => {
                // Remove null items (filtered out)
                return item !== null
            })
    } else {
        // Normal mode: filter top-level news items
        filteredItems = rightColumnData
            .map((item, index) => {
                // Check the structure of the item
                if (item.common) {
                    // Case 1: Item has common section (appears in both schools)
                    const commonData = item.common || {}
                    const schoolData = item[actualSchoolKey] || {}

                    // If school-specific data is false, return null to exclude
                    if (item[actualSchoolKey] === false) {
                        return null
                    }

                    // Merge common data with school-specific overrides
                    return {
                        ...commonData,
                        ...schoolData,
                    }
                } else if (item.ps || item.bs) {
                    // Case 2: Item has only ps or bs section (school-specific only)
                    // Check if this item is for the current school
                    if (item[actualSchoolKey]) {
                        return item[actualSchoolKey]
                    } else {
                        return null
                    }
                } else {
                    // Case 3: Old structure - item is directly the data
                    return item
                }
            })
            .filter((item) => {
                // Remove null items (filtered out)
                return item !== null
            })
    }

    // Create a new context with the filtered items
    const context = {
        items: filteredItems,
    }

    // Render the block with the filtered items
    const rendered = options.fn(context)

    // Add debug comment (only in development)
    const debugComment = `<!-- filterNews: school=${actualSchoolKey}, year=${year}, items=${filteredItems.length} -->`

    return debugComment + rendered
}
