const fs = require('fs')
const path = require('path')
const Handlebars = require('handlebars')
const marked = require('marked')

const CONTENT_ROOT = path.resolve(process.cwd(), 'src', 'content')

marked.setOptions({
    headerIds: false,
    mangle: false,
})

module.exports = function mdFile(relativeName, options) {
    const relativePath = `${String(relativeName).replace(/\.md$/, '')}.md`
    const absolutePath = path.resolve(CONTENT_ROOT, relativePath)
    const pathFromContentRoot = path.relative(CONTENT_ROOT, absolutePath)

    if (
        pathFromContentRoot.startsWith('..') ||
        path.isAbsolute(pathFromContentRoot) ||
        !fs.existsSync(absolutePath)
    ) {
        throw new Error(`Markdown content file not found: ${relativePath}`)
    }

    const markdownSource = fs.readFileSync(absolutePath, 'utf8')
    const context = Object.assign(
        {},
        options.data && options.data.root,
        this,
        options.hash
    )
    const renderedMarkdown = Handlebars.compile(markdownSource)(context)

    return new Handlebars.SafeString(marked.parse(renderedMarkdown))
}
