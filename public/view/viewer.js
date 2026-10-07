import { createEnvelope } from '../shared/protocol.js';

const urlParams = new URLSearchParams(window.location.search);
const camId = urlParams.get('camId');

if (!camId) {
  document.body.innerHTML = '<h1 style="color:white">Missing camId</h1>';
  throw new Error('Missing camId');
}

const video = document.getElementById('video');
video.muted = true;
video.autoplay = true;
video.playsInline = true;

let ws;
let pc;
let iceQueue = [];

// Generate unique viewer ID
const viewerId = 'viewer-' + Math.random().toString(36).substring(2, 10);

window.pc = null;
window.video = video;

function connect() {
  ws = new WebSocket(`wss://${window.location.host}`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify(createEnvelope('cam_join', viewerId, 'server', { camId })));
  };
  
  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    
    if (msg.type === 'offer') {
      if (pc) pc.close();
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      window.pc = pc;
      iceQueue = [];
      
      pc.ontrack = (event) => {
        if (!video.srcObject || video.srcObject !== event.streams[0]) {
          video.srcObject = event.streams[0];
          playVideo();
        }
      };
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify(createEnvelope('ice', viewerId, msg.from, { candidate: event.candidate })));
        }
      };
      
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      ws.send(JSON.stringify(createEnvelope('answer', viewerId, msg.from, { sdp: pc.localDescription })));
      
      // Process queued ICE candidates
      while (iceQueue.length > 0) {
        const candidate = iceQueue.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          // Trigger a new offer by re-joining
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(createEnvelope('cam_join', viewerId, 'server', { camId })));
          }
        }
      };

    } else if (msg.type === 'ice') {
      if (msg.payload.candidate && !msg.payload.candidate.candidate.includes('.local')) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate)).catch(err => console.warn(err));
        } else {
          iceQueue.push(msg.payload.candidate);
        }
      }
    }
  };
  
  ws.onclose = () => {
    setTimeout(connect, 2000); // Auto-reconnect
  };
}

function playVideo() {
  video.play().catch(e => {
    console.warn("Autoplay failed, retrying...", e);
    setTimeout(playVideo, 1000);
  });
}

connect();
