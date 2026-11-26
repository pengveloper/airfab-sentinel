// 카메라 사진 한 장 받기 (desktop/main/camera.mjs): 집 안 망의 IP 주소만, JPEG만, 3MB까지, 넘겨주기 없이.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { snapshotUrl, takeSnapshot, CAMERA_LIMITS } from '../desktop/main/camera.mjs';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

async function camera(handler) {
  const server = http.createServer(handler);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}

test('T-CAM-001 스트림 주소를 사진 주소로 바꾸고, 집 안 망 IP가 아닌 주소는 받지 않는다', () => {
  assert.equal(snapshotUrl('http://192.168.0.31:81/stream'), 'http://192.168.0.31/snapshot.jpg');
  assert.equal(snapshotUrl('http://192.168.0.31/'), 'http://192.168.0.31/snapshot.jpg');
  assert.equal(snapshotUrl('http://10.0.0.7:8080/capture'), 'http://10.0.0.7:8080/capture');
  assert.equal(snapshotUrl('http://127.0.0.1:9000/cam.jpg'), 'http://127.0.0.1:9000/cam.jpg');
  for (const bad of ['https://192.168.0.31/snapshot.jpg', 'http://camera.local/snapshot.jpg', 'http://8.8.8.8/snapshot.jpg', 'http://u:p@192.168.0.31/', 'file:///etc/passwd', '', 'nonsense'])
    assert.equal(snapshotUrl(bad), null, bad);
});

test('T-CAM-002 JPEG만 받고, 크거나 늦거나 다른 곳으로 넘기는 카메라는 거절한다', async () => {
  const cam = await camera((req, res) => {
    if (req.url === '/ok.jpg') { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(JPEG); }
    if (req.url === '/text.jpg') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>'); }
    if (req.url === '/big.jpg') { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(Buffer.alloc(CAMERA_LIMITS.bytes + 10, 0xff)); }
    if (req.url === '/moved.jpg') { res.writeHead(302, { location: 'http://8.8.8.8/x.jpg' }); return res.end(); }
    if (req.url === '/slow.jpg') return;   // never answers
    res.writeHead(404); res.end();
  });
  try {
    const ok = await takeSnapshot(cam.base + '/ok.jpg');
    assert.equal(ok.ok, true); assert.equal(ok.bytes, JPEG.length); assert.equal(Buffer.from(ok.b64, 'base64').equals(JPEG), true);
    assert.equal((await takeSnapshot(cam.base + '/text.jpg')).error, 'NOT_JPEG');
    assert.equal((await takeSnapshot(cam.base + '/big.jpg')).error, 'TOO_LARGE');
    assert.equal((await takeSnapshot(cam.base + '/moved.jpg')).error, 'UNREACHABLE', 'redirects are not followed');
    assert.equal((await takeSnapshot(cam.base + '/none.jpg')).error, 'UNREACHABLE');
    assert.equal((await takeSnapshot(cam.base + '/slow.jpg', { timeoutMs: 200 })).error, 'TIMEOUT');
    assert.equal((await takeSnapshot('http://8.8.8.8/snapshot.jpg')).error, 'BAD_URL');
  } finally { await cam.close(); }
});
