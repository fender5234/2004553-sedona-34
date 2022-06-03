import autoprefixer from 'autoprefixer';
import browser from 'browser-sync';
import del from 'del';
import eslint from 'gulp-eslint';
import gulp from 'gulp';
import gulpIf from 'gulp-if';
import imagemin from 'gulp-imagemin';
import htmlBeautify from 'gulp-html-beautify';
import less from 'gulp-less';
import lessSyntax from 'postcss-less';
import lintspaces from 'gulp-lintspaces';
import mozjpeg from 'imagemin-mozjpeg';
import pngquant from 'imagemin-pngquant';
import postcss from 'gulp-postcss';
import postcssReporter from 'postcss-reporter';
import posthtml from 'gulp-posthtml';
import rename from 'gulp-rename';
import stylelint from 'stylelint';
import svgo from 'imagemin-svgo';
import svgoConfig from './svgo.config.js';

const IS_DEV = process.env.NODE_ENV === 'development';
const { src, dest, watch, series, parallel } = gulp;
const checkLintspaces = () => lintspaces({
  editorconfig: '.editorconfig'
});
const reportLintspaces = () => lintspaces.reporter({
  breakOnWarning: !IS_DEV
});
const editorconfigSources = [
  'source/njk/**/*.njk',
  '*.json',
  'source/img/**/*.svg',
  'source/static/**/*.svg',
  'source/sprite/**/*.svg'
];
const jsSources = [
  'source/static/js/**/*.js',
  '*.js'
];
const staticSources = ['source/static/**/*', 'source/static/**/.*'];

export const testHTML = () => src('source/njk/pages/**/*.njk')
  .pipe(posthtml())
  .pipe(htmlBeautify())
  .pipe(rename({ extname: '.html' }));

export const buildHTML = () => testHTML()
  .pipe(dest('build'));

export const testEditorconfig = () => src(editorconfigSources)
  .pipe(checkLintspaces())
  .pipe(reportLintspaces());

export const buildStyles = () => src('source/less/*.less', { sourcemaps: IS_DEV })
  .pipe(less())
  .pipe(postcss([
    autoprefixer(),
    stylelint({ fix: true })
  ]))
  .pipe(dest('build/styles', { sourcemaps: '.' }));

export const testStyles = () => src('source/less/**/*.less')
  .pipe(checkLintspaces())
  .pipe(reportLintspaces())
  .pipe(postcss([
    stylelint(),
    postcssReporter({
      clearAllMessages: true,
      throwError: !IS_DEV
    })
  ], {
    syntax: lessSyntax
  }));

export const testScripts = () => src(jsSources)
  .pipe(checkLintspaces())
  .pipe(reportLintspaces())
  .pipe(eslint({
    fix: false
  }))
  .pipe(eslint.format())
  .pipe(gulpIf(!IS_DEV, eslint.failAfterError()));

export const optimizeImages = () => src('source/images/**/*.{svg,png,jpg}')
  .pipe(gulpIf(!IS_DEV, imagemin([
    svgo(svgoConfig),
    pngquant(),
    mozjpeg({ progressive: true, quality: 75 })
  ])))
  .pipe(dest('build/images'));

const server = (done) => {
  browser.init({
    server: {
      baseDir: 'build'
    },
    cors: true,
    notify: false,
    ui: false,
  });
  done();
};

export const copyStatic = () => src(staticSources)
  .pipe(dest('build'));

export const cleanDestination = () => del('build');
export const cleanDestinationAfter = () => del('build/pixelperfect');

const reload = (done) => {
  browser.reload();
  done();
};

const watcher = () => {
  watch(editorconfigSources, series(testEditorconfig, buildHTML, reload));
  watch('source/less/**/*.less', series(testStyles, buildStyles, reload));
  watch('source/images/**/*.{svg,png,jpg}', series(optimizeImages, reload));
  watch(staticSources, series(copyStatic, reload));
  watch(jsSources, series(testScripts, reload));
};

const compilationTasks = [
  cleanDestination,
  parallel(buildHTML, buildStyles, optimizeImages, copyStatic)
];
if (!IS_DEV) {
  compilationTasks.push(cleanDestinationAfter);
}

export const test = parallel(testHTML, testEditorconfig, testStyles, testScripts);
export const build = series(...compilationTasks);
export default series(test, build, server, watcher);
