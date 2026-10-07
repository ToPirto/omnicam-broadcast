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

let joinInterval;

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('[VIEWER] WS connected');
    const sendJoin = () => {
      if (!pc || (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting')) {
        console.log('[VIEWER] Sending cam_join...');
        ws.send(JSON.stringify(createEnvelope('cam_join', viewerId, 'server', { camId })));
      }
    };
    sendJoin();
    if (joinInterval) clearInterval(joinInterval);
    joinInterval = setInterval(sendJoin, 5000);
  };
  
  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    
    if (msg.type === 'offer') {
      console.log('[VIEWER] Received offer');
      if (pc) pc.close();
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      window.pc = pc;
      iceQueue = [];
      const inboundStream = new MediaStream();
      let srcObjectSet = false;
      
      pc.ontrack = (event) => {
        if (!srcObjectSet) {
          if (event.streams && event.streams[0]) {
            video.srcObject = event.streams[0];
          } else {
            inboundStream.addTrack(event.track);
            video.srcObject = inboundStream;
          }
          srcObjectSet = true;
          video.play().catch(() => {});
        } else if (!event.streams || !event.streams[0]) {
          inboundStream.addTrack(event.track);
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
      
      while (iceQueue.length > 0) {
        const candidate = iceQueue.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      pc.onconnectionstatechange = () => {
        console.log('[VIEWER STATE]', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
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
    console.log('[VIEWER] WS disconnected');
    if (joinInterval) clearInterval(joinInterval);
    setTimeout(connect, 2000);
  };
}

connect();
