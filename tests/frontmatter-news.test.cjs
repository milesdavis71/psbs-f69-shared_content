const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const filterNews = require('../src/helpers/filterNews')
const composeConfig = require('../frontmatter.config.cjs')

const projectRoot = path.resolve(__dirname, '..')
const baseConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'frontmatter.json'), 'utf8')
)
const config = composeConfig(baseConfig)

test('image choices follow uploads and removals without modifying the base config', (t) => {
    const folder = fs.mkdtempSync(
        path.join(os.tmpdir(), 'frontmatter-media-test-')
    )
    const firstImage = path.join(folder, 'régi kép.JPG')
    const newImage = path.join(folder, 'új-kép.png')
    const video = path.join(folder, 'video.mp4')
    const subfolder = path.join(folder, 'album.jpg')
    t.after(() => {
        for (const file of [firstImage, newImage, video]) {
            if (fs.existsSync(file)) fs.unlinkSync(file)
        }
        fs.rmdirSync(subfolder)
        fs.rmdirSync(folder)
    })
    fs.writeFileSync(firstImage, '')
    fs.writeFileSync(video, '')
    fs.mkdirSync(subfolder)
    fs.utimesSync(firstImage, new Date(0), new Date(0))
    const unrelatedFile = {
        id: 'authors',
        schema: { type: 'object', properties: { img: { type: 'string' } } },
    }
    const input = {
        ...baseConfig,
        'frontMatter.content.publicFolder': folder,
        'frontMatter.data.files': [
            ...baseConfig['frontMatter.data.files'],
            unrelatedFile,
        ],
    }
    const before = structuredClone(input)
    const choices = () =>
        composeConfig(input)['frontMatter.data.files'][0].schema.properties.img
            .enum

    assert.deepEqual(choices(), ['nincs', 'régi kép.JPG'])
    fs.writeFileSync(newImage, '')
    assert.deepEqual(choices(), ['nincs', 'új-kép.png', 'régi kép.JPG'])
    fs.unlinkSync(firstImage)
    assert.deepEqual(choices(), ['nincs', 'új-kép.png'])
    assert.deepEqual(input, before)
    assert.deepEqual(
        composeConfig(input)['frontMatter.data.files'].at(-1),
        unrelatedFile
    )
})

function select(newsData, school, extra = {}) {
    let result
    filterNews(school, {
        data: { root: { root: '../../' } },
        hash: { newsData, ...extra },
        fn: ({ items }) => {
            result = items
            return ''
        },
    })
    return result
}

test('Data form records reach the selected school, in list order', () => {
    const entries = yaml.load(
        yaml.dump([
            { site: 'bs', title: 'Bálint', content: 'news03' },
            { site: 'common', title: 'Közös', content: 'news02' },
            { site: 'ps', title: 'Petőfi', content: 'news01' },
        ])
    )
    assert.deepEqual(
        select(entries, 'ps').map((item) => item.content),
        ['news02', 'news01']
    )
    assert.deepEqual(
        select(entries, 'bs').map((item) => item.content),
        ['news03', 'news02']
    )
    assert.ok(select(entries, 'ps').every((item) => item.root === '../../'))
})

test('appended Data form records appear first on the appropriate homepages', () => {
    const entries = [
        { site: 'common', title: 'Közös', content: 'news99' },
        { site: 'bs', title: 'Bálint', content: 'news10' },
        { site: 'ps', title: 'Petőfi', content: 'news09' },
    ]
    // Add behaves like Array.push in the Front Matter Data dashboard.
    entries.push({ site: 'bs', title: 'Új Bálint hír', content: 'news100' })
    entries.push({ site: 'common', title: 'Új közös hír', content: 'news101' })
    const before = structuredClone(entries)
    const newestFirst = { newestFirst: true }

    assert.deepEqual(
        select(entries, 'bs', newestFirst).map((item) => item.content),
        ['news101', 'news100', 'news99', 'news10']
    )
    assert.deepEqual(
        select(entries, 'ps', newestFirst).map((item) => item.content),
        ['news101', 'news99', 'news09']
    )
    // An existing news item keeps its position when its title is edited.
    entries[1].title = 'Javított Bálint cím'
    assert.deepEqual(
        select(entries, 'bs', newestFirst).map((item) => item.content),
        ['news101', 'news100', 'news99', 'news10']
    )
    before[1].title = entries[1].title
    assert.deepEqual(entries, before, 'rendering must not reorder the data file')
    assert.deepEqual(
        select(entries, 'bs').map((item) => item.content),
        ['news99', 'news10', 'news100', 'news101'],
        'callers without newestFirst retain their original order'
    )
})

