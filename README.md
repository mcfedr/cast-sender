# Cast Sender

This is the sender side

## Running using launchd

1. `launchctl load ~/Library/LaunchAgents/co.fedr.castsender.plist`

1. `launchctl unload ~/Library/LaunchAgents/co.fedr.castsender.plist`


## Config

Create a config as `~/.sender.json`.

Sample config file:

    {
        "videosDir": "/Users/mcfedr/TV",
        "port": 5000
    }
