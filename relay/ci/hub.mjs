// CI only: runs the desktop app's broker on this machine so the relay in the Android emulator
// can connect to it (the emulator reaches the host as 10.0.2.2). Alerts are published when the
// driver script drops a file named after one of the samples below into the trigger folder.
import fs from 'node:fs';
import path from 'node:path';
import { Hub } from '../../desktop/main/broker.mjs';

const dir = process.argv[2] || '/tmp/relay-ci';
const password = process.env.RELAY_CI_PASSWORD;
if (!password) { console.error('RELAY_CI_PASSWORD is not set'); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });

const samples = {
  motion: { kind: 'motion', level: 'alert', title: '거실 CSI: 움직임', body: '점수 1.16 · 임계값 0.5', ttl: 40, source: 'broker' },
  session: { kind: 'session', level: 'info', title: '검증 세션: 3번째 통과 감지', body: '감지 3 · 놓침 0 · 남은 통과 7', ttl: 40, source: 'built_in_simulator' },
};

const hub = new Hub({ getPassword: () => password, port: 1883, host: '0.0.0.0' });
await hub.start();
console.log('broker listening on', hub.status().port);
let clients = 0;
hub.on('clients', s => { if (s.clients.length !== clients) { clients = s.clients.length; console.log('clients:', clients, 'rejected logins:', s.counts.authRejected); } });

let n = 0;
setInterval(() => {
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('send-')) continue;
    const key = name.slice(5);
    fs.rmSync(path.join(dir, name), { force: true });
    const s = samples[key];
    if (!s) continue;
    const ok = hub.publish('lab/out/notify', JSON.stringify({ v: 1, id: `ci-${++n}`, ts: Date.now(), ...s }));
    console.log('published', key, ok);
    fs.writeFileSync(path.join(dir, 'status'), JSON.stringify(hub.status().counts));
  }
}, 200);
