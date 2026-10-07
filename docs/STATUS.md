# OmniCam Broadcast - Status Tracker

## ✅ Done
- Phase 1: Environment + Docs + Architecture
- Phase 2: Core Server + WebRTC + Dashboard
  - Verified with evidence (Puppeteer e2e Test): Dashboard loads without 404s, QR code generation works, and OBS status renders correctly.
- Phase 3: OBS WebSocket bridge & Tally
  - Verified with evidence (Unit Tests): OBS Scene extraction logic and OBS reconnection handling.
  - Verified with evidence (Puppeteer e2e Test): Mocking tally endpoint in server and asserting dynamic UI border color changes.

## 🔄 In Progress
- Phase 4: Adaptive quality & telemetry
  - VERIFIED: E2E test proves frames reach viewer even across landscape orientation changes.
  - VERIFIED: Telemetry correctly tracks bitrate and frames per peer, and main numbers reflect OBS.
  - VERIFIED: E2E test validates HTTP 127.0.0.1 `/view` to bypass OBS CEF HTTPS rejection.
  - VERIFIED: Quality presets apply correctly via dropdown and cap dashboard viewers to save bandwidth. SDP munging applies min, start, max bitrates.
  - VERIFIED: Disconnect logic properly cleans up state and stops auto-reconnecting on both client and dashboard.
  - VERIFIED: Audio track connects to OBS (unmuted), supports mute/unmute, and toggles for echo/noise/agc.

## 🐛 Known Bugs
- None known.

## 📋 Next Steps
- Move to Phase 5: Remote control & talkback
