var express = require("express"),
    fs = require('fs'),
    path = require('path'),
    cors = require('cors'),
    config = require('./config');

var listFile = function(exts, host, cb) {
        fs.readdir(config.videosDir, function(err, files) {
            cb(files.filter(function (file) {
                var fileExt = path.extname(file);
                return file[0] != '.' && Object.keys(exts).some(function(ext) {
                    return fileExt == ext;
                });
            }).map(function (file) {
                return {
                    name: path.basename(file, path.extname(file)).replace(/\./g, ' '),
                    src: 'http://' + host + '/videos/' + file,
                    mime: exts[path.extname(file)]
                }
            }));
        });
    },
    app = express()
        .use(cors())
        .options('*', cors())
        .use('/videos', express.static(config.videosDir))
        .get('/api/videos', function(req, res) {
            listFile({'.mp4': 'video/mp4', '.webm': 'video/webm'}, req.headers.host, function(obj) {
                res.json(obj);
            });
        })
        .get('/api/subtitles', function(req, res) {
            listFile({'.vtt': 'text/vtt'}, req.headers.host, function(obj) {
                res.json(obj);
            });
        })
        .delete('/videos/:fileName', function(req, res) {
            var file = path.join(config.videosDir, req.params.fileName);
            fs.exists(file, function(exists) {
                if (exists) {
                    fs.unlink(file, function(err) {
                        if (err) {
                            res.status(500).json(err);
                        } else {
                            res.send('removed');
                        }
                    })
                } else {
                    res.status(404).send('not found');
                }
            });
        })
    ;
module.exports = app;
