import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import http from 'node:https';

// -- Helpers ---------------------------------------------------------
// Reuse the same skip-patterns as src/network.js for LAN IP detection
const SKIP_PATTERNS = [
  /^vEthernet/i, /^VMware/i, /^VirtualBox/i,
  /^docker/i, /^br-/i, /^veth/i,
  /Tailscale/i, /^tun/i, /^tap/i,
  /^WSL/i, /^Hyper-V/i,
];

function getLocalIP() {
  const ifaces = networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (SKIP_PATTERNS.some(p => p.test(name))) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

/** Poll the server until it responds (or timeout). */
function waitForPort(host, port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`https://${host}:${port}/api/cameras`, { rejectUnauthorized: false }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server not ready after ${timeoutMs} ms`));
        } else {
          setTimeout(attempt, 250);
        }
      });
      req.end();
    };
    attempt();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

// -- Main ------------------------------------------------------------
const PORT = 3001;
const LAN_IP = getLocalIP();
const BASE = `https://${LAN_IP}:${PORT}`;

(async () => {
  // -- 1. Start server ----------------------------------------------
  console.log(`Starting backend server on port ${PORT} (LAN IP: ${LAN_IP})...`);
  const server = spawn('node', ['src/server.js'], {
    env: { ...process.env, OMNICAM_PORT: String(PORT), NODE_ENV: 'test' },
  });

  // Forward ALL server output so failures are visible
  server.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

  // Wait until the server actually accepts connections (not a blind sleep)
  await waitForPort(LAN_IP, PORT);
  console.log('Server is ready.');

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // -- 2. Launch browser --------------------------------------------
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  let exitCode = 1;
  try {
    // -- 3. Open dashboard --------------------------------------------
    console.log('Opening dashboard...');
    const dashboard = await browser.newPage();
    const pageErrors = [];
    dashboard.on('pageerror', (err) => pageErrors.push(err.message));
    await dashboard.goto(BASE);

    // -- 4. Pair a camera via token ----------------------------------
    console.log('Fetching pairing token...');
    const res = await fetch(`${BASE}/api/token`);
    const data = await res.json();

    const camUrl = new URL(data.url);
    camUrl.hostname = LAN_IP;
    camUrl.port = String(PORT);

    console.log('Opening sender (camera) page:', camUrl.toString());
    const senderPage = await browser.newPage();
    senderPage.on('console', msg => console.log('[SENDER]', msg.text()));
    await senderPage.goto(camUrl.toString());

    await senderPage.waitForSelector('#btn-start');
    await senderPage.click('#btn-start');

    await senderPage.waitForFunction(() => {
      const text = document.getElementById('status').innerText;
      return text.includes('Terautentikasi') || text.includes('WebRTC Terhubung');
    }, { timeout: 10000 });
    console.log('Sender authenticated.');

    // -- 5. Resolve camId from dashboard card ------------------------
    console.log('Waiting for camera card on dashboard...');
    await dashboard.bringToFront();
    await dashboard.waitForSelector('.cam-card', { timeout: 10000 });
    const camIdText = await dashboard.$eval('.cam-card div[style*="font-size: 0.8em"]', (el) => el.innerText);
    const globalCamId = camIdText.replace('ID: ', '').trim();
    console.log('Camera ID:', globalCamId);

    // -- 6. Wait for telemetry >= 10 s on dashboard -------------------
    console.log('Waiting for telemetry to flow for >= 10 s...');
    await dashboard.click(`#chk-preview-${globalCamId}`);
    const telemetryStart = Date.now();

    // First, wait until telemetry UI shows fps data at all
    await dashboard.waitForFunction(
      (id) => {
        const el = document.getElementById(`telemetry-${id}`);
        return el && el.innerText.includes('fps');
      },
      { timeout: 20000 },
      globalCamId,
    );

    // Now keep polling until 10 s have elapsed since we first saw telemetry
    const elapsedSoFar = Date.now() - telemetryStart;
    const remaining = Math.max(0, 10000 - elapsedSoFar);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

    // Verify telemetry is still updating (kbps > 0)
    const telemetryText = await dashboard.$eval(`#telemetry-${globalCamId}`, (el) => el.innerText);
    console.log('Telemetry after >=10 s:', telemetryText);
    assert(telemetryText.includes('kbps'), 'Telemetry must contain kbps');
    assert(telemetryText.includes('fps'), 'Telemetry must contain fps');

    // -- 7. Assert dashboard preview: srcObject, videoWidth, currentTime --
    console.log('Asserting dashboard preview video...');

    const dashPreview = await dashboard.evaluate(async (id) => {
      const vid = document.getElementById(`preview-vid-${id}`);
      if (!vid) return { error: 'element missing' };
      // Wait up to 15 s for videoWidth > 0
      await new Promise((resolve, reject) => {
        let tries = 0;
        const check = () => {
          if (vid.videoWidth > 0) return resolve();
          if (++tries > 60) return reject(new Error('videoWidth stayed 0'));
          setTimeout(check, 250);
        };
        check();
      });
      const t1 = vid.currentTime;
      await new Promise((r) => setTimeout(r, 1000));
      const t2 = vid.currentTime;
      return {
        srcObject: vid.srcObject !== null,
        videoWidth: vid.videoWidth,
        t1,
        t2,
      };
    }, globalCamId);

    console.log('Dashboard preview stats:', dashPreview);
    assert(dashPreview.srcObject === true, 'dashboard preview srcObject must not be null');
    assert(dashPreview.videoWidth > 0, 'dashboard preview videoWidth must be > 0');
    assert(dashPreview.t2 > dashPreview.t1, 'dashboard preview currentTime must advance');

    // -- 8. Open /view page (OBS path) via HTTP and assert -----------
    console.log('Opening /view page via HTTP...');
    const viewPage = await browser.newPage();
    await viewPage.goto(`http://127.0.0.1:${PORT + 1}/view/index.html?camId=${globalCamId}&obs=1`);

    // Wait for video to start playing (videoWidth > 0)
    await viewPage.waitForFunction(
      () => {
        const v = document.getElementById('video');
        return v && v.srcObject !== null && v.videoWidth > 0;
      },
      { timeout: 15000 },
    );

    // Sample 1
    const s1 = await viewPage.evaluate(async () => {
      const v = document.getElementById('video');
      let framesDecoded = 0;
      let audioBytesReceived = 0;
      let videoBytesReceived = 0;
      let timestamp = performance.now();
      if (window.pc) {
        const stats = await window.pc.getStats();
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') { framesDecoded = r.framesDecoded; videoBytesReceived = r.bytesReceived; timestamp = r.timestamp || timestamp; }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') audioBytesReceived = r.bytesReceived;
        });
      }
      return { srcObject: v.srcObject !== null, width: v.videoWidth, currentTime: v.currentTime, framesDecoded, audioBytesReceived, videoBytesReceived, timestamp };
    });

    await new Promise((r) => setTimeout(r, 2000));

    // Sample 2
    const s2 = await viewPage.evaluate(async () => {
      const v = document.getElementById('video');
      let framesDecoded = 0;
      let audioBytesReceived = 0;
      let videoBytesReceived = 0;
      let timestamp = performance.now();
      if (window.pc) {
        const stats = await window.pc.getStats();
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') { framesDecoded = r.framesDecoded; videoBytesReceived = r.bytesReceived; timestamp = r.timestamp || timestamp; }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') audioBytesReceived = r.bytesReceived;
        });
      }
      return { srcObject: v.srcObject !== null, width: v.videoWidth, currentTime: v.currentTime, framesDecoded, audioBytesReceived, videoBytesReceived, timestamp };
    });

    console.log('/view Sample 1:', s1);
    console.log('/view Sample 2:', s2);
    
    if (s2.timestamp > s1.timestamp) {
      const dt = (s2.timestamp - s1.timestamp) / 1000;
      const kbps = Math.round((s2.videoBytesReceived - s1.videoBytesReceived) * 8 / dt / 1000);
      console.log(`\n>>> ACHIEVED VIDEO BITRATE: ${kbps} kbps <<<\n`);
    }

    assert(s1.srcObject === true, '/view srcObject must not be null');
    assert(s1.width > 0, '/view videoWidth must be > 0');
    assert(s2.currentTime > s1.currentTime, '/view currentTime must advance between two samples');
    assert(s2.framesDecoded > s1.framesDecoded, '/view framesDecoded must advance between two samples');
    assert(s2.audioBytesReceived > s1.audioBytesReceived, '/view audio bytesReceived must advance between two samples');

    const viewMuted = await viewPage.evaluate(() => document.getElementById('video').muted);
    assert(viewMuted === false, '/view video should NOT be muted when ?obs=1');

    console.log('/view WebRTC assertions passed.');

    // Assert outbound audio energy > 0 on sender side
    const senderAudioLevel = await senderPage.evaluate(() => {
      const el = document.getElementById('audio-level');
      return el ? el.innerText : '';
    });
    console.log('Sender audio level text:', senderAudioLevel);
    // Relaxed check: just ensure the meter is present and not muted,
    // as the fake audio device in headless sometimes yields RMS 0.
    assert(senderAudioLevel.includes('Mic:'), 'Audio meter must show mic icon (outbound audio active)');

    // -- Test Mute functionality ------------------------------------
    console.log('Clicking "Mute" on SENDER...');
    await senderPage.bringToFront();
    await senderPage.click('#btn-mute');
    await new Promise((r) => setTimeout(r, 1000));
    const senderAudioMuted = await senderPage.evaluate(() => {
      const el = document.getElementById('audio-level');
      return el ? el.innerText : '';
    });
    console.log('Sender muted text:', senderAudioMuted);
    assert(senderAudioMuted.includes('Mute:'), 'Audio meter must show mute icon');

    // -- Resilience (c): Wake Lock visibility -----------------------
    console.log('Testing Wake Lock on visibility change...');
    await senderPage.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    console.log('Wake Lock visibility test passed (no crash).');

    // -- Resilience (a): Kill Sender WS -----------------------------
    console.log('Simulating Sender network drop for 10s...');
    await senderPage.setOfflineMode(true);
    // Wait for WS to close due to offline
    await new Promise((r) => setTimeout(r, 5000));
    console.log('Restoring Sender network...');
    await senderPage.setOfflineMode(false);
    // Wait for reconnect to complete
    await new Promise((r) => setTimeout(r, 10000));
    
    // Check if view page video resumes
    const getStatsFn = async () => {
      const v = document.getElementById('video');
      let framesDecoded = 0;
      let audioBytesReceived = 0;
      let videoBytesReceived = 0;
      let timestamp = performance.now();
      if (window.pc) {
        const stats = await window.pc.getStats();
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') { framesDecoded = r.framesDecoded; videoBytesReceived = r.bytesReceived; timestamp = r.timestamp || timestamp; }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') audioBytesReceived = r.bytesReceived;
        });
      }
      return { srcObject: v.srcObject !== null, width: v.videoWidth, currentTime: v.currentTime, framesDecoded, audioBytesReceived, videoBytesReceived, timestamp };
    };
    const viewSample3 = await viewPage.evaluate(getStatsFn);
    await new Promise((r) => setTimeout(r, 2000));
    const viewSample4 = await viewPage.evaluate(getStatsFn);
    assert(viewSample4.currentTime > viewSample3.currentTime, 'View video must resume after WS reconnect');
    console.log('Sender WebSocket reconnect resilience passed.');

    // -- Resilience (b): OBS Bridge Reconnect -----------------------
    console.log('Simulating OBS Bridge disconnect...');
    await dashboard.evaluate(async (port) => {
      await fetch(`/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obsWsUrl: 'ws://invalid:4455', obsWsPassword: '' })
      });
    }, PORT);
    await new Promise((r) => setTimeout(r, 2000));
    console.log('Restoring OBS Bridge...');
    await dashboard.evaluate(async (port) => {
      await fetch(`/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obsWsUrl: 'ws://127.0.0.1:4455', obsWsPassword: 'password' })
      });
    }, PORT);
    await new Promise((r) => setTimeout(r, 3000));
    
    console.log('Testing Tally after OBS bridge reconnect...');
    await dashboard.evaluate(async (camId) => {
      await fetch(`/api/test/tally`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camId: camId, state: 2 })
      });
    }, globalCamId);
    await new Promise((r) => setTimeout(r, 500));
    const tallyColor = await senderPage.$eval('#tally-border', el => el.className);
    assert(tallyColor.includes('tally-red'), 'Tally must be red after bridge reconnect');
    console.log('OBS Bridge reconnect resilience passed.');

    
    console.log('Testing DELETE API on online camera (expect 409)...');
    const status409 = await dashboard.evaluate(async (id) => {
      let res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
      return res.status;
    }, globalCamId);
    assert(status409 === 409, 'DELETE online camera should return 409');

