import { networkInterfaces } from 'node:os';

const SKIP_PATTERNS = [
  /^vEthernet/i, /^VMware/i, /^VirtualBox/i,
  /^docker/i, /^br-/i, /^veth/i,
  /Tailscale/i, /^tun/i, /^tap/i,
  /^WSL/i, /^Hyper-V/i,
];

export function getLocalIPs() {
  const results = [];
  const ifaces = networkInterfaces();
  
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (SKIP_PATTERNS.some(p => p.test(name))) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push(addr.address);
      }
    }
  }
  return results;
}
