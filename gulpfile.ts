/**
 * Gulp tasks
 */

import * as gulp from 'gulp';
import * as ts from 'gulp-typescript';
import * as sourcemaps from 'gulp-sourcemaps';
import tslint from 'gulp-tslint';
const postcss = require('gulp-postcss'); // import * as postcss from 'gulp-postcss';
import * as uglifyComposer from 'gulp-uglify/composer';
import * as cssnano from 'cssnano';
import * as rimraf from 'rimraf';
import chalk from 'chalk';
import * as imagemin from 'gulp-imagemin';
import * as rename from 'gulp-rename';
import * as mocha from 'gulp-mocha';
import * as replace from 'gulp-replace';
import * as uglifyes from 'uglify-es';

import locales from './locales';

const uglify = uglifyComposer(uglifyes, console);

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const isDebug = !isProduction;
const productionOnly = (src: NodeJS.ReadableStream, dst: NodeJS.ReadWriteStream) => isProduction ? src.pipe(dst) : src;

if (isDebug) {
	console.warn(chalk.yellow.bold('WARNING! NODE_ENV is not "production".'));
	console.warn(chalk.yellow.bold('         built script will not be compressed.'));
}

gulp.task('build:ts', () => {
	const tsProject = ts.createProject('./tsconfig.json');

	return tsProject
		.src()
		.pipe(sourcemaps.init())
		.pipe(tsProject())
		.on('error', () => {})
		.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../built' }))
		.pipe(gulp.dest('./built/'));
});

gulp.task('build:copy:views', () =>
	gulp.src('./src/server/web/views/**/*').pipe(gulp.dest('./built/server/web/views'))
);

gulp.task('build:copy', gulp.parallel('build:copy:views', () =>
	gulp.src([
		'./build/Release/crypto_key.node',
		'./src/const.json',
		'./src/server/web/views/**/*',
		'./src/**/assets/**/*',
		'!./src/client/app/**/assets/**/*'
	]).pipe(gulp.dest('./built/'))
));

gulp.task('lint', () =>
	gulp.src('./src/**/*.ts')
		.pipe(tslint({
			formatter: 'verbose'
		}))
		.pipe(tslint.report())
);

gulp.task('format', () =>
	gulp.src('./src/**/*.ts')
		.pipe(tslint({
			formatter: 'verbose',
			fix: true
		}))
		.pipe(tslint.report())
);

gulp.task('mocha', () =>
	gulp.src('./test/**/*.ts')
		.pipe(mocha({
			exit: true,
			require: 'ts-node/register'
		} as any))
);

gulp.task('test', gulp.task('mocha'));

gulp.task('clean', cb =>
	rimraf('./built', cb)
);

gulp.task('cleanall', gulp.parallel('clean', cb =>
	rimraf('./node_modules', cb)
));

gulp.task('build:client:script', () => {
	const client = require('./built/client/meta.json');
	return productionOnly(gulp.src(['./src/client/app/boot.js', './src/client/app/safe.js'])
			.pipe(replace('VERSION', JSON.stringify(client.version)))
			.pipe(replace('ENV', JSON.stringify(env)))
			.pipe(replace('LANGS', JSON.stringify(Object.keys(locales)))),
		uglify({
			toplevel: true
		} as any))
		.pipe(gulp.dest('./built/client/assets/'));
});

gulp.task('build:client:styles', () =>
	productionOnly(gulp.src('./src/client/app/init.css'),
		postcss([
			cssnano()
		]))
		.pipe(gulp.dest('./built/client/assets/'))
);

gulp.task('copy:client', () =>
	productionOnly(gulp.src([
			'./assets/**/*',
			'./src/client/assets/**/*',
			'./src/client/app/*/assets/**/*'
		]),
		(imagemin as any)())
		.pipe(rename(path => {
			path.dirname = path.dirname.replace('assets', '.');
		}))
		.pipe(gulp.dest('./built/client/assets/'))
);

gulp.task('build:client', gulp.parallel(
	'build:client:script',
	'build:client:styles',
	'copy:client'
));

gulp.task('build', gulp.parallel(
	'build:ts',
	'build:copy',
	'build:client'
));

gulp.task('default', gulp.task('build'));
