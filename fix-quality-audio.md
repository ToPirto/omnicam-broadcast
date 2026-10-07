Read docs/HANDOFF.md and docs/STATUS.md. Branch fix-quality-audio. Prefix commands with:
$env:PATH = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:PATH ; use npm.cmd.
Quote the project path. Never loosen a test assertion. Show real output. Reproduce/measure before
fixing, report root causes first. Do ONLY these tasks.

VERIFIED on real hardware (Android Chrome, OBS 28.1.2, same Wi-Fi): video reaches OBS via
http://127.0.0.1 and tally works. REMAINING PROBLEMS:
A. With preset "1080p30 (5000 kbps)" actual bitrate is only 470-1000 kbps (never ~2000+). Motion looks
   blocky and laggy in OBS (visible compression blocks).
B. fps shown is 39-60 while the preset is 30 (telemetry sums framesEncoded/bytesSent across all peer
   connections: OBS viewer + dashboard preview).
C. No audio reaches OBS. The Audio Mixer shows a "Browser" meter at 0.0 dB (silent).
D. Need a mute/unmute button on the phone. Default orientation should be landscape.

TASKS:
1. Measure first: log per peer connection getStats (outbound-rtp: codec/mimeType via codecId,
   encoderImplementation, frameWidth/Height, framesPerSecond, targetBitrate, qualityLimitationReason,
   availableOutgoingBitrate, bytesSent delta). Report which encoder is used (hardware H.264 vs software),
   and whether qualityLimitationReason is "cpu" or "bandwidth". Show the evidence before changing.
2. Bitrate: apply maxBitrate AND a sensible minimum start via SDP (x-google-start-bitrate,
   x-google-min-bitrate, x-google-max-bitrate) and setParameters before/at first negotiation; keep
   degradationPreference 'maintain-resolution' and contentHint 'motion'. Remove the external STUN server
   when on a LAN (use host candidates only unless Internet mode is enabled). Ensure H.264 is preferred
   and fall back cleanly. Dashboard preview connections must be low (scaleResolutionDownBy, 15 fps,
   ~500 kbps) and must not reduce the OBS connection. Consider not sending preview when the dashboard
   tab is hidden. Report achieved kbps in the e2e log.
3. Telemetry (B): compute fps and bitrate PER peer connection from deltas, report the OBS viewer
   (id not starting with "dash-") as the main numbers, clamp fps to the capture fps, and add a unit test.
4. Audio (C): on /view do NOT set the video element muted when it runs inside OBS (use a query flag
   like ?obs=1 added by "Tambah Otomatis ke OBS"; keep muted for normal browser tabs). Ensure the
   microphone track is added to the OBS viewer connection, with echoCancellation/noiseSuppression/
   autoGainControl toggles (default off for OBS use, Opus stereo 48 kHz). Show an audio level meter on
   the phone HUD and log audio outbound-rtp bytesSent. e2e: with Chrome fake audio device assert the
   /view page receives audio (inbound-rtp audio bytesReceived increasing).
5. UI (D): add "Mute / Unmute" button on the phone (toggle audioTrack.enabled, clear state indicator,
   and report mute state to the dashboard card). Default to landscape: manifest orientation "landscape"
   and try screen.orientation.lock after the first user tap with graceful fallback; request width>height.
6. Also on update-OBS: SetInputSettings with 1920x1080 and reroute_audio true.
7. Run npm.cmd test and npm.cmd run test:e2e (120 s timeout), show full output. Update STATUS.md
   (VERIFIED vs NOT VERIFIED) and HANDOFF.md, commit. Stop after this.