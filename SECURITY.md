# Security

Wavrel runs an MQTT hub on your LAN and shows what boards send to it. This page says
what the app defends against, how, and what it does not cover.

## Reporting a problem

Open a private security advisory on this repository (Security → Advisories → Report a
vulnerability). Please do not put details in a public issue.

## What is being protected

- The PC that runs the app: nothing a board sends, and nothing shown in the window, should be able to run code on it.
- The hub: only your own boards should be able to connect or publish.
- The broker password: it must not sit on disk in clear text or leave the PC.
- Privacy of the home: device identifiers and presence data stay local and are masked in exports.

## Design

### The window cannot reach the system

| Control | Where |
|---|---|
| Renderer sandbox on, context isolation on, Node integration off | `desktop/main/main.mjs` |
| The window loads only files shipped with the app, through `app://wavrel`, with a path-escape check | `serve()` in `main.mjs` |
| Content Security Policy sent with every file: scripts only from the app, no plugins, no `<base>`, no form posts | `CSP` in `main.mjs` |
| Navigation away from the app and new windows are blocked; a short allowlist of HTTPS documentation hosts opens in the system browser instead | `web-contents-created` handlers |
| `<webview>` is disabled; permission requests are denied except full screen and reaching a camera on the LAN | `main.mjs` |
| The bridge exposes eleven fixed functions. The window never receives `ipcRenderer`, Node or Electron objects | `desktop/preload/preload.cjs` |
| Every IPC call checks that it came from the app's own main frame, and validates its arguments | `trusted()` and `handle()` in `main.mjs` |
| No remote code, no auto-updater, no telemetry, no analytics | whole app |

### The hub accepts only your boards

| Control | Value |
|---|---|
| Username and password required; comparison is constant-time | `authenticate` in `desktop/main/broker.mjs` |
| The hub does not start until a password has been set | `main.mjs` |
| Connections from addresses outside loopback and private ranges (RFC 1918, link-local, unique-local) are dropped before MQTT is parsed | `isPrivateAddress` |
| Five failed logins from one address within a minute block that address for a minute | `LIMITS.authFails` |
| A socket that sends more than 4 KB before authenticating is closed | `LIMITS.preAuthBytes` |
| At most 32 connections; payloads over 64 KB and topics over 200 characters are refused | `LIMITS` |
| Topics starting with `$` and `lab/console/` are reserved; devices cannot publish to them | `validTopic` |
| Topics under `lab/out/` carry what the app itself says (alerts for glasses and phones). Devices can subscribe but cannot publish there, so a device cannot forge an alert | `HUB_ONLY`, T-HUB-010 |
| The hub speaks plain MQTT on the LAN. There is no WebSocket or HTTP listener | `broker.mjs` |

### Secrets and data

- The broker password is encrypted with the operating system's credential protection (DPAPI on Windows, through Electron `safeStorage`) and stored in the app's user data folder. It is shown again only when you press "보기" in the broker panel.
- Client ids, which often contain a MAC address, are masked before they reach the window. Exports and reports mask identifiers to four characters.
- Nothing is sent to the internet. The typefaces are bundled, so the app makes no network request of its own.

### The build

- Electron fuses are set at build time: the executable cannot run as a plain Node process, ignores `NODE_OPTIONS`, has no `--inspect` port, loads the app only from its archive, and checks that archive against a hash embedded in the binary. See `desktop/builder.config.js`.
- Dependencies are pinned with a lockfile and installed with `npm ci`. CI runs `npm audit` on runtime dependencies, and Dependabot proposes updates weekly.
- CI builds the Windows packages on a clean GitHub-hosted runner, scans the output with Microsoft Defender, and publishes SHA-256 checksums next to the files.
- The runtime has one third-party dependency tree: `aedes` (the MQTT broker).

## Tested

`npm test` covers the hub controls above (T-HUB-001 to 010). `npm run test:app` starts the real
app and checks the window isolation, the first-run flow, password storage, authentication,
and that navigation is blocked. `tests/packaged.check.mjs` repeats the isolation check against
the packaged executable.

## Not covered

- MQTT on the LAN is not encrypted. Anyone who can capture traffic on your Wi-Fi can read messages and the broker password as boards send it. The upstream firmwares decide whether TLS is possible; treat the hub as a home-lab tool, not a hardened gateway.
- A board that knows the password can publish any non-reserved topic, including commands the rule engine would send.
- Someone who can already run programs as your Windows user can read what the app can read.
- Windows Firewall decides whether the LAN can reach port 1883. The app does not change firewall rules.
- Upstream firmware (ESPectre, ESPresense, Tasmota, WLED) is outside this repository's control.
