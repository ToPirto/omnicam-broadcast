# OmniCam Broadcast - Handoff

## 4. Work Done
- Identified and fixed signaling root cause: Reconnection was failing because the client sent `new-cam` and no session token, falling back to a consumed QR one-time token. Fixed by assigning `camId` and `sessionToken` properly and saving them to `sessionStorage`.
- Updated sender UI: Added real camera enumeration with dropdown, orientation/landscape lock API, `1920x1080` constraints toggling on `orientationchange`, and a fallback message for auth failure.
- Implemented per-peer telemetry tracking at 1Hz (`pc.getStats`) for both audio and video, clamping FPS to avoid outliers.
- Improved OBS API route: Made `addBrowserSource` idempotent, applied `reroute_audio: true`, and handled `passwordSaved: true`.
- Fixed `test-browser.js` by removing explicit `video.play()`, adding audio tests, and mocking `obsBridge.updateTally`.
- Added SDP munging for start/min/max bitrates and Opus stereo, fixed audio routing and unmute in OBS, and added UI controls for audio options.
- Locked landscape orientation in manifest and screen API.

## 5. Current State
- The WebRTC pipeline has been end-to-end verified with E2E tests, including audio reception and telemetry calculations.
- Quality presets implemented with SDP constraints to prevent blockiness, ensuring high-quality OBS feeds.
- Mute/Unmute buttons, audio toggles, and audio level meters added.
- `npm run test:e2e` and `npm test` are both fully passing.

## 7. Next Steps for Next Agent
- Begin **Phase 5: Remote control & talkback**.
- Ensure to check `STATUS.md` and read `GEMINI.md` before proceeding.
