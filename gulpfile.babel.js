import plugins from 'gulp-load-plugins'
import yargs from 'yargs'
import browser from 'browser-sync'
import gulp from 'gulp'
import panini from 'panini'
import rimraf from 'rimraf'
import sherpa from 'style-sherpa'
import yaml from 'js-yaml'
import fs from 'fs'
import webpackStream from 'webpack-stream'
import webpack2 from 'webpack'
import named from 'vinyl-named'
import autoprefixer from 'autoprefixer'
import imagemin from 'gulp-imagemin'

const sass = require('gulp-sass')(require('sass-embedded'))
const postcss = require('gulp-postcss')
const uncss = require('postcss-uncss')
var sourcemaps = require('gulp-sourcemaps')
var plumber = require('gulp-plumber')

// Load all Gulp plugins into one variable
const $ = plugins()

// Check for --production flag
const PRODUCTION = !!yargs.argv.production

// Load settings from settings.yml
function loadConfig() {
    const unsafe = require('js-yaml-js-types').all
    const schema = yaml.DEFAULT_SCHEMA.extend(unsafe)
    const ymlFile = fs.readFileSync('config.yml', 'utf8')
    return yaml.load(ymlFile, { schema })
}
const { PORT, UNCSS_OPTIONS, PATHS } = loadConfig()

console.log(UNCSS_OPTIONS)

// Az aktuális oldal frontmatteréből betöltjük a school értéket
function loadSchoolConfig() {
    const config = yargs.argv.school || 'iskola1' // alapértelmezett
    const yamlPath = `./src/data/${config}.yml`
    const file = fs.readFileSync(yamlPath, 'utf8')
    const data = yaml.load(file)

    const scssVars = Object.entries(data)
        .map(([key, val]) => `$${key}: ${val};`)
        .join('\n')
    fs.writeFileSync('./src/assets/scss/_dynamic-colors.scss', scssVars)
}

gulp.task('sass', function () {
    loadSchoolConfig()
    return gulp
        .src(paths.sass)
        .pipe(sourcemaps.init())
        .pipe(
            sass
                .sync({ includePaths: ['node_modules'] })
                .on('error', sass.logError)
        )
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(paths.dist + '/assets/css'))
})

// Build the "dist" folder by running all of the below tasks
// Sass must be run later so UnCSS can search for used classes in the others assets.
gulp.task(
    'build',
    gulp.series(
        clean,
        gulp.parallel(pages, javascript, images, copy),
        sassBuild,
        styleGuide
    )
)

// Build the site, run the server, and watch for file changes
gulp.task('default', gulp.series('build', server, watch))

// Delete the "dist" folder
// This happens every time a build starts
function clean(done) {
    rimraf(PATHS.dist, done)
}

// Copy files out of the assets folder
// This task skips over the "img", "js", and "scss" folders, which are parsed separately
function copy() {
    return gulp.src(PATHS.assets).pipe(gulp.dest(PATHS.dist + '/assets'))
}

// Copy page templates into finished HTML files
function pages() {
    return gulp
        .src('src/pages/**/*.{html,hbs,handlebars}')
        .pipe(
            panini({
                root: 'src/pages/',
                layouts: 'src/layouts/',
                partials: 'src/partials/',
                data: 'src/data/',
                helpers: 'src/helpers/',
            })
        )
        .pipe(gulp.dest(PATHS.dist))
}

// Load updated HTML templates and partials into Panini
function resetPages(done) {
    panini.refresh()
    done()
}

// Generate a style guide from the Markdown content and HTML template in styleguide/
function styleGuide(done) {
    sherpa(
        'src/styleguide/index.md',
        {
            output: PATHS.dist + '/styleguide.html',
            template: 'src/styleguide/template.html',
        },
        done
    )
}

// Compile Sass into CSS
// In production, the CSS is compressed
function sassBuild() {
    const postCssPlugins = [
        // Autoprefixer
        autoprefixer(),
        // UnCSS - Uncomment to remove unused styles in production
        // PRODUCTION && uncss(UNCSS_OPTIONS),
    ].filter(Boolean)

    return gulp
        .src('src/assets/scss/app.scss')
        .pipe(sourcemaps.init())
        .pipe(plumber())
        .pipe(
            sass({
                includePaths: PATHS.sass,
            }).on('error', sass.logError)
        )
        .pipe(postcss(postCssPlugins))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(PATHS.dist + '/assets/css'))
        .pipe(browser.reload({ stream: true }))
}

let webpackConfig = {
    mode: PRODUCTION ? 'production' : 'development',
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                        compact: false,
                    },
                },
            },
        ],
    },
    devtool: !PRODUCTION && 'source-map',
}

