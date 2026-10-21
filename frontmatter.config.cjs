const fs = require('node:fs')
const path = require('node:path')

// Front Matter calls this function when its settings are loaded/refreshed.
// Keep the JSON config as the source of the form; only its image choices vary.
module.exports = (config) => {
    const publicFolder = config['frontMatter.content.publicFolder']
    const folder =
        typeof publicFolder === 'string' ? publicFolder : publicFolder.path
    const imageFolder = path.resolve(
        __dirname,
        folder.replace('[[workspace]]', __dirname)
    )
    const images = fs
        .readdirSync(imageFolder, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isFile() &&
                /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(entry.name)
        )
        .map((entry) => ({
            name: entry.name,
            modified: fs.statSync(path.join(imageFolder, entry.name)).mtimeMs,
        }))
        .sort(
            (a, b) =>
                b.modified - a.modified || a.name.localeCompare(b.name, 'hu')
        )
        .map((entry) => entry.name)

    return {
        ...config,
        'frontMatter.data.files': config['frontMatter.data.files'].map(
            (file) => {
                if (
                    !file.id.startsWith('news-') ||
                    !file.schema?.properties?.img
                ) {
                    return file
                }

                return {
                    ...file,
                    schema: {
                        ...file.schema,
                        properties: {
                            ...file.schema.properties,
                            img: {
                                ...file.schema.properties.img,
                                enum: ['nincs', ...images],
                            },
                        },
                    },
                }
            }
        ),
    }
}
