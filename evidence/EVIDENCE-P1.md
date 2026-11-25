# EVIDENCE: Sentinel Lab P1

| Evidence ID | 내용 | 상태 | 근거 |
|---|---|---|---|
| EVD-P1-001 | 콘솔이 ESPectre·ESPresense 토픽 모양의 메시지를 받아 표시하고, 내보내기에서 식별자를 가림 | SOFTWARE_VERIFIED | 2026-11-23 클라우드 작업 환경, 테스트 브로커(aedes) + sim.html. 실제 펌웨어 메시지 아님 |
| EVD-P1-002 | Mosquitto(Docker)가 이 PC(Windows Docker Desktop)에서 인증과 두 리스너로 동작 | OPERATOR_REQUIRED | |
| EVD-P1-003 | 보드 A(ESPectre)가 실제로 motion 메시지를 보냄 | OPERATOR_REQUIRED | |
| EVD-P1-004 | 보드 B(ESPresense)가 실제로 기기 거리 메시지를 보냄 | OPERATOR_REQUIRED | |
| EVD-P1-005 | 빈 방, 지나가기, 거리 시험 결과 | OPERATOR_REQUIRED | |
| EVD-P1-006 | `broker/`의 compose와 설정으로 eclipse-mosquitto:2 (Mosquitto 2.1.4)가 뜨고, 올바른 비밀번호만 받으며, 콘솔이 WebSocket 9001로 받고 자동화 명령이 1883 구독자에게 도달 | SOFTWARE_VERIFIED | 2026-11-23 클라우드 Linux 작업 환경의 Docker. Windows에서의 실행은 EVD-P1-002 |
| EVD-P1-007 | 첫 실측 순서가 브로커의 새 메시지로만 채워지고, 보관(retained) 메시지와 시뮬레이터 값으로는 채워지지 않음 | SOFTWARE_VERIFIED | 2026-11-23 같은 환경, 시험용 발행기. 실제 보드 아님 |
| EVD-P1-008 | 데이터 계층 자동 시험 T-CON-001 ~ 010 통과 (식별자 가림, 감지 구간, 세션 통계, 위치 추정, PIR 정답, 보관 메시지, 규칙 발행) | SOFTWARE_VERIFIED | 2026-11-23 Node.js 22, `npm test`. 가짜 시계와 가짜 MQTT 클라이언트 사용 |
| EVD-P1-009 | 내장 브로커 자동 시험 T-HUB-001 ~ 009 통과 (사설망만 수락, 인증, 반복 실패 차단, 예약 토픽과 큰 메시지 거절, 가린 상태 정보) | SOFTWARE_VERIFIED | 2026-11-24 Node.js 22, `npm test`. 실제 TCP 소켓 사용 |
| EVD-P1-010 | 데스크톱 앱 연기 시험 7단계 통과 (창 격리, 첫 실행, 비밀번호 비평문 저장, 인증, 메시지 수신, 규칙 명령 전달, 이동 차단), 묶은 실행 파일 기동 확인 | SOFTWARE_VERIFIED | 2026-11-24 Linux 작업 환경, Electron 45.4.1, 가상 화면. 보드는 시험용 MQTT 클라이언트 |
| EVD-P1-011 | 같은 시험과 MSIX·zip 빌드, 묶은 실행 파일 확인, Defender 검사가 Windows에서 통과 | SOFTWARE_VERIFIED | 2026-11-24 GitHub Actions `windows-latest`, 실행 45342718676, 커밋 c7bcf54. Defender는 appx·zip·win-unpacked에서 위협을 찾지 못함. 빌드 서버 결과이며 운영자 PC가 아님. 그 뒤에 더한 알림 채널 시험(EVD-P1-013, 014)의 Windows 결과는 다음 실행에서 확인 |
| EVD-P1-012 | Microsoft Store로 설치했을 때 게시자 경고 없이 설치되고 실행됨 | OPERATOR_REQUIRED | Store 제출 뒤 실제 PC에서 확인 |
| EVD-P1-013 | 알림 채널 자동 시험 T-CON-011 ~ 014 통과 (v1 형식, 식별자 가림, 출처 표시, 세션 시작·통과·결과 안내, 예전 설정 옮김) | SOFTWARE_VERIFIED | 2026-11-24 Node.js 22, `npm test`. 가짜 시계와 가짜 MQTT 클라이언트 |
| EVD-P1-014 | 내장 브로커에서 알림 토픽은 앱만 발행 (T-HUB-010). 실제 앱에서 구독자에게 알림이 도착하고, 기기가 꾸민 알림은 거절되며, 안경 화면이 열리고 닫힘 (연기 시험 알림 단계) | SOFTWARE_VERIFIED | 2026-11-24 Linux, xvfb. 시험용 MQTT 클라이언트가 구독자 역할. 실제 안경·휴대폰 아님 |
| EVD-P1-015 | 실제 안경 또는 휴대폰 앱에 알림이 표시됨 | OPERATOR_REQUIRED | 받는 쪽 앱이 아직 없음. 형식은 docs/NOTIFY.md |
| EVD-P1-016 | 코드 리뷰에서 나온 세 가지를 고치고 시험으로 고정: 조용함 규칙의 규칙별 시간(T-CON-015), 내보낸 기록 머리말의 세션 노드 식별자 가림과 출처 표기(T-CON-016) | SOFTWARE_VERIFIED | 2026-11-25 Node.js 22, `npm test` 26건 통과. 가짜 시계와 가짜 MQTT 클라이언트 |

## HARDWARE_VERIFIED로 바꿀 때 적을 것

- 보드: ESP32‑S3 DevKitC‑1 N16R8 (별칭만 사용, 예: lab-node-a)
- 펌웨어 이름과 버전, 굽은 날짜
- 실행한 사람, 실행 시각
- 내려받은 JSONL 파일 이름 (식별자 가림 확인)
- 시험 결과

| 시험 | 결과 | 비고 |
|---|---|---|
| 빈 방 5분: 잘못 뜬 횟수 | | |
| 지나가기 10번: 감지 횟수 | | |
| 거리 1m / 3m / 5m: 표시 범위 | | |

실패한 결과도 지우지 않고 그대로 적습니다.
