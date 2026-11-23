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

Hardware results are added only with the board, firmware version, operator and time recorded.
Failed results stay in the table.
