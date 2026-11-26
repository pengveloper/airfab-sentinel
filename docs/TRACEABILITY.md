# Traceability

Each requirement points to the test that checks it and the evidence entry that records the result.
Status words: SIMULATED, SOFTWARE_VERIFIED, HARDWARE_VERIFIED, OPERATOR_REQUIRED.

| Requirement | Statement | Test | Evidence | Status |
|---|---|---|---|---|
| REQ-SL-001 | Device identifiers are masked to four characters on screen and in exports. | T-CON-001, T-CON-010 | EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-002 | ESPectre motion messages become nodes and detection intervals with start, end and peak. | T-CON-002 | EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-003 | Retained messages never count as fresh evidence and never create a node on their own. | T-CON-003 | EVD-P1-007, EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-004 | A validation session reports hits, misses, false detections and recall, with two seconds of slack. | T-CON-004, T-CON-005 | EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-005 | A device seen by three BLE nodes gets a position estimate. | T-CON-006 | EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-006 | A PIR input can supply ground truth for a session. | T-CON-007 | EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-007 | A motion rule publishes a WLED JSON command. | T-CON-008 | EVD-P1-006, EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-008 | Simulator data is never labelled as a measurement. | T-CON-009 | EVD-P1-008 | SOFTWARE_VERIFIED |
| REQ-SL-009 | The broker rejects anonymous and wrong-password clients; the WebSocket listener is local only. | manual container test | EVD-P1-006 | SOFTWARE_VERIFIED on Linux; Windows is EVD-P1-002, OPERATOR_REQUIRED |
| REQ-SL-010 | Real boards publish the expected topics and the console shows them. | first-measurement guide | EVD-P1-003, EVD-P1-004 | OPERATOR_REQUIRED |
| REQ-SL-011 | Detection quality is reported from real sessions (empty room, walk-through, distance). | validation session and report | EVD-P1-005 | OPERATOR_REQUIRED |
| REQ-SL-012 | The hub accepts connections only from loopback and private address ranges. | T-HUB-001 | EVD-P1-009 | SOFTWARE_VERIFIED |
| REQ-SL-013 | The hub requires the right username and password, and slows down repeated failures. | T-HUB-002, T-HUB-003 | EVD-P1-009 | SOFTWARE_VERIFIED |
| REQ-SL-014 | Device messages reach the window; retained messages are replayed separately; the app's own commands are not echoed back as device data. | T-HUB-004, T-HUB-007 | EVD-P1-009 | SOFTWARE_VERIFIED |
| REQ-SL-015 | Reserved topics, oversized payloads and pre-authentication floods are refused. | T-HUB-005, T-HUB-006 | EVD-P1-009 | SOFTWARE_VERIFIED |
| REQ-SL-016 | Hub status never contains the password or unmasked client ids. | T-HUB-008 | EVD-P1-009 | SOFTWARE_VERIFIED |
| REQ-SL-017 | The desktop window is isolated: no Node, fixed bridge, CSP, no navigation or new windows. | app smoke test, steps 1 and 7 | EVD-P1-010 | SOFTWARE_VERIFIED |
| REQ-SL-018 | The hub starts only after a password is set, and the password is not stored in clear text. | app smoke test, step 2 | EVD-P1-010 | SOFTWARE_VERIFIED on Linux; Windows DPAPI path is EVD-P1-011 |
| REQ-SL-019 | The packaged executable starts, is isolated, and has its hardening fuses set. | `tests/packaged.check.mjs` | EVD-P1-010, EVD-P1-011 | SOFTWARE_VERIFIED on Linux; Windows is EVD-P1-011 |
| REQ-SL-020 | Windows installs and runs the app without a publisher warning. | Store installation | EVD-P1-012 | OPERATOR_REQUIRED (needs Store submission) |
| REQ-SL-021 | Alerts leave on one topic as version 1 JSON with masked identifiers and a source label that never calls simulated values a measurement. | T-CON-011, T-CON-012 | EVD-P1-013 | SOFTWARE_VERIFIED |
| REQ-SL-022 | A validation session announces its start, each pass as detected or missed, and its result. | T-CON-013 | EVD-P1-013 | SOFTWARE_VERIFIED |
| REQ-SL-023 | Settings saved before the alert channel existed are migrated without changing the user's own rules. | T-CON-014 | EVD-P1-013 | SOFTWARE_VERIFIED |
| REQ-SL-024 | On the embedded hub only the app can publish alerts. Devices can subscribe but cannot forge one. | T-HUB-010, app smoke test, alert step | EVD-P1-014 | SOFTWARE_VERIFIED |
| REQ-SL-026 | Each quiet rule fires only after its own duration, once per quiet period. | T-CON-015 | EVD-P1-016 | SOFTWARE_VERIFIED |
| REQ-SL-027 | An exported log holds messages from one origin only, states that origin, and masks node identifiers in session records too. | T-CON-010, T-CON-016 | EVD-P1-016 | SOFTWARE_VERIFIED |
| REQ-SL-028 | Every Korean sentence in the console has an English sentence that keeps its placeholders and markup. No Korean literal bypasses the language layer and no logic depends on displayed text. | T-I18N-001, T-I18N-002 | EVD-P1-017 | SOFTWARE_VERIFIED |
| REQ-SL-029 | The language follows the address, then the saved choice, then the system language, and can be switched from the top bar and the first-run screen. | T-I18N-003, app smoke test, English step | EVD-P1-017, EVD-P1-018 | SOFTWARE_VERIFIED |
| REQ-SL-030 | Rule names, alerts, the exported log note and default node names follow the language. Names the user typed are left alone. | T-CON-017, T-CON-018, T-I18N-004 | EVD-P1-017 | SOFTWARE_VERIFIED |
| REQ-SL-031 | In English no Korean text is left on any screen, in the glasses screen or in the report. | app smoke test, English step | EVD-P1-018 | SOFTWARE_VERIFIED |
| REQ-SL-032 | In the desktop app, a command the app publishes on a topic the console subscribes to (such as the LED topic) also updates the console and the log, as it does with an external broker. | T-CON-019, app smoke test, rule step | EVD-P1-019 | SOFTWARE_VERIFIED |
| REQ-SL-025 | Alerts are shown on real glasses or in a phone app. | [relay/](../relay/README.md), checks 1, 3 to 6; emulator job in the `relay` workflow | EVD-P1-015, EVD-P1-021 | Phone path SOFTWARE_VERIFIED in an emulator; real phone and glasses OPERATOR_REQUIRED |
| REQ-SL-033 | The phone relay shows only version 1 alerts, keeps text to the documented lengths and labels every source other than live broker data, including a missing one. | T-REL-001 to T-REL-004 | EVD-P1-020 | SOFTWARE_VERIFIED |
| REQ-SL-034 | The relay sends the broker password only to a private, non-loopback address, including after resolving a host name, and says what is wrong with any other entry. | T-REL-005, T-REL-006, T-REL-009 | EVD-P1-020 | SOFTWARE_VERIFIED |
| REQ-SL-035 | What the relay sends to Rokid glasses opens one screen with four lines and updates the same lines for the next alert. | T-REL-007 | EVD-P1-020 | SOFTWARE_VERIFIED (format); glasses OPERATOR_REQUIRED |
| REQ-SL-036 | The relay connects with whichever known form of Rokid's `connectBluetooth` the SDK has and refuses forms it does not know. | T-REL-008 | EVD-P1-020 | SOFTWARE_VERIFIED |
| REQ-SL-037 | A wrong broker password stops the relay instead of retrying into the broker's lockout. Secrets are sealed with a Keystore key and backups are off. | emulator job, wrong-password step; code review of [Vault.kt](../relay/android/app/src/main/java/com/wavrel/relay/Vault.kt) | EVD-P1-021 | Lockout behaviour SOFTWARE_VERIFIED in an emulator; Keystore sealing reviewed, not tested |
| REQ-SL-038 | The desktop app lists the models on a local model server (Ollama) and sends one question to several of them in turn, showing each answer with its time. The window reaches the server only through the main process, which accepts only this PC or a private address written as an IP. | T-MOD-001..007, app smoke test (models step) | to be recorded | SOFTWARE_VERIFIED; with Ollama and a real model OPERATOR_REQUIRED |
| REQ-SL-039 | A question published on `lab/in/ask` is answered by the chosen model in under 80 characters on `lab/out/notify` (`kind` answer, `source` local_model). When answering is off or a question comes too soon after another, the app says so; retained questions get no answer. | T-CON-020, app smoke test (models step) | to be recorded | SOFTWARE_VERIFIED |
| REQ-SL-040 | The relay sends a spoken question from the phone's voice input as a v1 `lab/in/ask` message and shows a model's answer without marking it as simulated sensor data. | T-REL-010, T-REL-011 | to be recorded | SOFTWARE_VERIFIED (format); on a real phone and glasses OPERATOR_REQUIRED |
| REQ-SL-041 | The relay server answers a Rokid custom-agent request with the platform's event format, only with the right key, drops location and other metadata, and blocks repeated wrong keys. | T-SRV-001..004, T-SRV-009, T-SRV-010 | to be recorded | SOFTWARE_VERIFIED; with the real Rokid platform OPERATOR_REQUIRED |
| REQ-SL-042 | The desktop app keeps one outgoing link to the relay server with a sealed token; a question arriving there is answered by the chosen model through `lab/in/ask`, and only that answer goes back. A second PC with the same token waits. | T-SRV-005..008, T-LNK-001, app smoke test | to be recorded | SOFTWARE_VERIFIED; across the internet OPERATOR_REQUIRED |
| REQ-SL-043 | The relay server is deployed from `main` only, without SSH, with TLS and secrets that are never printed. | `server` workflow, `infra/server.yml` | to be recorded | to be verified on the first deploy |

Hardware results are added only with the board, firmware version, operator and time recorded.
Failed results stay in the table.
