import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CameraRegistry } from '../src/camera-registry.js';
import fs from 'node:fs';
import path from 'node:path';

describe('CameraRegistry', () => {
  let registry;
  const dataFile = path.join(process.cwd(), 'data', 'cameras.json');

  beforeEach(() => {
    if (fs.existsSync(dataFile)) {
      fs.unlinkSync(dataFile);
    }
    registry = new CameraRegistry(2);
  });
  
  afterEach(() => {
    if (fs.existsSync(dataFile)) {
      fs.unlinkSync(dataFile);
    }
  });

  it('registers and retrieves camera', () => {
    registry.register('cam1', {}, 'token1');
    const cam = registry.getCamera('cam1');
    expect(cam).toBeDefined();
    expect(cam.sessionToken).toBe('token1');
    expect(registry.count).toBe(1);
  });

  it('unregisters camera', () => {
    registry.register('cam1', {}, 'token1');
    registry.unregister('cam1');
    expect(registry.getCamera('cam1')).toBeUndefined();
    expect(registry.count).toBe(0);
  });

  it('respects max cameras limit', () => {
    registry.register('cam1', {}, 't1');
    registry.register('cam2', {}, 't2');
    expect(() => registry.register('cam3', {}, 't3')).toThrow('Maximum cameras reached');
  });

  it('deletes camera completely', () => {
    registry.register('cam1', {}, 'token1');
    registry.deleteCamera('cam1');
    expect(registry.getCamera('cam1')).toBeUndefined();
    expect(registry.listCameras().find(c => c.id === 'cam1')).toBeUndefined();
  });

  it('manages viewers', () => {
    registry.register('cam1', {}, 't1');
    registry.addViewer('cam1', 'ws1');
    registry.addViewer('cam1', 'ws2');
    const viewers = registry.getViewers('cam1');
    expect(viewers.size).toBe(2);
    expect(viewers.has('ws1')).toBe(true);
    
    registry.removeViewer('cam1', 'ws1');
    expect(registry.getViewers('cam1').size).toBe(1);
  });

  it('supports renaming a camera and persisting session', () => {
    registry.register('cam1', {}, 'token1');
    registry.rename('cam1', 'Altar Cam');
    
    // Unregister removes from active online list
    registry.unregister('cam1');
    expect(registry.getCamera('cam1')).toBeUndefined();
    
    // But it's still in the list of all known cameras
    const all = registry.listCameras();
    const found = all.find(c => c.id === 'cam1');
    expect(found.name).toBe('Altar Cam');
    expect(found.status).toBe('offline');
    
    // Can verify session token
    expect(registry.verifySession('cam1', 'token1')).toBe(true);
  });
});
