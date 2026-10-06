# OmniCam Broadcast — HANDOFF (read this first in any new session)

## 1. Goal
A self-hosted, browser-based alternative to VDO.Ninja / Iriun for a church. The phone opens a web
page (PWA) via QR scan and becomes a camera. OBS Studio receives it through a Browser Source.
Priorities: stability (auto-reconnect), low latency (<200 ms on LAN), high quality (up to 1080p),
must work on a LAN with NO internet, optional internet mode (Tailscale / Cloudflare Tunnel /
coturn), easy for non-technical volunteers (<2 min to connect a camera).
User language: Indonesian. UI text Indonesian (English toggle), code/comments/docs English,
README Indonesian. Every error message must say what happened AND what to do next.
No native app: only Antigravity + OBS are available to the user.

## 2. Locked decisions
- Node.js + Fastify, `ws`, native browser WebRTC, `qrcode`, `selfsigned` (auto HTTPS),
  `bonjour-service` (mDNS omnicam.local), `obs-websocket-js` (OBS WebSocket v5).
- Control/tally/telemetry go over WebSocket, NOT DataChannel.
- Versioned JSON envelope {v, type, id, ts, seq, from, to, payload} (see docs/PROTOCOL.md).
- Never write a custom media server/codec. Never invent library APIs; verify docs, pin versions.
- Work one phase per session; plan first, then implement, test, Walkthrough with evidence,
  update docs/STATUS.md, commit. Do not start the next phase without being told.
- Never claim "done/tested" without real output as evidence. Separate "verified" from
  "NOT verified" in STATUS.md.

## 3. Environment facts
- OS: Windows. Project path: C:\Users\m2sm\Downloads\OmniCam By Too (contains spaces; always
  quote it; consider moving to C:\Projects\omnicam).
- Node, npm, git are installed in C:\Program Files but are NOT on PATH in the Antigravity
  terminal. Prefix commands with:
  $env:PATH = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:PATH
  and use npm.cmd / npx.cmd (PowerShell blocks npm.ps1).
- Server: `npm.cmd start` -> https://localhost:3000, LAN https://192.168.1.27:3000.
  Port overridable with env OMNICAM_PORT. Self-signed cert warning is expected.
- OBS Studio 28.1.2 (built-in WebSocket v5), port 4455, authentication on, Studio Mode on,
  scenes "Scene" and "Scene 2". The user must enable "Enable WebSocket server" in
  Tools > WebSocket Server Settings. OBS password is entered in the dashboard and saved in
  settings.json (do NOT write the password anywhere in docs or logs).
- Git: user.name/email are placeholders; user will replace them.
- The user's phone is Android (Chrome). The user has a free chat plan with limited messages.

## 4. What was done
- Phase 1-2: environment check, GEMINI.md/AGENTS.md, docs (ARCHITECTURE, PROTOCOL, RISKS,
  STATUS), Fastify server with HTTPS + WebSocket signaling, camera registry, dashboard,
  QR/token pairing, sender page (/cam), OBS receiver page (/view).
- Phase 3: src/obs.js (OBS WebSocket v5 bridge: scene/preview/studio-mode/item-visibility events,
  maps Browser Source URLs to camId, nested-scene resolution), tally state stored in the
  registry and pushed to the phone and dashboards (0=off/grey, 1=preview/green, 2=program/red),
  OBS settings in the dashboard (/api/settings -> settings.json), "+ Tambah Otomatis ke OBS"
  button (/api/obs/add -> CreateInput Browser Source), OBS reconnect logic, unit tests in
  test/obs.test.js (passing).
- Verification so far (real evidence): `npm test` passes; `npm run test:e2e` (Puppeteer,
  headless Chrome) passes, but it uses a test-only endpoint /api/test/tally that BYPASSES the
  OBS connection, so the real OBS path is not covered by e2e.
- Git commits exist (feat: complete Phase 3, test: fix e2e..., docs: update STATUS.md).

