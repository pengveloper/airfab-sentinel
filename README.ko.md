# Sentinel Lab

English: [README.md](README.md)

ESP32 보드 여러 대의 오픈소스 펌웨어(ESPectre, ESPresense, 카메라 웹서버, WLED)를 MQTT로 한 콘솔에 모아
하나씩 시험하는 플랫폼입니다. Windows + pwsh 7 기준입니다.

## 지금 상태

| 항목 | 상태 |
|---|---|
| 콘솔의 일곱 화면 (공간, 움직임, 위치, 카메라, 자동화, 노드, 기록) | 내장 시뮬레이터로 동작 확인 (SIMULATED) |
| PIR 정답 입력, 기록 재생, 검증 요약 | 내장 시뮬레이터로 동작 확인 (SIMULATED) |
| 브로커 설정 (인증, 1883과 9001 리스너), 콘솔 실시간 경로, 자동화 명령 전송 | eclipse-mosquitto:2 (2.1.4) 컨테이너와 시험용 발행기로 확인 (SOFTWARE_VERIFIED, Linux 작업 환경) |
| 첫 실측 순서의 자동 채움 | 같은 컨테이너와 시험용 발행기로 확인 (SOFTWARE_VERIFIED) |
| 데이터 계층 (가림, 감지 구간, 세션 통계, 위치 추정, 보관 메시지 처리, 규칙) | 자동 시험 10건 통과, `npm test` (SOFTWARE_VERIFIED) |
| 검증 리포트, 발표 모드 | 내장 시뮬레이터로 동작 확인 (SIMULATED) |
| Windows Docker Desktop에서의 실행, `start.ps1` | 아직 아무도 실행하지 않음 (OPERATOR_REQUIRED) |
| 실제 보드 다섯 대 | 아직 아무도 확인하지 않음 (OPERATOR_REQUIRED) |

## 바로 열어 보기

`console/index.html`을 Chrome이나 Edge로 엽니다. 브로커가 없어도 데모(내장 시뮬레이터)로 시작합니다.
설치나 빌드는 필요 없습니다. "노드" 화면의 첫 실측 순서를 위에서부터 따라가면 됩니다.

## 보드 배정 (가진 보드 기준)

| 보드 | 역할 | 펌웨어 | 굽는 곳 |
|---|---|---|---|
| ESP32‑S3 N16R8 ① | Wi‑Fi 움직임 감지 | ESPectre | https://espectre.dev/tools/flash/ |
| ESP32‑S3 N16R8 ② | BLE 위치, 작업실 | ESPresense | https://espresense.com/firmware |
| ESP32‑S3 N16R8 ③ | BLE 위치, 거실 | ESPresense | 같음 |
| ESP32‑C3 Super Mini | BLE 위치, 현관 | ESPresense | 같음 |
| ESP32‑CAM + 어댑터 | 현장 영상 | Tasmota (tasmota32-webcam) | https://tasmota.github.io/install/ |

- 굽는 페이지는 모두 PC의 Chrome이나 Edge에서 엽니다. 컴파일은 필요 없습니다.
- S3 보드에 USB‑C가 두 개면 UART 또는 COM이라고 적힌 쪽에 꽂습니다. 포트가 보이지 않으면 보드의 USB 변환 칩 드라이버가 필요할 수 있습니다.
- ESPresense는 S3와 C3를 지원하고, 설치 페이지가 칩에 맞는 펌웨어를 고릅니다. 다만 가진 보드는 ESPresense 권장 목록에 이름이 없는 일반 보드라서, 거리 값은 직접 재서 확인합니다.
- ESP32‑CAM을 직접 빌드해서 쓰려면 https://github.com/easytarget/esp32-cam-webserver 가 대안입니다.

## 실측 순서

콘솔 "노드" 화면에 같은 순서가 있고, 콘솔이 보드의 메시지를 받으면 단계가 자동으로 채워집니다.

