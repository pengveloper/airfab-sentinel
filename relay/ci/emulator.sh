#!/usr/bin/env bash
# CI only: installs the relay in the running emulator and drives it against the desktop broker.
set -euo pipefail
adb install -r apk/*.apk
adb shell pm grant com.wavrel.relay android.permission.POST_NOTIFICATIONS
python3 relay/ci/drive.py relay-shots /tmp/relay-ci
