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
