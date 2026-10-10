const fs = require('fs');
const path = require('path');

const senderJsPath = path.join(__dirname, '../public/cam/sender.js');
let code = fs.readFileSync(senderJsPath, 'utf8');

// Update setup panel & camera population logic
const populateLogic = `async function populateCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    camSelect.innerHTML = '';
    const setupCamSelect = document.getElementById('setup-cam-select');
    if (setupCamSelect) setupCamSelect.innerHTML = '';
    
    videoDevices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.text = d.label || \`\${window.i18n[currentLang].camDefault} \${i + 1}\`;
      camSelect.appendChild(opt);
      
      if (setupCamSelect) {
        const opt2 = document.createElement('option');
        opt2.value = d.deviceId;
        opt2.text = opt.text;
        setupCamSelect.appendChild(opt2);
      }
    });
    if (videoDevices.length > 0 && !currentDeviceId) {
      const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
      currentDeviceId = backCam ? backCam.deviceId : videoDevices[0].deviceId;
      camSelect.value = currentDeviceId;
      if (setupCamSelect) setupCamSelect.value = currentDeviceId;
    }
  } catch (err) {
    console.warn('Could not populate cameras before getUserMedia', err);
  }
}`;

// Replace audio chip bindings & menu toggle logic
const menuInitLogic = `
  // Setup audio chips
  const bindAudioChip = (btnId, chkId) => {
    const btn = document.getElementById(btnId);
    const chk = document.getElementById(chkId);
    if (btn && chk) {
      btn.onclick = () => {
        chk.checked = !chk.checked;
        if (chk.checked) btn.classList.add('active');
        else btn.classList.remove('active');
        chk.dispatchEvent(new Event('change'));
      };
    }
  };
  bindAudioChip('btn-chip-echo', 'chk-echo');
  bindAudioChip('btn-chip-noise', 'chk-noise');
  bindAudioChip('btn-chip-agc', 'chk-agc');

  // Menu drawer toggle
  if (btnProMenu && proMenuPanel) {
    btnProMenu.onclick = () => {
      const isHidden = proMenuPanel.style.display === 'none';
      proMenuPanel.style.display = isHidden ? 'flex' : 'none';
      if (zoomContainer) {
        if (isHidden) zoomContainer.style.display = 'none';
        else if (localStream && zoomCapable) zoomContainer.style.display = 'flex';
      }
    };
  }
  if (btnCloseMenu && proMenuPanel) {
    btnCloseMenu.onclick = () => {
      proMenuPanel.style.display = 'none';
      if (localStream && zoomCapable && zoomContainer) zoomContainer.style.display = 'flex';
    };
  }

  // Setup screen preset sync
  const setupQualityPreset = document.getElementById('setup-quality-preset');
  const setupCamSelect = document.getElementById('setup-cam-select');
  if (setupQualityPreset && qualityPreset) {
    setupQualityPreset.onchange = (e) => { qualityPreset.value = e.target.value; };
  }
  if (setupCamSelect && camSelect) {
    setupCamSelect.onchange = (e) => { camSelect.value = e.target.value; };
  }
`;

console.log('Script ready for execution');
