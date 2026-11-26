#!/bin/bash
# Installs or updates the Wavrel relay server on its EC2 instance (Amazon Linux 2023, arm64).
# Run as root by the deploy workflow through SSM Run Command:
#   install.sh <commit> <unpacked server/ directory> <domain>
# Idempotent: every run brings the machine to the same state.
set -euo pipefail
umask 022

COMMIT="$1"; SRC="$2"; DOMAIN="$3"
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "bad commit" >&2; exit 2; }
[[ "$DOMAIN" =~ ^[a-z0-9.-]{3,253}$ ]] || { echo "bad domain" >&2; exit 2; }
[ -f "$SRC/main.mjs" ] || { echo "no server in $SRC" >&2; exit 2; }

CADDY_VERSION=2.11.7
CADDY_SHA512=3db36ba90c7a6e8dda40ee3dd71fa08844c76b5fb08f61b31e5e78d2ed38e71c51dc7baed875e50d1ca1279196e84302967237386ae87c91ae9f2aaceada682e
PARAMS=/wavrel/relay

imds() { local t; t=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60'); curl -fsS -H "X-aws-ec2-metadata-token: $t" "http://169.254.169.254/latest/meta-data/$1"; }
AWS_REGION=$(imds placement/region)
export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"

# 1. System packages. Security updates install themselves daily.
dnf -y -q install nodejs24 nodejs24-npm dnf-automatic tar gzip
sed -i 's/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer >/dev/null

# 2. Caddy (TLS with automatic Let's Encrypt certificates), pinned and checked.
if ! /usr/local/bin/caddy version 2>/dev/null | grep -q "^v$CADDY_VERSION "; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/caddy.tgz" "https://github.com/caddyserver/caddy/releases/download/v$CADDY_VERSION/caddy_${CADDY_VERSION}_linux_arm64.tar.gz"
  echo "$CADDY_SHA512  $tmp/caddy.tgz" | sha512sum -c --quiet -
  tar -xzf "$tmp/caddy.tgz" -C "$tmp" caddy
  install -m 0755 "$tmp/caddy" /usr/local/bin/caddy
  rm -rf "$tmp"
fi
id caddy >/dev/null 2>&1 || useradd --system --home-dir /var/lib/caddy --create-home --shell /sbin/nologin caddy
id wavrel >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin wavrel

install -d -m 0755 /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
{
	admin off
}

$DOMAIN {
	header {
		Strict-Transport-Security "max-age=63072000"
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		-Server
	}
	request_body {
		max_size 64KB
	}
	@relay path /health /rokid/sse /link
	handle @relay {
		reverse_proxy 127.0.0.1:8080 {
			flush_interval -1
		}
	}
	handle {
		respond 404
	}
}
EOF

cat > /etc/systemd/system/caddy.service <<'EOF'
[Unit]
Description=Caddy (TLS for the Wavrel relay server)
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
Environment=XDG_DATA_HOME=/var/lib XDG_CONFIG_HOME=/etc
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
TimeoutStopSec=5s
LimitNOFILE=65536
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/caddy
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# 3. Secrets: the deploy workflow creates them once in SSM Parameter Store (SecureString). They are
#    never written to the repository or printed; the owner reads them in the AWS console
#    (docs/ROKID_AGENT.md). The server loads them at start through the root-only script below.
install -d -m 0755 /opt/wavrel/bin /opt/wavrel/releases
cat > /opt/wavrel/bin/secrets <<EOF
#!/bin/bash
# Runs as root before the server starts: loads the two secrets into a root-only file in /run.
set -euo pipefail
export AWS_REGION=$AWS_REGION AWS_DEFAULT_REGION=$AWS_REGION
install -d -m 0700 /run/wavrel-relay
get() { aws ssm get-parameter --with-decryption --name "\$1" --query Parameter.Value --output text; }
umask 077
{ printf 'WAVREL_ROKID_AK=%s\n' "\$(get $PARAMS/rokid-ak)"; printf 'WAVREL_HOME_TOKEN=%s\n' "\$(get $PARAMS/home-token)"; } > /run/wavrel-relay/env
EOF
chmod 0700 /opt/wavrel/bin/secrets

# 4. The server itself, from the commit the workflow deployed.
REL=/opt/wavrel/releases/$COMMIT
if [ ! -f "$REL/.ready" ]; then
  rm -rf "$REL"; cp -r "$SRC" "$REL"
  (cd "$REL" && /usr/bin/npm-24 ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error)
  touch "$REL/.ready"
fi
ln -sfn "$REL" /opt/wavrel/current
ls -1dt /opt/wavrel/releases/* | tail -n +4 | xargs -r rm -rf

cat > /etc/systemd/system/wavrel-relay.service <<'EOF'
[Unit]
Description=Wavrel relay server (Rokid agent and home link)
After=network-online.target
Wants=network-online.target

[Service]
User=wavrel
Group=wavrel
ExecStartPre=+/opt/wavrel/bin/secrets
EnvironmentFile=-/run/wavrel-relay/env
WorkingDirectory=/opt/wavrel/current
ExecStart=/usr/bin/node-24 /opt/wavrel/current/main.mjs
Environment=NODE_ENV=production WAVREL_HOST=127.0.0.1 WAVREL_PORT=8080
Restart=always
RestartSec=2
MemoryMax=300M
NoNewPrivileges=true
CapabilityBoundingSet=
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable caddy wavrel-relay >/dev/null
systemctl restart wavrel-relay
systemctl restart caddy

for _ in $(seq 1 20); do curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8080/health >/dev/null
echo "wavrel relay $COMMIT is running"
