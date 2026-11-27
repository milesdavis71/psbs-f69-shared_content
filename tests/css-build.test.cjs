const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('Sass task writes app.css and rejects invalid Sass', () => {
    const root = path.resolve(__dirname, '..')
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'school-css-'))
    const source = path.join(fixture, 'src/assets/scss/app.scss')
    const output = path.join(fixture, 'dist/assets/css/app.css')
    fs.mkdirSync(path.dirname(source), { recursive: true })
    const run = () => spawnSync(process.execPath, ['-e', `
        require('@babel/register');
        require('./gulpfile.babel.js');
        process.chdir(${JSON.stringify(fixture)});
        require('gulp').series('sass')(error => { if (error) process.exitCode = 1; });
    `], { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true })
    try {
        fs.writeFileSync(source, '.css-build-check { color: red; }')
        const valid = run()
        assert.equal(valid.status, 0, valid.stderr)
        assert.match(fs.readFileSync(output, 'utf8'), /\.css-build-check/)
        fs.unlinkSync(output)
        fs.writeFileSync(source, '@error "intentional CSS build failure";')
        const invalid = run()
        assert.notEqual(invalid.status, 0)
        assert.match(invalid.stderr + invalid.stdout, /intentional CSS build failure/)
        assert.equal(fs.existsSync(output), false)
    } finally {
        assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()))
        fs.rmSync(fixture, { recursive: true, force: true })
    }
})
