import { createEnvelope } from '../shared/protocol.js';

const isNode = typeof window === 'undefined';

const urlParams = isNode ? null : new URLSearchParams(window.location.search);
const token = isNode ? null : urlParams.get('token');

let ws;
let camId = (isNode ? null : localStorage.getItem('omnicam_id')) || 'new-cam';
let sessionToken = isNode ? null : localStorage.getItem('omnicam_session');
let localStream;
let wakeLock = null;
let currentDeviceId = null;
let reconnectAttempts = 0;
let telemetryInterval = null;
let intentionalDisconnect = false;

let peers = new Map(); // viewerId -> RTCPeerConnection

const statusEl = isNode ? null : document.getElementById('status');
const preview = isNode ? null : document.getElementById('preview');
const btnStart = isNode ? null : document.getElementById('btn-start');
const batteryEl = isNode ? null : document.getElementById('battery');
const bitrateEl = isNode ? null : document.getElementById('bitrate');
const fpsEl = isNode ? null : document.getElementById('fps');
const resolutionEl = isNode ? null : document.getElementById('resolution');
const qualityPreset = isNode ? null : document.getElementById('quality-preset');
const btnDisconnect = isNode ? null : document.getElementById('btn-disconnect');
const camSelect = isNode ? null : document.getElementById('cam-select');
const btnFullscreen = isNode ? null : document.createElement('button');

async function requestWakeLock() {
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.error('Wake lock failed', err);
  }
}

if (!isNode) {
  btnFullscreen.id = 'btn-fullscreen';
  btnFullscreen.innerText = 'Layar penuh + kunci landscape';
  document.querySelector('.controls').appendChild(btnFullscreen);

  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      await requestWakeLock();
    }
  });

  const diagPanel = document.getElementById('diagnostics-panel');
  const btnToggleDiag = document.getElementById('btn-toggle-diag');
  const btnCloseDiag = document.getElementById('btn-close-diag');

  if (btnToggleDiag && diagPanel) {
    btnToggleDiag.onclick = () => {
      diagPanel.style.display = 'block';
    };
  }
  if (btnCloseDiag && diagPanel) {
    btnCloseDiag.onclick = () => {
      diagPanel.style.display = 'none';
    };
  }
}

export function getTargetVideoSettings(val) {
  if (val === '720p30_2500') return { width: 1280, height: 720, fps: 30, bitrate: 2500000 };
  if (val === '1080p60_8000') return { width: 1920, height: 1080, fps: 60, bitrate: 8000000 };
  return { width: 1920, height: 1080, fps: 30, bitrate: 5000000 };
}

async function startCamera(deviceId = null) {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }

  const chkEcho = document.getElementById('chk-echo');
  const chkNoise = document.getElementById('chk-noise');
  const chkAgc = document.getElementById('chk-agc');

  const settings = getTargetVideoSettings(qualityPreset.value);
  const constraints = {
    video: {
      width: { ideal: settings.width },
      height: { ideal: settings.height },
      frameRate: { ideal: settings.fps }
    },
    audio: { 
      echoCancellation: chkEcho ? chkEcho.checked : false, 
      noiseSuppression: chkNoise ? chkNoise.checked : false,
      autoGainControl: chkAgc ? chkAgc.checked : false
    }
  };

  if (deviceId) {
    constraints.video.deviceId = { exact: deviceId };
  } else {
    constraints.video.facingMode = 'environment';
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = localStream;
    preview.style.transform = 'none';
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.contentHint = 'motion';
      const s = videoTrack.getSettings();
      resolutionEl.innerText = `${s.width || 0}x${s.height || 0}`;
    }

    peers.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack).catch(e => console.warn(e));
        // Apply parameters if needed here
      }
    });
  } catch (err) {
    console.error('Camera error', err);
    alert('Izin kamera ditolak atau kamera tidak tersedia.');
    throw err;
  }
}

async function populateCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  camSelect.innerHTML = '';
  videoDevices.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.text = d.label || `Kamera ${i + 1}`;
    camSelect.appendChild(opt);
  });
  if (videoDevices.length > 0 && !currentDeviceId) {
    // Prefer back camera by default
    const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
    currentDeviceId = backCam ? backCam.deviceId : videoDevices[0].deviceId;
    camSelect.value = currentDeviceId;
  }
}

