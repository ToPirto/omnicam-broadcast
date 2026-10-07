import { describe, it, expect } from 'vitest';
import { getTargetVideoSettings } from '../public/cam/sender.js';

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
