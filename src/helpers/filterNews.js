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

    // Debug: log the structure of first few items
    const debugItems = rightColumnData
        .slice(0, 3)
        .map((item) => {
            const keys = Object.keys(item)
            return keys.join(',')
        })
        .join('; ')

    // Filter and merge items for the specified school
    let filteredItems = []

    if (olderMode) {
        // Older mode: collect all items from "older" arrays within the news items
        const olderItems = []

        rightColumnData.forEach((item) => {
            // Check if this item has an "older" array
            // The older array can be:
            // 1. At the top level: item.older
            // 2. Nested under a school key: item.ps.older or item.bs.older
            // 3. Nested under common: item.common.older

            if (item.older && Array.isArray(item.older)) {
                // Case 1: Top-level older array
                olderItems.push(...item.older)
            }

            // Check if older is nested under the current school key
            if (
                item[actualSchoolKey] &&
                typeof item[actualSchoolKey] === 'object' &&
                item[actualSchoolKey].older &&
                Array.isArray(item[actualSchoolKey].older)
            ) {
                // Case 2: older is nested under ps or bs
                olderItems.push(...item[actualSchoolKey].older)
            }

            // Check if older is nested under common
            if (
                item.common &&
                typeof item.common === 'object' &&
                item.common.older &&
                Array.isArray(item.common.older)
            ) {
                // Case 3: older is nested under common
                olderItems.push(...item.common.older)
            }
        })

        // Now filter the older items by school
        filteredItems = olderItems
            .map((item, index) => {
                // Determine the item structure and filter by school
                const hasCommon =
                    item.common &&
                    typeof item.common === 'object' &&
                    item.common !== null
                const schoolData = item[actualSchoolKey]
                const otherSchoolData =
                    actualSchoolKey === 'ps' ? item.bs : item.ps
                const hasSchoolData = schoolData !== undefined
                const hasOtherSchoolData = otherSchoolData !== undefined

                // Case 1: Item has common section
                if (hasCommon) {
                    // If school-specific data is explicitly false, exclude this item
                    if (schoolData === false) {
                        return null
                    }
                    // Merge common data with school-specific overrides (if any)
                    const merged = { ...item.common }
                    if (schoolData && typeof schoolData === 'object') {
                        Object.assign(merged, schoolData)
                    }
                    return merged
                }

                // Case 2: No common section, but has school-specific data
                if (hasSchoolData) {
                    // If school data is false, exclude
                    if (schoolData === false) {
                        return null
                    }
                    // If school data is an object and not null, use it directly
                    if (typeof schoolData === 'object' && schoolData !== null) {
                        return schoolData
                    }
                    // If school data is null or other primitive, treat as school-specific item
                    // where the item itself contains the news data (old YAML structure)
                    // Remove school keys and return the rest
                    const { ps, bs, common, ...itemData } = item
                    return itemData
                }

                // Case 3: Only has data for the other school (no common, no school data)
                if (hasOtherSchoolData) {
                    return null
                }

                // Case 4: Old structure - item is directly the news data
                return item
            })
            .filter((item) => item !== null)
    } else {
        // Normal mode: filter top-level news items
        filteredItems = rightColumnData
            .map((item, index) => {
                // Determine the item structure and filter by school
                const hasCommon =
                    item.common &&
                    typeof item.common === 'object' &&
                    item.common !== null
                const schoolData = item[actualSchoolKey]
                const otherSchoolData =
                    actualSchoolKey === 'ps' ? item.bs : item.ps
                const hasSchoolData = schoolData !== undefined
                const hasOtherSchoolData = otherSchoolData !== undefined

                // Case 1: Item has common section
                if (hasCommon) {
                    // If school-specific data is explicitly false, exclude this item
                    if (schoolData === false) {
                        return null
                    }
                    // Merge common data with school-specific overrides (if any)
                    const merged = { ...item.common }
                    if (schoolData && typeof schoolData === 'object') {
                        Object.assign(merged, schoolData)
                    }
                    return merged
                }

                // Case 2: No common section, but has school-specific data
                if (hasSchoolData) {
                    // If school data is false, exclude
                    if (schoolData === false) {
                        return null
                    }
                    // If school data is an object and not null, use it directly
                    if (typeof schoolData === 'object' && schoolData !== null) {
                        return schoolData
                    }
                    // If school data is null or other primitive, treat as school-specific item
                    // where the item itself contains the news data (old YAML structure)
                    // Remove school keys and return the rest
                    const { ps, bs, common, ...itemData } = item
                    return itemData
                }

                // Case 3: Only has data for the other school (no common, no school data)
                if (hasOtherSchoolData) {
                    return null
                }

                // Case 4: Old structure - item is directly the news data
                return item
            })
            .filter((item) => item !== null)
    }

    // Create a new context with the filtered items
    const context = {
        items: filteredItems,
    }

    // Render the block with the filtered items
    const rendered = options.fn(context)

    // Add debug comment (only in development)
    const debugComment = `<!-- filterNews: school=${actualSchoolKey}, year=${year}, items=${filteredItems.length}, debugItems=${debugItems} -->`

    return debugComment + rendered
}
