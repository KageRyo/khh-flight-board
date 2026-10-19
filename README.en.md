# KHH Flight Board

[繁體中文](README.md) · English

[![Live demo](https://img.shields.io/badge/Live_demo-KHH-216b29)](https://kageryo.github.io/khh-flight-board/)
[![CI](https://github.com/KageRyo/khh-flight-board/actions/workflows/check.yml/badge.svg)](https://github.com/KageRyo/khh-flight-board/actions/workflows/check.yml)
[![Pages](https://github.com/KageRyo/khh-flight-board/actions/workflows/pages.yml/badge.svg)](https://github.com/KageRyo/khh-flight-board/actions/workflows/pages.yml)
[![Data check](https://github.com/KageRyo/khh-flight-board/actions/workflows/freshness.yml/badge.svg)](https://github.com/KageRyo/khh-flight-board/actions/workflows/freshness.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.19-417e38?logo=nodedotjs&logoColor=white)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A web flight board for Kaohsiung International Airport, based on the airport's display screens. Use it fullscreen, cycle through flights, or show a selected gate or check-in counter.

**[Open the board](https://kageryo.github.io/khh-flight-board/)**

[![Preview of the four boards](docs/board-preview.gif)](https://kageryo.github.io/khh-flight-board/)

## Choose a screen

[International departures](https://kageryo.github.io/khh-flight-board/#int) · [International arrivals](https://kageryo.github.io/khh-flight-board/#int-arr) · [Domestic departures](https://kageryo.github.io/khh-flight-board/#dom) · [Domestic arrivals](https://kageryo.github.io/khh-flight-board/#dom-arr)

Separate [gate](https://kageryo.github.io/khh-flight-board/gate.html) and [check-in counter](https://kageryo.github.io/khh-flight-board/counter.html) screens let you choose a location and flight, then share the URL. Gates support international and domestic departures; check-in counters support international departures only.

The overview turns pages every 18 seconds. Search, filter, pause, or cycle through all four boards; your settings are saved in the browser. Use `←` / `→` to turn pages, Space to pause or resume, and `1`–`4` to switch boards. Marquee animation can be turned off separately.

The interface uses Traditional Chinese, with English flight headings and passenger reminders. [Screen previews and controls (Chinese)](docs/screens.md)

## Data updates

This is an unofficial project using public data from Kaohsiung International Airport. Confirm travel information with the airport or your airline.

The hosted site uses GitHub Actions to fetch snapshots on a schedule. **Scheduled runs can be delayed:** check the retrieval time in the page footer. The page checks for snapshots every 60 seconds and warns when data is more than 15 minutes old. Retrieval time is not the airport's update time, and the source does not include flight dates.

The Data check badge shows the latest scheduled check result, not live data health. [Sources, caching, and deployment (Chinese)](docs/data.md)

## Run locally

Requires [Node.js 22.19+](https://nodejs.org/). No package installation or API key is needed.

```sh
git clone https://github.com/KageRyo/khh-flight-board.git
cd khh-flight-board
npm start
```

Open <http://127.0.0.1:3000>. On Windows, you can also double-click `start-board.cmd`. Press `Ctrl+C` to stop the server.

To change settings, copy `.env.example` to `.env` and restart. Defaults are `HOST=127.0.0.1`, `PORT=3000`, `POLL_SECONDS=60`, and `UPSTREAM_TIMEOUT_SECONDS=12`. The local server keeps the last successful data if an update fails. [Configuration details (Chinese)](docs/data.md)

## Development

```sh
npm run check
npm test
npm run build:pages
npm run check:freshness
```

`build:pages` fetches all four feeds and writes a static site to `dist/`. Set `PREVIOUS_SITE_URL` to allow fallback to previously published snapshots. `check:freshness` validates published snapshots; set `SITE_URL` to check another deployment.

Further documentation is in Chinese: [visual references](docs/appearance.md), [passenger reminder sources](docs/notices.md), and [verification notes](docs/verification.md).

Code is licensed under the [MIT License](LICENSE). Airport graphics and flight data belong to their respective rights holders.
