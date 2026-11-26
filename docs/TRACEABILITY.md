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
| REQ-SL-037 | A wrong broker password stops the relay instead of retrying into the broker's lockout. Secrets are sealed with a Keystore key and backups are off. | emulator job, wrong-password step; code review of [Vault.kt](../relay/android/app/src/main/java/io/github/pengveloper/sentinel/relay/Vault.kt) | EVD-P1-021 | Lockout behaviour SOFTWARE_VERIFIED in an emulator; Keystore sealing reviewed, not tested |

Hardware results are added only with the board, firmware version, operator and time recorded.
Failed results stay in the table.
