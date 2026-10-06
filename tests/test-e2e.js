import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

(async () => {
  console.log('Starting server...');
  const serverProcess = spawn('node', ['src/server.js'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '3000' }
  });

  serverProcess.stdout.on('data', d => console.log(`SERVER: ${d.toString().trim()}`));
  serverProcess.stderr.on('data', d => console.error(`SERVER ERROR: ${d.toString().trim()}`));

  await new Promise(r => setTimeout(r, 2000));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--ignore-certificate-errors']
  });

  const dashPage = await browser.newPage();
  await dashPage.goto('https://127.0.0.1:3000/');
  await new Promise(r => setTimeout(r, 1000));

  await dashPage.click('#btn-add');
  await new Promise(r => setTimeout(r, 1000));

  const pairingUrl = await dashPage.evaluate(() => {
    const linkEl = document.querySelector('#qr-container a');
    return linkEl ? linkEl.href : null;
  });

  console.log('Pairing URL:', pairingUrl);
  
  const senderPage = await browser.newPage();
  senderPage.on('console', msg => console.log(`SENDER: ${msg.text()}`));
  await senderPage.goto(pairingUrl);
  await new Promise(r => setTimeout(r, 1000));
  await senderPage.click('#btn-start');
  await new Promise(r => setTimeout(r, 2000));

  const camId = await senderPage.evaluate(() => camId);
  console.log('camId is:', camId);

  // Landscape
  await senderPage.setViewport({ width: 1920, height: 1080, isLandscape: true });
  // trigger orientationchange
  await senderPage.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
  await new Promise(r => setTimeout(r, 1000));

  const viewPage = await browser.newPage();
  viewPage.on('console', msg => console.log(`VIEWER: ${msg.text()}`));
  await viewPage.goto(`https://127.0.0.1:3000/view/index.html?camId=${camId}`);
  await new Promise(r => setTimeout(r, 3000));

  const videoStats = await viewPage.evaluate(async () => {
    const video = document.getElementById('remoteVideo');
    const pc = window.pc; // if viewer exposes pc
    let framesDecoded = 0;
    if (pc) {
      const stats = await pc.getStats();
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
  });

  console.log('Video stats:', videoStats);

  await browser.close();
  serverProcess.kill();
})();
