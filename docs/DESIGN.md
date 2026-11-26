# Design

One visual language for the desktop console (`console/css/app.css`, `console/css/skin.css`), the
website (`web/css/site.css`) and the Android relay (`relay/android/app/src/main/res/values/colors.xml`).
It is a test bench: a dark instrument surface where color only appears when it means something.

## Color

| Token | Value | Meaning |
|---|---|---|
| Ink | `#05080d` | Background. The bench |
| Panel | `#0a1018` | Raised surfaces: figures, tables, the console's rail |
| Line | `#1b2737` | Dividers, grid, borders |
| Text | `#e8eef6` | Body and headings |
| Muted | `#93a3b8` (site), `#8c9db3` (console) | Captions, secondary text |
| Gold | `#ecb955` | Wi-Fi sensing energy: motion over the detection threshold. On the site also the one primary action per screen |
| RF blue | `#9cc6ff` | Radio structure: links, BLE, focus rings, text links |
| Violet | `#b9a8ff` | Simulated values. Used for nothing else, so a simulated number is never mistaken for a measurement |
| Lens green | `#00ff00` (relay), `#3dff62` (site drawing) | What the glasses show. Black is transparent on the lens |

## Type

- Display: Archivo Variable, wide (`font-stretch` 106 to 118 %), weight 750 to 800 for English headings and the wordmark.
- Body and Korean headings: IBM Plex Sans KR, 400 to 600. Korean text uses `word-break: keep-all`.
- Code only (topic names, commands): IBM Plex Mono. It is not used for labels.

The fonts ship with the app and the site (`desktop/scripts/fonts.mjs`); no font is loaded from
another host.

## Rules

- Say where a value came from. Anything simulated carries the violet marker or the word itself.
- Status is stated plainly, including what has not been done yet.
- Motion: one orchestrated moment per page (on the site, the link-crossing figure plays once).
  With reduced motion the figure shows its end state.
- No numbers, quotes or logos that the project cannot back up.
