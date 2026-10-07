import { describe, it, expect, vi } from 'vitest';
import { SignalingServer } from '../src/signaling.js';

describe('SignalingServer disconnect logic', () => {
  it('handles disconnect message from dashboard to cam', () => {
    const registry = {
      getCamera: vi.fn(),
      unregister: vi.fn(),
    };
    
    const server = new SignalingServer(registry, {});
    server.broadcastToDashboards = vi.fn();
    
    const mockCamWs = {
      readyState: 1,
      send: vi.fn(),
      terminate: vi.fn()
    };
    
    registry.getCamera.mockReturnValue({ ws: mockCamWs });
    
    server.handleMessage({}, JSON.stringify({
      v: 1, type: 'disconnect', id: '1', ts: 123, seq: 1,
      from: 'dashboard', to: 'cam-123'
    }));
    
    expect(registry.getCamera).toHaveBeenCalledWith('cam-123');
    expect(mockCamWs.send).toHaveBeenCalled();
    const sent = JSON.parse(mockCamWs.send.mock.calls[0][0]);
    expect(sent.type).toBe('disconnect');
    expect(sent.to).toBe('cam-123');
    
    expect(registry.unregister).toHaveBeenCalledWith('cam-123');
    expect(server.broadcastToDashboards).toHaveBeenCalled();
    const bcast = server.broadcastToDashboards.mock.calls[0][0];
    expect(bcast.type).toBe('cam_leave');
  });
});