// Combine JavaScript into one file
// In production, the file is minified
function javascript() {
    return gulp
        .src(PATHS.entries)
        .pipe(named())
        .pipe($.sourcemaps.init())
        .pipe(webpackStream(webpackConfig, webpack2))
        .pipe(
            $.if(
                PRODUCTION,
                $.terser().on('error', (e) => {
                    console.log(e)
                })
            )
        )
        .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
        .pipe(gulp.dest(PATHS.dist + '/assets/js'))
}

// Copy images to the "dist" folder
// In production, the images are compressed
function images() {
    return gulp
        .src('src/assets/img/**/*')
        .pipe(
            $.if(
                PRODUCTION,
                imagemin([
                    imagemin.gifsicle({ interlaced: true }),
                    imagemin.mozjpeg({ quality: 85, progressive: true }),
                    imagemin.optipng({ optimizationLevel: 5 }),
                    imagemin.svgo({
                        plugins: [
                            { removeViewBox: true },
                            { cleanupIDs: false },
                        ],
                    }),
                ])
            )
        )
        .pipe(gulp.dest(PATHS.dist + '/assets/img'))
}

// Start a server with BrowserSync to preview the site in
function server(done) {
    browser.init(
        {
            server: PATHS.dist,
            port: PORT,
        },
        done
    )
}

// Reload the browser with BrowserSync
function reload(done) {
    browser.reload()
    done()
}

// Watch for changes to static assets, pages, Sass, and JavaScript
function watch() {
    gulp.watch(PATHS.assets, copy)
    gulp.watch('src/pages/**/*.html').on(
        'all',
        gulp.series(pages, browser.reload)
    )
    gulp.watch('src/{layouts,partials}/**/*.html').on(
        'all',
        gulp.series(resetPages, pages, browser.reload)
    )
    gulp.watch('src/data/**/*.{js,json,yml}').on(
        'all',
        gulp.series(resetPages, pages, browser.reload)
    )
    gulp.watch('src/helpers/**/*.js').on(
        'all',
        gulp.series(resetPages, pages, browser.reload)
    )
    gulp.watch('src/assets/scss/**/*.scss').on('all', sassBuild)
    gulp.watch('src/assets/js/**/*.js').on(
        'all',
        gulp.series(javascript, browser.reload)
    )
    gulp.watch('src/assets/img/**/*').on(
        'all',
        gulp.series(images, browser.reload)
    )
    gulp.watch('src/styleguide/**').on(
        'all',
        gulp.series(styleGuide, browser.reload)
    )
}

// ----- School-specific Handling -----

const SCHOOLS = ['school1', 'school2']
let currentSchool = yargs.argv.school || 'school1'

function setSchool(school) {
    return (done) => {
        currentSchool = school
        console.log(`\n🔧 Building for: ${currentSchool}\n`)
        done()
    }
}

// This is the task for build pages of each school
function pagesSchool() {
    return gulp
        .src(`src/pages/${currentSchool}/**/*.{html,hbs,handlebars}`)
        .pipe(
            panini({
                root: `src/pages/${currentSchool}/`,
                layouts: 'src/layouts/',
                partials: 'src/partials/',
                data: 'src/data/',
                helpers: 'src/helpers/',
            })
        )
        .pipe(gulp.dest(PATHS.dist))
}

// Override default `pages` task with the dynamic one
gulp.task('pages', pagesSchool)

// Update watch to reflect current school
function watchSchool() {
    gulp.watch(PATHS.assets, copy)
    gulp.watch(`src/pages/${currentSchool}/**/*.html`).on(
        'all',
        gulp.series(pagesSchool, browser.reload)
    )
    gulp.watch('src/{layouts,partials}/**/*.html').on(
        'all',
        gulp.series(resetPages, pagesSchool, browser.reload)
    )
    gulp.watch('src/data/**/*.{js,json,yml}').on(
        'all',
        gulp.series(resetPages, pages, browser.reload)
    )
    gulp.watch('src/helpers/**/*.js').on(
        'all',
        gulp.series(resetPages, pages, browser.reload)
    )
    gulp.watch('src/assets/scss/**/*.scss').on('all', sassBuild)
    gulp.watch('src/assets/js/**/*.js').on(
        'all',
        gulp.series(javascript, browser.reload)
    )
    gulp.watch('src/assets/img/**/*').on(
        'all',
        gulp.series(images, browser.reload)
    )
    gulp.watch('src/styleguide/**').on(
        'all',
        gulp.series(styleGuide, browser.reload)
    )
}

gulp.task('watch', watch)

// Register school-specific build tasks
SCHOOLS.forEach((school) => {
    gulp.task(
        `build:${school}`,
        gulp.series(
            setSchool(school),
            clean,
            gulp.parallel(pagesSchool, javascript, images, copy),
            sassBuild,
            styleGuide
        )
    )
    gulp.task(
        `start:${school}`,
        gulp.series(setSchool(school), `build:${school}`, server, watchSchool)
    )
})
