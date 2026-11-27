# Evidence of hardware checks

A project moves from "Not yet checked on hardware" to "Checked on hardware" only with a record
here. The record comes from the app, not from hand-editing:

1. Do the project on real boards (and glasses, if it uses them), connected to the hub. Records are
   refused while the simulator or the browser demo is running.
2. In the Projects view, under **Hardware check**, mark each success criterion as passed, failed or
   not checked, add a short note, and save. The last finished test session from a real board is
   attached as numbers only (passes, detections, misses, false alarms).
3. Press **Copy record** and save it here as `EVD-YYYYMMDD-<project id>.json`, the id the record
   carries.
4. In `projects/<order>-<id>.json`, set `"status": "HARDWARE_VERIFIED"` and `"evidence": "<that id>"`,
   run `node tools/projects.mjs`, and send the pull request.

The check (T-PRJ-006) refuses the change unless the file exists, belongs to that project, came
from a real board, has every criterion passed, and its note holds no MAC or IP addresses.

Records hold no Wi-Fi names, MAC or IP addresses, passwords or file paths. The app masks
anything that looks like an address in the note before saving.
