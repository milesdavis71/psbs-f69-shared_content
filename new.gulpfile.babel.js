import plugins       from 'gulp-load-plugins';
import yargs         from 'yargs';
import browser       from 'browser-sync';
import gulp          from 'gulp';
import panini        from 'panini';
import rimraf        from 'rimraf';
import sherpa        from 'style-sherpa';
import yaml          from 'js-yaml';
import fs            from 'fs';
import webpackStream from 'webpack-stream';
import webpack2      from 'webpack';
import named         from 'vinyl-named';
import autoprefixer  from 'autoprefixer';
import imagemin      from 'gulp-imagemin';
const sass           = require('gulp-sass')(require('sass-embedded'));
const postcss        = require('gulp-postcss');
const sourcemaps     = require('gulp-sourcemaps');
const plumber        = require('gulp-plumber');
const inject         = require('gulp-inject-string');

// Load all Gulp plugins into one variable
const $ = plugins();

// Check for --production flag
const PRODUCTION = !!(yargs.argv.production);

// Load settings from settings.yml
function loadConfig() {
  const unsafe = require('js-yaml-js-types').all;
  const schema = yaml.DEFAULT_SCHEMA.extend(unsafe);
  const ymlFile = fs.readFileSync('config.yml', 'utf8');
  return yaml.load(ymlFile, {schema});
}
const { PORT, UNCSS_OPTIONS, PATHS } = loadConfig();

// School-specific config
const SCHOOLS = ['school1', 'school2'];
let currentSchool = yargs.argv.school || 'school1';

// Set school context
function setSchool(school) {
  return (done) => {
    currentSchool = school;
    console.log(`\n🔧 Building for: ${currentSchool}\n`);
    done();
  };
}

// Generate school-data.json from YAML
function generateSchoolData(done) {
  const allSchools = yaml.load(fs.readFileSync('src/data/school.yml', 'utf8'));
  const schoolData = allSchools[currentSchool];
  fs.writeFileSync('src/data/school-data.json', JSON.stringify({ school: schoolData }));
  done();
}

// Delete dist
function clean(done) {
  rimraf(PATHS.dist, done);
}

// Copy assets
function copy() {
  return gulp.src(PATHS.assets)
    .pipe(gulp.dest(PATHS.dist + '/assets'));
}

// HTML build with Panini
function pagesSchool() {
  return gulp.src(`src/pages/${currentSchool}/**/*.{html,hbs,handlebars}`)
    .pipe(panini({
      root: `src/pages/${currentSchool}/`,
      layouts: 'src/layouts/',
      partials: 'src/partials/',
      data: 'src/data/',
      helpers: 'src/helpers/'
    }))
    .pipe(gulp.dest(PATHS.dist));
}

// Reset Panini cache
function resetPages(done) {
  panini.refresh();
  done();
}

// Style guide
function styleGuide(done) {
  sherpa('src/styleguide/index.md', {
    output: PATHS.dist + '/styleguide.html',
    template: 'src/styleguide/template.html'
  }, done);
}

// SASS compilation with school-specific colors
function sassBuild() {
  const postCssPlugins = [
    autoprefixer(),
  ].filter(Boolean);

  const schoolScssPath = `src/assets/scss/${currentSchool}/_colors.scss`;

  return gulp.src('src/assets/scss/app.scss')
    .pipe(sourcemaps.init())
    .pipe(plumber())
    .pipe(inject.prepend(`@import "${schoolScssPath}";\n`))
    .pipe(sass({
      includePaths: PATHS.sass
    }).on('error', sass.logError))
    .pipe(postcss(postCssPlugins))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(PATHS.dist + '/assets/css'))
    .pipe(browser.reload({ stream: true }));
}

// Webpack config
let webpackConfig = {
  mode: (PRODUCTION ? 'production' : 'development'),
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ "@babel/preset-env" ],
            compact: false
          }
        }
      }
    ]
  },
  devtool: !PRODUCTION && 'source-map'
};

// JavaScript bundle
function javascript() {
  return gulp.src(PATHS.entries)
    .pipe(named())
    .pipe($.sourcemaps.init())
    .pipe(webpackStream(webpackConfig, webpack2))
    .pipe($.if(PRODUCTION, $.terser()
      .on('error', e => { console.log(e); })
    ))
    .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
    .pipe(gulp.dest(PATHS.dist + '/assets/js'));
}

// Image processing
function images() {
  return gulp.src('src/assets/img/**/*')
    .pipe($.if(PRODUCTION, imagemin([
      imagemin.gifsicle({interlaced: true}),
      imagemin.mozjpeg({quality: 85, progressive: true}),
      imagemin.optipng({optimizationLevel: 5}),
      imagemin.svgo({
        plugins: [
          {removeViewBox: true},
          {cleanupIDs: false}
        ]
      })
    ])))
    .pipe(gulp.dest(PATHS.dist + '/assets/img'));
}

// BrowserSync server
function server(done) {
  browser.init({
    server: PATHS.dist,
    port: PORT
  }, done);
}

// Reload page
function reload(done) {
  browser.reload();
  done();
}

// Watch files
function watchSchool() {
  gulp.watch(PATHS.assets, copy);
  gulp.watch(`src/pages/${currentSchool}/**/*.html`).on('all', gulp.series(pagesSchool, browser.reload));
  gulp.watch('src/{layouts,partials}/**/*.html').on('all', gulp.series(resetPages, pagesSchool, browser.reload));
  gulp.watch('src/data/**/*.{js,json,yml}').on('all', gulp.series(resetPages, pagesSchool, browser.reload));
  gulp.watch('src/helpers/**/*.js').on('all', gulp.series(resetPages, pagesSchool, browser.reload));
  gulp.watch('src/assets/scss/**/*.scss').on('all', sassBuild);
  gulp.watch('src/assets/js/**/*.js').on('all', gulp.series(javascript, browser.reload));
  gulp.watch('src/assets/img/**/*').on('all', gulp.series(images, browser.reload));
  gulp.watch('src/styleguide/**').on('all', gulp.series(styleGuide, browser.reload));
}

// Build pipeline
gulp.task('build', gulp.series(clean, gulp.parallel(pagesSchool, javascript, images, copy), sassBuild, styleGuide));
gulp.task('default', gulp.series('build', server, watchSchool));

// Per-school tasks
SCHOOLS.forEach(school => {
  gulp.task(`build:${school}`, gulp.series(
    setSchool(school),
    generateSchoolData,
    clean,
    gulp.parallel(pagesSchool, javascript, images, copy),
    sassBuild,
    styleGuide
  ));
  gulp.task(`start:${school}`, gulp.series(
    setSchool(school),
    generateSchoolData,
    `build:${school}`,
    server,
    watchSchool
  ));
});
