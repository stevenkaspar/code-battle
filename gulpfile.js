'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass');
const spawn = require('child_process').spawn;

const sass_src =  './public/stylesheets/scss/**/*.scss';
const sass_dest = './public/stylesheets';

const server_files = ['./routes/**/*'];

gulp.task('sass', function () {
  return gulp.src(sass_src)
    .pipe(sass.sync().on('error', sass.logError))
    .pipe(gulp.dest(sass_dest));
});

gulp.task('sass:watch', function () {
  gulp.watch(sass_src, ['sass']);
});



let startServer = function(){
  // clone the actual env vars to avoid overrides
  var env = Object.create( process.env );
  env.DEBUG = 'code:*';

  let local_node_process = spawn('nodemon', ['index.js', '--ignore', 'public/'], { env: env });
  local_node_process.on('close', (code, signal) => {
    console.log(`-- Server process closed --`);
  });
  local_node_process.stdout.on('data', (data) => {
    console.log(`${data}`);
  });
  local_node_process.stderr.on('data', (data) => {
    console.log(`${data}`);
  });
  return local_node_process;
}

startServer();


gulp.task('default', ['sass:watch']);
