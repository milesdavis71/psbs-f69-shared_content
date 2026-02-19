// Helper to filter right_column items based on school
// Usage: {{#filterRightColumn "ps"}} ... {{/filterRightColumn}}
// or: {{#filterRightColumn schoolKey}} ... {{/filterRightColumn}}

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

    // Get the right_column data from common.yml (available in different contexts)
    let rightColumnData = []

    // Try different possible locations for the right_column data
    if (root.common && root.common.right_column) {
        rightColumnData = root.common.right_column
    } else if (root.global && root.global.right_column) {
        rightColumnData = root.global.right_column
    } else if (root.right_column) {
        rightColumnData = root.right_column
    } else if (root.data && root.data.common && root.data.common.right_column) {
        rightColumnData = root.data.common.right_column
    }

    if (!rightColumnData || !Array.isArray(rightColumnData)) {
        return `<!-- No right_column data found -->`
    }

    // Filter and merge items for the specified school
    const filteredItems = rightColumnData
        .map((item, index) => {
            // Check the structure of the item
            if (item.common) {
                // Case 1: Item has common section (appears in both schools)
                const commonData = item.common || {}
                const schoolData = item[actualSchoolKey] || {}

                // If school-specific data is false, return null to exclude
                if (item[actualSchoolKey] === false) {
                    // console.log(`Item ${index}: common item disabled for ${actualSchoolKey}`)
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
                // If item has data for the current school, include it
                // If item doesn't have data for the current school, exclude it
                if (item[actualSchoolKey]) {
                    // console.log(`Item ${index}: school-specific item for ${actualSchoolKey}`, item[actualSchoolKey])
                    return item[actualSchoolKey]
                } else {
                    // console.log(`Item ${index}: school-specific item NOT for ${actualSchoolKey}, excluding`)
                    return null
                }
            } else {
                // Case 3: Old structure - item is directly the data (backward compatibility)
                // console.log(`Item ${index}: old structure item`)
                return item
            }
        })
        .filter((item) => {
            // Remove null items (filtered out)
            return item !== null
        })

    // Create a new context with the filtered items
    const context = {
        items: filteredItems,
    }

    // Render the block with the filtered items
    return options.fn(context)
}
