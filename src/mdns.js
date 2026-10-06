import { Bonjour } from 'bonjour-service';

let instance = null;

export function advertiseMDNS(port) {
  instance = new Bonjour();
  instance.publish({ name: 'OmniCam Broadcast', type: 'https', port });
  console.log(`[mDNS] Advertising as omnicam.local:${port}`);
  return instance;
}

export function stopMDNS() {
  if (instance) { 
    instance.unpublishAll(); 
    instance.destroy(); 
  }
}
