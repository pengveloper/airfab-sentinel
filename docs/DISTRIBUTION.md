# Distribution and Windows warnings

The goal is that someone can install Sentinel Lab without Windows calling it an unknown
publisher and without an antivirus product stopping it. Design alone cannot guarantee that:
Windows SmartScreen decides by signature and reputation, not by what the code does. This page
records which channel meets the goal, which do not yet, and what is still to do.

## Channels

| Channel | SmartScreen | Cost | State |
|---|---|---|---|
| Microsoft Store (MSIX, re-signed by Microsoft) | No warning | Free for individual developers | Package builds in CI. Submission needs a developer account (below) |
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

What the account owner does once:

1. Register as an individual developer at https://storedeveloper.microsoft.com with a personal Microsoft account. Registration is free.
2. In Partner Center, reserve the name "Sentinel Lab" and open Product identity. Note the three values: Package/Identity/Name, Package/Identity/Publisher, and Publisher display name.
3. In this repository, add them as Actions variables: `APPX_IDENTITY_NAME`, `APPX_PUBLISHER`, `APPX_PUBLISHER_DISPLAY_NAME`. The next CI run builds a package with the real identity.
4. Create a submission, upload the `.appx` from the CI artifact, fill in the listing, and link [PRIVACY.md](../PRIVACY.md) as the privacy policy.
5. Submit for certification. Microsoft tests the package and scans it before it is listed.

Until step 3 is done, the package is built with placeholder identity values and is useful only for checking that packaging works.

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
| Store submission | Developer account and reserved name |
| SignPath Foundation application | Repository made public |
| Tagged releases with build provenance attestation | Repository made public |
| Public web demo (GitHub Pages) | Repository made public |
| First install and run on a real Windows PC outside CI | Operator |
