import { describe, it, expect } from 'vitest';
import { generateObsUrl } from '../src/server.js';

describe('Server helpers', () => {
  it('should generate the correct OBS URL with &obs=1 appended', () => {
    const url = generateObsUrl(3001, 'cam-1234');
    expect(url).toBe('http://127.0.0.1:3002/view/index.html?camId=cam-1234&obs=1');
  });
});
