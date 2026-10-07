import { describe, it, expect } from 'vitest';
import { getTargetVideoSettings, calculatePeerTelemetry } from '../public/cam/sender.js';

describe('Quality Preset Logic', () => {
  it('returns correct settings for 720p30', () => {
    const s = getTargetVideoSettings('720p30_2500');
    expect(s.width).toBe(1280);
    expect(s.height).toBe(720);
    expect(s.fps).toBe(30);
    expect(s.bitrate).toBe(2500000);
  });
  
  it('returns correct settings for 1080p60', () => {
    const s = getTargetVideoSettings('1080p60_8000');
    expect(s.width).toBe(1920);
    expect(s.height).toBe(1080);
    expect(s.fps).toBe(60);
    expect(s.bitrate).toBe(8000000);
  });
  
  it('returns correct default settings for unknown or default', () => {
    const s = getTargetVideoSettings('1080p30_5000');
    expect(s.width).toBe(1920);
    expect(s.height).toBe(1080);
    expect(s.fps).toBe(30);
    expect(s.bitrate).toBe(5000000);
    
    const s2 = getTargetVideoSettings('unknown');
    expect(s2).toEqual(s);
  });
});

describe('calculatePeerTelemetry', () => {
  it('calculates bitrate and fps correctly', () => {
    const current = { bytesSent: 2000, framesEncoded: 100, timestamp: 2000 };
    const last = { bytesSent: 1000, framesEncoded: 70, timestamp: 1000 };
    
    // dt = 1 second
    const res = calculatePeerTelemetry(current, last, 30);
    expect(res.bitrate).toBe(8000); // (2000-1000)*8 / 1
    expect(res.fps).toBe(30); // 30 (cap)
    
    // Test fps without capping
    const res2 = calculatePeerTelemetry(current, last, 60);
    expect(res2.fps).toBe(30); // (100-70) / 1
    
    expect(res.hasTwoSamples).toBe(true);
  });

  it('handles zero dt and missing last stats', () => {
    const current = { bytesSent: 1000, framesEncoded: 30, timestamp: 1000 };
    const res = calculatePeerTelemetry(current, null, 30);
    expect(res.bitrate).toBe(0);
    expect(res.fps).toBe(0);
    expect(res.hasTwoSamples).toBe(false);
  });

  it('correctly isolates peers, including a late joiner', () => {
    const map = new Map();
    // T = 1
    const p1_t1 = calculatePeerTelemetry({ bytesSent: 1000, framesEncoded: 30, timestamp: 1000 }, null, 30);
    map.set('viewer-1', p1_t1);
    expect(p1_t1.hasTwoSamples).toBe(false);
    
    // T = 2 (p1 updates, p2 joins)
    const p1_t2 = calculatePeerTelemetry({ bytesSent: 2000, framesEncoded: 60, timestamp: 2000 }, map.get('viewer-1'), 30);
    map.set('viewer-1', p1_t2);
    expect(p1_t2.hasTwoSamples).toBe(true);
    expect(p1_t2.fps).toBe(30);

    const p2_t2 = calculatePeerTelemetry({ bytesSent: 500, framesEncoded: 10, timestamp: 2000 }, null, 30);
    map.set('viewer-2', p2_t2);
    expect(p2_t2.hasTwoSamples).toBe(false); // Late joiner doesn't get p1's stats
    
    // T = 3
    const p2_t3 = calculatePeerTelemetry({ bytesSent: 1500, framesEncoded: 40, timestamp: 3000 }, map.get('viewer-2'), 30);
    map.set('viewer-2', p2_t3);
    expect(p2_t3.hasTwoSamples).toBe(true);
    expect(p2_t3.fps).toBe(30);
    expect(p2_t3.bitrate).toBe(8000);
  });
});
