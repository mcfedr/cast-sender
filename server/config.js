var config;

try {
    config = require(process.env['HOME'] + '/.sender.json');
} catch(e) {
    console.log('No config file found');
    config = {
        "videosDir": "/Users/mcfedr/TV",
        "port": 5000
    };
}

module.exports = config;
