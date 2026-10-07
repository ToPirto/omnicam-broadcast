# OmniCam Broadcast v1.0

A self-hosted, browser-based ultra-low-latency wireless camera system designed for multi-camera live streaming in houses of worship, auditoriums, and live events.

OmniCam turns standard Android smartphones into high-definition wireless cameras transmitting directly to OBS Studio over a local Wi-Fi network (LAN). It operates 100% offline with zero external internet dependencies and requires no native app installation on mobile devices.

---

## Key Highlights

* Ultra-Low Latency: Native browser-to-browser WebRTC transmission (<200 ms latency over local LAN).
* High Quality: Supports up to 1080p30 at 5000 kbps utilizing mobile hardware video encoders (Qualcomm Snapdragon / MediaTek).
* Complete Offline Operation: Operates entirely on an isolated local network without internet access.
* Integrated Studio Tally: Real-time visual tally feedback on the mobile viewfinder synchronized with OBS Studio Mode (Red = Program / On-Air, Green = Preview, Grey = Standby).
* One-Click OBS Integration: Automatically creates and configures OBS Browser Sources with native audio routing via OBS WebSocket v5.
* Battery & Thermal Protection: Includes a dedicated OLED screen blackout mode and adaptive quality regulation to safeguard mobile hardware during extended broadcasts.

---

## System Architecture

OmniCam runs a dual-port server architecture:

1. HTTPS Server (Port 3000 / LAN IP): Serves the Web Management Dashboard and the mobile camera transmitter page (`/cam`) with automated self-signed SSL generation required for browser camera and microphone permissions.
2. Plain HTTP Localhost Listener (Port 3001): Bound strictly to `127.0.0.1` specifically for OBS Studio Browser Sources. This bypasses the Chromium Embedded Framework (CEF) security restriction in OBS that prevents loading self-signed HTTPS certificates.

---

## Prerequisites

* Host Computer: Windows 10/11, macOS, or Linux running OBS Studio.
* Mobile Camera: Android smartphone running Google Chrome (iOS Safari supported with browser-specific constraints).
* Dedicated Wi-Fi Router: A 5 GHz dual-band router (AC1200 or higher recommended) to eliminate 2.4 GHz packet collisions.
* Host Connection: Ethernet cable connecting the host laptop directly to the router.
* Runtime: Node.js version 18.0.0 or higher.
* Broadcast Software: OBS Studio version 28.0.0 or higher (tested on OBS Studio 28.1.2 with built-in WebSocket v5).

---

## Step-by-Step Setup Guide

Follow these steps in order to connect your Android phone camera to OBS Studio.

---

### Step 1: Configure OBS Studio WebSocket

OmniCam connects directly to OBS Studio to control sources and send Tally signals.

1. Open OBS Studio on your host machine.
2. In the top menu bar, click Tools -> WebSocket Server Settings.
3. Check the box "Enable WebSocket server".
4. Set the Server Port to 4455.
5. Under Authentication:
* If enabled, click Show Connect Info to view your password.
* (Optional for offline local setups): You can uncheck "Enable Authentication" to run without a password.


6. Click Apply, then OK. Keep OBS open.

---

### Step 2: Install and Start OmniCam Server

1. Open a terminal (PowerShell or Bash) on your host computer.
2. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/<your-username>/omnicam-broadcast.git
cd omnicam-broadcast

```

3. Install project dependencies:

```bash
npm install

```

4. Start the OmniCam server:

```bash
npm start

```

5. Keep this terminal window open. The server will display:

* Dashboard URL: `https://localhost:3000`
* OBS Local URL: `[http://127.0.0.1:3001](http://127.0.0.1:3001)`
* LAN Access URL: `https://<YOUR_LOCAL_IP>:3000`

---

### Step 3: Connect Dashboard to OBS

1. Open Google Chrome on your host computer and navigate to: `https://localhost:3000`.
2. Accept the self-signed certificate prompt by clicking Advanced -> Proceed to localhost (unsafe).
3. Scroll down to the OBS WebSocket Settings panel:
* URL: `ws://127.0.0.1:4455` (default).
* Password: Enter your OBS WebSocket password from Step 1 (leave blank if authentication was disabled).


4. Click Simpan & Reconnect OBS.
5. Look at the top header: it will display `OBS Terhubung` in green text, indicating a successful bridge connection.

---

### Step 4: Connect Your Android Phone

1. Connect your Android phone to the same Wi-Fi network as the host computer.
2. On the dashboard, click "Buat QR Baru" on the right card.
3. Open your phone camera or QR scanner and scan the QR code. Open the link in Google Chrome.
4. On your phone, accept the SSL warning by tapping Advanced -> Proceed.
5. Tap Allow when Chrome requests Camera and Microphone permissions.
6. Mobile Viewfinder Configuration:
* Camera Selector: Choose `camera 2, facing back`.
* Quality Preset: Select `1080p30 (5000 kbps)`.
* Orientation: Tap "Layar penuh + kunci landscape" and rotate your phone horizontally.


