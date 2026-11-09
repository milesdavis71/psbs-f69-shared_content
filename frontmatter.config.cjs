const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const { registerNewsCommands } = require('./.frontmatter/lib/news-commands.cjs')
const { registerGalleryCommands } = require('./.frontmatter/lib/gallery-commands.cjs')
const { galleryFolders } = require('./src/lib/gallery-utils.cjs')

// Front Matter calls this function when its settings are loaded/refreshed.
// Keep the JSON schema as the form definition; add image choices and ID handling.
module.exports = (config) => {
    // Plain Node tests do not have VS Code's extension-host API.
    let vscode
    try {
        vscode = require('vscode')
    } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error
    }
    if (vscode) {
        registerNewsCommands(vscode, __dirname, config)
        registerGalleryCommands(vscode, __dirname, config)
    }
    const galleryChoices = galleryFolders(__dirname).map((item) => item.value)
    const eventsFile = path.join(__dirname, 'src/data/gallery_events.yml')
    if (fs.existsSync(eventsFile)) {
        try {
            const events = yaml.load(fs.readFileSync(eventsFile, 'utf8'))
            if (Array.isArray(events)) {
                for (const event of events) {
                    if (event?.folder && !galleryChoices.includes(event.folder)) {
                        galleryChoices.push(event.folder)
                    }
                }
            }
        } catch {
            /* A broken registry must not prevent the dashboard from opening. */
        }
    }
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
                    file.id === 'gallery-events' &&
                    file.schema?.properties?.folder
                ) {
                    return {
                        ...file,
                        schema: {
                            ...file.schema,
                            properties: {
                                ...file.schema.properties,
                                folder: {
                                    ...file.schema.properties.folder,
                                    // Az üres érték is érvényes kell legyen: a
                                    // dashboard saját validációja különben a
                                    // mappa kiválasztása előtt elhasal.
                                    enum: ['', ...galleryChoices],
                                    uniforms: {
                                        placeholder:
                                            'Válassz feldolgozott galériamappát (gallery-events)',
                                        'data-gallery-source': file.id,
                                    },
                                },
                                school: {
                                    ...file.schema.properties.school,
                                    uniforms: {},
                                },
                                year: {
                                    ...file.schema.properties.year,
                                    uniforms: {},
                                },
                                slug: {
                                    ...file.schema.properties.slug,
                                    uniforms: { readOnly: true },
                                },
                            },
                        },
                    }
                }
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
                            content: {
                                ...file.schema.properties.content,
                                uniforms: {
                                    readOnly: true,
                                    // The placeholder carries the source id as a fallback
                                    // marker: some uniforms builds do not forward custom
                                    // data-* attributes to the rendered input.
                                    placeholder: `Mentéskor automatikusan létrejön (${file.id})`,
                                    'data-news-source': file.id,
                                },
                            },
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
