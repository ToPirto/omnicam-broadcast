# OmniCam Architecture

## System Overview
OmniCam Broadcast is a low-latency WebRTC streaming system from mobile devices to OBS Studio.
It is designed to work efficiently on a local area network (LAN) with optional internet extensions.

### 1. Mobile Sender (PWA)
- URL: `/cam?token=...`
- Functions: Requests camera/mic, sets constraints (WebRTC), authenticates to server, initiates SDP Offer, streams media directly to OBS.
- Telemetry: Reports battery, bitrate, RTT, etc., periodically.

### 2. Node.js Signaling Server
- Entry: `npm start`
- HTTPS enabled automatically via `selfsigned` for `getUserMedia` to work.
- WebSocket relay: Forwards SDP and ICE candidates between Phone and OBS.
- Features: Dashboard at `/`, Camera connection registry, OBS WebSocket controller, mDNS advertiser.

### 3. OBS Receiver
- URL: `/view/:camId` inside OBS Browser Source.
- Functions: Connects to signaling server, waits for SDP Offer, returns SDP Answer, renders incoming video.

## Security
- Endpoints use single-use pairing tokens for initialization.
- Reconnection relies on persistent session tokens.
- No media touches the signaling server.
