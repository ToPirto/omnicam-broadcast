# OmniCam Broadcast - Status Tracker

## ✅ Done
- Phase 1: Environment + Docs + Architecture
- Phase 2: Core Server + WebRTC + Dashboard
- Phase 3: OBS WebSocket bridge & Tally
- Phase 4: Adaptive quality & telemetry

### Verified (Evidence from automated tests)
- **Dashboard load & QR token**: VERIFIED (Puppeteer e2e)
- **OBS Bridge Scene Logic & Reconnect**: VERIFIED (Unit tests)
- **Tally UI logic**: VERIFIED (Puppeteer e2e)
- **WebRTC Pipeline & Peer Connections**: VERIFIED (Puppeteer e2e validates `127.0.0.1/view` streaming and HTTP bypass)
- **Telemetry deltas per peer**: VERIFIED (Puppeteer e2e)
- **SDP Munging (bitrates, Opus stereo)**: VERIFIED (Unit tests)
- **Disconnect cleanup & Reconnection backoff**: VERIFIED (Puppeteer e2e simulated offline)
- **Wake lock logic**: VERIFIED (Puppeteer e2e evaluates `visibilitychange`)
- **Audio meter & unmute checks**: VERIFIED (Puppeteer e2e with fake audio)

### Not Verified (Requires Real Hardware Testing)
- **[NOT VERIFIED]** Actual bitrate reaches ~2000+ kbps and blocky/laggy motion is resolved in OBS.
- **[NOT VERIFIED]** FPS shown matches exactly 30 on real hardware capture.
- **[NOT VERIFIED]** Audio routing to OBS produces audible sound (fake device in E2E produces silence, needs real microphone test).
- **[NOT VERIFIED]** Phone HUD layout in landscape mode on physical devices.
- **[NOT VERIFIED]** "Layar hitam hemat baterai" (Powersave) physically reduces heat and saves battery on real phone.
- **[NOT VERIFIED]** Battery level detection (`navigator.getBattery()`) triggers correct UI warnings on real Android phone.
- **[NOT VERIFIED]** QR scanning from physical phone successfully sets up `camId` persistently across reloads.
- **[NOT VERIFIED]** Renaming camera persists across reloads and displays correctly on physical dashboard monitor.
- **[NOT VERIFIED]** Real-world Wi-Fi drops on phone successfully trigger WebRTC reconnections seamlessly.

## 📋 Next Steps
- User to manually test the **[NOT VERIFIED]** hardware items using real phones (Android/iOS) and a live OBS instance.
- Report results and fix any discrepancies.
- Move to Phase 5: Remote control & talkback
