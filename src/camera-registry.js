export class CameraRegistry {
  #cameras = new Map();  // camId -> { ws, name, joinedAt, lastTelemetry, sessionToken }
  #viewers = new Map();  // camId -> Set<ws>
  #maxCameras;

  constructor(maxCameras = 8) {
    this.#maxCameras = maxCameras;
  }

  register(camId, ws, sessionToken) {
    if (!this.#cameras.has(camId) && this.isFull) {
      throw new Error('Maximum cameras reached');
    }
    this.#cameras.set(camId, {
      ws,
      name: `Camera ${this.#cameras.size + 1}`,
      joinedAt: Date.now(),
      lastTelemetry: null,
      sessionToken,
      tally: 0
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
    return this.#cameras.get(camId);
  }

  listCameras() {
    return Array.from(this.#cameras.entries()).map(([id, cam]) => ({
      id,
      name: cam.name,
      joinedAt: cam.joinedAt,
      lastTelemetry: cam.lastTelemetry,
      tally: cam.tally
    }));
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
    const cam = this.#cameras.get(camId);
    if (cam) {
      cam.name = name;
    }
  }

  get count() { return this.#cameras.size; }
  get isFull() { return this.count >= this.#maxCameras; }
}
