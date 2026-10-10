const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '../public/dashboard/index.html');
const indexHtmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniCam Dashboard</title>
  <style>
    body { font-family: sans-serif; background: #0a0a0c; color: #fff; padding: 20px; margin: 0; }
    
    /* Header Bar */
    .dashboard-header {
      background: #16161a; border: 1px solid #2a2a32; padding: 15px 20px;
      border-radius: 8px; margin-bottom: 20px;
      display: flex; justify-content: space-between; align-items: center;
    }
    
    .brand-logo { display: flex; align-items: center; gap: 12px; }
    .brand-logo-text { font-family: sans-serif; font-weight: 900; font-size: 20px; letter-spacing: 4px; color: #fff; text-transform: uppercase; }
    
    .meta-data { color: #8e8e93; font-family: monospace; font-size: 12px; margin-top: 4px; }
    
    .obs-badge {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 12px; border-radius: 4px; border: 1px solid #2a2a32;
      background: #000; font-family: monospace; font-size: 12px; font-weight: bold;
    }
    .obs-badge.connected { color: #34c759; border-color: #34c759; }
    .obs-badge.disconnected { color: #ff3b30; border-color: #ff3b30; }
    
    .summary-counters { display: flex; gap: 15px; font-family: monospace; font-size: 14px; }
    .summary-item { display: flex; flex-direction: column; align-items: center; background: #000; padding: 8px 15px; border-radius: 4px; border: 1px solid #2a2a32; }
    .summary-item span:last-child { font-weight: bold; font-size: 18px; margin-top: 4px; }
    
    .global-actions { display: flex; gap: 10px; }
    
    .btn { background: #2a2a32; color: white; border: 1px solid #444; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-family: sans-serif; font-weight: bold; font-size: 12px; }
    .btn:hover { background: #333; }
    .btn-green { background: rgba(52, 199, 89, 0.2); color: #34c759; border-color: #34c759; }
    .btn-red { background: rgba(255, 59, 48, 0.2); color: #ff3b30; border-color: #ff3b30; }

    /* Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    
    /* Cards */
    .card { background: #16161a; border-radius: 8px; padding: 15px; border: 2px solid #2a2a32; display: flex; flex-direction: column; transition: border-color 0.2s; }
    .card.program { border-color: #ff3b30; }
    .card.preview { border-color: #34c759; }
    .card.offline { border-color: #33333a; opacity: 0.8; }
    
    .card.add-cam { align-items: center; justify-content: center; text-align: center; border-style: dashed; }
    #qr-container { background: #fff; padding: 10px; border-radius: 8px; margin-top: 15px; display: inline-block; }
    #qr-container img { max-width: 200px; display: block; margin: 0 auto; }
    .qr-instruction { font-size: 0.9em; color: #aaa; margin-top: 15px; max-width: 200px; line-height: 1.4; }
    .qr-url { margin-top: 10px; color: #4da6ff; font-family: monospace; font-size: 12px; word-break: break-all; }

    /* LED Meter */
    .led-meter-container { display: flex; gap: 2px; align-items: center; background: #0a0a0c; padding: 6px; border-radius: 4px; border: 1px solid #2a2a32; width: 100%; box-sizing: border-box; justify-content: center; margin-top: -5px; border-top-left-radius: 0; border-top-right-radius: 0; }
    .led-segment { flex: 1; height: 10px; background: #1e1e24; border-radius: 1px; transition: background-color 0.1s; }
    .led-segment.active-green { background: #34c759; box-shadow: 0 0 4px #34c759; }
    .led-segment.active-yellow { background: #ffd600; box-shadow: 0 0 4px #ffd600; }
    .led-segment.active-red { background: #ff3b30; box-shadow: 0 0 4px #ff3b30; }

    /* Telemetry Chips */
    .telemetry-row { display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap; }
    .telemetry-chip { background: #0a0a0c; border: 1px solid #2a2a32; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #ddd; display: flex; align-items: center; }

    /* Copy URL */
    .copy-url-box { display: flex; margin-top: 15px; gap: 5px; }
    .copy-url-box input { flex: 1; background: #0a0a0c; border: 1px solid #2a2a32; color: #8e8e93; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; }

    /* Sony-Style Battery */
    .battery-container { display: flex; align-items: center; gap: 4px; }
    .battery-body { width: 20px; height: 10px; border: 1px solid #aaa; border-radius: 2px; padding: 1px; position: relative; background: rgba(0,0,0,0.5); }
    .battery-level { height: 100%; width: 0%; background-color: #34c759; border-radius: 1px; transition: width 0.3s, background-color 0.3s; }
    .battery-nipple { width: 2px; height: 4px; background: #aaa; border-radius: 0 1px 1px 0; }
  </style>
</head>
<body>
  
  <!-- OBS Settings Modal -->
  <div id="obs-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center;">
    <div style="background:#16161a; padding:20px; border-radius:8px; border:1px solid #2a2a32; width: 350px;">
      <h3 style="margin-top:0;">Pengaturan OBS WebSocket</h3>
      <input type="text" id="obs-url" placeholder="ws://127.0.0.1:4455" style="width:100%; padding:10px; margin-bottom:10px; background:#0a0a0c; border:1px solid #2a2a32; color:#fff; box-sizing:border-box; border-radius:4px;">
      <input type="password" id="obs-pwd" placeholder="Password" style="width:100%; padding:10px; margin-bottom:15px; background:#0a0a0c; border:1px solid #2a2a32; color:#fff; box-sizing:border-box; border-radius:4px;">
      <div style="display:flex; justify-content:space-between;">
        <button class="btn" id="btn-close-modal">Batal</button>
        <button class="btn btn-green" id="btn-save-settings">Simpan</button>
      </div>
    </div>
  </div>

  <div class="dashboard-header">
    <div>
      <div class="brand-logo">
        <div class="brand-logo-text">OMNICAM BROADCAST</div>
      </div>
      <div class="meta-data">
        Server: <span id="server-url"></span> | OBS Port: <span id="obs-port">3001</span>
      </div>
    </div>
    
    <div class="summary-counters">
      <div class="summary-item">
        <span>TOTAL KAMERA</span>
        <span id="count-total">0</span>
      </div>
      <div class="summary-item" style="color: #ff3b30; border-color: rgba(255,59,48,0.3);">
        <span>LIVE (PROGRAM)</span>
        <span id="count-program">0</span>
      </div>
      <div class="summary-item" style="color: #34c759; border-color: rgba(52,199,89,0.3);">
        <span>STANDBY (PREVIEW)</span>
        <span id="count-preview">0</span>
      </div>
    </div>

    <div style="display: flex; gap: 15px; align-items: center;">
      <div class="obs-badge disconnected" id="obs-badge">
        <span id="obs-status-text">[ OBS TERPUTUS ]</span>
        <button class="btn" id="btn-obs-reconnect" style="padding: 4px 8px; font-size: 10px; margin-left: 10px;">[ RECONNECT ]</button>
      </div>
      
      <div class="global-actions">
        <!-- Optional global mute later -->
        <button class="btn" id="btn-refresh">[ REFRESH ]</button>
      </div>
    </div>
  </div>

  <div class="grid" id="cam-grid">
    <div class="card add-cam">
      <h3 style="margin-top:0;">Tambah Kamera</h3>
      <button class="btn btn-green" id="btn-add">Buat QR Code Baru</button>
      <div id="qr-container"></div>
      <div class="qr-instruction">Scan menggunakan Google Chrome di Wi-Fi yang sama</div>
    </div>
  </div>

  <script type="module" src="/dashboard/dashboard.js"></script>
</body>
</html>`;
fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf8');

const dashboardJsPath = path.join(__dirname, '../public/dashboard/dashboard.js');
let dashboardJs = fs.readFileSync(dashboardJsPath, 'utf8');

// Replace elements for new logic
const dashboardJsNew = `import { createEnvelope } from '../shared/protocol.js';

document.getElementById('server-url').innerText = window.location.hostname;
document.getElementById('obs-port').innerText = parseInt(window.location.port || 443) + 1;

const grid = document.getElementById('cam-grid');
const btnAdd = document.getElementById('btn-add');
const qrContainer = document.getElementById('qr-container');

const obsModal = document.getElementById('obs-modal');
document.getElementById('btn-obs-reconnect').onclick = () => {
  obsModal.style.display = 'flex';
};
document.getElementById('btn-close-modal').onclick = () => {
  obsModal.style.display = 'none';
};

// Connection Banner
const banner = document.createElement('div');
banner.style = "position: fixed; top: 0; left: 0; width: 100%; background: #d9534f; color: white; text-align: center; padding: 5px; z-index: 9999; display: none;";
banner.innerText = "Dashboard terputus, menyambung ulang...";
document.body.appendChild(banner);

function updateObsStatus(connected) {
  const badge = document.getElementById('obs-badge');
  const text = document.getElementById('obs-status-text');
  if (badge && text) {
    if (connected) {
      badge.className = 'obs-badge connected';
      text.innerText = '[ OBS TERHUBUNG ]';
    } else {
      badge.className = 'obs-badge disconnected';
      text.innerText = '[ OBS TERPUTUS ]';
    }
  }
}

async function loadSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  document.getElementById('obs-url').value = data.obsWsUrl || '';
  document.getElementById('obs-pwd').value = data.passwordSaved ? '********' : '';
  updateObsStatus(data.obsConnected);
}

document.getElementById('btn-save-settings').onclick = async () => {
  const obsWsUrl = document.getElementById('obs-url').value;
  const obsWsPassword = document.getElementById('obs-pwd').value;
  const btn = document.getElementById('btn-save-settings');
  btn.disabled = true;
  btn.innerText = 'Menyimpan...';
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ obsWsUrl, obsWsPassword })
  });
  btn.innerText = 'Disimpan!';
  setTimeout(() => { 
    btn.innerText = 'Simpan'; 
    btn.disabled = false; 
    obsModal.style.display = 'none';
  }, 1000);
};

document.getElementById('btn-refresh').onclick = () => {
  loadCamerasSnapshot();
};

loadSettings();

let ws;
const cameras = new Map(); // camId -> card Element
const webrtcs = new Map(); // camId -> RTCPeerConnection
let reconnectAttempts = 0;

function updateSummaryCounters() {
  let program = 0;
  let preview = 0;
  let total = cameras.size;
  
  cameras.forEach((card, id) => {
    if (card.classList.contains('program')) program++;
    else if (card.classList.contains('preview')) preview++;
  });
  
  document.getElementById('count-total').innerText = total;
  document.getElementById('count-program').innerText = program;
  document.getElementById('count-preview').innerText = preview;
}

function connect() {
  ws = new WebSocket(\`wss://\${window.location.host}\`);
  
  ws.onopen = () => {
    console.log('WS connected');
    banner.style.display = 'none';
    reconnectAttempts = 0;
    ws.send(JSON.stringify(createEnvelope('dashboard_join', 'dashboard', 'server')));
    loadCamerasSnapshot();
  };
  
  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'obs_status') {
      updateObsStatus(msg.payload.connected);
    } else if (msg.type === 'cam_join') {
      await patchCamera(msg.payload.camId || msg.payload.id || msg.from, { id: msg.payload.camId || msg.payload.id || msg.from, tally: 0, status: 'online' });
    } else if (msg.type === 'cam_leave') {
      const camId = msg.payload.camId || msg.from;
      updateCameraUI(camId, { status: 'offline' });
    } else if (msg.type === 'cam_remove') {
      const camId = msg.payload.camId || msg.from;
      removeCamera(camId);
    } else if (msg.type === 'telemetry') {
      const camId = msg.from;
      updateCameraUI(camId, { lastTelemetry: msg.payload });
    } else if (msg.type === 'tally') {
      const camId = msg.payload.camId || msg.from;
      updateCameraUI(camId, { tally: msg.payload.state });
    } else if (msg.type === 'offer') {
      handleWebRTCOffer(msg);
    } else if (msg.type === 'ice') {
      const pcInfo = webrtcs.get(msg.from);
      if (pcInfo && pcInfo.pc && msg.payload.candidate && !msg.payload.candidate.candidate.includes('.local')) {
        if (pcInfo.pc.remoteDescription && pcInfo.pc.remoteDescription.type) {
           await pcInfo.pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate)).catch(err => console.warn(err));
        } else {
           pcInfo.iceQueue.push(msg.payload.candidate);
        }
      }
    }
  };
  
  ws.onclose = () => {
    banner.style.display = 'block';
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts) + Math.random() * 1000, 30000);
    setTimeout(connect, delay);
  };
}

async function handleWebRTCOffer(msg) {
  const camId = msg.from; 
  const viewerId = msg.to; 
  let pcInfo = webrtcs.get(camId);
  
  if (pcInfo && pcInfo.pc) pcInfo.pc.close();
  
  const pc = new RTCPeerConnection({ iceServers: [] });
  pcInfo = { pc, iceQueue: [], viewerId };
  webrtcs.set(camId, pcInfo);

  const videoEl = document.getElementById(\`preview-vid-\${camId}\`);
  const inboundStream = new MediaStream();
  let srcObjectSet = false;
  
  pc.ontrack = (event) => {
    if (!videoEl) return;
    if (!srcObjectSet) {
      if (event.streams && event.streams[0]) {
        videoEl.srcObject = event.streams[0];
      } else {
        inboundStream.addTrack(event.track);
        videoEl.srcObject = inboundStream;
      }
      srcObjectSet = true;
      videoEl.play().catch(() => {});
      const placeholder = document.getElementById(\`preview-placeholder-\${camId}\`);
      if (placeholder) placeholder.style.display = 'none';
      videoEl.style.display = 'block';
    } else if (!event.streams || !event.streams[0]) {
      inboundStream.addTrack(event.track);
    }
  };
  
  pc.onicecandidate = (event) => {
    if (event.candidate && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope('ice', viewerId, camId, { candidate: event.candidate })));
    }
  };
  
  await pc.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
  let answer = await pc.createAnswer();
  const maxKbps = 500;
  const minKbps = 50;
  const startKbps = 250;
  answer.sdp = answer.sdp.replace(/(a=fmtp:\\d+ .*)/g, \`$1;x-google-max-bitrate=\${maxKbps};x-google-min-bitrate=\${minKbps};x-google-start-bitrate=\${startKbps}\`);
  
  await pc.setLocalDescription(answer);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(createEnvelope('answer', viewerId, camId, { sdp: pc.localDescription })));
  }

  while (pcInfo.iceQueue.length > 0) {
    const candidate = pcInfo.iceQueue.shift();
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

async function loadCamerasSnapshot() {
  try {
    const res = await fetch('/api/cameras');
    const list = await res.json();
    
    const currentIds = new Set(cameras.keys());
    for (const cam of list) {
      currentIds.delete(cam.id);
      await patchCamera(cam.id, cam);
    }
    for (const staleId of currentIds) {
      removeCamera(staleId);
    }
  } catch (err) {}
}

async function patchCamera(id, data) {
  if (!cameras.has(id)) {
    const div = document.createElement('div');
    div.className = 'card cam-card offline';
    div.id = \`cam-card-\${id}\`;
    
    const obsUrl = \`http://127.0.0.1:\${parseInt(window.location.port || 443) + 1}/view/index.html?camId=\${id}&obs=1\`;

    div.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="font-weight: bold; font-size: 18px;" id="name-\${id}"></div>
        <button id="btn-rename-\${id}" class="btn" style="padding: 4px 8px; font-size: 10px;">[ UBAH ]</button>
      </div>
      
      <div id="preview-container-\${id}" style="position: relative; width: 100%; height: 180px; background: #000; border-radius: 4px; border-bottom-left-radius: 0; border-bottom-right-radius: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; display: none;">
         <div id="preview-placeholder-\${id}" style="color: #888;">Menunggu video...</div>
         <video id="preview-vid-\${id}" muted autoplay playsinline style="width: 100%; height: 100%; object-fit: contain; display: none;"></video>
      </div>
      
      <div id="audio-meter-\${id}" class="led-meter-container" style="display: none;">
        \${Array(16).fill(0).map((_, i) => \`<div class="led-segment" id="audio-seg-\${id}-\${i}"></div>\`).join('')}
      </div>
      
      <div class="telemetry-row">
        <div class="telemetry-chip" id="tel-res-\${id}">[ -- ]</div>
        <div class="telemetry-chip" id="tel-bit-\${id}">[ 0.0 Mbps ]</div>
        <div class="telemetry-chip" id="tel-loss-\${id}">[ LOSS: 0 ]</div>
        <div class="telemetry-chip">
          <div class="battery-container">
            <div class="battery-body"><div id="bat-lvl-\${id}" class="battery-level"></div></div>
            <div class="battery-nipple"></div>
            <div id="bat-txt-\${id}" style="margin-left: 4px;">--%</div>
          </div>
        </div>
      </div>
      
      <div class="copy-url-box">
        <input type="text" id="obs-url-\${id}" value="\${obsUrl}" readonly>
        <button class="btn" id="btn-copy-\${id}">[ SALIN / COPY ]</button>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button class="btn btn-green" id="btn-obs-\${id}" style="flex: 1;">[ + Tambah Otomatis ke OBS ]</button>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <label style="flex: 1; display: flex; align-items: center; justify-content: center; background: #2a2a32; border-radius: 4px; font-size: 12px; cursor: pointer;">
          <input type="checkbox" id="chk-preview-\${id}" style="margin-right: 5px;"> Preview
        </label>
        <button class="btn btn-red" id="btn-disconnect-\${id}" style="flex: 1; display: none;">[ Putuskan ]</button>
        <button class="btn btn-red" id="btn-delete-\${id}" style="flex: 1; display: none;">[ Hapus ]</button>
      </div>
    \`;
    
    grid.insertBefore(div, grid.firstChild);
    cameras.set(id, div);
    
    document.getElementById(\`btn-rename-\${id}\`).onclick = async () => {
      const currentName = document.getElementById(\`name-\${id}\`).textContent;
      const newName = prompt('Ubah Nama Kamera:', currentName);
      if (newName && newName !== currentName) {
        await fetch('/api/cameras/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camId: id, name: newName })
        });
        document.getElementById(\`name-\${id}\`).textContent = newName;
      }
    };
    
    document.getElementById(\`btn-copy-\${id}\`).onclick = () => {
      const input = document.getElementById(\`obs-url-\${id}\`);
      input.select();
      document.execCommand('copy');
      const btn = document.getElementById(\`btn-copy-\${id}\`);
      btn.innerText = '[ DISALIN ]';
      setTimeout(() => btn.innerText = '[ SALIN / COPY ]', 2000);
    };

    document.getElementById(\`btn-obs-\${id}\`).onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = '[ Menambahkan... ]';
      const res = await fetch('/api/obs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camId: id })
      });
      const resData = await res.json();
      if (resData.success) {
        e.target.textContent = resData.exists ? '[ Diperbarui di OBS ]' : '[ Berhasil Ditambahkan ]';
      } else {
        alert('Gagal: ' + resData.error);
        e.target.textContent = '[ + Tambah Otomatis ke OBS ]';
        e.target.disabled = false;
      }
    };

    document.getElementById(\`btn-delete-\${id}\`).onclick = async () => {
      if (confirm('Hapus kamera ini?')) {
        try {
          const res = await fetch(\`/api/cameras/\${id}\`, { method: 'DELETE' });
          if (res.ok) {
            removeCamera(id);
          } else {
            alert('Gagal menghapus kamera');
          }
        } catch (e) {
          alert('Gagal menghapus kamera');
        }
      }
    };

    document.getElementById(\`btn-disconnect-\${id}\`).onclick = () => {
      if (confirm('Putuskan kamera ini?')) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(createEnvelope('disconnect', 'dashboard', id)));
        }
      }
    };

    let viewerId = null;
    let isPreviewing = false;

    const togglePreview = (enable) => {
      if (enable && !isPreviewing) {
        viewerId = 'dash-' + Math.random().toString(36).substring(2, 10);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(createEnvelope('cam_join', viewerId, 'server', { camId: id })));
        }
        document.getElementById(\`preview-container-\${id}\`).style.display = 'flex';
        document.getElementById(\`audio-meter-\${id}\`).style.display = 'flex';
        isPreviewing = true;
      } else if (!enable && isPreviewing) {
        document.getElementById(\`preview-container-\${id}\`).style.display = 'none';
        document.getElementById(\`audio-meter-\${id}\`).style.display = 'none';
        if (viewerId) {
          if (webrtcs.has(id)) {
            webrtcs.get(id).pc.close();
            webrtcs.delete(id);
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(createEnvelope('viewer_disconnect', viewerId, id)));
          }
        }
        viewerId = null;
        isPreviewing = false;
      }
    };

    const chkPreview = document.getElementById(\`chk-preview-\${id}\`);
    chkPreview.onchange = (e) => {
      togglePreview(e.target.checked);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (isPreviewing) {
          togglePreview(false);
          chkPreview.dataset.wasChecked = 'true';
        }
      } else if (document.visibilityState === 'visible') {
        if (chkPreview.dataset.wasChecked === 'true') {
          chkPreview.checked = true;
          togglePreview(true);
          delete chkPreview.dataset.wasChecked;
        }
      }
    });
  }

  updateCameraUI(id, data);
}

function updateCameraUI(id, data) {
  const card = cameras.get(id);
  if (!card) return;

  if (data.name !== undefined) {
    document.getElementById(\`name-\${id}\`).textContent = data.name || \`CAM \${id.substring(0, 4)}\`;
  }
  
  if (data.tally !== undefined) {
    card.classList.remove('program', 'preview', 'offline');
    if (data.status === 'offline') {
      card.classList.add('offline');
    } else {
      if (data.tally === 2) card.classList.add('program');
      else if (data.tally === 1) card.classList.add('preview');
    }
  }

  if (data.status) {
    const placeholder = document.getElementById(\`preview-placeholder-\${id}\`);
    const videoEl = document.getElementById(\`preview-vid-\${id}\`);
    const btnDelete = document.getElementById(\`btn-delete-\${id}\`);
    const btnDisconnect = document.getElementById(\`btn-disconnect-\${id}\`);
    
    if (data.status === 'offline') {
      card.classList.add('offline');
      card.classList.remove('program', 'preview');
      if (btnDelete) btnDelete.style.display = 'block';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = 'Kamera terputus';
        placeholder.style.color = '#ff3b30';
      }
      if (videoEl) videoEl.style.display = 'none';
      
      const pcInfo = webrtcs.get(id);
      if (pcInfo && pcInfo.pc) {
        pcInfo.pc.close();
        webrtcs.delete(id);
      }
    } else if (data.status === 'online') {
      card.classList.remove('offline');
      if (btnDelete) btnDelete.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'block';
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = 'Menunggu video...';
        placeholder.style.color = '#888';
      }
      if (videoEl) videoEl.style.display = 'none';
      
      if (!webrtcs.has(id)) {
        const viewerId = 'dash-' + Math.random().toString(36).substring(2, 10);
        if (ws.readyState === WebSocket.OPEN && document.getElementById(\`chk-preview-\${id}\`).checked) {
          ws.send(JSON.stringify(createEnvelope('cam_join', viewerId, 'server', { camId: id })));
        }
      }
    }
  }

  if (data.lastTelemetry) {
    const batPercent = data.lastTelemetry.battery ? Math.round(data.lastTelemetry.battery * 100) : null;
    if (batPercent !== null) {
      const batLvl = document.getElementById(\`bat-lvl-\${id}\`);
      if (batLvl) {
        batLvl.style.width = batPercent + '%';
        if (batPercent > 40) batLvl.style.backgroundColor = '#34c759';
        else if (batPercent > 20) batLvl.style.backgroundColor = '#ffd600';
        else batLvl.style.backgroundColor = '#ff3b30';
      }
      const batTxt = document.getElementById(\`bat-txt-\${id}\`);
      if (batTxt) batTxt.innerText = batPercent + '%';
    }

    const bit = data.lastTelemetry.bitrate ? (data.lastTelemetry.bitrate / 1000000).toFixed(1) : '0.0';
    const fps = data.lastTelemetry.fps || 0;
    
    document.getElementById(\`tel-res-\${id}\`).innerText = \`[ 1080p\${fps} ]\`;
    document.getElementById(\`tel-bit-\${id}\`).innerText = \`[ \${bit} Mbps ]\`;

    const isMuted = data.lastTelemetry.isMuted;
    const audioLvl = data.lastTelemetry.audioLevel || 0;
    const barCount = Math.round((audioLvl / 100) * 16);
    
    for (let i = 0; i < 16; i++) {
      const seg = document.getElementById(\`audio-seg-\${id}-\${i}\`);
      if (seg) {
        seg.className = 'led-segment';
        if (!isMuted && i < barCount) {
          if (i < 10) seg.classList.add('active-green');
          else if (i < 14) seg.classList.add('active-yellow');
          else seg.classList.add('active-red');
        }
      }
    }
  }
  
  updateSummaryCounters();
}

function removeCamera(id) {
  const card = cameras.get(id);
  if (card) {
    card.remove();
    cameras.delete(id);
  }
  const pcInfo = webrtcs.get(id);
  if (pcInfo && pcInfo.pc) {
    pcInfo.pc.close();
    webrtcs.delete(id);
  }
  updateSummaryCounters();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
     webrtcs.forEach((pcInfo, camId) => {
       const videoEl = document.getElementById(\`preview-vid-\${camId}\`);
       if (videoEl) videoEl.pause();
     });
  } else {
     webrtcs.forEach((pcInfo, camId) => {
       const videoEl = document.getElementById(\`preview-vid-\${camId}\`);
       if (videoEl && videoEl.srcObject) videoEl.play().catch(()=>{});
     });
  }
});

btnAdd.onclick = async () => {
  btnAdd.disabled = true;
  btnAdd.innerText = 'Membuat...';
  try {
    const res = await fetch('/api/token');
    const data = await res.json();
    qrContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = data.qr;
    const a = document.createElement('div');
    a.className = 'qr-url';
    a.innerText = data.url;
    qrContainer.appendChild(img);
    qrContainer.appendChild(a);
  } catch (err) {
    alert('Gagal membuat QR');
  }
  btnAdd.innerText = 'Buat QR Code Baru';
  btnAdd.disabled = false;
};

connect();
`;

fs.writeFileSync(dashboardJsPath, dashboardJsNew, 'utf8');

console.log("Dashboard Update Done.");
