var express = require("express"),
    morgan  = require('morgan')
    sender = require('./server/sender.js'),
    config = require('./sender-config.json'),

    app = express()
        .use(morgan('dev'))
        .use(sender)
        .use(express.static(__dirname + '/dist'))
        .listen(config.port, function() {
            console.log("Listening on " + config.port);
        });
