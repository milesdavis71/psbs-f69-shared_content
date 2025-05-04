const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Add this near the top of your gulpfile
const SCHOOLS = ['school1', 'school2'];
let currentSchool = 'school1'; // Default school

// Task to set school
function setSchool(school) {
  return function(done) {
    if (SCHOOLS.includes(school)) {
      currentSchool = school;
      console.log(`Building site for: ${currentSchool}`);
    } else {
      console.error(`Invalid school: ${school}. Available options: ${SCHOOLS.join(', ')}`);
    }
    done();
  };
}

// Modify the PANINI_CONFIG in your build task
const PANINI_CONFIG = {
  root: 'src/pages/',
  layouts: 'src/layouts/',
  partials: 'src/partials/',
  data: 'src/data/',
  helpers: 'src/helpers/'
};

// Update the data loader to merge common and school-specific data
function loadData() {
  const commonData = {};
  const schoolData = {};
  
  // Load common data
  const commonPath = path.join(PANINI_CONFIG.data, 'common');
  fs.readdirSync(commonPath).forEach(file => {
    if (file.endsWith('.yml') || file.endsWith('.yaml')) {
      const name = path.basename(file, path.extname(file));
      commonData[name] = yaml.safeLoad(fs.readFileSync(path.join(commonPath, file), 'utf8'));
    }
  });
  
  // Load school-specific data
  const schoolPath = path.join(PANINI_CONFIG.data, currentSchool);
  if (fs.existsSync(schoolPath)) {
    fs.readdirSync(schoolPath).forEach(file => {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const name = path.basename(file, path.extname(file));
        schoolData[name] = yaml.safeLoad(fs.readFileSync(path.join(schoolPath, file), 'utf8'));
      }
    });
  }
  
  // Merge data with school-specific overriding common
  return {...commonData, ...schoolData, school: currentSchool};
}

// Update the panini task
function pages() {
  return gulp.src('src/pages/' + currentSchool + '/**/*.html')
    .pipe(panini({
      ...PANINI_CONFIG,
      data: loadData
    }))
    .pipe(gulp.dest('dist'));
}

// Add school-specific tasks
SCHOOLS.forEach(school => {
  gulp.task(`build:${school}`, gulp.series(
    'clean',
    setSchool(school),
    'pages',
    'sass',
    'javascript',
    'images',
    'copy'
  ));
  
  gulp.task(`start:${school}`, gulp.series(
    setSchool(school),
    'build',
    gulp.parallel('watch', 'server')
  ));
});

// Update the default build task
gulp.task('build', gulp.series(`build:${currentSchool}`));
gulp.task('start', gulp.series(`start:${currentSchool}`));