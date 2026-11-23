#!/usr/bin/env sh
# Sentinel Lab 브로커 시작 (macOS, Linux). Windows에서는 start.ps1을 씁니다.
# 비밀번호는 직접 입력하며, 해시는 Docker 볼륨에만 저장됩니다.
cd "$(dirname "$0")" || exit 1
docker info >/dev/null 2>&1 || { echo 'Docker가 꺼져 있습니다. 켠 다음 다시 실행하세요.'; exit 1; }
if ! docker compose run --rm -T mosquitto test -s /mosquitto/auth/passwd >/dev/null 2>&1; then
  echo '브로커 사용자 lab의 비밀번호를 정합니다. 같은 값을 두 번 입력합니다.'
  docker compose run --rm mosquitto sh -c 'mosquitto_passwd -c /mosquitto/auth/passwd lab && chown mosquitto:mosquitto /mosquitto/auth/passwd' || { echo '비밀번호를 만들지 못했습니다.'; exit 1; }
fi
docker compose up -d || { echo '브로커를 켜지 못했습니다. 1883이나 9001 포트를 확인하세요.'; exit 1; }
echo
echo '브로커가 켜졌습니다.'
echo '  콘솔에서 연결:  ws://localhost:9001   사용자 lab'
echo '  보드에 넣을 값:  Host 이 PC의 LAN 주소   Port 1883   사용자 lab'
echo '  끄기:  docker compose down'
