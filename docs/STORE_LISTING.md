# Microsoft Store listing text

Text prepared for the Partner Center submission of Sentinel Lab (Store ID `9NVR2WGRQB9X`).
Paste as is or edit. Nothing here claims a hardware result.

## Properties

- Category: Developer tools
- Privacy policy: entered in Partner Center as hosted text (the wording of [PRIVACY.md](../PRIVACY.md) in English and Korean). The same text is live at `https://pengveloper.github.io/airfab-sentinel/privacy/` if a URL is preferred
- Website: `https://pengveloper.github.io/airfab-sentinel/` (the simulator demo) or the repository address
- Support contact: the repository's issue tracker

## Why the package needs `runFullTrust`

Sentinel Lab is a packaged desktop (Win32) application built with Electron. It runs a local
MQTT broker on TCP port 1883 so that ESP32 boards on the user's own network can report to it,
which requires the full-trust desktop runtime. It does not require administrator rights,
does not install drivers or services, and does not start with Windows.

## Notes for certification

No hardware or account is needed to review the app. On first launch choose "See the demo first"
("데모 먼저 보기" when Windows is set to Korean). Every screen then runs on a built-in simulator
and is labelled as simulated data. To see the broker start, press "Suggest one" and then
"Start broker" on the first screen; Windows may ask whether to allow the app on private networks.
The app itself makes no connection to the internet.

The interface is in English and Korean. It follows the Windows display language and can be
switched with the EN / 한국어 button in the top bar.

## English (en-us)

**Short description**

Try open-source ESP32 sensing firmware side by side: a built-in MQTT hub, a 3D console, and validation against ground truth.

**Description**

Sentinel Lab is a desktop console for people who experiment with ESP32 boards.

Open-source firmware can already sense motion from Wi-Fi signals, measure Bluetooth distance room by room, or stream a small camera. Each project comes with its own setup and its own screen. Sentinel Lab puts them on one bench: flash each board with its unmodified firmware, point it at this app, and watch everything in one place.

What you get

- A built-in MQTT hub. Start the app and your boards have somewhere to report. No Docker and no scripts.
- A 3D view of the room that draws the sensing region of each Wi-Fi link and the live motion score along it.
- Validation sessions that compare what the firmware detected with when someone really walked through: hits, misses, false detections and recall.
- A floor plan with Bluetooth device positions, a camera view, and simple rules such as "when motion starts, turn the light gold".
- Log export, replay, and a standalone report for each test.
- A demo mode with a built-in simulator, clearly labelled, so you can explore before you own a board.
- English and Korean, following your Windows language.

Built carefully

- The hub requires a password, accepts connections only from your local network, and limits failed logins.
- The password is stored with Windows credential protection.
- The app sends nothing to the internet. There is no account, telemetry or advertising.

Works with ESPectre, ESPresense, Tasmota and WLED firmware. These projects are separate downloads with their own licenses.

**Features (up to 20, one per line)**

Built-in MQTT hub for ESP32 boards
3D room view with Wi-Fi sensing links
Detection validation with recall and false-detection counts
Bluetooth presence on a floor plan
Camera stream next to sensor data
Automation rules for LED feedback
Log export, replay and HTML reports
Demo mode with a labelled simulator
No account, no telemetry

**Keywords (up to 7)**

ESP32, MQTT, Wi-Fi sensing, CSI, IoT, presence detection, home lab

## 한국어 (ko-kr)

**간단한 설명**

오픈소스 ESP32 감지 펌웨어를 한 화면에서 시험합니다. MQTT 허브 내장, 3D 콘솔, 정답과 맞춰 보는 검증.

**설명**

Sentinel Lab은 ESP32 보드로 실험하는 사람을 위한 데스크톱 콘솔입니다.

Wi‑Fi 신호로 움직임을 감지하거나, 방마다 블루투스 거리를 재거나, 작은 카메라 영상을 보내는 오픈소스 펌웨어는 이미 있습니다. 다만 프로젝트마다 설정과 화면이 따로입니다. Sentinel Lab은 이들을 한 시험대에 올립니다. 보드마다 원본 펌웨어를 굽고 이 앱 주소를 넣으면 한곳에서 볼 수 있습니다.

들어 있는 것

- MQTT 허브 내장. 앱을 켜면 보드가 보고할 곳이 생깁니다. Docker도 스크립트도 필요 없습니다.
- 방을 3D로 보여 주고, Wi‑Fi 링크의 감지 구역과 실시간 움직임 점수를 그립니다.
- 펌웨어가 감지한 것과 사람이 실제로 지나간 시간을 맞춰 보는 검증 세션. 감지, 놓침, 오탐, 재현율이 나옵니다.
- 블루투스 기기 위치를 그린 평면도, 카메라 화면, "움직임이 시작되면 조명을 금색으로" 같은 간단한 규칙.
- 기록 내려받기, 재생, 시험별 리포트.
- 내장 시뮬레이터로 도는 데모. 시뮬레이션 값이라고 표시되므로 보드가 없어도 먼저 둘러볼 수 있습니다.

신경 쓴 부분

- 허브는 비밀번호가 있어야 붙고, 집 안 망의 연결만 받으며, 로그인 실패를 제한합니다.
- 비밀번호는 Windows 자격 증명 보호로 저장합니다.
- 앱은 인터넷으로 아무것도 보내지 않습니다. 계정, 수집, 광고가 없습니다.

ESPectre, ESPresense, Tasmota, WLED 펌웨어와 함께 씁니다. 이 프로젝트들은 각자의 라이선스로 따로 배포됩니다.

**키워드**

ESP32, MQTT, Wi-Fi 감지, CSI, IoT, 재실 감지, 홈랩
