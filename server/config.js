var config,
    path = require('path'),
    os = require('os');

try {
    config = require(path.join(os.homedir(), '.sender.json'));
} catch(e) {
    console.log('No config file found');
    config = {
        videosDir: path.join(os.homedir(), 'TV'),
        port: 5000
    };
}

module.exports = config;
