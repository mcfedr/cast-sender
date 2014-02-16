//process.env.FFMPEG_PATH = __dirname + '/../ffmpeg';
var express = require("express"),
    fs = require('fs'),
    path = require('path'),
    port = 5000,
    VIDEOS_PATH = '/Users/mcfedr/TV',

    app = express()
        .use(express.logger('dev'))
        .use('/videos', express.static(VIDEOS_PATH))
        .get('/api/videos', function(req, res) {
            fs.readdir('/Users/mcfedr/TV', function(err, files) {
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
        })
        .use(express.static(__dirname + '/src'))
//        .use(express.static(__dirname + '/build'))
        .listen(port, function() {
            console.log("Listening on " + port);
        });
