module.exports = function (...args) {
    // Remove the Handlebars options object from the end
    args.pop()
    // Concatenate all arguments
    return args.join('')
}
