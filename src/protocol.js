import { randomUUID } from 'node:crypto';

const PROTOCOL_VERSION = 1;
const VALID_TYPES = [
  'auth', 'auth_ok', 'auth_fail',
  'offer', 'answer', 'ice',
  'tally', 'telemetry',
  'control', 'control_ack', 'control_nack',
  'ping', 'pong', 'bye', 'disconnect',
  'cam_join', 'cam_leave', 'dashboard_join', 'obs_status', 'viewer_join'
];

let seq = 0;

export function createEnvelope(type, from, to, payload = {}) {
  return {
    v: PROTOCOL_VERSION,
    type,
    id: randomUUID(),
    ts: Date.now(),
    seq: ++seq,
    from,
    to,
    payload,
  };
}

export function validateEnvelope(msg) {
  if (!msg || typeof msg !== 'object') return { valid: false, error: 'Not an object' };
  if (msg.v !== PROTOCOL_VERSION) return { valid: false, error: `Unknown protocol version: ${msg.v}` };
  if (!VALID_TYPES.includes(msg.type)) return { valid: false, error: `Unknown type: ${msg.type}` };
  if (!msg.id) return { valid: false, error: 'Missing id' };
  if (!msg.from) return { valid: false, error: 'Missing from' };
  return { valid: true };
}
