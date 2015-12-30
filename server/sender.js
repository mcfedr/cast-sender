'use strict';

const express = require('express'),
    fswalk = require('fswalk'),
    path = require('path'),
    cors = require('cors'),
    mime = require('mime'),
    config = require('./config');

function listFile(host) {
    return new Promise(function(resolve) {
        let files = [];
        fswalk(config.videosDir, function(file) {
            let fileMime = mime.lookup(file);
            if (['video/mp4', 'video/webm', 'text/vtt'].indexOf(fileMime) === -1) {
                return;
            }
            files.push({
                name: path.basename(file, path.extname(file)).replace(/\./g, ' '),
                path: path.dirname(path.relative(config.videosDir, file)),
                mime: fileMime,
                src: 'http://' + host + '/videos/' + path.relative(config.videosDir, file)
            });
        }, function() {
            resolve(files.sort((a, b) => a.path.localeCompare(b.path)));
        });
    });
}

let app = express()
        .use(cors())
        .options('*', cors())
        .use('/videos', express.static(config.videosDir))
        .get('/api/files', function(req, res) {
            listFile(req.headers.host).then(function(obj) {
                res.json({files: obj});
            }).catch(function(err) {
                console.error(err);
                res.status(500).end();
            });
        })
        .delete(/api\/files(\/.+)?/, function(req, res) {
            let file = path.join(config.videosDir, req.params[0]);
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
