# Website (wavrel.com)

wavrel.com is a static site on AWS: a private S3 bucket behind CloudFront. There is no server
and no runtime code on AWS. The pages are plain HTML and CSS; the demo at `/demo/` is the
console with its built-in simulator, the same files the desktop app ships.

| Path | Source |
|---|---|
| `/` (Korean), `/en/` (English) | `web/index.html`, `web/en/index.html` |
| `/demo/` | `console/` |
| `/privacy/` | `web/privacy/index.html` |
| 404 | `web/404.html` |
| `/fonts/`, `/css/fonts.css` | the bundled typefaces (`desktop/scripts/fonts.mjs`) |

`node tools/site.mjs` assembles all of it into `_site/`. Design tokens: [DESIGN.md](DESIGN.md).

## Deploying

The `web` workflow deploys on every push to `main` that touches the site, and on demand. It
holds no AWS keys. It asks GitHub for an OpenID Connect token and exchanges it for the
`wavrel-github-deploy` role, which trusts only this repository's `aws` environment, matched by
GitHub's numeric owner and repository IDs so a renamed or re-created repository cannot borrow it.
The role ARN is the repository variable `AWS_DEPLOY_ROLE_ARN`; the `aws` environment allows
only `main` (and the branch that first set the site up).

Each run:

1. creates or updates the certificate stack `wavrel-web-cert` (ACM, us-east-1, DNS validation)
   and waits until the certificate is issued,
2. creates or updates the site stack `wavrel-web` ([infra/web.yml](../infra/web.yml)),
3. uploads `_site/` (HTML and other text files are revalidated on every visit; fonts and images
   are cached for a week), invalidates CloudFront and checks that the pages answer.

## What the role may do

[infra/bootstrap.yml](../infra/bootstrap.yml) creates the role once, by hand, in CloudShell.
Its rights are limited to resources named or tagged for Wavrel: CloudFormation stacks
`wavrel-*`, S3 buckets `wavrel-*`, CloudFront and ACM, EC2 and SSM only on resources tagged
`project=wavrel`, SSM parameters under `/wavrel/`. It can create IAM roles only under
`wavrel-relay-*` and only with the `wavrel-relay-boundary` permissions boundary attached, and it
cannot remove that boundary. The bootstrap stack itself is named outside the `wavrel-*` prefix,
so the role cannot change its own trust or rights.

## Edge settings

- TLS 1.2 or newer, HTTP/2 and HTTP/3. `www.wavrel.com` redirects to `wavrel.com`.
- Response headers: HSTS (two years), `nosniff`, no framing, a strict referrer policy, and a
  content security policy that allows scripts, styles and fonts from the site itself only.
  `connect-src` allows `ws:`/`wss:` for the demo's optional broker connection.
- The bucket is reachable only through CloudFront (origin access control) and only over HTTPS.

## DNS

The domain is registered with Cloudflare. Its DNS has, all set to "DNS only" so traffic goes
straight to CloudFront:

| Name | Type | Target |
|---|---|---|
| `wavrel.com` | CNAME (flattened at the apex) | the distribution's `*.cloudfront.net` name |
| `www` | CNAME | the same name |
| two `_…` records | CNAME | ACM validation records for the certificate |

The workflow prints the distribution name and the validation records when it creates them.

## Old address

`pengveloper.github.io/airfab-sentinel/` (GitHub Pages) now only forwards to the same page on
wavrel.com; see `.github/workflows/pages.yml`.
