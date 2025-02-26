# TalkOps Extension: Home Assistant

A TalkOps Extension made to work with [TalkOps](https://link.talkops.app/talkops).

This Extension based on [Home Assistant](https://www.home-assistant.io/) allows you to control connected devices by voice in **realtime**.

## Installation Guide

_[TalkOps](https://link.talkops.app/install-talkops) must be installed beforehand._

* Open Home Assitant from a web browser with admin permissions.
* Open the `Profile` page by clicking on your username at the bottom left.
* Navigate to `Security` tab and scroll down to `Long-lived access tokens` card.
* Click on the button `Create Token`, called the token `TalkOps` and validate.
* Use the generated token to setup the environment variable `ACCESS_TOKEN`.

## Integration Guide

Add the service and setup the environment variables if needed:

_compose.yml_
``` yml
name: talkops

services:
...
  talkops-extension-home-assistant:
    image: ghcr.io/bierdok/talkops-extension-home-assistant
    environment:
      ACCESS_TOKEN: [your-value]
    restart: unless-stopped
```

## Environment Variables

#### WS_BASE_URL

The Web Socket base URL.
* Default value: `ws://home-assistant:8123`

#### ACCESS_TOKEN

The generated long-lived access token.

#### AGENT_URLS

A comma-separated list of WebSocket server URLs for real-time communication with specified agents.
* Default value: `ws://talkops`