if (!isNode) {
  camSelect.onchange = async () => {
    currentDeviceId = camSelect.value;
    await startCamera(currentDeviceId);
  };

  qualityPreset.onchange = async () => {
    await startCamera(currentDeviceId);
    // Re-apply bitrates to all peers
    for (const [viewerId, pc] of peers.entries()) {
      applyQualityParameters(pc, viewerId);
    }
  };

  btnFullscreen.onclick = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengunci landscape. Aktifkan Putar Otomatis di HP dan putar HP Anda secara manual.');
    }
  };

  window.addEventListener('orientationchange', async () => {
    if (localStream) {
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      const settings = getTargetVideoSettings(qualityPreset.value);
      const constraints = {
        width: { ideal: isLandscape ? settings.width : settings.height },
        height: { ideal: isLandscape ? settings.height : settings.width }
      };
      const videoTrack = localStream.getVideoTracks()[0];
      try {
        if (videoTrack) {
          await videoTrack.applyConstraints(constraints);
          const s = videoTrack.getSettings();
          resolutionEl.innerText = `${s.width || 0}x${s.height || 0}`;
        }
      } catch(e) {
        console.warn('applyConstraints failed', e);
      }
    }
  });
  const btnMute = document.getElementById('btn-mute');
  const chkEcho = document.getElementById('chk-echo');
  const chkNoise = document.getElementById('chk-noise');
  const chkAgc = document.getElementById('chk-agc');
  
  let isMuted = false;

  btnMute.onclick = () => {
    isMuted = !isMuted;
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
      }
    }
    btnMute.innerText = isMuted ? 'Unmute' : 'Mute';
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope('mute_state', camId, 'server', { muted: isMuted })));
    }
  };

  btnStart.onclick = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (e) {
      console.warn('Orientation lock failed:', e);
    }
    
    await requestWakeLock();
    await populateCameras();
    await startCamera(currentDeviceId);

    startConnection();
    btnStart.style.display = 'none';
    btnDisconnect.style.display = 'inline-block';
    btnMute.style.display = 'inline-block';
    
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      const updateBat = () => { batteryEl.innerText = `🔋 ${Math.round(battery.level * 100)}%`; };
      updateBat();
      battery.addEventListener('levelchange', updateBat);
    }
  };

  btnDisconnect.onclick = () => {
    intentionalDisconnect = true;
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    peers.forEach(pc => pc.close());
    peers.clear();
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(createEnvelope('disconnect', camId, 'server')));
      }
      ws.close();
    }
    sessionStorage.removeItem('omnicam_session');
    sessionStorage.removeItem('omnicam_id');
    
    btnDisconnect.style.display = 'none';
    btnStart.style.display = 'inline-block';
    btnStart.innerText = 'Scan Ulang QR';
    btnStart.onclick = () => window.location.href = '/';
    
    statusEl.innerHTML = `<span style="color: red;">Terputus. Scan QR untuk menyambung lagi</span>`;
    stopTelemetry();
  };
}

