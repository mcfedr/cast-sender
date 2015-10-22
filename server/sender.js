var bluebird = require('bluebird'),
    express = require("express"),
    fs = bluebird.promisifyAll(require('fs')),
    path = require('path'),
    cors = require('cors'),
    config = require('./config');

function filterExts(exts) {
    return function (file) {
        var fileExt = path.extname(file);
        return file[0] != '.' && Object.keys(exts).some(function(ext) {
            return fileExt == ext;
        });
    };
}

function listFile(exts, host, subPath) {
    var filter = filterExts(exts),
        listDir = path.join(config.videosDir, subPath || '.');

    return fs.readdirAsync(listDir)
        .then(function(files) {
            return Promise.all(files.map(function (file) {
                var full = path.join(listDir, file);
                return Promise.all([full, fs.statAsync(full)])
            }));
        })
        .then(function(fileAndStats) {
            return fileAndStats
                .filter(function(fileAndStat) {
                    var file = fileAndStat[0],
                        stat = fileAndStat[1];
                    return stat.isDirectory() || filter(file);
                })
                .map(function (fileAndStat) {
                    var file = fileAndStat[0],
                        stat = fileAndStat[1],
                        fileExt = path.extname(file);
                    if (stat.isDirectory()) {
                        return {
                            name: path.basename(file, fileExt).replace(/\./g, ' '),
                            path: path.dirname(path.relative(config.videosDir, file)),
                            type: 'dir'
                        }
                    }
                    return {
                        name: path.basename(file, fileExt).replace(/\./g, ' '),
                        path: path.dirname(path.relative(config.videosDir, file)),
                        src: 'http://' + host + '/videos/' + path.relative(config.videosDir, file),
                        mime: exts[fileExt],
                        type: 'file'
                    };
                })
        });
}

var app = express()
        .use(cors())
        .options('*', cors())
        .use('/videos', express.static(config.videosDir))
        .get(/api\/videos(\/.+)?/, function(req, res) {
            console.log(req.path, req.params[0]);
            listFile({'.mp4': 'video/mp4', '.webm': 'video/webm'}, req.headers.host, req.params[0]).then(function(obj) {
                res.json({videos: obj});
            }).catch(function(err) {
                console.error(err);
                res.status(500).end();
            });
        })
        .get(/api\/subtitles(\/.+)?/, function(req, res) {
            console.log(req.path, req.params[0]);
            listFile({'.vtt': 'text/vtt'}, req.headers.host, req.params[0]).then(function(obj) {
                res.json({subtitles: obj});
            }).catch(function(err) {
                console.error(err);
                res.status(500).end();
            });
        })
        .delete(/api\/videos(\/.+)?/, function(req, res) {
            console.log(req.path, req.params[0]);
            var file = path.join(config.videosDir, req.params[0]);
            fs.exists(file, function(exists) {
                if (exists) {
                    fs.unlink(file, function(err) {
                        if (err) {
                            console.error(err);
                            res.status(500).end();
                            return;
                        }
                        res.send('removed');
                    });
                } else {
                    res.status(404).send('not found');
                }
            });
        })
    ;
module.exports = app;