## 5. Current state / known bugs (as of the last session)
1. BLOCKING BUG (root cause found): the dashboard cannot load its script.
   - Browser requests https://localhost:3000/dashboard.js -> Fastify 404
     {"message":"Route GET:/dashboard.js not found"}.
   - VERIFIED by the user: https://localhost:3000/dashboard/dashboard.js and
     https://localhost:3000/shared/protocol.js both return code correctly, so static routes work.
   - Cause: public/dashboard/index.html references the script with a wrong/relative path.
   - Fix: use <script type="module" src="/dashboard/dashboard.js"></script> (dashboard.js uses
     `import { createEnvelope } from '../shared/protocol.js'`, so type="module" is required),
     and use absolute /dashboard/... paths for any CSS. Audit every <script>/<link>/fetch URL in
     dashboard, /cam and /view pages.
   - Symptoms: "Buat QR Code" button does nothing, "Server:" text is empty.
   - The e2e test missed this because it only tested the camera page. Add a dashboard e2e test.
2. src/server.js has a test endpoint /api/test/tally: restrict it to NODE_ENV=test only and make
   `npm run test:e2e` set that variable.
3. Dashboard shows no OBS connection status. "Server:" should show the address and OBS status
   (connected / not connected, with plain Indonesian hint such as "Buka OBS dan aktifkan
   WebSocket Server di Tools > WebSocket Server Settings").
4. When OBS is unreachable the server prints a full stack trace every few seconds
   (ECONNREFUSED 127.0.0.1:4455). Replace with one short message and exponential backoff.
5. Dashboard inserts cam.name into innerHTML (XSS risk). Escape it or use textContent.
6. No plain-text fallback URL is shown under the QR code (required: manual-IP fallback).
7. puppeteer must be in devDependencies. Move the project to a path without spaces if build
   problems appear.

## 6. NOT VERIFIED against real OBS / real phone (must be tested by the user)
- OBS WebSocket connection with password from the dashboard.
- "+ Tambah Otomatis ke OBS" actually creating a working Browser Source.
- Tally colors on a real phone via real OBS events (Studio Mode: Preview green, Program red,
  other scene grey; also a camera inside a nested scene).
- OBS restart recovery.
- Real video flowing phone -> /view page -> OBS, latency, 1080p.

## 7. NEXT ACTIONS (in order, one step at a time)
A. Fix bug 1 (script path), show proof with the browser subagent: zero 404, zero console errors,
   "Buat QR Code" renders a QR image + plain-text URL, "Server:" shows address + OBS status.
B. Add dashboard e2e test to `npm run test:e2e`; fix bugs 2-6; update STATUS.md; commit.
C. Give the user a short manual test list for real OBS + phone (section 6) and wait for results.
D. Only after the user reports Phase 3 works on real hardware: start Phase 4
   (telemetry 1 Hz, adaptive quality bitrate->fps->resolution with hysteresis, auto-reconnect with
   exponential backoff + jitter, ICE restart on network change, Wake Lock, OLED blackout mode, PWA).
E. Later phases: 5 remote control (zoom/torch/focus/WB/exposure, capability-checked, ACK/NACK),
   talkback (extra WebRTC audio track, headset warning), multi-camera (>=4), diagnostics page
   "Kenapa streamnya lag?", latency test tool. 6 Internet mode guides (Tailscale, Cloudflare
   Tunnel, coturn) + security review. 7 Indonesian README, church network guide (dedicated
   router, 5 GHz, AP isolation off, laptop on LAN cable, USB tethering), troubleshooting FAQ,
   docs/TESTING.md (30-min 1080p30 soak test, Wi-Fi drop, screen dim, OBS restart, talkback
   with earphone), honest Limitations section.

## 8. Honest browser limits (keep in UI and docs)
No SRT/HEVC in browsers; screen must stay on (Wake Lock); phone temperature not readable
(use heuristic "heat risk"); zoom/torch/focus/WB depend on phone and browser support;
iOS is more limited. Recommend a native Android app later if these matter.

## 9. How to work with this user
Explain steps simply in Indonesian, give exact commands, quote paths with spaces, and tell the
user precisely what to test on the real phone/OBS and what to report back.