function startConnection() {
  const wsUrl = `wss://${window.location.host}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    reconnectAttempts = 0;
    console.log('WS state: onopen');
    statusEl.innerText = '● Menghubungkan (Signaling)...';
    ws.send(JSON.stringify(createEnvelope('auth', camId, 'server', { token, sessionToken })));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    
    if (msg.type === 'auth_ok') {
      console.log('WS state: auth_ok');
      statusEl.innerText = '● Terautentikasi (Menunggu Viewer)';
      camId = msg.payload.camId;
      sessionToken = msg.payload.sessionToken;
      sessionStorage.setItem('omnicam_session', sessionToken);
      sessionStorage.setItem('omnicam_id', camId);
    } else if (msg.type === 'auth_fail') {
      console.error('Auth failed:', msg.payload.reason);
      statusEl.innerHTML = `<span style="color: red;">Gagal: ${msg.payload.reason}. Harap scan QR baru.</span>`;
      btnStart.style.display = 'inline-block';
      btnStart.innerText = 'Scan Ulang QR';
      btnStart.onclick = () => window.location.href = '/';
    } else if (msg.type === 'viewer_join') {
      createAndSendOffer(msg.payload.viewerId);
    } else if (msg.type === 'answer') {
      const pc = peers.get(msg.from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
    } else if (msg.type === 'ice') {
      const pc = peers.get(msg.from);
      if (pc && msg.payload.candidate && !msg.payload.candidate.candidate.includes('.local')) {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
      }
    } else if (msg.type === 'tally') {
      const state = msg.payload.state;
      console.log('Received tally state:', state);
      const border = document.getElementById('tally-border');
      border.className = '';
      if (state === 2) border.classList.add('tally-red');
      else if (state === 1) border.classList.add('tally-green');
      else border.classList.add('tally-grey');
    } else if (msg.type === 'viewer_disconnect') {
      const vid = msg.sender;
      if (peers.has(vid)) {
        peers.get(vid).close();
        peers.delete(vid);
        peerStats.delete(vid);
        if (peerAdaptive) peerAdaptive.delete(vid);
        console.log(`Viewer ${vid} disconnected gracefully`);
      }
    } else if (msg.type === 'disconnect') {
      console.log('Received disconnect command from dashboard');
      if (typeof btnDisconnect !== 'undefined' && btnDisconnect.onclick) {
        btnDisconnect.onclick();
      }
    }
  };

  ws.onclose = () => {
    console.log('WS state: onclose');
    stopTelemetry();
    if (intentionalDisconnect) {
      console.log('Intentional disconnect, not reconnecting.');
      return;
    }
    statusEl.innerText = '● Terputus, menyambungkan ulang...';
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts) + Math.random() * 1000, 30000);
    setTimeout(startConnection, delay);
  };
}

function closePeer(viewerId) {
  if (peers.has(viewerId)) {
    peers.get(viewerId).close();
    peers.delete(viewerId);
  }
}

function checkGlobalStatus() {
  let connected = false;
  peers.forEach(pc => {
    if (pc.connectionState === 'connected') connected = true;
  });
  if (connected) {
    statusEl.innerText = '● WebRTC Terhubung (Live)';
    startTelemetry();
  } else {
    statusEl.innerText = '● Terautentikasi (Menunggu Viewer)';
    stopTelemetry();
  }
}

function applyQualityParameters(pc, viewerId, adaptiveSettings = null) {
  const isDashboard = viewerId && viewerId.startsWith('dash-');
  let settings = getTargetVideoSettings(qualityPreset.value);
  if (adaptiveSettings && !isDashboard) {
    settings = adaptiveSettings;
  }
  
  pc.getSenders().forEach(sender => {
    if (sender.track && sender.track.kind === 'video') {
      sender.track.contentHint = 'motion';
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      
      params.degradationPreference = 'maintain-resolution';
      
      if (isDashboard) {
        params.encodings[0].maxBitrate = 500000;
        params.encodings[0].minBitrate = 50000;
        params.encodings[0].scaleResolutionDownBy = 4;
        params.encodings[0].maxFramerate = 15;
      } else {
        params.encodings[0].maxBitrate = settings.bitrate;
        params.encodings[0].minBitrate = settings.bitrate * 0.1;
        params.encodings[0].scaleResolutionDownBy = settings.scaleDown || 1;
        params.encodings[0].maxFramerate = settings.fps;
      }
      
      sender.setParameters(params).catch(e => console.warn('setParameters error:', e));
    }
  });
}

async function createAndSendOffer(viewerId) {
  closePeer(viewerId);
  const pc = new RTCPeerConnection({ iceServers: [] });
  peers.set(viewerId, pc);
  
  localStream.getTracks().forEach(track => {
    const transceiver = pc.addTransceiver(track, { direction: 'sendonly' });
    if (track.kind === 'video') {
      const codecs = RTCRtpSender.getCapabilities('video').codecs;
      const h264 = codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
      const others = codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
      if (h264.length > 0) {
        transceiver.setCodecPreferences([...h264, ...others]);
      }
    }
  });

  applyQualityParameters(pc, viewerId);

  pc.onicecandidate = (e) => {
    if (ws.readyState === WebSocket.OPEN && e.candidate) {
      ws.send(JSON.stringify(createEnvelope('ice', camId, viewerId, { candidate: e.candidate })));
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`RTC connection state [${viewerId}]:`, pc.connectionState);
    if (pc.connectionState === 'connected') {
      applyQualityParameters(pc, viewerId);
    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      closePeer(viewerId);
    }
    checkGlobalStatus();
  };

  let offer = await pc.createOffer();
  
  // SDP Munging for start/min/max bitrates
  const settings = getTargetVideoSettings(qualityPreset.value);
  const isDashboard = viewerId.startsWith('dash-');
  const maxKbps = isDashboard ? 500 : Math.round(settings.bitrate / 1000);
  const minKbps = Math.round(maxKbps * 0.1);
  const startKbps = Math.round(maxKbps * 0.5);
  offer.sdp = offer.sdp.replace(/(a=fmtp:\d+ .*)/g, `$1;x-google-max-bitrate=${maxKbps};x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps}`);
  offer.sdp = offer.sdp.replace(/(a=rtpmap:(\d+) opus\/48000\/2)/gi, '$1\r\na=fmtp:$2 stereo=1; sprop-stereo=1');
  
  await pc.setLocalDescription(offer);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(createEnvelope('offer', camId, viewerId, { sdp: pc.localDescription })));
  }
}

export class AdaptiveQuality {
  constructor(targetSettings, getNow = null) {
    this.target = targetSettings;
    this.step = 0; // 0=normal, 1=lower bitrate, 2=lower fps, 3=lower res
    this.badSince = null;
    this.getNow = getNow || (() => (typeof performance !== 'undefined') ? performance.now() : Date.now());
    this.goodSince = this.getNow();
  }

  update(qlr, currentKbps) {
    const now = this.getNow();
    const targetKbps = this.target.bitrate / 1000;
    const isBad = qlr === 'bandwidth' || qlr === 'cpu' || (currentKbps > 0 && currentKbps < targetKbps * 0.4);

    if (isBad) {
      this.goodSince = null;
      if (!this.badSince) this.badSince = now;
      else if (now - this.badSince >= 10000) {
        if (this.step < 3) {
          this.step++;
          this.badSince = null;
          this.goodSince = now;
          return true;
        }
      }
    } else {
      this.badSince = null;
      if (!this.goodSince) this.goodSince = now;
      else if (now - this.goodSince >= 30000) {
        if (this.step > 0) {
          this.step--;
          this.goodSince = now;
          this.badSince = null;
          return true;
        }
      }
    }
    return false;
  }

  getCurrentSettings() {
    let { bitrate, fps } = this.target;
    let scaleDown = 1;

    if (this.step >= 1) bitrate = Math.max(bitrate * 0.5, 500000);
    if (this.step >= 2) fps = Math.max(Math.floor(fps / 2), 15);
    if (this.step >= 3) scaleDown = 2;

    return { bitrate, fps, scaleDown, step: this.step };
  }
}

export function calculatePeerTelemetry(currentStats, lastStats, maxFps) {
  let bitrate = 0;
  let fps = 0;
  let hasTwoSamples = false;
  
  if (lastStats && currentStats.timestamp > lastStats.timestamp) {
    const dt = (currentStats.timestamp - lastStats.timestamp) / 1000;
    if (dt > 0) {
      if (currentStats.bytesSent >= lastStats.bytesSent) {
        bitrate = (currentStats.bytesSent - lastStats.bytesSent) * 8 / dt;
      }
      if (currentStats.framesEncoded >= lastStats.framesEncoded) {
        fps = (currentStats.framesEncoded - lastStats.framesEncoded) / dt;
      }
      hasTwoSamples = true;
    }
  }
  
  fps = Math.min(fps, maxFps);
  return { 
    bitrate, 
    fps, 
    bytesSent: currentStats.bytesSent, 
    framesEncoded: currentStats.framesEncoded,
    timestamp: currentStats.timestamp,
    hasTwoSamples
  };
}

let peerStats = new Map();
let peerAdaptive = new Map();
let lastTime = 0;

function startTelemetry() {
  if (telemetryInterval) return;
  peerStats.clear();
  peerAdaptive.clear();
  lastTime = 0;
  let diagCounter = 0;
  telemetryInterval = setInterval(async () => {
    diagCounter++;
    const doDiag = diagCounter % 2 === 0;
    let diagText = '';
    
    let activePeers = 0;
    
    let mainBitrate = 0;
    let mainFps = 0;
    let mainValid = false;
    let audioBytesTotal = 0;
    const settings = getTargetVideoSettings(qualityPreset.value);

    for (let [id, pc] of peers.entries()) {
      if (pc.connectionState === 'connected') {
        activePeers++;
        const stats = await pc.getStats();
        let bytesSent = 0;
        let framesEncoded = 0;
        let audioBytes = 0;
        let timestamp = performance.now();
        
        let encoder = '-', fw = 0, fh = 0, ffps = 0, tbr = 0, qlr = '-', avail = 0, rtt = 0, jitter = 0, pl = 0;
        
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            bytesSent += report.bytesSent;
            framesEncoded += report.framesEncoded;
            if (report.timestamp) timestamp = report.timestamp;
            encoder = report.encoderImplementation || '-';
            fw = report.frameWidth || 0;
            fh = report.frameHeight || 0;
            ffps = report.framesPerSecond || 0;
            tbr = report.targetBitrate || 0;
            qlr = report.qualityLimitationReason || '-';
          }
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            audioBytes += report.bytesSent;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            avail = report.availableOutgoingBitrate || 0;
            rtt = report.currentRoundTripTime || 0;
          }
          if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            jitter = report.jitter || 0;
            pl = report.packetsLost || 0;
          }
        });
        
        audioBytesTotal += audioBytes;

        const currentStats = { bytesSent, framesEncoded, timestamp };
        const maxFps = id.startsWith('dash-') ? 15 : settings.fps;
        const result = calculatePeerTelemetry(currentStats, peerStats.get(id), maxFps);
        peerStats.set(id, result);

        if (doDiag) {
          const mkbps = Math.round(result.bitrate / 1000);
          const akbps = Math.round(avail / 1000);
          const tkbps = Math.round(tbr / 1000);
          diagText += `[${id}]\n` +
            `Enc: ${encoder} | Res: ${fw}x${fh} @ ${ffps}fps\n` +
            `Tar: ${tkbps}kbps | Mes: ${mkbps}kbps | Avail: ${akbps}kbps\n` +
            `QLR: ${qlr} | Jitter: ${jitter} | Loss: ${pl} | RTT: ${rtt}\n\n`;
        }

        let adaptiveStep = 0;
        if (!id.startsWith('dash-')) {
          if (!peerAdaptive.has(id)) {
            peerAdaptive.set(id, new AdaptiveQuality(settings));
          }
          const adaptive = peerAdaptive.get(id);
          adaptive.target = settings; // Keep target updated
          const mkbps = Math.round(result.bitrate / 1000);
          if (adaptive.update(qlr, mkbps)) {
            applyQualityParameters(pc, id, adaptive.getCurrentSettings());
          }
          adaptiveStep = adaptive.step;
        }

        if (id.startsWith('viewer-')) {
          if (result.hasTwoSamples) {
            mainBitrate = result.bitrate;
            mainFps = result.fps;
            mainValid = true;
          }
          if (adaptiveStep > 0) {
            document.getElementById('status').innerText = `● WebRTC Terhubung (Live) [Drop: ${['', 'Bitrate', 'FPS', 'Resolusi'][adaptiveStep]}]`;
          } else {
            document.getElementById('status').innerText = `● WebRTC Terhubung (Live)`;
          }
        } else if (!mainValid && activePeers === 1 && result.hasTwoSamples) {
          mainBitrate = result.bitrate;
          mainFps = result.fps;
          mainValid = true;
        }
      } else {
        peerStats.delete(id); // reset if disconnected
      }
    }

    if (doDiag && diagText) {
      if (isNode === false) {
        const diagContent = document.getElementById('diagnostics-content');
        if (diagContent) diagContent.innerText = diagText;
        console.log(diagText);
      }
    }

    if (activePeers === 0) return;

    bitrateEl.innerText = mainValid ? `${Math.round(mainBitrate / 1000)} kbps` : '- kbps';
    fpsEl.innerText = mainValid ? `${Math.round(mainFps)} fps` : '- fps';
    
    const audioEl = document.getElementById('audio-level');
    if (audioEl) audioEl.innerText = `🎤 ${audioBytesTotal}`;

    let batteryLvl = null;
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      batteryLvl = battery.level;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope('telemetry', camId, 'server', { 
        bitrate: mainBitrate, 
        fps: Math.round(mainFps), 
        battery: batteryLvl 
      })));
    }
  }, 1000);
}

function stopTelemetry() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
}
