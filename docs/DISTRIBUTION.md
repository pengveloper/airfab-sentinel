# Distribution and Windows warnings

The goal is that someone can install Wavrel without Windows calling it an unknown
publisher and without an antivirus product stopping it. Design alone cannot guarantee that:
Windows SmartScreen decides by signature and reputation, not by what the code does. This page
records which channel meets the goal, which do not yet, and what is still to do.

## Channels

| Channel | SmartScreen | Cost | State |
|---|---|---|---|
| Microsoft Store (MSIX, re-signed by Microsoft) | No warning | Free for individual developers | Submitted for certification 2026-11-26 (below) |
| GitHub Releases, signed through SignPath Foundation | Publisher shown as SignPath Foundation; reputation carries over from their certificate | Free for open-source projects that are accepted | Needs a public repository and an application |
| GitHub Releases, unsigned portable zip | "Windows protected your PC" on first run | Free | Published from 0.5.0 by the `release` workflow, with SHA-256 checksums and the Defender report. Linked from wavrel.com |
| Build from source | None (nothing is downloaded as an executable from this project) | Free | `npm ci && npm start` |

Why the other options are not used:

- Azure Artifact Signing (formerly Trusted Signing) accepts individual developers only in the USA and Canada, and Microsoft's own guidance says it does not give instant SmartScreen trust.
- OV certificates cost roughly 150 to 300 USD a year and still start with warnings until downloads build reputation. EV certificates stopped bypassing SmartScreen in 2024.
- A self-signed certificate makes things worse for anyone but the author.

Source for the comparison: Microsoft Learn, "Code signing options for Windows app developers"
(https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options).

## Microsoft Store: the warning-free path

What the project already does:

- `npm run dist` produces `Wavrel-<version>-store.appx` on Windows. CI builds it on every push.
- The package declares only `runFullTrust` (required for a packaged desktop app) and `privateNetworkClientServer` (the hub listens on the LAN).
- The app does not update itself, so Store delivery is the single update path.

Progress:

| Step | State |
|---|---|
| Individual developer account | Registered 2026-11-24 |
| Name reserved | "Sentinel Lab", Store ID `9NVR2WGRQB9X` (a reservation lapses if nothing is submitted within three months). "Wavrel" reserved on the same product 2026-11-26 and set as its dashboard name |
| Package identity | `Pengveloper.SentinelLab`, set in `desktop/builder.config.js`; CI builds the package with it. The identity name stays the same after the rename, only the display name changes |
| Submission draft: pricing and availability | Done: free, all markets, public |
| Submission draft: properties | Done: Developer tools; declares that the app handles personal information (device names and identifiers from the user's own boards, processed locally); privacy policy entered as text hosted by Microsoft; OneDrive backup of app data turned off |
| Submission draft: age rating | Done: all ages in every system |
| Submission draft: submission options | Done: published only when "Publish now" is pressed after certification; reviewer notes entered under Additional testing information; runFullTrust justification entered |
| Submission draft: package | Done: `SentinelLab-0.3.0-store.appx`, validated (x64, Windows desktop only) |
| Store listing | Done for Korean and English, under the name Sentinel Lab: text, five screenshots each, seven search keywords |
| Submitted for certification | 2026-11-26 |
| Certification | Cancelled 2026-11-26 by the account owner's decision, so the app is not published under the old name. The submission is a draft again |
| Rename to Wavrel | Code and [STORE_LISTING.md](STORE_LISTING.md) renamed; "Wavrel" reserved. Next: in the same submission, replace the package with `Wavrel-0.4.0-store.appx`, update the listing text and screenshots, and submit again |
| Publish and first Store install | Not done. Because publishing is manual, the account owner presses "Publish now" after certification passes |

If certification fails, Partner Center gives the reason in the submission's certification
report; the fix goes into a new submission.

Partner Center accepts the privacy policy either as a URL or as text that Microsoft hosts. The
draft uses hosted text. The same policy is published at
https://wavrel.com/privacy/, next to the simulator demo at https://wavrel.com/demo/.

## Antivirus

No project can promise that every antivirus product stays quiet about a new, unsigned
executable. What this project does to stay out of trouble:

- No installer scripts, no packer or obfuscation, no self-update, no start-up entry, no request for administrator rights, no bundled third-party executables. The package is a stock Electron runtime plus an archive of JavaScript.
- CI scans the build output with Microsoft Defender on a clean runner and stores the scanner's report with the artifacts.
- Releases carry SHA-256 checksums so a download can be compared with what CI produced.
- If a product flags a release, the file is submitted to that vendor as a false positive (Microsoft: https://www.microsoft.com/wdsi/filesubmission) and the result is recorded here.

The Store package has the strongest position: Microsoft scans it during certification and signs it.

## Releases

`release` (`.github/workflows/release.yml`) is started by hand on `main` with the version, which
must match `package.json` and have a section in `CHANGELOG.md`. It runs the tests and the app smoke
test on Windows, packages the zip, scans it with Defender, builds the Android relay as a signed
release APK, and creates the release and its tag `v<version>`. Each release also carries
`Wavrel-win-x64.zip` and `Wavrel-Relay.apk` under fixed names, so
`https://github.com/pengveloper/wavrel/releases/latest/download/<name>` always gives the newest one.

The relay's signing key is made on the first release and kept in Parameter Store
(`/wavrel/relay-android/*`, SecureString); only the `aws` environment, which runs on `main` only,
can read it. If the key were lost, the next APK could not install over the old one.

## Verifying a download

```powershell
Get-FileHash .\Wavrel-win-x64.zip -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt` from the same CI run or release.

## Still to do

| Item | Blocked on |
|---|---|
| Store submission | Package upload and submission by the account owner |
| SignPath Foundation application | Application by the owner (the repository is public since 2026-11-25) |
| Tagged releases with build provenance attestation | Release workflow not written yet |
| First install and run on a real Windows PC outside CI | Operator |
