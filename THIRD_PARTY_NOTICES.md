# Third-party notices

## Bundled with the console

| Component | Version | License | Location |
|---|---|---|---|
| Electron | 45 | MIT, Copyright Electron contributors and GitHub Inc. The runtime also contains Chromium and Node.js under their own licenses, listed in `LICENSES.chromium.html` inside the app | desktop app runtime |
| aedes | 1.2 | MIT, Copyright aedes contributors | embedded MQTT broker in the desktop app |
| Archivo, IBM Plex Sans KR, IBM Plex Mono | via Fontsource 5.3 | SIL Open Font License 1.1 | copied into `console/fonts` at install time and shipped inside the desktop app |
| three.js | r149 | MIT, Copyright 2010-2023 Three.js Authors | `console/vendor/three.min.js` |
| MQTT.js | 5.10.1 | MIT, Copyright MQTT.js contributors | `console/vendor/mqtt.min.js`, license text in `console/vendor/MQTTJS-LICENSE.md` |

The typefaces are not committed to this repository. `npm install` copies them from the Fontsource packages, and the desktop build bundles them, so the app never requests fonts over the network. Opened straight from a clone without `npm install`, the console falls back to system fonts.

### three.js (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Used at run time, not included

These run on separate boards or in a separate container and talk to the console over MQTT or
HTTP. Their code is not part of this repository. Check each project for its current license.

| Project | Role here |
|---|---|
| [ESPectre](https://github.com/francescopace/espectre) | Wi-Fi CSI motion sensing firmware |
| [ESPresense](https://github.com/ESPresense/ESPresense) | BLE presence firmware |
| [Tasmota](https://github.com/arendst/Tasmota) | ESP32-CAM webcam firmware |
| [WLED](https://github.com/wled/WLED) | LED firmware; the rule engine speaks its JSON format |
| [Eclipse Mosquitto](https://mosquitto.org/) | MQTT broker, run from the official container image |
