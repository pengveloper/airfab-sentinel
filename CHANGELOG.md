# Changelog

## 0.6.0 (2026-11-27)

- **Ask the camera.** The Models view takes one picture from the ESP32-CAM and asks a picture-reading open model (gemma3, llava, qwen2.5-vl and others) about it, showing the picture next to the answer. Questions from the glasses can carry a camera picture too. The picture goes only to the model server on this PC or the home network.
- **Projects.** A new Projects view and wavrel.com/projects/ list seven experiments that tie boards, models and glasses together: parts, firmware, steps and what success looks like, in Korean and English. Ticked steps and parts are saved on the PC; each step can open its screen. Projects are JSON files in `projects/`, checked in CI, so anyone can add one by pull request.
- "Broker" is now called the hub everywhere a person reads it, and the first-run screen explains what it is.

## 0.5.0 (2026-11-26)

### Desktop app
- **Models view.** Lists the models on a local Ollama server, sends one question to several of them in turn and shows each answer with its time, speed and load time. "Ask about the sensor log" builds the question from the recent log and says where the values came from.
- **Questions from the glasses.** A question spoken into Wavrel Relay comes to the PC on `lab/in/ask`; the model you pick answers in under 80 characters and the answer goes back to the phone and the lens as an alert. Chinese questions get Chinese answers.
- **Ask from anywhere.** A new panel connects the app to a relay server, so the Rokid app's custom agent can ask the PC at home while you are out. The PC opens no port; the token is sealed with the OS credential store.
- The broker dialog shows the app version and a link to new releases.

### Relay server (new, optional)
- `server/`: Rokid custom-agent endpoint and the desktop link, behind Caddy TLS on one small EC2 instance. Drops location and other metadata, stores nothing about questions, blocks repeated wrong keys. See [docs/ROKID_AGENT.md](docs/ROKID_AGENT.md).

### Wavrel Relay (Android)
- "Ask the PC out loud" sends what the phone's voice input heard as a question; answers show as "PC model".
- Release builds are signed with the project's own key, so later versions install over this one.

## 0.4.0 (2026-11-26)

- Renamed from Sentinel Lab to Wavrel: app, website (wavrel.com), repository and Android package (`com.wavrel.relay`). Settings from Sentinel Lab are picked up on first start.
- Website with Korean and English pages, the browser demo and the privacy policy.

Earlier versions were published under the name Sentinel Lab.
