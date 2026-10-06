const PROTOCOL_VERSION = 1;

let seq = 0;

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

export function createEnvelope(type, from, to, payload = {}) {
  return {
    v: PROTOCOL_VERSION,
    type,
    id: uuidv4(),
    ts: Date.now(),
    seq: ++seq,
    from,
    to,
    payload,
  };
}
