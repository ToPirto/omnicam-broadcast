import { createEnvelope } from '../shared/protocol.js';

const urlParams = new URLSearchParams(window.location.search);
const camId = urlParams.get('camId');

if (!camId) {
  document.body.innerHTML = '<h1 style="color:white">Missing camId</h1>';
  throw new Error('Missing camId');
}

const video = document.getElementById('video');
let ws;
let pc;
window.pc = null;
window.video = video;

function connect() {
  ws = new WebSocket(`wss://${window.location.host}`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify(createEnvelope('cam_join', 'viewer', 'server', { camId })));
  };
  
  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    
    if (msg.type === 'offer') {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      window.pc = pc;
      
      pc.ontrack = (event) => {
        if (!video.srcObject) {
          video.srcObject = event.streams[0];
        }
      };
      
      pc.onicecandidate = (event) => {
        ws.send(JSON.stringify(createEnvelope('ice', `viewer-${camId}`, msg.from, { candidate: event.candidate })));
      };
      
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      ws.send(JSON.stringify(createEnvelope('answer', `viewer-${camId}`, msg.from, { sdp: pc.localDescription })));
    } else if (msg.type === 'ice') {
      if (msg.payload.candidate && pc) {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
      }
    }
  };
  
  ws.onclose = () => {
    setTimeout(connect, 2000); // Auto-reconnect
  };
}

connect();
