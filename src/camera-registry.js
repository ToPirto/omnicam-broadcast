import fs from 'node:fs';
import path from 'node:path';

export class CameraRegistry {
  #cameras = new Map();  // camId -> { ws, joinedAt, lastTelemetry, tally, isOnline }
  #viewers = new Map();  // camId -> Set<ws>
  #persisted = new Map(); // camId -> { name, sessionToken }
  #maxCameras;
  #dataFile;

  constructor(maxCameras = 8) {
    this.#maxCameras = maxCameras;
    this.#dataFile = path.join(process.cwd(), 'data', 'cameras.json');
    this.#load();
  }

  #load() {
    try {
      if (fs.existsSync(this.#dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.#dataFile, 'utf8'));
        for (const [id, cam] of Object.entries(data)) {
          this.#persisted.set(id, cam);
        }
      }
    } catch (e) {
      console.error('Failed to load cameras.json:', e);
    }
  }

  #save() {
    try {
      const dir = path.dirname(this.#dataFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = Object.fromEntries(this.#persisted);
      fs.writeFileSync(this.#dataFile, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Failed to save cameras.json:', e);
    }
  }

  register(camId, ws, sessionToken) {
    if (!this.#persisted.has(camId) && this.#persisted.size >= this.#maxCameras) {
      throw new Error('Maximum cameras reached');
    }
    
    if (!this.#persisted.has(camId)) {
      this.#persisted.set(camId, { name: `Camera ${camId.substring(4, 8)}`, sessionToken });
      this.#save();
    } else {
      // Re-bind session token if it changed
      const p = this.#persisted.get(camId);
      p.sessionToken = sessionToken;
      this.#save();
    }

    this.#cameras.set(camId, {
      ws,
      joinedAt: Date.now(),
      lastTelemetry: null,
      tally: 0,
      isOnline: true
    });
    
    if (!this.#viewers.has(camId)) {
      this.#viewers.set(camId, new Set());
    }
  }

  unregister(camId) {
    this.#cameras.delete(camId);
    this.#viewers.delete(camId);
  }

  getCamera(camId) {
    const cam = this.#cameras.get(camId);
    if (!cam) return undefined;
    const p = this.#persisted.get(camId);
    return { ...cam, name: p?.name, sessionToken: p?.sessionToken };
  }

  verifySession(camId, sessionToken) {
    const p = this.#persisted.get(camId);
    return p && p.sessionToken === sessionToken;
  }

  listCameras() {
    return Array.from(this.#persisted.entries()).map(([id, p]) => {
      const cam = this.#cameras.get(id);
      return {
        id,
        name: p.name,
        joinedAt: cam?.joinedAt,
        lastTelemetry: cam?.lastTelemetry,
        tally: cam?.tally || 0,
        status: cam ? 'online' : 'offline'
      };
    });
  }

  addViewer(camId, ws) {
    if (!this.#viewers.has(camId)) {
      this.#viewers.set(camId, new Set());
    }
    this.#viewers.get(camId).add(ws);
  }

  removeViewer(camId, ws) {
    if (this.#viewers.has(camId)) {
      this.#viewers.get(camId).delete(ws);
    }
  }

  getViewers(camId) {
    return this.#viewers.get(camId) || new Set();
  }

  updateTelemetry(camId, data) {
    const cam = this.#cameras.get(camId);
    if (cam) {
      cam.lastTelemetry = data;
    }
  }

  updateTally(camId, tallyState) {
    const cam = this.#cameras.get(camId);
    if (cam) {
      cam.tally = tallyState;
    }
  }

  rename(camId, name) {
    const p = this.#persisted.get(camId);
    if (p) {
      p.name = name;
      this.#save();
    }
  }

  get count() { return this.#cameras.size; }
  get isFull() { return this.#persisted.size >= this.#maxCameras; }
}
