var express = require("express"),
    fs = require('fs'),
    path = require('path'),
    config = require('../sender-config.json'),

    app = express()
        .use('/videos', express.static(config.videosDir))
        .get('/api/videos', function(req, res) {
            fs.readdir(config.videosDir, function(err, files) {
                res.json(files.filter(function(file) {
                    var ext = path.extname(file);
                    return file[0] != '.' && (ext == '.mp4' || ext == '.webm');
                }).map(function(file) {
                    return {
                        name: path.basename(file),
                        src: 'http://' + req.headers.host + '/videos/' + file,
                        mime: path.extname(file) == '.mp4' ? 'video/mp4' : 'video/webm'
                    }
                }));
            });
        });
module.exports = app;
