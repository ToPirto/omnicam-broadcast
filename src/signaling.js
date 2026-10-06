import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createEnvelope, validateEnvelope } from './protocol.js';

export class SignalingServer {
  constructor(wss, registry, config) {
    this.wss = wss;
    this.registry = registry;
    this.config = config;
    this.pendingTokens = new Map(); // token -> { expiresAt }
    
    this.wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      
      ws.on('message', (message) => this.handleMessage(ws, message));
      ws.on('close', () => this.handleClose(ws));
    });

    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }
  
  createPairingToken() {
    const token = randomUUID().replace(/-/g, '');
    this.pendingTokens.set(token, { expiresAt: Date.now() + this.config.tokenExpiryMs });
    return token;
  }

  handleMessage(ws, message) {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (err) {
      return;
    }

    const { valid, error } = validateEnvelope(msg);
    if (!valid) return;

    switch (msg.type) {
      case 'auth':
        this.handleAuth(ws, msg);
        break;
      case 'offer':
      case 'answer':
      case 'ice':
        this.relayTo(msg);
        break;
      case 'telemetry':
        this.registry.updateTelemetry(msg.from, msg.payload);
        // Relay to dashboard viewers (simplified: just broadcast to all dashboard clients)
        this.broadcastToDashboards(msg);
        break;
      case 'cam_join':
        // viewer joining
        if (msg.payload && msg.payload.camId) {
          ws.isViewer = true;
          ws.camId = msg.payload.camId;
          this.registry.addViewer(msg.payload.camId, ws);
        }
        break;
      case 'dashboard_join':
        ws.isDashboard = true;
        break;
    }
  }

  handleAuth(ws, msg) {
    const { token, sessionToken } = msg.payload;
    const now = Date.now();

    // Clean up expired tokens
    for (const [k, v] of this.pendingTokens.entries()) {
      if (v.expiresAt < now) this.pendingTokens.delete(k);
    }

    if (sessionToken) {
      // Reconnection logic (simplified for now)
      const camId = msg.from;
      const cam = this.registry.getCamera(camId);
      if (cam && cam.sessionToken === sessionToken) {
        cam.ws = ws;
        ws.camId = camId;
        ws.send(JSON.stringify(createEnvelope('auth_ok', 'server', camId, { sessionToken, camId })));
        if (cam.tally !== undefined) {
          ws.send(JSON.stringify(createEnvelope('tally', 'server', camId, { state: cam.tally })));
        }
        return;
      }
    }

    if (token) {
      // New pairing
      if (this.pendingTokens.has(token)) {
        this.pendingTokens.delete(token);
        const camId = `cam-${randomUUID().substring(0,8)}`;
        const newSessionToken = randomUUID();
        
        try {
          this.registry.register(camId, ws, newSessionToken);
          ws.camId = camId;
          ws.send(JSON.stringify(createEnvelope('auth_ok', 'server', camId, { sessionToken: newSessionToken, camId })));
          
          // New cameras start with tally 0
          ws.send(JSON.stringify(createEnvelope('tally', 'server', camId, { state: 0 })));

          // Notify dashboards
          this.broadcastToDashboards(createEnvelope('cam_join', 'server', 'dashboard', { camId }));
        } catch (err) {
          ws.send(JSON.stringify(createEnvelope('auth_fail', 'server', msg.from, { reason: err.message })));
        }
      } else {
        ws.send(JSON.stringify(createEnvelope('auth_fail', 'server', msg.from, { reason: 'Invalid or expired token' })));
      }
    }
  }

  relayTo(msg) {
    if (msg.to.startsWith('cam-')) {
      // Relay to specific camera
      const cam = this.registry.getCamera(msg.to);
      if (cam && cam.ws.readyState === 1) { // 1 = OPEN
        cam.ws.send(JSON.stringify(msg));
      }
    } else {
      // Relay to viewers of the camera
      const viewers = this.registry.getViewers(msg.from);
      viewers.forEach(vws => {
        if (vws.readyState === 1) {
          vws.send(JSON.stringify(msg));
        }
      });
    }
  }

  broadcastToDashboards(msg) {
    const msgStr = JSON.stringify(msg);
    this.wss.clients.forEach(c => {
      if (c.isDashboard && c.readyState === 1) {
        c.send(msgStr);
      }
    });
  }

  handleClose(ws) {
    if (ws.camId && !ws.isViewer) {
      // Camera disconnected (maybe temporary)
      this.broadcastToDashboards(createEnvelope('cam_leave', 'server', 'dashboard', { camId: ws.camId }));
      // We don't unregister immediately to allow reconnects
    } else if (ws.isViewer && ws.camId) {
      this.registry.removeViewer(ws.camId, ws);
    }
  }

  close() {
    clearInterval(this.pingInterval);
  }
}
