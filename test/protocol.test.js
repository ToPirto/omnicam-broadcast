import { describe, it, expect } from 'vitest';
import { createEnvelope, validateEnvelope } from '../src/protocol.js';

describe('Protocol Envelope', () => {
  it('creates a valid envelope', () => {
    const env = createEnvelope('auth', 'cam1', 'server', { token: '123' });
    expect(env.v).toBe(1);
    expect(env.type).toBe('auth');
    expect(env.id).toBeDefined();
    expect(env.from).toBe('cam1');
    expect(env.to).toBe('server');
    expect(env.payload.token).toBe('123');
  });

  it('validates a correct envelope', () => {
    const env = createEnvelope('auth', 'cam1', 'server', { token: '123' });
    const { valid } = validateEnvelope(env);
    expect(valid).toBe(true);
  });

  it('rejects missing version', () => {
    const env = createEnvelope('auth', 'cam1', 'server', {});
    env.v = undefined;
    const { valid, error } = validateEnvelope(env);
    expect(valid).toBe(false);
    expect(error).toContain('Unknown protocol version');
  });

  it('rejects unknown type', () => {
    const env = createEnvelope('unknown_type', 'cam1', 'server', {});
    const { valid, error } = validateEnvelope(env);
    expect(valid).toBe(false);
    expect(error).toContain('Unknown type');
  });
});
