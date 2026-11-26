# Ask the home PC from anywhere (Rokid custom agent)

[한국어](ROKID_AGENT.ko.md)

Rokid glasses can send what you say to a "custom agent" of your own (the Lingzhu platform,
rizon.rokid.com). Wavrel's relay server is such an agent. It does not answer by itself: it passes
the question to the Wavrel desktop app at home, the model you picked there answers, and the answer
shows on the lens. The PC needs no public address and no open port, because the app keeps an
outgoing connection to the server.

```
glasses ─ Rokid cloud ─ HTTPS POST /rokid/sse (Bearer AK) ─┐
                                                           ├─ relay server (agent.wavrel.com)
Wavrel desktop app ── WSS /link (Bearer PC token), outgoing ─┘
        └─ lab/in/ask → chosen model (Ollama) → lab/out/notify → back up the link
```

The phone relay (Wavrel Relay) is not involved. Use it at home; use this when you are out.

## What travels where

| Data | Where it goes | Kept |
|---|---|---|
| The newest thing you said (up to 300 characters) | Rokid cloud → server → your PC | Not stored on the server; the PC shows it in the Models view |
| Earlier turns, photos, location, weather, battery that the platform sends | Dropped by the server as soon as the request is parsed | Never |
| The answer (up to 400 characters; the app keeps it under 90) | PC → server → Rokid cloud → glasses | Not stored on the server |
| Server logs | Path, status and duration only | systemd journal on the instance |

## Security

- **Two separate secrets** in SSM Parameter Store (SecureString, Seoul): `/wavrel/relay/rokid-ak`
  for the Rokid platform and `/wavrel/relay/home-token` for the desktop app. The deploy workflow
  creates them once from a random source and never prints them. Neither one opens the other's door.
- **Brute force**: ten wrong keys from one address in ten minutes block it for fifteen minutes.
- **One answering PC**: the first app to connect answers; another PC with the same token waits and
  takes over when the first disconnects (close code 4001). A silent connection is dropped within a minute.
- **What the link can do**: carry a question down and its answer up. The app turns a question into
  `lab/in/ask` for its own window and sends back only the alert published for that question within
  50 seconds. The link cannot publish to the hub, change settings or reach anything else on the PC.
- **In the app**: the address must be `wss://` (or `ws://` to the PC itself, for a local test). The
  token is sealed with the OS credential store like the hub password, the field is cleared after
  saving and the window never gets it back.
- **Server**: Amazon Linux 2023 on one t4g.micro, Caddy for TLS (Let's Encrypt, pinned version with a
  checked SHA-512), Node.js under a locked-down systemd unit, security updates applied daily. No SSH
  key and no port 22; the workflow installs each commit through SSM Run Command. The instance role
  can only read its two parameters.

## Set it up (wavrel.com owner)

1. **Server.** Merging to `main` runs the `server` workflow, which creates the `wavrel-relay` stack
   ([infra/server.yml](../infra/server.yml)), the two secrets, and installs the server.
2. **DNS.** In Cloudflare, add `agent` → the `PublicIp` the workflow prints, type A, **DNS only**.
   Caddy fetches the certificate by itself within a minute. Re-run the workflow to see the check pass.
3. **Copy the two values.** AWS console → Systems Manager → Parameter Store (Seoul) → open each
   parameter → Show decrypted value.
4. **Rokid platform.** Sign in to developer.rokid.com (real-name verification is required), then on
   rizon.rokid.com create a third-party agent of type "custom agent" (自定义智能体):
   URL `https://agent.wavrel.com/rokid/sse`, authentication Bearer Token, AK = the `rokid-ak` value.
   Do **not** submit it for review (提审): an agent that was never submitted stays private to you.
5. **Desktop app.** Models view → 밖에서 묻기 (Ask from anywhere): address
   `wss://agent.wavrel.com/link`, PC token = the `home-token` value, Save and connect. Turn on
   "Answer questions from phone and glasses" above it and pick the model.
6. **Try it.** On the glasses, switch to your agent and ask something. The question appears in the
   Models view and the answer on the lens. If the PC is off, the lens says so.

## Run your own

Fork the repository, deploy [infra/bootstrap.yml](../infra/bootstrap.yml) once, set the repository
variable `AWS_DEPLOY_ROLE_ARN`, change `DOMAIN` in [.github/workflows/server.yml](../.github/workflows/server.yml)
and follow the steps above with your own domain. The server is about USD 10 a month (t4g.micro,
its public IPv4 address and an 8 GB disk).

## Protocol notes

The request and event formats follow Rokid's public examples and community bridges: a JSON POST
with `message_id`, `agent_id`, `message[]` and `metadata`, answered as `event:message` /
`data:{…}` events with `answer_stream` and a final empty event with `is_finish: true`. The server
sends a `: keepalive` comment at once and every five seconds while the PC thinks. A question that is
only a photo gets a short note asking to say it out loud; no picture is fetched.

## Tests and status

T-SRV-001…010 and T-LNK-001 (`tests/server.test.mjs`) run a real server and the desktop link
against each other: format, keys, blocking, timeouts, the waiting second PC, retried requests and
photos. The app smoke test connects the real Electron app to a local server and checks that a
Rokid-style request is answered by the chosen model and that the token is not stored in clear text.

Not yet checked with the real Rokid platform and glasses: **OPERATOR_REQUIRED**.
