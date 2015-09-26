#!/usr/local/bin/node
var express = require("express"),
    morgan  = require('morgan'),
    sender = require('./server/sender'),
    config = require('./server/config');

    app = express()
        .use(morgan('dev'))
        .use(sender)
        .use(express.static(__dirname + '/dist'))
        .listen(config.port, function() {
            console.log("Listening on " + config.port);
        });
