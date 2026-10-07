import { describe, it, expect, beforeEach } from 'vitest';
import { CameraRegistry } from '../src/camera-registry.js';

describe('CameraRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new CameraRegistry(2);
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
