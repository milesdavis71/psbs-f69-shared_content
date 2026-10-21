const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const filterNews = require('../src/helpers/filterNews')

const projectRoot = path.resolve(__dirname, '..')
const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'frontmatter.json'), 'utf8')
)

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