7. Tap the start button. The status at the top will change to: `WebRTC Terhubung (Live)`.

---

### Step 5: Add Camera to OBS Studio

You can route the incoming camera stream to OBS using either automatic or manual provisioning:

#### Option A: Automatic Provisioning (Recommended)

1. On your host dashboard (`https://localhost:3000`), find your active camera card.
2. Click the green button: "+ Tambah Otomatis ke OBS".
3. The button will update to "Berhasil Diperbarui di OBS".
4. In OBS Studio, a new Browser Source matching the camera name will automatically appear under the active scene with 1920x1080 resolution and audio routing enabled.

#### Option B: Manual Setup

1. On your dashboard camera card, copy the URL provided in the text box:
`[http://127.0.0.1:3001/view/index.html?camId=](http://127.0.0.1:3001/view/index.html?camId=)<CAM_ID>&obs=1`
2. In OBS Studio, under Sources, click + -> Browser.
3. Name the source (e.g., `Cam 1`) and paste the copied URL into the URL field.
4. Set Width to 1920 and Height to 1080.
5. Check the box "Control audio via OBS" (critical for routing microphone sound).
6. Click OK.

---

### Step 6: Verify Video, Audio, and Tally

1. Video: In OBS Studio, confirm that the live 1080p camera feed is displaying smoothly.
2. Audio: Speak near the phone. In the OBS Audio Mixer, confirm that the green volume bar for Browser bounces dynamically.
3. Tally Lights:
* In OBS Studio Mode, switch the camera scene to Program (Live / Right screen): the border around your phone screen turns RED.
* Switch the camera scene to Preview (Next / Left screen): the border around your phone screen turns GREEN.
* Switch to another scene: the border turns GREY.



---

## Viewfinder Controls on Mobile

* Layar hitam hemat baterai: Tap this button to turn the phone screen completely black during long events (sermons, speeches) to prevent overheating and save battery. Video encoding and streaming continue uninterrupted in the background. Touch and hold the screen for 2 seconds to turn the display back on.
* Mute: Tap to silence the microphone instantly.
* Diag: Tap the small Diag label in the bottom-right corner to open real-time WebRTC telemetry (hardware encoder model, measured bitrate, frames per second, packet loss, and round-trip time).

---

## Automated Verification & Testing

OmniCam includes unit tests and headless browser integration suites:

```bash
# Run unit test suite (Vitest)
npm test

# Run end-to-end browser integration suite (Puppeteer)
npm run test:e2e

```

The test runner validates camera session persistence across re-scans, OBS bridge reconnection, SDP bitrate munging, and end-to-end audio/video stream continuity.

---

## Troubleshooting Guide

1. Error: "Gagal: Not connected to OBS"
* Confirm Tools -> WebSocket Server Settings in OBS has "Enable WebSocket server" checked.
* Confirm port is 4455 and the password in the dashboard matches OBS.


2. OBS Browser Source Displays a Blank Screen
* Ensure the URL in OBS starts with `[http://127.0.0.1:3001/](http://127.0.0.1:3001/)` (plain HTTP), not `https://`. OBS CEF blocks untrusted local SSL certificates.


3. Audio Meter Does Not Move in OBS
* Open the Browser Source properties in OBS.
* Verify that the URL ends with `&obs=1`.
* Verify that "Control audio via OBS" is checked.


4. Video Is Choppy or Drops Resolution
* In the mobile Diag panel, check if Loss is high.
* Connect the mobile phone to a 5 GHz Wi-Fi network and connect the host laptop via an Ethernet cable.


5. Phone Cannot Reach the Dashboard URL
* In your router management settings, turn AP Isolation / Client Isolation OFF.
* In Windows Defender Firewall, allow Node.js inbound connections on Private Networks.



---

## Technical Specifications

| Parameter | Specification |
| --- | --- |
| Video Codec | H.264 Baseline/Main (Hardware Accelerated via NDK / MediaFoundation) |
| Audio Codec | Opus Stereo (48 kHz) |
| Signaling Transport | WebSocket (`ws` protocol) with custom JSON envelope |
| Supported Resolutions | 720p30 (2500 kbps), 1080p30 (5000 kbps), 1080p60 (8000 kbps) |
| Local Latency | ~120 ms - 180 ms over 5 GHz Wi-Fi |
| Control Interface | Responsive Web Management Dashboard (Vanilla JS + CSS) |
| OBS Protocol | OBS WebSocket v5 protocol (`obs-websocket-js`) |
| Platform Compatibility | Windows 10/11 (Host), Android 10+ Chrome (Camera Sender) |

---

## License

This project is developed for community broadcast use and licensed under the MIT License.