import { createEnvelope } from '../shared/protocol.js';

document.getElementById('server-url').innerText = `https://${window.location.host}`;

const grid = document.getElementById('cam-grid');
const btnAdd = document.getElementById('btn-add');
const qrContainer = document.getElementById('qr-container');

function updateObsStatus(connected) {
  const statusEl = document.getElementById('obs-status');
  if (statusEl) {
    statusEl.innerHTML = connected ? ' - <span style="color:#0f0;">OBS Terhubung</span>' : ' - <span style="color:#f00;">OBS Tidak Terhubung (Buka OBS dan aktifkan WebSocket Server di Tools > WebSocket Server Settings)</span>';
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
  setTimeout(() => { btn.innerText = 'Simpan & Reconnect OBS'; btn.disabled = false; }, 2000);
};

loadSettings();

let ws;
const cameras = new Map();

function connect() {
  ws = new WebSocket(`wss://${window.location.host}`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify(createEnvelope('dashboard_join', 'dashboard', 'server')));
    loadCameras();
  };
  
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'obs_status') {
      updateObsStatus(msg.payload.connected);
    } else if (msg.type === 'cam_join' || msg.type === 'cam_leave') {
      loadCameras();
    } else if (msg.type === 'telemetry') {
      // Update telemetry on card
      const camId = msg.from;
      if (cameras.has(camId)) {
        const data = msg.payload;
        const el = document.getElementById(`telemetry-${camId}`);
        if (el) {
          el.innerHTML = `🔋 ${data.battery ? Math.round(data.battery * 100) + '%' : 'N/A'}<br>⚡ ${data.bitrate ? Math.round(data.bitrate/1000) : 0} kbps | ${data.fps || 0} fps`;
        }
      }
    } else if (msg.type === 'tally') {
      const camId = msg.payload.camId || msg.from;
      if (cameras.has(camId)) {
        const el = document.getElementById(`tally-${camId}`);
        if (el) {
           const state = msg.payload.state;
           if (state === 2) {
             el.innerText = 'PROGRAM';
             el.style.background = '#f00';
             el.style.color = '#fff';
           } else if (state === 1) {
             el.innerText = 'PREVIEW';
             el.style.background = '#0f0';
             el.style.color = '#000';
           } else {
             el.innerText = 'OFF';
             el.style.background = '#555';
             el.style.color = '#fff';
           }
        }
      }
    }
  };
  
  ws.onclose = () => setTimeout(connect, 2000);
}

async function loadCameras() {
  const res = await fetch('/api/cameras');
  const list = await res.json();
  
  // Clear old camera cards (keep the first add-cam card)
  const cards = grid.querySelectorAll('.cam-card');
  cards.forEach(c => c.remove());
  
  cameras.clear();
  list.forEach(cam => {
    cameras.set(cam.id, cam);
    const div = document.createElement('div');
    div.className = 'card cam-card';
    const tallyBg = cam.tally === 2 ? '#f00' : cam.tally === 1 ? '#0f0' : '#555';
    const tallyColor = cam.tally === 1 ? '#000' : '#fff';
    const tallyText = cam.tally === 2 ? 'PROGRAM' : cam.tally === 1 ? 'PREVIEW' : 'OFF';
    div.innerHTML = `
      <h3></h3>
      <p>● Terhubung <span id="tally-${cam.id}" style="float: right; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; background: ${tallyBg}; color: ${tallyColor};">${tallyText}</span></p>
      <div id="telemetry-${cam.id}" style="color: #aaa; font-size: 0.9em; margin-bottom: 10px;">
        Menunggu data...
      </div>
      <a href="/view/index.html?camId=${cam.id}" target="_blank" style="color: #4da6ff;">Buka di Tab Baru (Untuk OBS)</a>
      <br><br>
      <button class="btn-add-obs" data-id="${cam.id}" style="background: #28a745; margin-bottom: 10px; width: 100%;">+ Tambah Otomatis ke OBS</button>
      <div style="font-size: 0.8em; color: #666;">ID: ${cam.id}</div>
    `;
    div.querySelector('h3').textContent = cam.name;
    grid.insertBefore(div, grid.firstChild);
  });
  
  document.querySelectorAll('.btn-add-obs').forEach(btn => {
    btn.onclick = async (e) => {
      const camId = e.target.getAttribute('data-id');
      e.target.disabled = true;
      e.target.innerText = 'Menambahkan...';
      const res = await fetch('/api/obs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camId })
      });
      const data = await res.json();
      if (data.success) {
        e.target.innerText = data.exists ? 'Berhasil Diperbarui di OBS' : 'Berhasil Ditambahkan';
      } else {
        alert('Gagal: ' + data.error);
        e.target.innerText = '+ Tambah Otomatis ke OBS';
        e.target.disabled = false;
      }
    };
  });
}

btnAdd.onclick = async () => {
  btnAdd.disabled = true;
  btnAdd.innerText = 'Membuat...';
  try {
    const res = await fetch('/api/token');
    const data = await res.json();
    qrContainer.innerHTML = `<img src="${data.qr}" alt="QR Code"><br><a href="${data.url}" target="_blank" style="color: #4da6ff; word-break: break-all;">${data.url}</a>`;
  } catch (err) {
    alert('Gagal membuat QR');
  }
  btnAdd.innerText = 'Buat QR Baru';
  btnAdd.disabled = false;
};

connect();
