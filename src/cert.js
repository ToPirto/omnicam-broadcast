import { generate } from 'selfsigned';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getLocalIPs } from './network.js';
import path from 'node:path';

export async function getOrCreateCert(certDir = './certs') {
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');
  
  if (existsSync(certPath) && existsSync(keyPath)) {
    return {
      cert: await readFile(certPath, 'utf8'),
      key: await readFile(keyPath, 'utf8'),
    };
  }
  
  const ips = getLocalIPs();
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 2, value: 'omnicam.local' },
    ...ips.map(ip => ({ type: 7, ip })),
  ];
  
  const pems = await generate(
    [{ name: 'commonName', value: 'OmniCam Broadcast' }],
    {
      keySize: 2048,
      algorithm: 'sha256',
      notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      extensions: [{ name: 'subjectAltName', altNames }],
    }
  );
  
  await mkdir(certDir, { recursive: true });
  await writeFile(certPath, pems.cert);
  await writeFile(keyPath, pems.private);
  
  return { cert: pems.cert, key: pems.private };
}
