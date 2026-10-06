import OBSWebSocket from 'obs-websocket-js';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ 
  port: 4458,
  handleProtocols: (protocols) => {
    return protocols.has('obswebsocket.json') ? 'obswebsocket.json' : false;
  }
});
wss.on('connection', (ws, req) => {
  console.log('[MOCK] Connected with protocol:', req.headers['sec-websocket-protocol']);
  ws.on('message', (msg) => {
    console.log('[MOCK] Received buffer:', msg.toString());
    const parsed = JSON.parse(msg.toString());
    if (parsed.op === 1) {
      ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
    }
  });
  ws.send(JSON.stringify({ op: 0, d: { obsWebSocketVersion: '5.0.0', rpcVersion: 1 } }));
});

const obs = new OBSWebSocket();
obs.connect('ws://127.0.0.1:4458')
  .then(() => console.log('Client connected!'))
  .catch(e => console.error('Client error:', e))
  .finally(() => { wss.close(); process.exit(0); });
