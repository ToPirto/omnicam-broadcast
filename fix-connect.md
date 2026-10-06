Read docs/HANDOFF.md, GEMINI.md and docs/STATUS.md. Do NOT start Phase 4.

Prefix commands with: $env:PATH = "C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd;" + $env:PATH

and use npm.cmd. Quote the project path. Show real command output as evidence for every step.

Before changing code, reproduce the bug and tell me the EXACT root cause.



VERIFIED on real hardware: the phone (Android Chrome) can open https://192.168.1.27:3000/ (network,

firewall, certificate OK). After scanning a FRESH QR, the /cam page still gets stuck at

"Menghubungkan (Signaling)..." with 0 kbps | 0 fps and never streams (it once showed

"Terautentikasi"). The camera preview works. The arrow/dropdown button at the bottom-left of the phone

UI does nothing and its box is empty. Tally already works with real OBS.



TASKS:

1\. Reproduce with Puppeteer (page A = phone with fake camera flags and allow-insecure-certs, page B =

&#x20;  dashboard). Read server logs and public/cam/sender.js and src/signaling.js. Report the exact reason

&#x20;  the signaling/auth fails (reused one-time token, wrong wss URL/port, auth handshake, exception

&#x20;  before the WebSocket opens, etc.). Log every state transition on the phone page to the console

&#x20;  AND show the last error on screen (what happened + what to do, in Indonesian).

2\. Fix pairing: the QR token stays one-time, but after a successful pairing the server issues a

&#x20;  per-session token stored in sessionStorage, used to re-authenticate after refresh, screen off,

&#x20;  Wi-Fi drop or server restart (exponential backoff + jitter). Add a "Sambungkan ulang" button.

3\. Fix the camera dropdown: call getUserMedia first, then enumerateDevices, fill the list with real

&#x20;  labels (front/back/lenses), switch camera on change without dropping the connection, and show a

&#x20;  clear message if permission is denied. Replace the unlabeled arrow with a visible labeled control.

4\. Add landscape mode: the sender page must work in portrait AND landscape (responsive layout,

&#x20;  HUD and tally border adapt, manifest "orientation": "any"). Add a "Layar penuh + kunci landscape"

&#x20;  button using Fullscreen API + screen.orientation.lock('landscape') with a graceful fallback

&#x20;  message ("Aktifkan Putar Otomatis di HP"). Request 1920x1080 with width > height when landscape,

&#x20;  and re-negotiate/update the video track on orientation change so /view and OBS get 16:9 video.

5\. Verify the WebRTC pipeline end to end (phone sender -> signaling -> /view page). Add an e2e test

&#x20;  proving /view receives frames: video.videoWidth > 0, currentTime advancing, getStats framesDecoded

&#x20;  increasing, in portrait and in landscape (emulate with page.setViewport / fake device).

6\. Stale cameras: heartbeat (ping 5 s, timeout 15 s), mark offline, notify dashboard.

7\. Send telemetry at 1 Hz (bitrate, fps, RTT, packet loss, battery) so "Menunggu data..." goes away.

8\. Fix dashboard "OBS Tidak Terhubung" bug (GET /api/settings returns obsConnected; saving settings

&#x20;  reconnects immediately; never return the OBS password, use passwordSaved: true).

9\. Make add-to-OBS idempotent (SetInputSettings if the input exists) with a friendly message.

10\. Run npm.cmd test and npm.cmd run test:e2e, show full output. Update STATUS.md (VERIFIED vs NOT

&#x20;   verified), update HANDOFF.md, git commit.

