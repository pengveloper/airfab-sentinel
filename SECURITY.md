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
- The relay server (optional, `server/`): only the Rokid platform with its key and your own PC with its token may use it, and it must not keep what you ask.
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
| The bridge exposes eighteen fixed functions. The window never receives `ipcRenderer`, Node or Electron objects | `desktop/preload/preload.cjs` |
| The window never reaches a model server itself. The main process asks for it, and only over plain HTTP to localhost, a loopback address or a private address written as an IP (no host names, so a name cannot later resolve elsewhere); no redirects, a 2 MB reply limit, one question at a time | `desktop/main/models.mjs`, T-MOD-001..007 |
| The window never reaches the relay server itself. The main process keeps the link (`wss://` only, or `ws://` to the PC itself), seals its token with `safeStorage`, never returns the token to the window, and sends back only the answer the window published for a question that arrived over the link in the last 50 seconds | `desktop/main/link.mjs`, T-LNK-001, T-SRV-005 |
| The window never reaches the camera itself either. For "Ask the camera", the main process takes one still from a private IP address only (plain HTTP, no redirects, JPEG only, 3 MB, 6 seconds) and sends it only to the model server above; the picture is never sent through the relay server | `desktop/main/camera.mjs`, T-CAM-001..002, T-MOD-008 |
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
| `lab/in/ask` carries spoken questions from the phone. Any client with the hub password can publish there, so the app answers only when answering is turned on, ignores retained questions, takes at most one new question every 1.5 seconds and cuts questions to 300 characters. Model output reaches the window as text only, never as markup | `console/js/models.js`, T-CON-020 |
| The hub speaks plain MQTT on the LAN. There is no WebSocket or HTTP listener | `broker.mjs` |

### The relay server (optional)

Only used when you set up "ask from anywhere" ([docs/ROKID_AGENT.md](docs/ROKID_AGENT.md)).

| Control | Where |
|---|---|
| Two random secrets in SSM Parameter Store (SecureString): one for the Rokid platform, one for the PC. Created by the deploy workflow, never printed, compared in constant time, and the server refuses to start if they are equal or short | `.github/workflows/server.yml`, `createApp` in `server/app.mjs` |
| Ten wrong keys from one address in ten minutes block it for fifteen minutes; the client address is taken from Caddy only when the request comes from the same machine | `GUARD` in `server/app.mjs`, T-SRV-009 |
| Request bodies over 64 KB are refused (Caddy and the server); questions are cut to 300 characters, answers to 400; WebSocket messages over 16 KB are refused | `server/lingzhu.mjs`, `server/home.mjs` |
| Location, weather, battery, earlier turns and photo links in a request are dropped when it is parsed; nothing about a question is stored or logged, logs hold path, status and duration only | `parseRequest`, T-SRV-001 |
| One PC answers at a time; a second PC with the same token waits instead of taking over | `Home.attach`, T-SRV-007 |
| TLS by Caddy (pinned release, SHA-512 checked); no SSH and no port 22; code installed per commit through SSM Run Command; the instance role reads only its two parameters and carries the `wavrel-relay-boundary` | `server/deploy/install.sh`, `infra/server.yml` |
| The Node process runs as its own user under a locked-down systemd unit (no capabilities, read-only system, no new privileges, memory cap); security updates install daily | `wavrel-relay.service` in `install.sh` |

### Secrets and data

- The broker password is encrypted with the operating system's credential protection (DPAPI on Windows, through Electron `safeStorage`) and stored in the app's user data folder. It is shown again only when you press "보기" in the broker panel.
- Client ids, which often contain a MAC address, are masked before they reach the window. Exports and reports mask identifiers to four characters.
- Nothing is sent to the internet unless you set up the relay link. The typefaces are bundled, so the app makes no network request of its own otherwise.

### The build

- Electron fuses are set at build time: the executable cannot run as a plain Node process, ignores `NODE_OPTIONS`, has no `--inspect` port, loads the app only from its archive, and checks that archive against a hash embedded in the binary. See `desktop/builder.config.js`.
- Dependencies are pinned with a lockfile and installed with `npm ci`. CI runs `npm audit` on runtime dependencies, and Dependabot proposes updates weekly.
- CI builds the Windows packages on a clean GitHub-hosted runner, scans the output with Microsoft Defender, and publishes SHA-256 checksums next to the files.
- The runtime has one third-party dependency tree: `aedes` (the MQTT broker). The relay server has one: `ws`.

## Tested

`npm test` covers the hub controls above (T-HUB-001 to 010) and the relay server against the desktop link (T-SRV-001 to 010, T-LNK-001). `npm run test:app` starts the real
app and checks the window isolation, the first-run flow, password storage, authentication,
and that navigation is blocked. `tests/packaged.check.mjs` repeats the isolation check against
the packaged executable.

## Not covered

- MQTT on the LAN is not encrypted. Anyone who can capture traffic on your Wi-Fi can read messages and the broker password as boards send it. The upstream firmwares decide whether TLS is possible; treat the hub as a home-lab tool, not a hardened gateway.
- A board that knows the password can publish any non-reserved topic, including commands the rule engine would send.
- Someone who can already run programs as your Windows user can read what the app can read.
- Windows Firewall decides whether the LAN can reach port 1883. The app does not change firewall rules.
- Upstream firmware (ESPectre, ESPresense, Tasmota, WLED) is outside this repository's control.
- With the relay link on, questions and answers pass through Rokid's cloud, which this repository does not control. The relay server sees the question text and the answer while it passes them on.
