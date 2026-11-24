# Distribution and Windows warnings

The goal is that someone can install Sentinel Lab without Windows calling it an unknown
publisher and without an antivirus product stopping it. Design alone cannot guarantee that:
Windows SmartScreen decides by signature and reputation, not by what the code does. This page
records which channel meets the goal, which do not yet, and what is still to do.

## Channels

| Channel | SmartScreen | Cost | State |
|---|---|---|---|
| Microsoft Store (MSIX, re-signed by Microsoft) | No warning | Free for individual developers | Account registered and name reserved. Package builds in CI. Submission pending (below) |
| GitHub Releases, signed through SignPath Foundation | Publisher shown as SignPath Foundation; reputation carries over from their certificate | Free for open-source projects that are accepted | Needs a public repository and an application |
| GitHub Releases, unsigned portable zip | "Windows protected your PC" on first run | Free | Built in CI today. For developers who can verify the checksum |
| Build from source | None (nothing is downloaded as an executable from this project) | Free | `npm ci && npm start` |

Why the other options are not used:

- Azure Artifact Signing (formerly Trusted Signing) accepts individual developers only in the USA and Canada, and Microsoft's own guidance says it does not give instant SmartScreen trust.
- OV certificates cost roughly 150 to 300 USD a year and still start with warnings until downloads build reputation. EV certificates stopped bypassing SmartScreen in 2024.
- A self-signed certificate makes things worse for anyone but the author.

Source for the comparison: Microsoft Learn, "Code signing options for Windows app developers"
(https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options).

## Microsoft Store: the warning-free path

What the project already does:

- `npm run dist` produces `SentinelLab-<version>-store.appx` on Windows. CI builds it on every push.
- The package declares only `runFullTrust` (required for a packaged desktop app) and `privateNetworkClientServer` (the hub listens on the LAN).
- The app does not update itself, so Store delivery is the single update path.

Progress:

| Step | State |
|---|---|
| Individual developer account | Registered 2026-11-24 |
| Name reserved | "Sentinel Lab", Store ID `9NVR2WGRQB9X` (a reservation lapses if nothing is submitted within three months) |
| Package identity | `Pengveloper.SentinelLab`, set in `desktop/builder.config.js`; CI builds the package with it |
| Submission | Not started. Listing text is prepared in [STORE_LISTING.md](STORE_LISTING.md) |
| Certification and first Store install | Not done |

To submit: download `SentinelLab-<version>-store.appx` from the latest CI run (artifact
`sentinel-lab-windows`), start a submission in Partner Center, upload the package, paste the
listing text, answer the age-rating questionnaire, give a public privacy policy URL, and submit.
The privacy policy must be reachable without signing in, so it needs a public address
(this repository once it is public, or a page on a personal site).

## Antivirus

No project can promise that every antivirus product stays quiet about a new, unsigned
executable. What this project does to stay out of trouble:

- No installer scripts, no packer or obfuscation, no self-update, no start-up entry, no request for administrator rights, no bundled third-party executables. The package is a stock Electron runtime plus an archive of JavaScript.
- CI scans the build output with Microsoft Defender on a clean runner and stores the scanner's report with the artifacts.
- Releases carry SHA-256 checksums so a download can be compared with what CI produced.
- If a product flags a release, the file is submitted to that vendor as a false positive (Microsoft: https://www.microsoft.com/wdsi/filesubmission) and the result is recorded here.

The Store package has the strongest position: Microsoft scans it during certification and signs it.

## Verifying a download

```powershell
Get-FileHash .\SentinelLab-0.2.0-win-x64.zip -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt` from the same CI run or release.

## Still to do

| Item | Blocked on |
|---|---|
| Store submission | A public privacy policy URL, then upload and review by the account owner |
| SignPath Foundation application | Repository made public |
| Tagged releases with build provenance attestation | Repository made public |
| Public web demo (GitHub Pages) | Repository made public |
| First install and run on a real Windows PC outside CI | Operator |
