import puppeteer from 'puppeteer';
import { WebSocketServer } from 'ws';

(async () => {
  // 1. Start Fake OBS WebSocket Server on port 4455
  const wss = new WebSocketServer({ port: 4455 });
  let obsClients = [];
  
  wss.on('connection', (ws) => {
    obsClients.push(ws);
    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg);
      if (parsed.requestType === 'GetInputList') {
        ws.send(JSON.stringify({
          op: 7,
          d: {
            requestId: parsed.requestId,
            requestStatus: { result: true, code: 100 },
            responseData: { inputs: [{ inputName: 'Browser', inputKind: 'browser_source' }] }
          }
        }));
      } else if (parsed.requestType === 'GetInputSettings') {
        ws.send(JSON.stringify({
          op: 7,
          d: {
            requestId: parsed.requestId,
            requestStatus: { result: true, code: 100 },
            responseData: { inputSettings: { url: 'https://127.0.0.1:3001/view/index.html?camId=' + globalCamId } }
          }
        }));
      } else if (parsed.requestType === 'GetCurrentProgramScene') {
        ws.send(JSON.stringify({
          op: 7,
          d: {
            requestId: parsed.requestId,
            requestStatus: { result: true, code: 100 },
            responseData: { currentProgramSceneName: globalProgramScene }
          }
        }));
      } else if (parsed.requestType === 'GetCurrentPreviewScene') {
        ws.send(JSON.stringify({
          op: 7,
          d: {
            requestId: parsed.requestId,
            requestStatus: { result: true, code: 100 },
            responseData: { currentPreviewSceneName: globalPreviewScene }
          }
        }));
      } else if (parsed.requestType === 'GetSceneItemList') {
        const sceneName = parsed.requestData.sceneName;
        let items = [];
        if (sceneName === 'Scene Live' || sceneName === 'Scene Preview') {
           items = [{ sceneItemEnabled: true, sourceType: 'OBS_SOURCE_TYPE_INPUT', sourceName: 'Browser' }];
        }
        ws.send(JSON.stringify({
          op: 7,
          d: {
            requestId: parsed.requestId,
            requestStatus: { result: true, code: 100 },
            responseData: { sceneItems: items }
          }
        }));
      } else {
        // Just ack
        ws.send(JSON.stringify({
          op: 7,
          d: {
            requestId: parsed.requestId,
            requestStatus: { result: true, code: 100 },
            responseData: {}
          }
        }));
      }
    });

    // Send Hello and Identified
    ws.send(JSON.stringify({
      op: 0,
      d: { obsWebSocketVersion: '5.0.0', rpcVersion: 1 }
    }));
    // Wait for Identify and send Identified
    ws.on('message', (m) => {
      const p = JSON.parse(m);
      if (p.op === 1) {
         ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
      }
    });
  });

  let globalCamId = 'test';
  let globalProgramScene = 'Empty Scene';
  let globalPreviewScene = 'Empty Scene';

  // 2. Run Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors'
    ]
  });

  const page = await browser.newPage();
  
  // Allow fetching via Node with self-signed certs
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // Get token
  const res = await fetch('https://127.0.0.1:3001/api/token');
  const data = await res.json();
  const url = new URL(data.url);
  globalCamId = 'cam-to-replace'; // Will be set correctly when auth_ok arrives, but for test we can get it from dashboard
  
  await page.goto(data.url);
  await page.waitForSelector('#btn-start');
  await page.click('#btn-start');
  
  // Wait for auth to complete to get camId (we can check localStorage or the DOM)
  await page.waitForFunction(() => document.getElementById('status').innerText.includes('Terautentikasi') || document.getElementById('status').innerText.includes('WebRTC Terhubung'));
  
  // Get camId from the signaling via a secondary page (dashboard)
  const dashboard = await browser.newPage();
  await dashboard.goto('https://127.0.0.1:3001');
  await dashboard.waitForSelector('.cam-card');
  const camIdText = await dashboard.$eval('.cam-card div[style*="font-size: 0.8em"]', el => el.innerText);
  globalCamId = camIdText.replace('ID: ', '');
  console.log('Camera ID:', globalCamId);
  
  // Check border is grey
  let borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('Initial border class:', borderClass);

  // Switch to Preview
  globalPreviewScene = 'Scene Preview';
  obsClients.forEach(c => c.send(JSON.stringify({ op: 5, d: { eventType: 'CurrentPreviewSceneChanged', eventData: { sceneName: globalPreviewScene } } })));
  
  await new Promise(r => setTimeout(r, 1000));
  borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('After Preview border class:', borderClass);
  
  // Switch to Program
  globalProgramScene = 'Scene Live';
  obsClients.forEach(c => c.send(JSON.stringify({ op: 5, d: { eventType: 'CurrentProgramSceneChanged', eventData: { sceneName: globalProgramScene } } })));
  
  await new Promise(r => setTimeout(r, 1000));
  borderClass = await page.$eval('#tally-border', el => el.className);
  console.log('After Program border class:', borderClass);

  await browser.close();
  wss.close();
  process.exit(0);
})();
