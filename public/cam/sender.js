import { createEnvelope } from '../shared/protocol.js';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

let ws;
let pc;
let camId;
let sessionToken = localStorage.getItem('omnicam_session');
let localStream;
let wakeLock = null;

const statusEl = document.getElementById('status');
const preview = document.getElementById('preview');
const btnStart = document.getElementById('btn-start');
const batteryEl = document.getElementById('battery');

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

btnStart.onclick = async () => {
  await requestWakeLock();
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, facingMode: 'environment' },
    audio: { echoCancellation: true, noiseSuppression: true }
  });
  preview.srcObject = localStream;
  preview.style.transform = 'none'; // Back camera, no mirror

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
    statusEl.innerText = '● Menghubungkan (Signaling)...';
    ws.send(JSON.stringify(createEnvelope('auth', 'new-cam', 'server', { token, sessionToken })));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    
    if (msg.type === 'auth_ok') {
      statusEl.innerText = '● Terautentikasi';
      camId = msg.payload.camId;
      sessionToken = msg.payload.sessionToken;
      localStorage.setItem('omnicam_session', sessionToken);
      
      // We are the sender, we wait for a viewer to join?
      // Actually, we can create the offer immediately if we want, but usually sender offers to viewer.
      // Wait, we don't know the viewer's ID. Let the viewer request or just offer to 'server', server relays to viewers.
      createAndSendOffer();
    } else if (msg.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
    } else if (msg.type === 'ice') {
      if (msg.payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
      }
    } else if (msg.type === 'tally') {
      const state = msg.payload.state;
      const border = document.getElementById('tally-border');
      border.className = '';
      if (state === 2) border.classList.add('tally-red');
      else if (state === 1) border.classList.add('tally-green');
      else border.classList.add('tally-grey');
    }
  };
}

async function createAndSendOffer() {
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
    ws.send(JSON.stringify(createEnvelope('ice', camId, 'server', { candidate: e.candidate })));
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      statusEl.innerText = '● WebRTC Terhubung (Live)';
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify(createEnvelope('offer', camId, 'server', { sdp: pc.localDescription })));
}
