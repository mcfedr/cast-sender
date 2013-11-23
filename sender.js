//process.env.FFMPEG_PATH = __dirname + '/../ffmpeg';
var express = require("express"),
    fs = require('fs'),
    path = require('path'),
//    ffmpeg = require('fluent-ffmpeg'),
    port = 5000,
    VIDEOS_PATH = '/Users/mcfedr/TV',

    app = express()
        .use(express.logger('dev'))
        .use('/videos', express.static(VIDEOS_PATH))
//        .get('/videos/:filename', function(req, res) {
//            res.contentType('webm');
//            new ffmpeg({
//                source: VIDEOS_PATH + '/' + req.params.filename,
//                nolog: true
//            })
//            .addOptions(['-map 0:0', '-map 0:1'])
//            .withVideoBitrate('1024k')
//            .withVideoCodec('libvpx')
//            .withAudioBitrate('128k')
//            .withAudioCodec('libvorbis')
//            .withAudioChannels(2)
//            .toFormat('webm')
//            .writeToStream(res, function(retcode, error){
//                console.log(error, 'file has been converted succesfully');
//            });
//        })
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