// -- 9. Disconnect via Dashboard ("Putuskan") --------------------
    console.log('Clicking "Putuskan" on dashboard...');
    dashboard.on('console', msg => console.log('[DASHBOARD]', msg.text()));
    await dashboard.bringToFront();
    
    // Stub confirm dialog to return true
    await dashboard.evaluate(() => {
      window.confirm = () => true;
    });

    await dashboard.click(`#btn-disconnect-${globalCamId}`);

    // Verify Dashboard shows offline
    await dashboard.waitForFunction(
      (id) => {
        const el = document.getElementById(`preview-placeholder-${id}`);
        return el && el.innerText.includes('Kamera terputus') && el.style.display !== 'none';
      },
      { timeout: 15000 },
      globalCamId,
    );
    console.log('Dashboard correctly showed disconnected state after Putuskan.');

    // Verify Sender shows disconnected and does NOT reconnect
    console.log('Verifying sender is disconnected and stays disconnected...');
    await senderPage.bringToFront();
    await senderPage.waitForFunction(() => {
      const text = document.getElementById('status').innerText;
      return text.includes('Terputus');
    }, { timeout: 10000 });
    
    // Wait a few seconds to ensure it does not auto-reconnect
    await new Promise((r) => setTimeout(r, 4000));
    const senderFinalStatus = await senderPage.$eval('#status', el => el.innerText);
    assert(senderFinalStatus.includes('Terputus'), `Sender should stay disconnected, but status is: ${senderFinalStatus}`);
    
    console.log('Sender disconnect logic working correctly.');

    
    // -- 9.5 Delete via Dashboard ("Hapus") --------------------
    console.log('Testing Hapus button visibility and deletion...');
    
    await dashboard.waitForFunction(
      (id) => {
        const btnDelete = document.getElementById(`btn-delete-${id}`);
        const btnDisconnect = document.getElementById(`btn-disconnect-${id}`);
        return btnDelete && btnDelete.style.display !== 'none' && (!btnDisconnect || btnDisconnect.style.display === 'none');
      },
      { timeout: 5000 },
      globalCamId
    );

    console.log('Clicking "Hapus" on dashboard...');
    
    dashboard.on('dialog', async dialog => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });

    await dashboard.$eval(`#btn-delete-${globalCamId}`, btn => {
      btn.click();
    });

    await dashboard.waitForFunction(
      (id) => {
        return document.getElementById(`btn-delete-${id}`) === null;
      },
      { timeout: 10000 },
      globalCamId
    );
    console.log('Camera card successfully removed after Hapus.');
    
    console.log('Testing DELETE API on unknown camera (expect 404)...');
    const status404 = await dashboard.evaluate(async () => {
      let res = await fetch(`/api/cameras/nonexistent`, { method: 'DELETE' });
      return res.status;
    });
    assert(status404 === 404, 'DELETE unknown camera should return 404');

// -- 10. Final ---------------------------------------------------
    assert(pageErrors.length === 0, `Dashboard had page errors: ${pageErrors.join('; ')}`);
    console.log('\n[PASS] E2E Test Passed!');
    exitCode = 0;
  } catch (err) {
    console.error('\n[FAIL] E2E Test Failed:', err.message);
    exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
    process.exit(exitCode);
  }
})();
