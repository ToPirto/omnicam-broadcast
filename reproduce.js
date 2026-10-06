import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

(async () => {
  console.log('Starting server...');
  const serverProcess = spawn('node', ['src/server.js'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '3000' }
  });

  serverProcess.stdout.on('data', d => console.log(`SERVER: ${d.toString().trim()}`));
  serverProcess.stderr.on('data', d => console.error(`SERVER ERROR: ${d.toString().trim()}`));

  // Wait for server to start
  await new Promise(r => setTimeout(r, 2000));

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--ignore-certificate-errors']
  });

  const page = await browser.newPage();
  
  // Intercept console messages
  page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

  console.log('Opening dashboard to get a pairing token...');
  await page.goto('https://127.0.0.1:3000/');
  await new Promise(r => setTimeout(r, 1000));

  console.log('Clicking Buat QR Baru...');
  await page.click('#btn-add');
  await new Promise(r => setTimeout(r, 1000));

  // Extract the pairing URL from the DOM
  const pairingUrl = await page.evaluate(() => {
    const linkEl = document.querySelector('#qr-container a');
    return linkEl ? linkEl.href : null;
  });

  if (!pairingUrl) {
    console.error('Could not find pairing URL');
    process.exit(1);
  }

  console.log('Pairing URL:', pairingUrl);

  const phonePage = await browser.newPage();
  phonePage.on('console', msg => console.log(`PHONE LOG: ${msg.text()}`));
  
  console.log('Opening phone page...');
  await phonePage.goto(pairingUrl);
  await new Promise(r => setTimeout(r, 1000));

  console.log('Clicking Mulai Kamera...');
  await phonePage.click('#btn-start');
  await new Promise(r => setTimeout(r, 2000));

  const status1 = await phonePage.evaluate(() => document.getElementById('status').innerText);
  console.log('Status after first connect:', status1);

  console.log('Refreshing phone page to simulate Wi-Fi drop/reload...');
  await phonePage.reload();
  await new Promise(r => setTimeout(r, 1000));

  console.log('Clicking Mulai Kamera again...');
  await phonePage.click('#btn-start');
  await new Promise(r => setTimeout(r, 2000));

  const status2 = await phonePage.evaluate(() => document.getElementById('status').innerText);
  console.log('Status after reconnect:', status2);

  await browser.close();
  serverProcess.kill();
})();
