# Alert channel for glasses and phones

Wavrel can say what it sees in one short sentence at a time, on one MQTT topic.
A receiver (an app for smart glasses, a phone, anything that speaks MQTT) subscribes to that
topic and shows the title and body. It needs to know nothing about ESP32 firmware.

Status: the sending side is covered by automated tests. A receiver for Android phones and Rokid
glasses is in [relay/](../relay/README.md). It is built and unit tested in CI but has not yet run
on a phone or on glasses (OPERATOR_REQUIRED).

## Topic

| | |
|---|---|
| Topic | `lab/out/notify` |
| QoS, retain | 0, not retained. An old alert shown late would be misleading |
| Who may publish | On the embedded hub only the app. Devices can subscribe but a publish from a device is refused (T-HUB-010) |

With the optional Mosquitto kit in `broker/` there is no such restriction unless you add an ACL.

## Payload (version 1)

```json
{"v":1,"id":"nmb1x2k3a0","ts":1795500000000,"kind":"motion","level":"alert",
 "title":"거실 CSI: 움직임","body":"점수 1.16 · 임계값 0.5","ttl":8,"source":"broker"}
```

| Field | Meaning |
|---|---|
| `v` | Format version. A receiver ignores versions it does not know |
| `id` | Unique per alert within a run |
| `ts` | Time the app created the alert, milliseconds since the epoch |
| `kind` | `motion`, `enter`, `quiet`, `session` or `test` |
| `level` | `alert` (needs attention) or `info` |
| `title` | Up to 40 characters |
| `body` | Up to 90 characters |
| `ttl` | Seconds to keep the alert on screen |
| `source` | `broker`, `broker_with_simulator`, `replay` or `built_in_simulator` |

Device identifiers are masked to four characters before an alert leaves the app (T-CON-011).
A receiver should show `source` whenever it is not `broker`, so simulated values are never
mistaken for a measurement (T-CON-012).

## When an alert is sent

- A rule whose action is "알림 보내기" fires: motion starts on a link, a pinned device enters a room, or a link stays quiet for the set time. One rule fires at most once every 3 seconds.
- A validation session, when "검증 세션 안내도 보내기" is on: the start, each pass about 2 seconds after it ends (detected or missed, with the running count), and the result when the session is stopped (T-CON-013). This is what lets a person walk the link and read the outcome without returning to the PC.
- The "시험 알림 보내기" button.

## Trying it without glasses

- The 자동화 view shows the latest alert in a lens-shaped preview.
- "안경 화면 열기" opens a full-screen page on a black background with the current state, the score against the threshold, the session progress and the latest alert. On see-through displays black is transparent, so this page can be mirrored to display glasses as it is. `M` switches to a single color to preview monochrome displays, `Esc` closes it.
- Any MQTT client on the same network can watch the topic:

```sh
mosquitto_sub -h <address of this PC> -p 1883 -u lab -P <hub password> -t lab/out/notify
```

## Receivers

- [Wavrel Relay](../relay/README.md) for Android: shows each alert as a phone notification and on
  Rokid glasses through Rokid's CXR-M SDK. Tests T-REL-001 to T-REL-004 check it against this
  format, including that a missing or unknown `source` is labelled rather than shown as a measurement.

## Writing a receiver

1. Connect to the hub with the user `lab` and the hub password. The address and port are in the app's hub panel.
2. Subscribe to `lab/out/notify`.
3. For each message: parse the JSON, skip it if `v` is not 1, show `title` and `body` for `ttl` seconds, and mark it when `source` is not `broker`.

The hub accepts connections only from private network addresses, so the receiver has to be on the same network as the PC.
