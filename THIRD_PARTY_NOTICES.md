# Third-party notices

## Bundled with the console

| Component | Version | License | Location |
|---|---|---|---|
| three.js | r149 | MIT, Copyright 2010-2023 Three.js Authors | `console/vendor/three.min.js` |
| MQTT.js | 5.10.1 | MIT, Copyright MQTT.js contributors | `console/vendor/mqtt.min.js`, license text in `console/vendor/MQTTJS-LICENSE.md` |

The console loads the Archivo, IBM Plex Sans KR and IBM Plex Mono typefaces from Google Fonts
at run time (SIL Open Font License 1.1). They are not stored in this repository. Without a
network connection the console falls back to system fonts.

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
