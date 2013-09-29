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
                    return file[0] != '.';
                }).map(function(file) {
                    return {
                        name: path.basename(file),
                        src: 'http://' + req.headers.host + '/videos/' + file
                    }
                }));
            });
        })
        .use(express.static(__dirname + '/src'))
        .use('/bower_components', express.static(__dirname + '/bower_components'))

        .listen(port, function() {
            console.log("Listening on " + port);
        });
