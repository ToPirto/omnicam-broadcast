import { createEnvelope } from '../shared/protocol.js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

let ws;
let pc;
let camId = sessionStorage.getItem('omnicam_id') || 'new-cam';
let sessionToken = sessionStorage.getItem('omnicam_session');
let localStream;
let wakeLock = null;
let currentDeviceId = null;
let reconnectAttempts = 0;
let telemetryInterval = null;

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

    if (pc) {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
    }
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
  // Try to re-request camera with width>height if landscape
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
      statusEl.innerText = '● Terautentikasi';
      camId = msg.payload.camId;
      sessionToken = msg.payload.sessionToken;
      sessionStorage.setItem('omnicam_session', sessionToken);
      sessionStorage.setItem('omnicam_id', camId);
      
      createAndSendOffer();
    } else if (msg.type === 'auth_fail') {
      console.error('Auth failed:', msg.payload.reason);
      statusEl.innerHTML = `<span style="color: red;">Gagal: ${msg.payload.reason}. Harap scan QR baru.</span>`;
      btnStart.style.display = 'inline-block';
      btnStart.innerText = 'Scan Ulang QR';
      btnStart.onclick = () => window.location.href = '/';
    } else if (msg.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
    } else if (msg.type === 'ice') {
      if (msg.payload.candidate) {
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

async function createAndSendOffer() {
  if (pc) pc.close();
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  
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
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope('ice', camId, 'server', { candidate: e.candidate })));
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('RTC connection state:', pc.connectionState);
    if (pc.connectionState === 'connected') {
      statusEl.innerText = '● WebRTC Terhubung (Live)';
      startTelemetry();
    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      statusEl.innerText = '● WebRTC Terputus';
      stopTelemetry();
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(createEnvelope('offer', camId, 'server', { sdp: pc.localDescription })));
  }
}

let lastBytes = 0;
let lastTime = 0;

function startTelemetry() {
  stopTelemetry();
  telemetryInterval = setInterval(async () => {
    if (!pc) return;
    const stats = await pc.getStats();
    let currentBytes = 0;
    let fps = 0;
    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        currentBytes = report.bytesSent;
        fps = report.framesEncoded;
      }
    });

    const now = performance.now();
    let bitrate = 0;
    if (lastTime > 0 && currentBytes > lastBytes) {
      bitrate = (currentBytes - lastBytes) * 8 * 1000 / (now - lastTime);
    }
    lastBytes = currentBytes;
    lastTime = now;

    bitrateEl.innerText = `${Math.round(bitrate / 1000)} kbps`;
    fpsEl.innerText = `${fps || 0} fps`;

    let batteryLvl = null;
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      batteryLvl = battery.level;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope('telemetry', camId, 'server', { bitrate, fps, battery: batteryLvl })));
    }
  }, 1000);
}

function stopTelemetry() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
}

