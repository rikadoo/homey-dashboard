<div align="center">

# Homey tablet dashboard

**A self-hosted wall dashboard for Homey Pro that you lay out on the screen itself.**

**English** · [Nederlands](README.nl.md)

![Homey Pro](https://img.shields.io/badge/Homey-Pro-1fb6ff?logo=homey&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ed?logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-5fa04e?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

<img src="docs/screenshots/home.jpg" alt="The dashboard on a landscape tablet" width="100%">

</div>

Add, drag, resize and configure tiles right on the tablet, without touching code. The layout adapts to any screen, from phone to portrait or landscape tablet. Values arrive live through the Homey's local Web API, no cloud involved.

> [!NOTE]
> The interface is available in **English and Dutch**. On first start it follows the language of the browser; switch any time under **Settings → Language**. The screenshots show the Dutch interface.

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Settings in .env](#settings-in-env)
- [Integrations](#integrations)
- [Setting up the tablet](#setting-up-the-tablet)
- [Try it without a Homey](#try-it-without-a-homey)
- [How it is built](#how-it-is-built)

## Features

| | |
|---|---|
| 🎛️ **Edit on screen** | Add tiles from your Homey devices, flows and moods, drag them, resize them and configure each one. With undo, PIN protection and export/import. |
| 💡 **Lights that glow** | A light that is on colours its tile in its actual light colour. Long-press for brightness, colour temperature and colour. |
| ⚡ **Energy** | An animated energy flow with solar, grid, home battery and house, charts up to 30 days, arc gauges, today's costs and the expected annual bill. |
| 📷 **Cameras** | Snapshots via Homey, live video via go2rtc, and a doorbell pop-up with chime that appears on top of everything. |
| 🏠 **Your home at a glance** | Rooms with lights and temperature, presence, a timeline of what happened, batteries running low, and the waste collection calendar. |
| 🧺 **Appliances** | Washing machine, dryer, dishwasher and 3D printer with a progress ring and a notification when they are done. |
| 🚨 **Alarm** | A water leak, smoke or carbon monoxide shows a large red screen with sound. |
| 🌙 **Day and night** | The background follows the time of day. At night the screen dims or shows a clock, a daily overview or a photo frame. Pick a different start page per time slot. |

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/overzicht.jpg" alt="Energy flow, costs, appliances, timeline and maintenance"><br><sub><b>Energy flow and overview.</b> Power from solar, grid and battery, today's costs, a washing machine that just finished, the timeline and batteries running low.</sub></td>
<td width="50%"><img src="docs/screenshots/lamp.jpg" alt="Light controls"><br><sub><b>Controlling a light.</b> Long-press for brightness, colour temperature and colour.</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/bewerken.jpg" alt="Edit mode with tile settings"><br><sub><b>Edit mode.</b> Every tile has its own settings: icon, size, display style, threshold colours and more.</sub></td>
<td><img src="docs/screenshots/deurbel.jpg" alt="Doorbell pop-up"><br><sub><b>Doorbell.</b> When someone rings, a large (live) picture appears with a chime.</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/klok.jpg" alt="Clock screensaver"><br><sub><b>Screensaver.</b> A calm clock with the weather at night, slowly moving to prevent burn-in.</sub></td>
<td>
<img src="docs/screenshots/tablet-staand.jpg" alt="Portrait tablet" width="48%">
<img src="docs/screenshots/telefoon.jpg" alt="Phone" width="40%"><br><sub><b>Any screen.</b> Portrait, landscape or phone: the columns adjust automatically.</sub>
</td>
</tr>
</table>

## Installation

You need a server running Docker (a NAS, mini PC or Raspberry Pi) on the same network as your Homey Pro.

**1. Create an API key in Homey.** In the Homey web app ([my.homey.app](https://my.homey.app)) go to **Settings → API Keys** and give the key these permissions:

- view devices and zones, control devices
- view and start flows, use moods
- view users (for the presence tile)
- apps (for the waste calendar from Trashcan Reminder)

**2. Get the files and fill in the settings.**

```bash
git clone https://github.com/rikadoo/homey-dashboard.git
cd homey-dashboard
cp .env.example .env
cp go2rtc/go2rtc.example.yaml go2rtc/go2rtc.yaml
nano .env          # fill in at least HOMEY_ADDRESS and HOMEY_TOKEN
```

**3. Start.**

```bash
docker compose up -d --build
docker compose logs -f homey-dashboard
```

The log shows `Verbonden, N apparaten gevolgd` ("connected, N devices tracked"). Then open `http://<server>:8091`.

> [!TIP]
> Rather not build it yourself? Use the ready-made image. In `docker-compose.yml`, put a `#` in front of `build: .`, remove the `#` in front of `image: ghcr.io/rikadoo/homey-dashboard:latest` and run `docker compose pull && docker compose up -d`.

**Updating:** `git pull && docker compose up -d --build`. Your layout, history and settings live in `data/` and `.env` and are kept.

> [!IMPORTANT]
> The server must be able to reach the Homey on port 80. If the Homey is on a separate IoT network, allow that traffic in your firewall.

## Settings in .env

| Setting | Required | What it does |
|---|:---:|---|
| `HOMEY_ADDRESS` | ✅ | Address of your Homey Pro, e.g. `http://192.168.1.50` |
| `HOMEY_TOKEN` | ✅ | The API key from step 1. Leave empty to start demo mode. |
| `EDIT_PIN` | | PIN to open edit mode |
| `ALLOWED_NETWORKS` | | Only allow access from these networks, e.g. `192.168.1.0/24` |
| `DASH_USER`, `DASH_PASS` | | Log in with username and password, once per device |
| `TRUST_PROXY` | | Set to `1` behind a reverse proxy such as Traefik |
| `ENERGY_URL` | | Address of an energy dashboard, for the "Energy today" tile |
| `BACKUP_DIR` | | Folder for a daily backup of the layout |
| `PHOTOS_DIR` | | Folder with photos for the photo frame |

Everything you set on the screen (layout, theme, weather, doorbell, screensaver) is stored in `data/layout.json`, not in `.env`.

## Integrations

<details>
<summary><b>Live camera video (go2rtc)</b></summary>

Homey usually only provides snapshots of cameras. For live video, `docker compose` also starts **go2rtc**, which converts RTSP streams into video the browser can play.

1. Enable RTSP on your cameras. In UniFi Protect: camera → Settings → Advanced → RTSP(S) → "Medium".
2. Put the addresses in `go2rtc/go2rtc.yaml`, as explained in that file.
3. Test at `http://<server>:1984`: click "stream" next to a stream.
4. Enter the stream name in the camera tile. Tapping the camera then opens live video, including in the doorbell pop-up.

If you open the dashboard over https, also create an https route for go2rtc and enter that address in the settings. go2rtc has no password of its own, so keep that route internal.

</details>

<details>
<summary><b>Waste collection calendar</b></summary>

The waste tile reads the collection days from the Homey app **Trashcan Reminder** (com.trashchecker), so nothing needs to be entered. If your municipality offers an iCal link, you can enter it in the settings; it then takes precedence.

</details>

<details>
<summary><b>Energy dashboard</b></summary>

The "Energy today" tile and the "Overview" screensaver show production, consumption, self-sufficiency, costs and the expected annual bill from an energy dashboard such as [homey-energie-dashboard](https://github.com/rikadoo/homey-energie-dashboard). Set its address in `ENERGY_URL`. If both containers share a Docker network, the container name works as the address, e.g. `http://energie-dashboard:8080`.

</details>

<details>
<summary><b>Traefik</b></summary>

```yaml
http:
  routers:
    homey-dashboard:
      rule: "Host(`dashboard.example.com`)"
      entryPoints: [websecure]
      tls: {}
      service: homey-dashboard
  services:
    homey-dashboard:
      loadBalancer:
        servers:
          - url: "http://homey-dashboard:8080"
```

WebSockets work without extra configuration. Set `TRUST_PROXY=1` in `.env`.

</details>

<details>
<summary><b>Monitoring and backups</b></summary>

- `/health` returns status 200 when the Homey is connected and 503 when it is not. Docker uses it itself, and you can add it to Uptime Kuma.
- With `BACKUP_DIR` a copy of the layout is made every day; the last 30 are kept. The last 20 versions are also kept in `data/backups/`.
- Charts are filled from Homey Insights at startup, so they show history right away.

</details>

## Setting up the tablet

- **Android:** use [Fully Kiosk Browser](https://www.fully-kiosk.com) with the dashboard URL and enable "Keep screen on" and "Launch on boot".
- **iPad:** open the page in Safari, choose "Add to Home Screen" and use Guided Access to lock the screen.
- **Slow tablet?** Enable "Less blur" in the settings. That saves a lot of processing power.

The dashboard can be installed as an app. If the server is briefly unavailable, a red notice appears and the page recovers by itself.

## Try it without a Homey

```bash
npm install
npm run demo
```

Open `http://localhost:8080`. You get a demo layout with fake devices that change live; the screenshots above come from it.

## How it is built

| File | What it does |
|---|---|
| `server.js` | Web server, layout storage, WebSocket for live updates |
| `lib/homey.js` | Connection to the Homey via the local Web API |
| `lib/history.js` | History for charts, filled from Homey Insights |
| `lib/events.js` | Timeline, finished appliances, doorbell |
| `lib/energy.js`, `lib/waste.js`, `lib/weather.js` | Energy dashboard, waste calendar and weather (Open-Meteo) |
| `lib/security.js` | Access per network and login |
| `lib/mock.js` | Demo devices for trying it without a Homey |
| `public/app.js` | Tiles, controls and edit mode |
| `public/graphics.js` | Charts, gauges, side panel and status bar |
| `public/extras.js` | Energy flow, appliances, groups, doorbell, screensaver and more |
| `public/i18n.js` | Language: English translation layer, dates and numbers per language |
| `public/live.js` | Live camera video via go2rtc |
| `public/style.css` | Styling; colours are defined as variables at the top |

Add your own tile type in `TYPES`: each type has a `render` function and optionally `tap`, `hold`, `settings` and `onInput`.

**Built with** [homey-api](https://github.com/athombv/node-homey-api), [Express](https://expressjs.com), [ws](https://github.com/websockets/ws), [SortableJS](https://sortablejs.github.io/Sortable/), [Lucide](https://lucide.dev) icons, the [Figtree](https://fonts.google.com/specimen/Figtree) typeface, weather from [Open-Meteo](https://open-meteo.com) and [go2rtc](https://github.com/AlexxIT/go2rtc).

## License

GPL-3.0, see [`LICENSE`](LICENSE). The dashboard uses Athom's official `homey-api` library, which is also licensed under GPL-3.0.
