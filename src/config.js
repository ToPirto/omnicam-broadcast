import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsPath = path.join(__dirname, '../settings.json');

let localSettings = {};
try {
  if (fs.existsSync(settingsPath)) {
    localSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to read settings.json', e);
}

export const config = {
  port: parseInt(process.env.OMNICAM_PORT || '3000'),
  host: '0.0.0.0',   // Bind all interfaces (LAN-accessible)
  obsWsUrl: localSettings.obsWsUrl || process.env.OBS_WS_URL || 'ws://127.0.0.1:4455',
  obsWsPassword: localSettings.obsWsPassword !== undefined ? localSettings.obsWsPassword : (process.env.OBS_WS_PASSWORD || ''),
  tokenExpiryMs: 5 * 60 * 1000,  // 5-minute one-time token
  sessionExpiryMs: 24 * 60 * 60 * 1000,  // 24-hour session
  certDir: './certs',
  maxCameras: 8,
  rateLimit: { windowMs: 60_000, maxAttempts: 10 },
};

export function saveSettings(newSettings) {
  if (newSettings.obsWsUrl !== undefined) config.obsWsUrl = newSettings.obsWsUrl;
  if (newSettings.obsWsPassword !== undefined) config.obsWsPassword = newSettings.obsWsPassword;
  
  localSettings = { ...localSettings, ...newSettings };
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(localSettings, null, 2));
  } catch (e) {
    console.error('Failed to save settings.json', e);
  }
}
