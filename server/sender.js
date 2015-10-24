var bluebird = require('bluebird'),
    express = require("express"),
    fs = bluebird.promisifyAll(require('fs')),
    path = require('path'),
    cors = require('cors'),
    mime = require('mime'),
    config = require('./config');

function listFile(host, subPath) {
    var listDir = path.join(config.videosDir, subPath || '.');

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
                        stat = fileAndStat[1],
                        mime = mime.lookup(file);
                    return stat.isDirectory() || ['video/mp4', 'video/webm', 'text/vtt'].indexOf(mime) != -1;
                })
                .map(function (fileAndStat) {
                    var file = fileAndStat[0],
                        stat = fileAndStat[1],
                        obj = {
                            name: path.basename(file, fileExt).replace(/\./g, ' '),
                            path: path.dirname(path.relative(config.videosDir, file))
                        };
                    if (stat.isDirectory()) {
                        obj.mime = 'dir';
                    }
                    else {
                        obj.mime = mime.lookup(file);
                        obj.src = 'http://' + host + '/videos/' + path.relative(config.videosDir, file);
                    }
                    return obj;
                })
        });
}

var app = express()
        .use(cors())
        .options('*', cors())
        .use('/videos', express.static(config.videosDir))
        .get(/api\/files(\/.+)?/, function(req, res) {
            console.log(req.path, req.params[0]);
            listFile(req.headers.host, req.params[0]).then(function(obj) {
                res.json({videos: obj});
            }).catch(function(err) {
                console.error(err);
                res.status(500).end();
            });
        })
        .delete(/api\/files(\/.+)?/, function(req, res) {
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
