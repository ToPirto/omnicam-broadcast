Read docs/HANDOFF.md, GEMINI.md and docs/STATUS.md. Do NOT start adaptive bitrate, OLED blackout

or other Phase 4/5 features. Only do the tasks below.

Prefix commands with: $env:PATH = "C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd;" + $env:PATH

and use npm.cmd. Quote the project path. Show real command output as evidence. Reproduce each bug

before fixing it, and never loosen a test assertion to make it pass.



VERIFIED on real hardware (OBS 28.1.2, Android Chrome, same Wi-Fi): OBS status shows connected,

tally PROGRAM reaches the phone (red border), camera dropdown and landscape button work, phone

shows 2495 kbps. PROBLEMS:

A. Phone shows "WebRTC Terputus" and /view (https://localhost:3000/view/index.html?camId=...)

&#x20;  stays BLACK. The dashboard card still says "Menunggu data...".

B. Phone shows "147 fps" (impossible). The fps calculation is wrong.

C. The server terminal loops forever: "Disconnected from OBS WebSocket" / "Connected and

&#x20;  Identified to OBS WebSocket", several times per second.

D. The dashboard has no live camera preview.

E. The dashboard does not update by itself: after a phone connects or disconnects, the camera

&#x20;  cards and info only update after a manual page refresh.



TASKS:

1\. WebRTC (A): trace offer/answer/ICE between public/cam/sender.js, src/signaling.js and

&#x20;  public/view/viewer.js. Log connection/ICE state transitions and failure reasons on both sides.

&#x20;  Check: viewer opened before OR after the sender (a late joiner must trigger a new offer),

&#x20;  sender reconnect re-negotiating, ICE candidates arriving before setRemoteDescription (queue

&#x20;  them), mDNS ".local" host candidates the other side cannot resolve, iceConnectionState

&#x20;  "failed"/"disconnected" (do ICE restart with backoff), and multiple viewers for one camera

&#x20;  (dashboard preview + OBS view at the same time must both work; use one RTCPeerConnection per

&#x20;  viewer on the sender, or a clean per-viewer negotiation). /view must call video.play() muted

&#x20;  and retry automatically. Report the exact root cause.

2\. Real-network proof: Puppeteer test where the sender page uses the LAN URL

&#x20;  https://192.168.1.27:3000 (not localhost) and /view receives frames: assert videoWidth > 0,

&#x20;  videoHeight > 0, currentTime advancing between two samples, and framesDecoded increasing.

3\. fps (B): compute fps from the delta of framesSent/framesEncoded over elapsed seconds; bitrate

&#x20;  from the delta of bytesSent. Display sensible values.

4\. OBS loop (C): find why the bridge reconnects in a loop (duplicate clients, close handler

&#x20;  reconnecting while open, listeners registered repeatedly, saving settings creating a second

&#x20;  client, OBS kicking a second session). Guarantee exactly one OBS client, close the old one

&#x20;  before creating a new one, reconnect only when closed, use exponential backoff (max 30 s),

&#x20;  log only state changes. Add a unit test and show real output.

5\. Live preview (D): each connected camera card shows a live video thumbnail (muted, autoplay,

&#x20;  playsinline, about 320x180, object-fit contain) fed by a dedicated WebRTC viewer connection,

&#x20;  separate from the OBS /view connection. Use a lower-cost preview if possible (it must not

&#x20;  reduce the quality of the OBS feed; cap the preview with scaleResolutionDownBy or lower fps

&#x20;  on that viewer's connection only). Show a placeholder "Menunggu video..." until frames arrive

&#x20;  and "Kamera terputus" when the camera leaves. Pause preview for hidden tabs. Support 4 cameras

&#x20;  in a grid without freezing.

6\. Auto-update (E): on dashboard WebSocket connect, the server sends a full snapshot (cameras with

&#x20;  state, tally, telemetry, name, online/offline, plus obs status). Afterwards send incremental

&#x20;  events (cam\_join, cam\_leave, cam\_update, telemetry, tally, obs\_status). The dashboard patches

&#x20;  the DOM per camera by id (add, update, remove) and NEVER rebuilds all cards, so previews and

&#x20;  buttons are not reset. Auto-reconnect the dashboard WebSocket with backoff and re-request the

&#x20;  snapshot on reconnect. Show a small "Dashboard terputus, menyambung ulang..." banner while

&#x20;  disconnected. Escape all text (use textContent, no innerHTML with user data).

7\. Telemetry at 1 Hz reaches the dashboard card (battery, bitrate, fps, resolution, RTT, packet

&#x20;  loss) replacing "Menunggu data...". Heartbeat: ping every 5 s, mark offline after 15 s.

8\. E2E test for task 6: open the dashboard first, THEN connect a fake phone with Puppeteer, and

&#x20;  assert the card appears, shows telemetry and a preview with videoWidth > 0 WITHOUT reloading

&#x20;  the dashboard; then close the phone page and assert the card goes offline automatically.

9\. Remove scratch files (reproduce.js, fix.js, fix.cjs, tests/test-e2e.js if unused). Keep

&#x20;  puppeteer in devDependencies only.

10\. Run npm.cmd test and npm.cmd run test:e2e, show the FULL output. Update STATUS.md (VERIFIED

&#x20;   with evidence vs NOT VERIFIED; mark every real-phone item NOT VERIFIED until I report), update

&#x20;   HANDOFF.md sections 4, 5 and 7, and commit with an accurate message.

