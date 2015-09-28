# Cast Sender

This is the sender side

## Running using launchd on OSX

Copy `co.fedr.castsender.plist` to `~/Library/LaunchAgents`

1. `launchctl load ~/Library/LaunchAgents/co.fedr.castsender.plist`

1. `launchctl unload ~/Library/LaunchAgents/co.fedr.castsender.plist`

## Running using supervisor on Linux

Copy `cast-sender.conf` to `/etc/supervisor/conf.d/cast-sender.conf` (or similar)

1. `supervisorctl start cast-sender`

1. `supervisorctl stop cast-sender`

## Config

Create a config as `~/.sender.json`.

Sample config file:

    {
        "videosDir": "/Users/mcfedr/TV",
        "port": 5000
    }