1. **브로커 켜기.** `broker` 폴더에서 `start.ps1`을 실행합니다. 비밀번호를 직접 정하게 되고, 끝나면 보드에 넣을 이 PC의 LAN 주소를 알려 준 뒤 콘솔을 엽니다.
   ```powershell
   cd broker
   ./start.ps1
   ```
   내려받은 스크립트라서 실행이 막히면, 파일 내용을 읽어 본 뒤 `Unblock-File ./start.ps1`을 하거나 아래 명령을 직접 실행합니다.
   ```powershell
   docker compose run --rm mosquitto sh -c 'mosquitto_passwd -c /mosquitto/auth/passwd lab && chown mosquitto:mosquitto /mosquitto/auth/passwd'
   docker compose up -d
   ```
   비밀번호 해시는 Docker 볼륨(`sentinel-lab_mqauth`)에만 저장되고 이 폴더에는 남지 않습니다. 끌 때는 `docker compose down`입니다.
2. **콘솔 연결.** 오른쪽 위 "브로커 연결"에서 `ws://localhost:9001`, 사용자 `lab`, 정한 비밀번호.
3. **보드 ① ESPectre.** 굽고 와이파이를 넣은 뒤 Device settings에서 MQTT를 `mqtt`, 이 PC의 LAN 주소, `1883`, 사용자 `lab`으로 설정합니다. 보드는 2.4GHz 와이파이에만 붙습니다.
4. **검증 세션.** "움직임" 화면에서 세션을 시작하고, 보드와 공유기 사이를 지나가는 동안 버튼이나 L 키를 누릅니다.
5. **보드 ②③과 C3 ESPresense.** 굽고 나면 보드가 `espresense-`로 시작하는 와이파이를 띄웁니다. 접속해서 방 이름(office, living, entry)과 MQTT 값을 넣습니다.
6. **배치 맞추기.** "위치" 화면에서 방 크기를 넣고, 노드를 실제 자리로 끌어다 놓습니다.
7. **ESP32‑CAM.** Tasmota 설치 페이지에서 tasmota32-webcam을 골라 굽고, "카메라" 화면에 `http://카메라주소:81/stream`을 넣습니다. 영상이 나오지 않으면 Tasmota의 Configure Other에서 AI‑Thinker ESP32‑CAM 템플릿(https://templates.blakadder.com/ai-thinker_ESP32-CAM.html)을 적용합니다.
8. **기록.** "기록" 화면에서 JSONL을 내려받고 검증 요약을 복사합니다.

### 보드가 브로커에 붙지 않을 때

- 보드와 PC가 같은 공유기의 2.4GHz 망에 있는지 확인합니다.
- Windows 방화벽이 TCP 1883 인바운드를 막고 있을 수 있습니다. 보안 설정이므로 직접 판단해서 바꾸세요. 집 안 망에만 여는 규칙의 예는 다음과 같습니다 (관리자 PowerShell).
  ```powershell
  New-NetFirewallRule -DisplayName 'Sentinel Lab MQTT 1883' -Direction Inbound -Protocol TCP -LocalPort 1883 -Profile Private -RemoteAddress LocalSubnet -Action Allow
  ```
- 9001 포트는 이 PC 안에서만 열리므로 방화벽과 무관합니다.

### 보드 없이 브로커 경로만 먼저 확인하기

`tools/broker-sim.html`을 다른 탭에서 엽니다. 콘솔에 "시뮬레이터 포함" 표시가 뜨고, 그동안에는 첫 실측 순서가 채워지지 않습니다.

## PIR 정답 센서 (HC‑SR501)

Wi‑Fi 감지가 맞았는지 버튼 대신 센서로 기록합니다. ESPresense를 구운 보드 한 대에 연결합니다.

| PIR 핀 | 보드 핀 | 비고 |
|---|---|---|
| VCC | 5V | HC‑SR501은 4.5~20V 전원이 필요합니다 |
| GND | GND | |
| OUT | 비어 있는 GPIO 하나 | 출력은 3.3V 레벨입니다 |

F/F 점퍼선 세 가닥이면 브레드보드 없이 연결됩니다. 배선은 USB를 뽑은 상태에서 합니다.

1. ESPresense 노드의 웹 화면 Hardware에서 Inputs에 입력을 추가하고 Role을 Motion, 핀을 연결한 GPIO, 타입을 Pulldown 또는 Floating으로 둡니다.
2. 노드는 `espresense/rooms/{room}/input_1`에 `ON`/`OFF`를 보냅니다.
3. 콘솔 "움직임" 화면의 정답 출처에 "PIR 입력"이 나타납니다. 고르고 세션을 시작합니다.

PIR은 보는 범위가 넓습니다. 센서가 보드와 공유기 사이 구간을 보도록 두세요. 전원을 넣고 1분쯤은 감지가 불안정합니다.

## 기록 재생

"기록" 화면에서 내려받은 JSONL 파일을 고르면 같은 수신 경로로 다시 흘려보냅니다. 실측 뒤에 화면을 다시 보여 주거나 영상을 찍을 때 씁니다. 재생 중에는 상단에 "재생"으로 표시됩니다.

## 검증 리포트와 발표 모드

- "기록" 화면의 "리포트 만들기"는 끝낸 세션을 HTML 한 장으로 만듭니다. 세션마다 점수 곡선, 정답 구간, 감지 구간, 통계가 들어가고, 데이터가 브로커 수신인지 SIMULATED인지 표시됩니다. 혼자 열리는 파일이라 포트폴리오에 그대로 올릴 수 있고, 인쇄하면 밝은 배경으로 바뀝니다.
- "공간" 화면의 "발표 모드"는 3D 화면만 가득 채웁니다. 영상을 찍을 때 씁니다. 데이터 출처 표시는 화면에 남습니다. Esc로 나옵니다.

## 자동 시험

Node.js 20 이상에서 의존성 없이 실행합니다.

```powershell
npm test
```

`tests/core.test.mjs`가 콘솔의 데이터 계층을 가짜 시계와 가짜 MQTT 클라이언트로 시험합니다 (T-CON-001 ~ 010).

## 콘솔이 듣는 토픽

- `espectre/v1/devices/{id}/motion`, `/sensing`, `/health`
- `espresense/devices/{id}/{room}`, `espresense/rooms/{room}/status`, `/telemetry`, `/input_{n}`
- LED 명령은 `wled/lab/api`로 WLED JSON 형식을 보냅니다 (자동화 화면에서 변경).

## 지켜야 할 것

- 브로커 비밀번호, Wi‑Fi 정보, 가리지 않은 MAC이 든 캡처는 저장소에 올리지 않습니다.
- 내려받는 기록은 식별자를 앞 4자만 남기고 가립니다.
- 콘솔 안의 배너 사진 두 장은 연출용 이미지이며 실제 실험 장비 사진이 아닙니다.
- 시뮬레이터 값이 섞인 기록은 SIMULATED로 표시되며 하드웨어 결과로 쓰지 않습니다.
- 브로커가 보관(retained)하고 있던 예전 메시지는 첫 실측 순서의 확인으로 세지 않습니다.
- 콘솔의 "확인" 표시는 메시지를 받았다는 뜻입니다. HARDWARE_VERIFIED 판정은 `evidence/` 양식에 사람이 적습니다.

## 폴더

- `console/` 콘솔 (정적 파일, three.js r149와 MQTT.js 포함)
- `broker/` Mosquitto 설정과 시작 스크립트 (`start.ps1`, macOS와 Linux는 `start.sh`)
- `tools/broker-sim.html` 브로커를 거치는 가짜 발행기
- `tests/` 데이터 계층 자동 시험
- `evidence/` 기록 양식
- `docs/` 스크린샷과 요구사항 추적표 (`docs/TRACEABILITY.md`)

## 라이선스

[MIT](LICENSE). 포함한 라이브러리와 연동하는 펌웨어는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
