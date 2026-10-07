import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import os from 'node:os';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

(async () => {
  let globalCamId = 'cam-to-replace';
  const LAN_IP = getLocalIP();
  
  console.log('Starting backend server on port 3001...');
  const server = spawn('node', ['src/server.js'], { env: { ...process.env, OMNICAM_PORT: '3001', NODE_ENV: 'test' } });
  
  server.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

  await new Promise(r => setTimeout(r, 2000));

  console.log('Starting Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  console.log('Task 8: Opening dashboard first...');
  const dashboard = await browser.newPage();
  const errors = [];
  dashboard.on('pageerror', err => errors.push(err.message));
  dashboard.on('console', msg => console.log('[DASHBOARD LOG]', msg.text()));
  await dashboard.goto(`https://${LAN_IP}:3001`);
  
  console.log('Fetching token...');
  const res = await fetch(`https://${LAN_IP}:3001/api/token`);
  const data = await res.json();
  
  const camUrl = new URL(data.url);
  camUrl.hostname = LAN_IP; // Use LAN IP (Task 2)
  
  console.log('Opening camera page (sender) on LAN IP:', camUrl.toString());
  const senderPage = await browser.newPage();
  await senderPage.goto(camUrl.toString());
  
  await senderPage.waitForSelector('#btn-start');
  await senderPage.click('#btn-start');
  
  await senderPage.waitForFunction(() => {
    const text = document.getElementById('status').innerText;
    return text.includes('Terautentikasi') || text.includes('WebRTC Terhubung');
  }, { timeout: 10000 });

  // Task 8: Check dashboard without reloading
  console.log('Checking dashboard for new camera card without reload...');
  await dashboard.bringToFront();
  
  // Wait for card to appear
  await dashboard.waitForSelector('.cam-card', { timeout: 10000 });
  const camIdText = await dashboard.$eval('.cam-card div[style*="font-size: 0.8em"]', el => el.innerText);
  globalCamId = camIdText.replace('ID: ', '').trim();
  console.log('Camera ID resolved from Dashboard:', globalCamId);
  
  // Assert telemetry and preview
  console.log('Waiting for telemetry to appear on dashboard...');
  await dashboard.waitForFunction((id) => {
    const el = document.getElementById(`telemetry-${id}`);
    return el && el.innerText.includes('fps');
  }, { timeout: 15000 }, globalCamId);
  
  console.log('Waiting for preview video on dashboard...');
  const dashboardVideoStats = await dashboard.evaluate((id) => {
    return new Promise(resolve => {
      const vid = document.getElementById(`preview-vid-${id}`);
      if (!vid) return resolve(null);
      
      let attempts = 0;
      const check = () => {
        attempts++;
        if (vid.videoWidth > 0) resolve({ width: vid.videoWidth });
        else if (attempts > 30) resolve({ width: 0, error: 'Timeout' });
        else setTimeout(check, 500);
      };
      check();
    });
  }, globalCamId);
  
  if (!dashboardVideoStats || dashboardVideoStats.width === 0) {
    throw new Error('Dashboard preview videoWidth is 0');
  }
  console.log('Dashboard preview works!');

  // Task 2: Real-network proof /view page
  console.log('Testing /view page over LAN IP...');
  const viewPage = await browser.newPage();
  await viewPage.goto(`https://${LAN_IP}:3001/view/index.html?camId=${globalCamId}`);
  await new Promise(r => setTimeout(r, 4000));
  
  await viewPage.evaluate(() => {
    const v = document.getElementById('video');
    if (v.paused) v.play().catch(e => console.error('E2E play err:', e));
  });

  const getVideoStats = async (p, elementId) => {
    return p.evaluate(async (elId) => {
      const video = document.getElementById(elId);
      let framesDecoded = 0;
      if (window.pc) {
        const stats = await window.pc.getStats();
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            framesDecoded = report.framesDecoded;
          }
        });
      }
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        currentTime: video.currentTime,
        framesDecoded
      };
    }, elementId);
  };

  let s1 = await getVideoStats(viewPage, 'video');
  await new Promise(r => setTimeout(r, 2000));
  let s2 = await getVideoStats(viewPage, 'video');
  
  console.log('View Page Sample 1:', s1);
  console.log('View Page Sample 2:', s2);
  
  if (s1.width === 0 || s1.height === 0) throw new Error('videoWidth/videoHeight is 0');
  if (s2.currentTime <= s1.currentTime) throw new Error('currentTime not advancing');
  if (s2.framesDecoded <= s1.framesDecoded) throw new Error('framesDecoded not advancing');
  
  console.log('Real network WebRTC test passed.');

  // Task 8 part 2: close phone page, assert offline
  console.log('Closing phone page...');
  await senderPage.close();
  
  console.log('Waiting for dashboard card to show Kamera terputus...');
  await dashboard.bringToFront();
  
  await dashboard.waitForFunction((id) => {
    const el = document.getElementById(`preview-placeholder-${id}`);
    return el && el.innerText.includes('Kamera terputus') && el.style.display !== 'none';
  }, { timeout: 15000 }, globalCamId);
  console.log('Dashboard correctly showed disconnected state.');

  console.log('E2E Test Passed!');
  await browser.close();
  server.kill();
  process.exit(0);
})();
