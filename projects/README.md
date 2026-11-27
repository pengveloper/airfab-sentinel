# Projects

Each project is one JSON file here: `<order>-<id>.json`. The Projects view in the app, the
browser demo and [wavrel.com/projects](https://wavrel.com/projects/) are all made from these files.

## Add one

1. Copy an existing file, give it the next order number and a new `id` (lowercase words joined by hyphens).
2. Fill in both languages. Every text field has `ko` and `en`.
3. Use parts from [`parts.json`](parts.json), or add the part there first.
4. Run `node tools/projects.mjs` to rebuild the app data and the two web pages, then `npm test`.
5. Send a pull request with the JSON file and the three rebuilt files.

## Fields

| Field | Meaning |
|---|---|
| `id`, `order` | Unique name and position in the list |
| `level` | 1 easy, 2 medium, 3 challenging |
| `minutes` | Rough time for someone doing it the first time |
| `demo` | `true` if the browser demo's simulator can show it |
| `status` | `OPERATOR_REQUIRED` until someone checks it on real hardware. `HARDWARE_VERIFIED` needs an `evidence` id (`EVD-…`) whose record is in [`evidence/`](../evidence/README.md), made on real boards, with every success criterion passed |
| `start` | Optional, `true` only. Offers the project in the getting-started guide the app shows on first open |
| `title`, `summary` | One line, then up to 400 characters |
| `learn`, `success` | Lists in both languages, same length. `success` is what you can see when it works |
| `parts` | Ids from `parts.json` |
| `firmware` | Name and `https://` link for each firmware or tool |
| `setup` | Optional. What "Set up for this project" does: `rules` to turn on or add (`when`: `motion` with a node or `*`, `enter` with a room, `quiet` with a node and `sec`; `then`: `led` with `#rrggbb` and `sec`, or `notify` with `info` or `alert`), `models` switches to turn on (`glass`, `gcam`), and the screen to `open`. It never turns anything off or deletes a rule |
| `steps` | 2 to 10 steps. `view` opens a screen of the app: `space`, `motion`, `presence`, `camera`, `rules`, `models`, `nodes`, `evidence` or `glass` |

The check refuses a file with a missing translation, an unknown part or screen, a plain `http://`
link, angle brackets in text, or a hardware claim without a passing record from real boards (T-PRJ-001 to 006).
