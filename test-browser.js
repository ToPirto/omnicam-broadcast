import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';

(async () => {
  let globalCamId = 'cam-to-replace';

  console.log('Starting backend server on port 3001...');
  const server = spawn('node', ['src/server.js'], { env: { ...process.env, OMNICAM_PORT: '3001', TEST_E2E: '1' } });
  
  server.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 2000));

  console.log('Starting Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[PAGE LOG]', msg.text()));
  
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  console.log('Fetching token...');
  const res = await fetch('https://127.0.0.1:3001/api/token');
  const data = await res.json();
  
  const camUrl = new URL(data.url);
  camUrl.hostname = '127.0.0.1';
  
  console.log('Opening camera page:', camUrl.toString());
  await page.goto(camUrl.toString());
  
  console.log('Waiting for start button...');
  await page.waitForSelector('#btn-start');
  await page.click('#btn-start');
  
  console.log('Waiting for connection...');
  await page.waitForFunction(() => {
    const text = document.getElementById('status').innerText;
    return text.includes('Terautentikasi') || text.includes('WebRTC Terhubung');
  }, { timeout: 10000 });
  
  console.log('Opening dashboard to get camId...');
  const dashboard = await browser.newPage();
  await dashboard.goto('https://127.0.0.1:3001');
  
  // Wait a bit for cameras to populate
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    const camIdText = await dashboard.$eval('.cam-card div[style*="font-size: 0.8em"]', el => el.innerText);
    globalCamId = camIdText.replace('ID: ', '').trim();
    console.log('Camera ID resolved from Dashboard:', globalCamId);
  } catch (e) {
    console.log('Could not find .cam-card on dashboard. Fetching via API...');
    const res2 = await fetch('https://127.0.0.1:3001/api/cameras');
    const cams = await res2.json();
    if (cams.length > 0) {
      globalCamId = cams[0].id;
      console.log('Camera ID resolved from API:', globalCamId);
    } else {
      console.log('No cameras found via API. Exiting.');
      process.exit(1);
    }
  }
  
  let borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('Initial border class:', borderClass);

  const setTally = async (state) => {
    const r = await fetch('https://127.0.0.1:3001/api/test/tally', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ camId: globalCamId, state })
    });
    const result = await r.json();
    console.log('Tally API response for state', state, ':', result);
    await new Promise(r => setTimeout(r, 1000)); // wait for WS propagation
  };

  console.log('Switching to Preview...');
  await setTally(1);
  borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('After Preview border class:', borderClass);
  if (!borderClass.includes('tally-green')) throw new Error('Expected tally-green');
  
  console.log('Switching to Program...');
  await setTally(2);
  borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('After Program border class:', borderClass);
  if (!borderClass.includes('tally-red')) throw new Error('Expected tally-red');

  console.log('Switching to Off...');
  await setTally(0);
  borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('After Off border class:', borderClass);
  if (!borderClass.includes('tally-grey')) throw new Error('Expected tally-grey');

  console.log('E2E Test Passed!');
  await browser.close();
  server.kill();
  process.exit(0);
})();
