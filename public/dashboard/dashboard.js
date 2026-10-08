import { createEnvelope } from '../shared/protocol.js';

document.getElementById('server-url').innerText = `https://${window.location.host}`;

const grid = document.getElementById('cam-grid');
const btnAdd = document.getElementById('btn-add');
const qrContainer = document.getElementById('qr-container');

// Connection Banner
const banner = document.createElement('div');
banner.style = "position: fixed; top: 0; left: 0; width: 100%; background: #d9534f; color: white; text-align: center; padding: 5px; z-index: 9999; display: none;";
banner.innerText = "Dashboard terputus, menyambung ulang...";
document.body.appendChild(banner);

function updateObsStatus(connected) {
  const statusEl = document.getElementById('obs-status');
  if (statusEl) {
    statusEl.innerHTML = connected ? ' - <span style="color:#0f0;">OBS Terhubung</span>' : ' - <span style="color:#f00;">OBS Tidak Terhubung (Buka OBS dan aktifkan WebSocket Server)</span>';
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
const cameras = new Map(); // camId -> card Element
const webrtcs = new Map(); // camId -> RTCPeerConnection
let reconnectAttempts = 0;

function connect() {
  ws = new WebSocket(`wss://${window.location.host}`);
  
  ws.onopen = () => {
    console.log('WS connected');
    banner.style.display = 'none';
    reconnectAttempts = 0;
    ws.send(JSON.stringify(createEnvelope('dashboard_join', 'dashboard', 'server')));
    loadCamerasSnapshot();
  };
  
  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    // Task 4: removed per-message "WS msg type" console.log
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
  const camId = msg.from; // Offer comes from camera
  const viewerId = msg.to; // This specific dashboard viewer ID
  let pcInfo = webrtcs.get(camId);
  
  if (pcInfo && pcInfo.pc) pcInfo.pc.close();
  
  const pc = new RTCPeerConnection({ iceServers: [] });
  pcInfo = { pc, iceQueue: [], viewerId };
  webrtcs.set(camId, pcInfo);

  const videoEl = document.getElementById(`preview-vid-${camId}`);
  const inboundStream = new MediaStream();
  let srcObjectSet = false;
  
  pc.ontrack = (event) => {
    if (!videoEl) return;
    // Idempotent: set srcObject exactly once per peer connection
    if (!srcObjectSet) {
      // Sender uses addTransceiver (sendonly) which does not associate
      // tracks with a stream, so event.streams is empty. Build our own.
      if (event.streams && event.streams[0]) {
        videoEl.srcObject = event.streams[0];
      } else {
        inboundStream.addTrack(event.track);
        videoEl.srcObject = inboundStream;
      }
      srcObjectSet = true;
      // Ignore AbortError from play(); no retry loop
      videoEl.play().catch(() => {});
      const placeholder = document.getElementById(`preview-placeholder-${camId}`);
      if (placeholder) placeholder.style.display = 'none';
      videoEl.style.display = 'block';
    } else if (!event.streams || !event.streams[0]) {
      // Additional tracks (audio) on same connection - add to existing stream
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
  answer.sdp = answer.sdp.replace(/(a=fmtp:\d+ .*)/g, `$1;x-google-max-bitrate=${maxKbps};x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps}`);
  
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
    
    // Mark all existing as potentially stale
    const currentIds = new Set(cameras.keys());
    
    for (const cam of list) {
      currentIds.delete(cam.id);
      await patchCamera(cam.id, cam);
    }
    
    // Remove cameras not in snapshot
    for (const staleId of currentIds) {
      removeCamera(staleId);
    }
  } catch (err) {
    console.error('Snapshot error:', err);
  }
}

async function patchCamera(id, data) {
  if (!cameras.has(id)) {
    // Create new card
    const div = document.createElement('div');
    div.className = 'card cam-card';
    div.id = `cam-card-${id}`;
    
    div.innerHTML = `
      <h3 style="display: flex; justify-content: space-between; align-items: center;">
        <span id="name-${id}"></span>
        <button id="btn-rename-${id}" style="background: transparent; border: 1px solid #555; border-radius: 3px; color: #fff; font-size: 0.8em; cursor: pointer; padding: 2px 5px;" title="Ubah Nama">Ubah</button>
      </h3>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <p style="margin:0;">Terhubung <span id="tally-${id}" style="float: right; padding: 2px 5px; border-radius: 3px; font-size: 0.8em; background: #555; color: #fff;">OFF</span></p>
        <label style="font-size: 0.8em; cursor: pointer; color: #aaa;"><input type="checkbox" id="chk-preview-${id}"> Preview</label>
      </div>
      
      <div id="preview-container-${id}" style="position: relative; width: 100%; height: 180px; background: #000; margin-bottom: 10px; border-radius: 5px; overflow: hidden; display: flex; align-items: center; justify-content: center; display: none;">
         <div id="preview-placeholder-${id}" style="color: #888;">Menunggu video...</div>
         <video id="preview-vid-${id}" muted autoplay playsinline style="width: 100%; height: 100%; object-fit: contain; display: none;"></video>
      </div>

      <div id="telemetry-${id}" style="color: #aaa; font-size: 0.9em; margin-bottom: 10px;">
        Menunggu data...
      </div>
      <a href="http://127.0.0.1:${parseInt(window.location.port || 443) + 1}/view/index.html?camId=${id}&obs=1" target="_blank" style="color: #4da6ff;">Buka di Tab Baru (Untuk OBS)</a>
      <br><br>
      <input type="text" value="http://127.0.0.1:${parseInt(window.location.port || 443) + 1}/view/index.html?camId=${id}&obs=1" readonly onclick="this.select(); document.execCommand('copy'); alert('Disalin!')" style="width: 100%; padding: 5px; margin-bottom: 10px; border-radius: 3px; border: 1px solid #555; background: #333; color: #fff; box-sizing: border-box;" title="URL OBS (Klik untuk copy)">
      <button class="btn-add-obs" id="btn-obs-${id}" style="background: #28a745; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; margin-bottom: 10px; width: 100%;">+ Tambah Otomatis ke OBS</button>
      <button id="btn-disconnect-${id}" style="background: #dc3545; color: white; width: 100%; padding: 10px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">Putuskan</button>
      <button id="btn-delete-${id}" style="background: #dc3545; color: white; width: 100%; padding: 10px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 10px; display: none;">Hapus</button>
      <div style="font-size: 0.8em; color: #666;">ID: ${id}</div>
    `;
    
    // Add to DOM BEFORE grid.firstChild (which is the add card or other cameras)
    grid.insertBefore(div, grid.firstChild);
    cameras.set(id, div);
    
    document.getElementById(`btn-rename-${id}`).onclick = async () => {
      const currentName = document.getElementById(`name-${id}`).textContent;
      const newName = prompt('Ubah Nama Kamera:', currentName);
      if (newName && newName !== currentName) {
        await fetch('/api/cameras/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camId: id, name: newName })
        });
        document.getElementById(`name-${id}`).textContent = newName;
      }
    };

    document.getElementById(`btn-obs-${id}`).onclick = async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Menambahkan...';
      const res = await fetch('/api/obs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camId: id })
      });
      const resData = await res.json();
      if (resData.success) {
        e.target.textContent = resData.exists ? 'Berhasil Diperbarui di OBS' : 'Berhasil Ditambahkan';
      } else {
        alert('Gagal: ' + resData.error);
        e.target.textContent = '+ Tambah Otomatis ke OBS';
        e.target.disabled = false;
      }
    };

    document.getElementById(`btn-delete-${id}`).onclick = async () => {
      console.log('btn-delete clicked!');
      if (confirm('Hapus kamera ini?')) {
        console.log('confirmed hapus');
        try {
          const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
          console.log('fetch res:', res.status);
          if (res.ok) {
            removeCamera(id);
            console.log('removed camera from DOM');
          } else {
            console.log('fetch failed');
            alert('Gagal menghapus kamera');
          }
        } catch (e) {
          console.log('fetch error', e);
          alert('Gagal menghapus kamera');
        }
      } else {
        console.log('not confirmed');
      }
    };

    document.getElementById(`btn-disconnect-${id}`).onclick = () => {
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
        document.getElementById(`preview-container-${id}`).style.display = 'flex';
        isPreviewing = true;
      } else if (!enable && isPreviewing) {
        document.getElementById(`preview-container-${id}`).style.display = 'none';
        if (viewerId) {
          if (webrtcs.has(id)) {
            webrtcs.get(id).pc.close();
            webrtcs.delete(id);
          }
          // Optional: we can send viewer_disconnect so sender cleans up immediately
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(createEnvelope('viewer_disconnect', viewerId, id)));
          }
        }
        viewerId = null;
        isPreviewing = false;
      }
    };

    const chkPreview = document.getElementById(`chk-preview-${id}`);
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
    document.getElementById(`name-${id}`).textContent = data.name || `Kamera ${id.substring(0, 4)}`;
  }
  
  if (data.tally !== undefined) {
    const el = document.getElementById(`tally-${id}`);
    if (el) {
       if (data.tally === 2) {
         el.textContent = 'PROGRAM';
         el.style.background = '#f00';
         el.style.color = '#fff';
       } else if (data.tally === 1) {
         el.textContent = 'PREVIEW';
         el.style.background = '#0f0';
         el.style.color = '#000';
       } else {
         el.textContent = 'OFF';
         el.style.background = '#555';
         el.style.color = '#fff';
       }
    }
  }

  if (data.status) {
    const placeholder = document.getElementById(`preview-placeholder-${id}`);
    const videoEl = document.getElementById(`preview-vid-${id}`);
    const btnDelete = document.getElementById(`btn-delete-${id}`);
    const btnDisconnect = document.getElementById(`btn-disconnect-${id}`);
    if (data.status === 'offline') {
      if (btnDelete) btnDelete.style.display = 'block';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = 'Kamera terputus';
        placeholder.style.color = '#d9534f';
      }
      if (videoEl) videoEl.style.display = 'none';
      
      const pcInfo = webrtcs.get(id);
      if (pcInfo && pcInfo.pc) {
        pcInfo.pc.close();
        webrtcs.delete(id);
      }
    } else if (data.status === 'online') {
      if (btnDelete) btnDelete.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'block';
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = 'Menunggu video...';
        placeholder.style.color = '#888';
      }
      if (videoEl) videoEl.style.display = 'none';
      
      // Request WebRTC connection again if it was offline
      if (!webrtcs.has(id)) {
        const viewerId = 'dash-' + Math.random().toString(36).substring(2, 10);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(createEnvelope('cam_join', viewerId, 'server', { camId: id })));
        }
      }
    }
  }

  if (data.lastTelemetry) {
    const el = document.getElementById(`telemetry-${id}`);
    if (el) {
      const bat = data.lastTelemetry.battery ? Math.round(data.lastTelemetry.battery * 100) + '%' : 'N/A';
      const bit = data.lastTelemetry.bitrate ? Math.round(data.lastTelemetry.bitrate/1000) : 0;
      const fps = data.lastTelemetry.fps || 0;
      el.textContent = `Bat: ${bat} | Bitrate: ${bit} kbps | ${fps} fps`;
    }
  }
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
}

// Pause/resume preview based on visibility
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
     // pause videos
     webrtcs.forEach((pcInfo, camId) => {
       const videoEl = document.getElementById(`preview-vid-${camId}`);
       if (videoEl) videoEl.pause();
     });
  } else {
     // resume videos
     webrtcs.forEach((pcInfo, camId) => {
       const videoEl = document.getElementById(`preview-vid-${camId}`);
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
    const a = document.createElement('a');
    a.href = data.url;
    a.target = '_blank';
    a.style = "color: #4da6ff; word-break: break-all;";
    a.textContent = data.url;
    qrContainer.appendChild(img);
    qrContainer.appendChild(document.createElement('br'));
    qrContainer.appendChild(a);
  } catch (err) {
    alert('Gagal membuat QR');
  }
  btnAdd.innerText = 'Buat QR Baru';
  btnAdd.disabled = false;
};

connect();
