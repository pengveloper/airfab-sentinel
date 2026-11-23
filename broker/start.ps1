# Sentinel Lab 브로커 시작 (Windows, PowerShell 7)
# 하는 일: Docker 확인 -> 비밀번호가 없으면 만들기 -> 브로커 실행 -> 이 PC의 LAN 주소 안내 -> 콘솔 열기
# 비밀번호는 직접 입력하며, 해시는 Docker 볼륨에만 저장됩니다. 이 폴더와 화면 기록에는 남지 않습니다.
# 방화벽과 시스템 설정은 바꾸지 않습니다.

Set-Location $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker Desktop이 꺼져 있습니다. 켠 다음 다시 실행하세요.' -ForegroundColor Yellow
  exit 1
}

docker compose run --rm -T mosquitto test -s /mosquitto/auth/passwd *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '브로커 사용자 lab의 비밀번호를 정합니다. 같은 값을 두 번 입력합니다.'
  docker compose run --rm mosquitto sh -c 'mosquitto_passwd -c /mosquitto/auth/passwd lab && chown mosquitto:mosquitto /mosquitto/auth/passwd'
  if ($LASTEXITCODE -ne 0) {
    Write-Host '비밀번호를 만들지 못했습니다. 다시 실행하세요.' -ForegroundColor Yellow
    exit 1
  }
}

docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Host '브로커를 켜지 못했습니다. 1883이나 9001 포트를 다른 프로그램이 쓰고 있는지 확인하세요.' -ForegroundColor Yellow
  exit 1
}

$ip = $null
try {
  $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
  if ($cfg) { $ip = $cfg.IPv4Address.IPAddress }
} catch { }

Write-Host ''
Write-Host '브로커가 켜졌습니다.' -ForegroundColor Green
Write-Host '  콘솔에서 연결:  ws://localhost:9001   사용자 lab'
if ($ip) {
  Write-Host "  보드에 넣을 값:  Host $ip   Port 1883   사용자 lab"
} else {
  Write-Host '  보드에 넣을 값:  Host 이 PC의 LAN 주소 (ipconfig의 IPv4 주소)   Port 1883   사용자 lab'
}
Write-Host '  보드가 붙지 않으면 README의 방화벽 항목을 보세요.'
Write-Host '  끄기:  docker compose down'
Write-Host ''

$console = Join-Path $PSScriptRoot '..\console\index.html'
if (Test-Path $console) { Start-Process $console }
