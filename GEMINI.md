# OmniCam Agent Rules

## Design Decision
- Pure PWA, no native app.
- Stack: Node.js, fastify, ws, qrcode, selfsigned, bonjour-service, obs-websocket-js.
- UI in Indonesian (default Dark mode), Code/Comments in English.
- No placeholder code.

## Architecture
1. **Mobile Sender (`/cam`)**: Connects via QR. WebRTC direct to OBS.
2. **Desktop Server**: HTTPS Node.js signaling relay (no media processing).
3. **OBS Receiver (`/view/:camId`)**: OBS Browser source displaying WebRTC video.

## Security
- One-time tokens for pairing, session tokens for reconnect.
- LAN-only default binding.

## Phases
1. Docs & Setup
2. Signaling & WebRTC prototype
3. OBS WebSocket bridge & Tally
4. Adaptive quality & telemetry
5. Remote control & talkback
6. Internet mode (Tailscale, etc)
7. Final polish & README
