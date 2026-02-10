const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const fm = require('yaml-front-matter')

// Ide írd be a kért sorrendet
const PREFERRED_ORDER = ['layout', 'title', 'page', 'dataFile', 'dataKey']

// A script mostantól paraméterként is kaphatja a fájlt, vagy futhat az összesre
const fileArg = process.argv[2]
const files = fileArg
    ? [fileArg]
    : require('glob').sync('./src/pages/**/*.html')

files.forEach((file) => {
    try {
        const absolutePath = path.resolve(file)
        let content = fs.readFileSync(absolutePath, 'utf8')

        // BOM karakter eltávolítása, ha van
        if (content.charCodeAt(0) === 0xfeff) {
            content = content.substring(1)
        }

        // Ellenőrizzük, hogy van-e frontmatter (Windows és Unix sortörések támogatása)
        const frontmatterRegex =
            /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/
        const match = content.match(frontmatterRegex)

        if (!match) {
            console.log(`Nincs frontmatter: ${file}`)
            return
        }

        const frontmatterText = match[1]
        const body = match[2]

        // YAML parse
        let parsed
        try {
            parsed = yaml.load(frontmatterText)
        } catch (yamlErr) {
            console.log(`YAML parse hiba: ${file}`, yamlErr.message)
            return
        }

        // Ha nincs frontmatter objektum, ne csináljon semmit
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            Object.keys(parsed).length === 0
        ) {
            console.log(`Üres frontmatter: ${file}`)
            return
        }

        // Kulcsok rendezése: Fix sorrend + a maradék ABC-ben
        const allKeys = Object.keys(parsed)
        const sortedKeys = allKeys.sort((a, b) => {
            let idxA = PREFERRED_ORDER.indexOf(a)
            let idxB = PREFERRED_ORDER.indexOf(b)

            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            return a.localeCompare(b)
        })

        const sortedObj = {}
        sortedKeys.forEach((k) => {
            sortedObj[k] = parsed[k]
        })

        // YAML generálás (távolságok és formázás fixálása)
        const newYaml = yaml.dump(sortedObj, {
            lineWidth: -1, // ne törje meg a hosszú sorokat
            quotingType: '"',
        })

        const newContent = `---\n${newYaml}---\n${body.trimStart()}`

        fs.writeFileSync(absolutePath, newContent, 'utf8')
        console.log(`Sikeresen rendezve: ${file}`)
    } catch (err) {
        console.error(`Hiba a fájl feldolgozása közben (${file}):`, err)
    }
})
