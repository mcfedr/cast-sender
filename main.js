#!/usr/local/bin/node
var express = require("express"),
    morgan  = require('morgan'),
    sender = require('./server/sender'),
    config = require('./server/config'),
    commander = require('commander');

var options = commander
    .description('Send local videos to your chromecast')
    .option('-t, --tv <path>', 'Folder with videos')
    .option('-p, --port <port>', 'Server port')
    .parse(process.argv)
    .opts();

config.port = options.port || config.port;
config.videosDir = options.tv || config.videosDir;

    app = express()
        .use(morgan('dev'))
        .use(sender)
        .use(express.static(__dirname + '/dist'))
        .listen(config.port, function() {
            console.log("Listening on " + config.port);
        });
