import { createEnvelope } from '../shared/protocol.js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

let ws;
let camId = sessionStorage.getItem('omnicam_id') || 'new-cam';
let sessionToken = sessionStorage.getItem('omnicam_session');
let localStream;
let wakeLock = null;
let currentDeviceId = null;
let reconnectAttempts = 0;
let telemetryInterval = null;

let peers = new Map(); // viewerId -> RTCPeerConnection

const statusEl = document.getElementById('status');
const preview = document.getElementById('preview');
const btnStart = document.getElementById('btn-start');
const batteryEl = document.getElementById('battery');
const bitrateEl = document.getElementById('bitrate');
const fpsEl = document.getElementById('fps');
const camSelect = document.getElementById('cam-select');
const btnFullscreen = document.createElement('button');

btnFullscreen.id = 'btn-fullscreen';
btnFullscreen.innerText = 'Layar penuh + kunci landscape';
document.querySelector('.controls').appendChild(btnFullscreen);

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.error('Wake lock failed', err);
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

async function startCamera(deviceId = null) {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 }
    },
    audio: { echoCancellation: true, noiseSuppression: true }
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

    peers.forEach(pc => {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack).catch(e => console.warn(e));
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
    currentDeviceId = videoDevices[0].deviceId;
  }
}

camSelect.onchange = async () => {
  currentDeviceId = camSelect.value;
  await startCamera(currentDeviceId);
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
    const constraints = {
      width: { ideal: isLandscape ? 1920 : 1080 },
      height: { ideal: isLandscape ? 1080 : 1920 }
    };
    const videoTrack = localStream.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints(constraints);
    } catch(e) {
      console.warn('applyConstraints failed', e);
    }
  }
});

btnStart.onclick = async () => {
  await requestWakeLock();
  await startCamera();
  await populateCameras();

  startConnection();
  btnStart.style.display = 'none';
  
  if ('getBattery' in navigator) {
    const battery = await navigator.getBattery();
    const updateBat = () => { batteryEl.innerText = `🔋 ${Math.round(battery.level * 100)}%`; };
    updateBat();
    battery.addEventListener('levelchange', updateBat);
  }
};

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
    }
  };

  ws.onclose = () => {
    console.log('WS state: onclose');
    statusEl.innerText = '● Terputus, menyambungkan ulang...';
    stopTelemetry();
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

async function createAndSendOffer(viewerId) {
  closePeer(viewerId);
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
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

  pc.onicecandidate = (e) => {
    if (ws.readyState === WebSocket.OPEN && e.candidate) {
      ws.send(JSON.stringify(createEnvelope('ice', camId, viewerId, { candidate: e.candidate })));
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`RTC connection state [${viewerId}]:`, pc.connectionState);
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      closePeer(viewerId);
    }
    checkGlobalStatus();
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(createEnvelope('offer', camId, viewerId, { sdp: pc.localDescription })));
  }
}

let lastBytes = 0;
let lastFrames = 0;
let lastTime = 0;

function startTelemetry() {
  if (telemetryInterval) return;
  lastBytes = 0;
  lastFrames = 0;
  lastTime = 0;
  telemetryInterval = setInterval(async () => {
    let currentBytes = 0;
    let framesEncoded = 0;
    
    let activePeers = 0;
    for (let pc of peers.values()) {
      if (pc.connectionState === 'connected') {
        activePeers++;
        const stats = await pc.getStats();
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            currentBytes += report.bytesSent;
            framesEncoded += report.framesEncoded;
          }
        });
      }
    }

    if (activePeers === 0) return;
    
    const now = performance.now();
    let bitrate = 0;
    let fps = 0;
    if (lastTime > 0) {
      const dt = (now - lastTime) / 1000;
      if (currentBytes > lastBytes) {
        bitrate = (currentBytes - lastBytes) * 8 / dt;
      }
      if (framesEncoded > lastFrames) {
        fps = (framesEncoded - lastFrames) / dt;
      }
    }
    lastBytes = currentBytes;
    lastFrames = framesEncoded;
    lastTime = now;

    bitrateEl.innerText = `${Math.round(bitrate / 1000)} kbps`;
    fpsEl.innerText = `${Math.round(fps)} fps`;

    let batteryLvl = null;
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      batteryLvl = battery.level;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope('telemetry', camId, 'server', { 
        bitrate, 
        fps: Math.round(fps), 
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
