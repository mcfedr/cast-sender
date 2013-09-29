var async       = require('async'),
	cc          = require('cli-color'),
	connect     = require('connect'),
	fs          = require('fs'),
	fse         = require('fs-extra'),
	imagemagick = require('imagemagick'),
	less        = require('less'),
	path        = require('path'),
	project     = require('./build-settings'),
	requirejs   = require('requirejs'),
	S           = require('string'),
	spawn       = require('child_process').spawn,
	watchr      = require('watchr'),
	wrench      = require('wrench'),
	_           = require('underscore');

function start(cb) {
	if(process.argv.length > 2 && process.argv[2] == 'watch') {
		async.series([
			tasks.actions.build,
			tasks.actions.watch
		], cb);
	}
	else if(process.argv.length > 2 && process.argv[2] == 'serve') {
		async.auto({
			serve: function(cb) {
				tasks.actions.serve(cb, process.argv.length > 3 ? process.argv[3] : null);
			},
			build: tasks.actions.build,
			watch: ['build', tasks.actions.watch]
		}, cb);
	}
	else {
		tasks.actions.build(cb);
	}
}

var tasks = {
	actions: {
		build: function(cb) {
			importantMsg('Building app');
			var auto = {
				mkdirs: function(cb) {
					fse.mkdirs(build('webapp'), cb);
				},
				js: ['mkdirs', tasks.helpers.js],
				html: ['mkdirs', tasks.helpers.html],
				assets: ['mkdirs', 'css', tasks.helpers.assets]//so that generated files will be copied
			};
			if(project.helpers.less) {
				auto.css = ['mkdirs', tasks.helpers.less];
			}
			else {
				auto.css = ['mkdirs', tasks.helpers.css];
			}
			if(project.helpers.icons) {
				auto.icons = ['assets', tasks.helpers.icons];
			}
			if(project.helpers.manifest) {
				auto.manifest = ['mkdirs', 'js', 'html', 'css', 'assets'];
				if(project.helpers.icons) {
					auto.manifest.push('icons');
				}
				auto.manifest.push(tasks.helpers.manifest);
			}
			if(project.helpers.cordova) {
				auto.cordova = (project.helpers.manifest ? ['manifest'] : ['js', 'html', 'css', 'assets']);
				auto.cordova.push(tasks.helpers.cordova);
			}
			async.auto(auto, function(err) {
				if(err) {
					cb(err);
					return;
				}
				importantMsg('Finished building app');
				cb();
			});
		},
		serve: function(cb, port) {
			startMsg('serving');
			connect()
				.use(connect.logger('dev'))
				.use(connect.static(source()))
				.listen(port || project.port);
			importantMsg("Source server started at localhost:" + (port || project.port));
			var buildP = parseInt(port || project.port) + 1
			connect()
				.use(connect.logger('dev'))
				.use(connect.compress())
				.use(connect.static(build('webapp')))
				.listen(buildP);
			importantMsg("Build server started at localhost:" + buildP);
			doneMsg("serving");
			cb();
		},
		watch: function(cb) {
			startMsg('watching');
			var auto = {};
			if(project.helpers.manifest) {
				auto.manifest = ['task', tasks.helpers.manifest];
			}
			if(project.helpers.cordova) {
				auto.cordova = (project.helpers.manifest ? ['manifest'] : ['task']);
				auto.cordova.push(tasks.helpers.cordova);
			}
			
			var running = false;
			function listener(type) {
				return function() {
					if(running) return;
					running = true;
					triggerMsg(type);
					async.auto(_.extend({
						task: tasks.helpers[type]
					}, auto), function(err) {
						if(err) {
							errorMsg(err);
						}
						triggerDoneMsg(type);
						running = false;
					});
				}
			}
				
			watchr.watch({
				path: source('js'),
				listener: listener('js')
			});
			
			watchr.watch({
				path: path.join(source(), 'index.html'),
				listener: listener('html')
			});
			
			if(project.helpers.less) {
				watchr.watch({
					path: source('less'),
					listener: listener('less')
				});
			}
			else {
				watchr.watch({
					path: source('css'),
					listener: listener('css')
				});
			}
			
			watchr.watch({
				paths: [
	                source('images')
	            ],
				listener: listener('assets')
			});
			
			if(project.helpers.manifest) {
				watchr.watch({
					path: path.join(source(), 'cache.manifest'),
					listener: function() {
						if(running) return;
						running = true;
						triggerMsg('manifest');
						async.auto(auto, function(err) {
							if(err) {
								errorMsg(err);
							}
							triggerDoneMsg(type);
							running = false;
						});
					}
				});
			}
			
			doneMsg('watching ready');
			cb();
		}
	},
	helpers: {
		assets: function(cb) {
			startMsg('assets');
			function assetSeries(asset) {
				return function(cb) {
					var buildDir = build('webapp', asset);
					async.series([
						function(cb) {
							fse.remove(buildDir, cb);
						},
						function(cb) {
							fse.mkdirs(buildDir, cb);
						},
						function(cb) {
							fse.copy(source(asset), buildDir, cb);
						}
					], cb);
				};
			}
		
			async.parallel([
				assetSeries('images')
			], function(err) {
				if (err) {
					cb(err);
					return;
				}
				doneMsg('assets');
				cb();
			});
		},
		cordova: function(cb) {
			startMsg('cordova');
			async.each(project.platforms, function(platform, cb) {
				spawn('cordova', ['prepare', platform], {
					cwd: build()
				}).on('close', cb);
			}, function(err) {
				if (err) {
					cb(err);
					return;
				}
				doneMsg('cordova');
				cb();
			});
		},
		css: function(cb) {
			startMsg('css');
			async.series([
				function(cb) {
					fse.remove(build('webapp', 'css'), cb);
				},
				function(cb) {
					fse.mkdirs(build('webapp', 'css'), cb);
				},
				function(cb) {
					fse.copy(source('css'), build('webapp', 'css'), cb);
				}
			], function(err) {
				if (err) {
					cb(err);
					return;
				}
				doneMsg('css');
				cb();
			});
		},
		html: function(cb) {
	        startMsg('html');
			fs.readFile(path.join(source(), 'index.html'), 'utf8', function (err, data) {
				if (err) {
	                cb(err);
	                return;
	            }
				
				if(project.helpers.require) {
					data = data.replace('src="bower_components\/requirejs\/require.js"', 'src="js/main.js"');
				}
				if(project.helpers.manifest) {
					data = data.replace('<html>', '<html manifest="cache.manifest">');
				}
				if(project.helpers.icons) {
					data = data.replace('<link href="'+project.folders.sources.images+'/icon.png" rel="apple-touch-icon">',
						  "<link href=\"favicon.ico\" rel=\"icon\">\n"
						+ "<link href=\"favicon.ico\" rel=\"shortcut icon\">\n"
						+ "<link href=\"" + project.folders.sources.images + "/apple-touch-icon.png\" sizes=\"57x57\" rel=\"apple-touch-icon\">\n"
						+ "<link href=\"" + project.folders.sources.images + "/apple-touch-icon-icon-2x.png\" sizes=\"114x114\" rel=\"apple-touch-icon\">\n"
						+ "<link href=\"" + project.folders.sources.images + "/apple-touch-icon-ipad.png\" sizes=\"72x72\" rel=\"apple-touch-icon\">\n"
				        + "<link href=\"" + project.folders.sources.images + "/apple-touch-icon-ipad-2x.png\" sizes=\"144x144\" rel=\"apple-touch-icon\">"
						+ "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image.png\" media=\"(device-width: 320px)\" rel=\"apple-touch-startup-image\">\n"
				        + "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image-2x.png\" media=\"(device-width: 320px) and (-webkit-device-pixel-ratio: 2)\" rel=\"apple-touch-startup-image\">\n"
					    + "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image-iphone5-2x.png\" media=\"(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)\" rel=\"apple-touch-startup-image\">\n"
					    + "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image-ipad.png\" media=\"(device-width: 768px) and (orientation: portrait)\" rel=\"apple-touch-startup-image\">\n"
				        + "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image-ipad-2x.png\" media=\"(device-width: 768px) and (orientation: portrait) and (-webkit-device-pixel-ratio: 2)\" rel=\"apple-touch-startup-image\">\n"
						+ "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image-ipad-landscape.png\" media=\"(device-width: 768px) and (orientation: landscape)\" rel=\"apple-touch-startup-image\">\n"
				        + "<link href=\"" + project.folders.sources.images + "/apple-touch-startup-image-ipad-landscape-2x.png\" media=\"(device-width: 768px)  and (orientation: landscape) and (-webkit-device-pixel-ratio: 2)\" rel=\"apple-touch-startup-image\">\n"
					);
				}
				
				fs.writeFile(path.join(build('webapp'), 'index.html'), data, 'utf8', function(err) {
					if (err) {
						cb(err);
						return;
					}
					doneMsg('html');
					cb();
				});
			});
		},
		icons: function(cb) {
			startMsg('icons');
			var images = build('webapp', 'images'),
				web = build('webapp'),
				fav16 = path.join(web, 'favicon16.png'),
				fav32 = path.join(web, 'favicon32.png'),
				fav64 = path.join(web, 'favicon64.png');
			async.auto({
				appleTouch                       : image('icon',   path.join(images, 'apple-touch-icon.png'), 57),
				appleTouch2x                     : image('icon',   path.join(images, 'apple-touch-icon-2x.png'), 57, true),
				appleTouchIPad                   : image('icon',   path.join(images, 'apple-touch-icon-ipad.png'), 72),
				appleTouchIPad2x                 : image('icon',   path.join(images, 'apple-touch-icon-ipad-2x.png'), 72, true),
				appleTouchStartup                : image('splash', path.join(images, 'apple-touch-startup-image.png'), 320, 460),
				appleTouchStartup2x              : image('splash', path.join(images, 'apple-touch-startup-image-2x.png'), 320, 460, true),
				appleTouchStartupIPhone52x       : image('splash', path.join(images, 'apple-touch-startup-image-iphone5-2x.png'), 320, 548, true),
				appleTouchStartupIPad            : image('splash', path.join(images, 'apple-touch-startup-image-ipad.png'), 768, 1004),
				appleTouchStartupIPad2x          : image('splash', path.join(images, 'apple-touch-startup-image-ipad-2x.png'), 768, 1004, true),
				appleTouchStartupIPadLandscape   : image('splash', path.join(images, 'apple-touch-startup-image-ipad-landscape.png'), 1024, 748, ['-rotate', '90']),
				appleTouchStartupIPadLandscape2x : image('splash', path.join(images, 'apple-touch-startup-image-ipad-landscape-2x.png'), 1024, 748, true, ['-rotate', '90']),
				favicon16: image('icon', fav16, 16, ['-alpha', 'background']),
				favicon16Tidy: ['favicon', function(cb) {
					fse.remove(fav16, cb);
				}],
				favicon32: image('icon', fav32, 32, ['-alpha', 'background']),
				favicon32Tidy: ['favicon', function(cb) {
					fse.remove(fav32, cb);
				}],
				favicon64: image('icon', fav64, 64, ['-alpha', 'background']),
				favicon64Tidy: ['favicon', function(cb) {
					fse.remove(fav64, cb);
				}],
				favicon: ['favicon16', 'favicon32', 'favicon64', function(cb) {
					imagemagick.convert([
						fav16,
						fav32,
						fav64,
						'-colors', '128',
						'-alpha', 'background',
						path.join(web, 'favicon.ico')
					], cb);
				}]
			}, function(err) {
				if (err) {
					cb(err);
					return;
				}
				doneMsg('icons');
				cb();
			});
		},
		js: function(cb, results, from, to) {
	        startMsg('js' + (from ? ' ' + from : ''));
			if(project.helpers.require) {
				var require = {
					baseUrl: from || source('js'),
					mainConfigFile: path.join(from || source('js'), 'main.js'),
					include: ['main'],
					insertRequire: ['main'],
					wrap: true,
					findNestedDependencies: false,
					cjsTranslate: false,
					out: path.join(to || build('webapp', 'js'), 'main.js')
				};
                
                if(project.debug) {
					require.optimize = 'none';
				}
                else {
                    require.optimize = 'uglify2';
                    require.generateSourceMaps = true;
                    require.preserveLicenseComments = false;
                }
				
				if(project.helpers.almond && !project.empty) {
					require.name = '../bower_components/almond/almond';
				}
                else {
                    require.name = '../bower_components/requirejs/require';
                    if(project.empty) {
                        require.paths = project.empty.reduce(function(memo, val) {
                            memo[val] = 'empty:';
                            return memo;
                        }, {});
                    }
                }
				
                if(project.helpers.hogan) {
					require.pragmasOnSave = require.pragmasOnSave || {};
					require.pragmasOnSave.excludeHogan = true;
					require.stubModules = require.stubModules || [];
					require.stubModules.push('hgn');
				}
				
                if(project.helpers.text) {
					require.inlineText =  true;
					require.stubModules = require.stubModules || [];
					require.stubModules.push('text');
				}
				
				requirejs.optimize(require, function() {
					doneMsg('js' + (from ? ' ' + from : ''));
					cb();
				}, cb);
			}
			else {
				fse.copy(from || source('js'), to || build('webapp', 'js'), function(err) {
					if(err) {
						cb(err);
						return;
					}
					doneMsg('js' + (from ? ' ' + from : ''));
					cb();
				});
			}
		},
        less: function(cb) {
			startMsg('less');
            async.auto({
                mkdirs: function(cb) {
                    fse.mkdirs(source('css'), cb);
                },
                read: function(cb) {
                    fs.readFile(path.join(source('less'), 'main.less'), 'utf8', cb);
                },
                parse: ['read', function(cb, results) {
                    var parser = new(less.Parser)({
                        paths: [source('less')],
                        filename: 'main.less'
                    });
                    parser.parse(results.read, cb);
                }],
                compress: ['parse', function(cb, results) {
                    cb(null, results.parse.toCSS({compress: !project.debug}));
                }],
                write: ['mkdirs', 'compress', function(cb, results) {
                    fs.writeFile(path.join(source('css'), 'main.css'), results.compress, 'utf8', cb);
                }]
            }, function(err) {
                if(err) {
                    cb(err);
                    return;
                }
                doneMsg('less');
                tasks.helpers.css(cb);
            });
		},
		manifest: function(cb) {
			startMsg('manifest');
			var manifestPath = path.join(build('webapp'), 'cache.manifest');
			async.auto({
				list: function(cb) {
					var strStart = (build('webapp') + path.sep).length,
						manifestFiles = [];
					async.forEach([
							build('webapp', 'images'),
							build('webapp', 'css'),
							build('webapp', 'js')
						],
						function(folder, cb) {
							var c = 0,
								finish = function(err) {
									if(err) {
										c = -1;
										cb(err);
									}
									c--;
									if(c == 0) {
										cb();
									}
								};
							wrench.readdirRecursive(folder, function(err, files) {
								if(!files) {
									finish();//folders for each cb
									return;
								}
								c++;
								async.forEach(files, function(file, cb) {
									var n = path.join(folder, file);
									if(!/^\.|apple-touch|\-nc/.test(file)) {
										fs.stat(n, function(err, stats) {
											if(err) {
												cb(err);
												return;
											}
											if(stats.isFile()) {
												manifestFiles.push(n.substr(strStart));
											}
											cb();//files for each cb
										});
									}
								}, finish);
							});
					}, function(err) {
						cb(err, manifestFiles);//auto list cb
					});
				},
				rev: function(cb) {
					fs.readFile(manifestPath, "utf8", function(err, data) {
						var rev;
						if (err) {
							rev = 0;
						}
						else {
							rev = parseInt((data.match(/# rev (\d+)/) || ["0", "0"])[1]) + 1;
						}
						cb(null, rev);
					});
				},
				tmpl: function(cb) {
					fs.readFile(path.join(source(), 'cache.manifest'), "utf8", cb);
				},
				write: ['list', 'rev', 'tmpl', function(cb, results) {
					fs.writeFile(manifestPath,
						results.tmpl.replace(/^#--files--$/m, results.list.join("\n"))
							.replace("# rev 0", "# rev " + results.rev),
						"utf8", cb);//write cb
				}]
			}, function(err) {
				if (err) {
					cb(err);
					return;
				}
				doneMsg('manifest');
				cb();
			});
		}
	}
}

start(function(err) {
	if(err) errorMsg(err);
});

function source(source) {
	var r = path.join(__dirname, project.folders.source);
	if(source == 'jslib') {
		r = path.join(r, project.folders.sources.js, 'libs');
	}
	else if(source) {
		r = path.join(r, project.folders.sources[source]);
	}
    return r;
}

function build(module, source) {
	var r = path.join(__dirname, project.folders.build);
	if(module) {
		r = path.join(r, project.folders.modules[module]);
		if(source) {
			r = path.join(r, project.folders.sources[source]);
		}
	}
    return r;
}

//from, to, [width], [height], [double], [custom]
function image(from, to, width, height, x2, custom) {
	if(from == 'icon') {
		from = path.join(source('images'), 'icon.png');
	}
	else if(from == 'splash') {
		from = path.join(source('images'), 'splashscreen.png');
	}
	if(_.isBoolean(height)) {
		custom = x2;
		x2 = height;
		height = width;
	}
	else if(_.isArray(x2)) {
		custom = x2;
		x2 = false;
	}
	else if(_.isArray(height)) {
		custom = height;
		x2 = false;
		height = width;
	}
	if(!height) {
		height = width;
	}
	if(x2 && width) {
		width *= 2;
		height *= 2;
	}
	var crop = {
		srcPath: from,
		dstPath: to,
		format: 'png'
	};
	if(width || height) {
		crop.width = width;
		crop.height = height;
	}
	if(custom) {
		crop.customArgs = custom;
	}
	return function(cb) {
		fse.mkdirs(path.dirname(to), function(err) {
			if(err) {
				cb(err);
				return;
			}
			imagemagick.crop(crop, cb);
		});
	};
}

function startMsg(messg) {
	console.log(cc.magenta('start: '), messg);
}

function doneMsg(messg) {
	console.log(cc.green('done: '), messg);
}

function importantMsg(messg) {
	console.log(cc.yellowBright(messg));
}

function triggerMsg(messg) {
	console.log(cc.magentaBright('trigger: '), messg);
}

function triggerDoneMsg(messg) {
	console.log(cc.greenBright('trigger done: '), messg);
	if(project.notify) {
		spawn('terminal-notifier', ['-title', 'Trigger done', '-message', messg, '-activate', 'com.apple.dt.Xcode', '-group', 'trigger']);
	}
}

function errorMsg(messg) {
	console.log(cc.redBright('error: '), messg);
}
