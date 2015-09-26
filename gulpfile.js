'use strict';

var gulp = require('gulp'),
    livereload = require('gulp-livereload'),
    http = require('http'),
    connect = require('connect'),
    connectLivereload = require('connect-livereload'),
    less = require('gulp-less'),
    size = require('gulp-size'),
    jshint = require('gulp-jshint'),
    jshintStylish = require('jshint-stylish'),
    minifyHtml = require('gulp-minify-html'),
    ngHtml2js = require('gulp-ng-html2js'),
    filter = require('gulp-filter'),
    inject = require('gulp-inject'),
    uglify = require('gulp-uglify'),
    imagemin = require('gulp-imagemin'),
    useref = require('gulp-useref'),
    ngAnnotate = require('gulp-ng-annotate'),
    csso = require('gulp-csso'),
    mainBowerFiles = require('main-bower-files'),
    flatten = require('gulp-flatten'),
    del = require('del');

gulp.task('default', ['build']);

gulp.task('styles', function () {
    return gulp.src('app/styles/main.less')
        .pipe(less())
        .pipe(gulp.dest('.tmp/styles'))
        .pipe(size());
});

gulp.task('scripts', function () {
    return gulp.src('app/scripts/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter(jshintStylish))
        .pipe(size());
});

gulp.task('partials', function () {
    return gulp.src('app/partials/**/*.html')
        .pipe(minifyHtml({
            empty: true,
            spare: true,
            quotes: true
        }))
        .pipe(ngHtml2js({
            moduleName: "cast",
            prefix: "partials/"
        }))
        .pipe(gulp.dest(".tmp/partials"))
        .pipe(size());
});

gulp.task('html', ['styles', 'scripts', 'partials'], function () {
    var jsFilter = filter('**/*.js');
    var cssFilter = filter('**/*.css');

    return gulp.src('app/*.html')
        .pipe(inject(gulp.src('.tmp/partials/**/*.js'), {
            read: false,
            starttag: '<!-- inject:partials -->',
            addRootSlash: false,
            ignorePath: '.tmp'
        }))
        .pipe(useref.assets())
        .pipe(jsFilter)
        .pipe(ngAnnotate())
        .pipe(uglify({
            outSourceMap: true
        }))
        .pipe(jsFilter.restore())
        .pipe(cssFilter)
        .pipe(csso())
        .pipe(cssFilter.restore())
        .pipe(useref.restore())
        .pipe(useref())
        .pipe(gulp.dest('dist'))
        .pipe(size());
});

gulp.task('images', ['favicon'], function () {
    return gulp.src('app/images/**')
        .pipe(imagemin({
            optimizationLevel: 3,
            progressive: true,
            interlaced: true
        }))
        .pipe(gulp.dest('dist/images'))
        .pipe(size());
});

gulp.task('favicon', function () {
    return gulp.src('app/favicon.ico')
        .pipe(gulp.dest('dist'))
        .pipe(size());
});

gulp.task('fonts', function () {
    return gulp.src(mainBowerFiles())
        .pipe(filter('**/*.{eot,svg,ttf,woff}'))
        .pipe(flatten())
        .pipe(gulp.dest('dist/fonts'))
        .pipe(gulp.dest('.tmp/fonts'))
        .pipe(size());
});

gulp.task('clean', function (cb) {
    del(['.tmp', 'dist'], cb);
});

gulp.task('build', ['html', 'partials', 'images', 'fonts']);

gulp.task('connect:src', function () {
    var app = connect()
        .use(connectLivereload({port: 35729}))
        .use(require('./server/sender'))
        .use(connect.static('app'))
        .use(connect.static('.tmp'))
        .use(connect.directory('app'));

    gulp.server = http.createServer(app)
        .listen(9000)
        .on('listening', function () {
            console.log('Started connect web server on http://localhost:9000');
        });
});

gulp.task('connect:dist', function () {
    var app = connect()
        .use(connect.static('dist'));

    gulp.server = http.createServer(app)
        .listen(9000)
        .on('listening', function () {
            console.log('Started connect web server for dist files on http://localhost:9000');
        });
});

gulp.task('serve', ['connect:src', 'styles']);

gulp.task('serve:dist', ['connect:dist']);

gulp.task('watch', ['serve', 'fonts'], function () {
    var server = livereload();

    gulp.watch([
        'app/*.html',
        '.tmp/styles/**/*.css',
        'app/scripts/**/*.js',
        'app/images/**/*'
    ]).on('change', function (file) {
        server.changed(file.path);
    });

    gulp.watch('app/styles/**/*.less', ['styles']);
    gulp.watch('app/scripts/**/*.js', ['scripts']);
    gulp.watch('app/images/**/*', ['images']);
    gulp.watch('bower.json', ['wiredep']);
});
