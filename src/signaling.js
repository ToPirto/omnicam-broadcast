import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createEnvelope, validateEnvelope } from './protocol.js';

export class SignalingServer {
  constructor(registry, config) {
    this.registry = registry;
    this.config = config;
    this.pendingTokens = new Map(); // token -> { expiresAt }
    this.clients = new Set();
    
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((ws) => {
        if (!ws.isAlive || (ws.lastPing && now - ws.lastPing > 15000)) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.lastPing = now;
        ws.ping();
      });
    }, 5000);
  }

  addWss(wss) {
    wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      
      ws.on('message', (message) => this.handleMessage(ws, message));
      ws.on('close', () => {
        this.clients.delete(ws);
        this.handleClose(ws);
      });
    });
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
        this.relayTo(msg);
        break;
      case 'answer':
        this.relayTo(msg);
        break;
      case 'ice':
        this.relayTo(msg);
        break;
      case 'telemetry':
        this.registry.updateTelemetry(msg.from, msg.payload);
        // Relay to dashboard viewers
        this.broadcastToDashboards(msg);
        break;
      case 'cam_join':
        // viewer joining
        if (msg.payload && msg.payload.camId) {
          ws.isViewer = true;
          ws.camId = msg.payload.camId;
          ws.viewerId = msg.from; // Assuming viewer sends unique ID in msg.from
          this.registry.addViewer(msg.payload.camId, ws);
          const cam = this.registry.getCamera(ws.camId);
          if (cam && cam.ws && cam.ws.readyState === 1) {
            cam.ws.send(JSON.stringify(createEnvelope('viewer_join', 'server', ws.camId, { viewerId: ws.viewerId })));
          }
        }
        break;
      case 'dashboard_join':
        ws.isDashboard = true;
        // Send snapshot (we can just let the dashboard fetch it, or send it here)
        // Actually, dashboard.js uses fetch('/api/cameras') when it connects (loadCamerasSnapshot)!
        break;
      case 'disconnect':
        // Dashboard kicking a camera, or camera disconnecting itself
        if (msg.to && msg.to.startsWith('cam-')) {
           const cam = this.registry.getCamera(msg.to);
           if (cam) {
             if (cam.ws && cam.ws.readyState === 1) {
               cam.ws.send(JSON.stringify(createEnvelope('disconnect', 'server', msg.to)));
               setTimeout(() => cam.ws.terminate(), 500);
             }
             this.registry.unregister(msg.to);
             this.broadcastToDashboards(createEnvelope('cam_leave', 'server', 'dashboard', { camId: msg.to }));
           }
        } else if (msg.from && msg.from.startsWith('cam-')) {
           // Camera disconnecting itself
           const cam = this.registry.getCamera(msg.from);
           if (cam) {
             this.registry.unregister(msg.from);
             this.broadcastToDashboards(createEnvelope('cam_leave', 'server', 'dashboard', { camId: msg.from }));
             if (ws.readyState === 1) ws.terminate();
           }
        }
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
      // Reconnection logic
      const camId = msg.from;
      if (this.registry.verifySession(camId, sessionToken)) {
        this.registry.register(camId, ws, sessionToken); // Put it online
        ws.camId = camId;
        ws.send(JSON.stringify(createEnvelope('auth_ok', 'server', camId, { sessionToken, camId, name: this.registry.getCamera(camId)?.name })));
        
        const cam = this.registry.getCamera(camId);
        if (cam && cam.tally !== undefined) {
          ws.send(JSON.stringify(createEnvelope('tally', 'server', camId, { state: cam.tally })));
        }

        // Notify dashboards
        this.broadcastToDashboards(createEnvelope('cam_join', 'server', 'dashboard', { camId }));
        
        // Notify sender about all connected viewers so it can create offers
        const viewers = this.registry.getViewers(camId);
        viewers.forEach(vws => {
          if (vws.readyState === 1 && vws.viewerId) {
            ws.send(JSON.stringify(createEnvelope('viewer_join', 'server', camId, { viewerId: vws.viewerId })));
          }
        });
        return;
      }
    }

    if (token) {
      // New pairing
      if (this.pendingTokens.has(token)) {
        this.pendingTokens.delete(token);
        const camId = (msg.from && msg.from.startsWith('cam-')) ? msg.from : `cam-${randomUUID().substring(0,8)}`;
        const newSessionToken = sessionToken || randomUUID();
        
        try {
          this.registry.register(camId, ws, newSessionToken);
          ws.camId = camId;
          ws.send(JSON.stringify(createEnvelope('auth_ok', 'server', camId, { sessionToken: newSessionToken, camId, name: this.registry.getCamera(camId)?.name })));
          
          // New cameras start with tally 0
          ws.send(JSON.stringify(createEnvelope('tally', 'server', camId, { state: 0 })));

          // Notify dashboards
          this.broadcastToDashboards(createEnvelope('cam_join', 'server', 'dashboard', { camId }));

          // Notify sender about existing viewers
          const viewers = this.registry.getViewers(camId);
          viewers.forEach(vws => {
            if (vws.readyState === 1 && vws.viewerId) {
              ws.send(JSON.stringify(createEnvelope('viewer_join', 'server', camId, { viewerId: vws.viewerId })));
            }
          });
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
      if (cam && cam.ws && cam.ws.readyState === 1) { // 1 = OPEN
        cam.ws.send(JSON.stringify(msg));
      }
    } else if (msg.to.startsWith('viewer-') || msg.to.startsWith('dash-')) {
      // Relay to specific viewer
      const viewers = this.registry.getViewers(msg.from); // msg.from is camId
      viewers.forEach(vws => {
        if (vws.viewerId === msg.to && vws.readyState === 1) {
          vws.send(JSON.stringify(msg));
        }
      });
    } else {
      // Relay to all viewers of the camera
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
    this.clients.forEach(c => {
      if (c.isDashboard && c.readyState === 1) {
        c.send(msgStr);
      }
    });
  }

  handleClose(ws) {
    if (ws.camId && !ws.isViewer) {
      // Camera disconnected
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
