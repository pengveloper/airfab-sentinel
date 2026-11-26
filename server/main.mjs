// Starts the relay server. Secrets come from the environment (systemd loads them from SSM
// Parameter Store into a root-only file at boot); they are never printed.
import { createApp } from './app.mjs';

const port = Number(process.env.WAVREL_PORT) || 8080;
const host = process.env.WAVREL_HOST || '127.0.0.1';
const app = createApp({
  rokidAk: process.env.WAVREL_ROKID_AK,
  homeToken: process.env.WAVREL_HOME_TOKEN,
  log: e => process.stdout.write(JSON.stringify({ t: new Date().toISOString(), ...e }) + '\n'),
});
delete process.env.WAVREL_ROKID_AK;
delete process.env.WAVREL_HOME_TOKEN;

app.server.listen(port, host, () => process.stdout.write(`wavrel relay listening on ${host}:${port}\n`));
const stop = () => app.close().then(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