test('news without a sequence keep their relative order after numbered news', () => {
    const entries = [
        { site: 'ps', title: 'Azonosító nélkül' },
        { site: 'ps', content: 'news09' },
        { site: 'ps', title: 'Régi azonosító', content: 'other' },
        { site: 'ps', content: 'news10' },
    ]
    assert.deepEqual(
        select(entries, 'ps', { newestFirst: true }).map((item) => item.content),
        ['news10', 'news09', undefined, 'other']
    )
})

test('changing the school in the form takes effect even with a legacy marker', () => {
    const entries = [{ ps: null, site: 'bs', title: 'Áthelyezett hír' }]
    assert.equal(select(entries, 'ps').length, 0)
    assert.equal(select(entries, 'bs')[0].title, 'Áthelyezett hír')
    assert.deepEqual(entries, [
        { ps: null, site: 'bs', title: 'Áthelyezett hír' },
    ])
})

test('legacy archive markers, nested overrides and explicit exclusions still work', () => {
    const entries = {
        '2025-26': [
            { bs: null, school: 'Székhely', title: 'Régi Bálint hír' },
            { common: { title: 'Közös' }, ps: { title: 'Petőfi változat' } },
            { common: { title: 'Csak Bálint' }, ps: false },
        ],
    }
    assert.deepEqual(
        select(entries, 'ps').map((item) => item.title),
        ['Petőfi változat']
    )
    assert.deepEqual(
        select(entries, 'bs').map((item) => item.title),
        ['Régi Bálint hír', 'Közös', 'Csak Bálint']
    )
})

test('older news mode also accepts Data form records', () => {
    const entries = [
        {
            older: [
                { site: 'ps', title: 'Petőfi' },
                { site: 'bs', title: 'Bálint' },
                { site: 'common', title: 'Közös' },
            ],
        },
    ]
    assert.deepEqual(
        select(entries, 'ps', { older: true }).map((item) => item.title),
        ['Petőfi', 'Közös']
    )
    assert.deepEqual(
        select(entries, 'bs', { older: true }).map((item) => item.title),
        ['Bálint', 'Közös']
    )
})

test('the YAML snippet creates a root list and preserves quoted Hungarian titles', () => {
    const snippet =
        config['frontMatter.content.snippets'][
            'HIR - YAML bejegyzés (news-*.yml)'
        ]
    const fields = {
        site: 'bs',
        title: 'Hír: "Idézet" & ünnepség',
        img: 'nincs',
        imgclass: 'medium-3',
        contentclass: 'medium-9',
        content: 'news07',
    }
    const rendered = snippet.body
        .join('\n')
        .replace(/\[\[&?(\w+)\]\]/g, (_, key) => fields[key])
    const entries = yaml.load(rendered + '\n- site: ps\n  title: Meglévő hír\n')
    assert.equal(entries.length, 2)
    assert.equal(entries[0].title, fields.title)
    assert.equal(select(entries, 'bs')[0].content, 'news07')
    assert.equal(select(entries, 'ps').length, 1)
})

test('registered news files have forms and unique, matching content blocks', () => {
    for (const file of config['frontMatter.data.files']) {
        const schema =
            file.schema ||
            config['frontMatter.data.types']?.find(
                (type) => type.id === file.type
            )?.schema
        assert.ok(schema, `${file.id}: the dashboard requires a schema`)
        assert.equal(schema.type, 'object')
        assert.ok(
            schema.properties[file.labelField],
            `${file.id}: readable list labels`
        )
        assert.equal(file.singleEntry, false)
        const entries = yaml.load(
            fs.readFileSync(
                file.file.replace('[[workspace]]', projectRoot),
                'utf8'
            )
        )
        assert.ok(Array.isArray(entries), `${file.id}: a root list is required`)
        const contentPath = path.join(
            projectRoot,
            'src/content',
            `common-news-content-${file.id.slice(5)}.md`
        )
        const source = fs.readFileSync(contentPath, 'utf8')
        const blocks = [
            ...source.matchAll(/\{\{#ifequal hir "(news\d+)"\}\}/g),
        ].map((match) => match[1])
        assert.equal(
            new Set(blocks).size,
            blocks.length,
            'unique content blocks'
        )
        assert.equal(
            new Set(entries.map((item) => item.content)).size,
            entries.length,
            'unique content IDs'
        )
        for (const item of entries) {
            assert.ok(
                schema.properties.img.enum.includes(item.img),
                `${item.content}: current image is selectable in the Data form`
            )
            assert.ok(
                schema.properties.site.enum.includes(item.site),
                `${item.content}: supported school`
            )
            assert.ok(
                blocks.includes(item.content),
                `${item.content}: matching Markdown block`
            )
            assert.ok(
                item.img === 'nincs' ||
                    fs.existsSync(
                        path.join(
                            projectRoot,
                            'src/assets/img/hirfolyam',
                            item.img
                        )
                    ),
                `${item.content}: existing image`
            )
        }
    }
})
