import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { config, saveSettings } from './config.js';
import { getOrCreateCert } from './cert.js';
import { CameraRegistry } from './camera-registry.js';
import { SignalingServer } from './signaling.js';
import { generateQRDataURL } from './qr.js';
import { advertiseMDNS } from './mdns.js';
import { getLocalIPs } from './network.js';
import { ObsBridge } from './obs.js';

export function generateObsUrl(port, camId) {
  return `http://127.0.0.1:${port + 1}/view/index.html?camId=${camId}&obs=1`;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  const { cert, key } = await getOrCreateCert(config.certDir);
  
  const fastify = Fastify({
    https: { key, cert },
    logger: false
  });

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/', 
  });

  const fastifyHttp = Fastify({ logger: false });
  fastifyHttp.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/', 
  });

  const registry = new CameraRegistry(config.maxCameras);
  
  const wss = new WebSocketServer({ server: fastify.server });
  const wssHttp = new WebSocketServer({ server: fastifyHttp.server });
  
  const signaling = new SignalingServer(registry, config);
  signaling.addWss(wss);
  signaling.addWss(wssHttp);
  
  const obsBridge = new ObsBridge(config, signaling);
  obsBridge.connect();

  fastify.get('/', async (request, reply) => {
    return reply.sendFile('dashboard/index.html');
  });

  fastify.get('/api/token', async (request, reply) => {
    const token = signaling.createPairingToken();
    const ips = getLocalIPs();
    const ip = ips.length > 0 ? ips[0] : '127.0.0.1';
    const url = `https://${ip}:${config.port}/cam/?token=${token}`;
    const qr = await generateQRDataURL(url);
    return { token, url, qr };
  });

  fastify.get('/api/cameras', async (request, reply) => {
    return registry.listCameras();
  });
  
  fastify.get('/api/settings', async (request, reply) => {
    return { 
      obsWsUrl: config.obsWsUrl, 
      passwordSaved: !!config.obsWsPassword,
      obsConnected: obsBridge.connected 
    };
  });

  fastify.post('/api/settings', async (request, reply) => {
    const { obsWsUrl, obsWsPassword } = request.body;
    let pwdToSave = obsWsPassword;
    if (obsWsPassword === '********') {
      pwdToSave = config.obsWsPassword;
    }
    saveSettings({ obsWsUrl, obsWsPassword: pwdToSave });
    config.obsWsUrl = obsWsUrl;
    config.obsWsPassword = pwdToSave;
    
    // reconnect immediately
    obsBridge.config = config;
    obsBridge.disconnect();
    if (obsBridge.reconnectTimer) clearTimeout(obsBridge.reconnectTimer);
    obsBridge.connect();
    
    return { success: true };
  });

  fastify.post('/api/obs/add', async (request, reply) => {
    const { camId } = request.body;
    const url = generateObsUrl(config.port, camId);
    try {
      const exists = await obsBridge.addBrowserSource(`Camera ${camId.substring(0, 4)}`, url);
      return { success: true, exists };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  if (process.env.NODE_ENV === 'test') {
    fastify.post('/api/test/tally', async (request, reply) => {
      const { camId, state } = request.body;
      const { createEnvelope } = await import('./protocol.js');
      obsBridge.tallyState.set(camId, state);
      obsBridge.updateTally = async () => {}; // Disable real polling from overriding
      const msg = createEnvelope('tally', 'server', camId, { state });
      signaling.relayTo(msg);
      signaling.registry.updateTally(camId, state);
      signaling.broadcastToDashboards(createEnvelope('tally', 'server', 'dashboard', { camId, state }));
      return { success: true };
    });
  }

  try {
    await fastify.listen({ port: config.port, host: config.host });
    await fastifyHttp.listen({ port: config.port + 1, host: '127.0.0.1' });
    advertiseMDNS(config.port);
    
    const ips = getLocalIPs();
    console.log('\n=========================================');
    console.log('🎥 OmniCam Broadcast Server Started');
    console.log('=========================================');
    console.log(`Dashboard : https://localhost:${config.port}`);
    console.log(`OBS Local : http://127.0.0.1:${config.port + 1}`);
    ips.forEach(ip => {
      console.log(`LAN Access: https://${ip}:${config.port}`);
    });
    console.log('-----------------------------------------');
    console.log('⚠️  Note: You will see a "Not Secure" warning in your browser.');
    console.log('   This is expected for local HTTPS. Proceed to the site.');
    console.log('=========================================\n');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
