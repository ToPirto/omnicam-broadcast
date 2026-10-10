const fs = require('fs');
const path = require('path');

const senderJsPath = path.join(__dirname, '../public/cam/sender.js');
let js = fs.readFileSync(senderJsPath, 'utf8');

// Update menu toggle logic
const menuOld = `  if (btnProMenu && proMenuPanel) {
    btnProMenu.onclick = () => {
      proMenuPanel.style.display = proMenuPanel.style.display === 'none' ? 'flex' : 'none';
    };
    if (btnCloseMenu) {
      btnCloseMenu.onclick = () => proMenuPanel.style.display = 'none';
    }
  }`;

const menuNew = `  if (btnProMenu && proMenuPanel) {
    btnProMenu.onclick = () => {
      proMenuPanel.classList.add('open');
      if (zoomContainer) zoomContainer.style.display = 'none';
    };
    if (btnCloseMenu) {
      btnCloseMenu.onclick = () => {
        proMenuPanel.classList.remove('open');
        if (zoomContainer && localStream) {
          const track = localStream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps.zoom) zoomContainer.style.display = 'flex';
        }
      };
    }
  }`;

js = js.replace(menuOld, menuNew);


// Update audio filter UI logic
const audioFilterLogic = `
  // Audio Filter Chips
  ['echo', 'noise', 'agc'].forEach(f => {
    const btn = document.getElementById('btn-chk-' + f);
    const chk = document.getElementById('chk-' + f);
    if (btn && chk) {
      btn.onclick = () => {
        chk.checked = !chk.checked;
        if (chk.checked) btn.classList.add('active');
        else btn.classList.remove('active');
        if (localStream) {
          startCamera(currentDeviceId);
        }
      };
    }
  });
`;
// Insert before updateLanguage
js = js.replace('currentLang = localStorage.getItem(\'omnicam_lang\') || \'id\';', audioFilterLogic + '\n  currentLang = localStorage.getItem(\'omnicam_lang\') || \'id\';');


// Powersave animations
const powersaveOld = `    let pressTimer;
    powersaveOverlay.addEventListener('mousedown', startPress);
    powersaveOverlay.addEventListener('touchstart', startPress);
    powersaveOverlay.addEventListener('mouseup', cancelPress);
    powersaveOverlay.addEventListener('mouseleave', cancelPress);
    powersaveOverlay.addEventListener('touchend', cancelPress);
    
    function startPress(e) {
      e.preventDefault();
      pressTimer = window.setTimeout(() => {
        powersaveOverlay.style.display = 'none';
      }, 2000);
    }
    function cancelPress() {
      clearTimeout(pressTimer);
    }`;

const powersaveNew = `    let pressTimer;
    let progressInterval;
    const progressCircle = document.getElementById('powersave-progress');
    
    powersaveOverlay.addEventListener('mousedown', startPress);
    powersaveOverlay.addEventListener('touchstart', startPress);
    powersaveOverlay.addEventListener('mouseup', cancelPress);
    powersaveOverlay.addEventListener('mouseleave', cancelPress);
    powersaveOverlay.addEventListener('touchend', cancelPress);
    
    function startPress(e) {
      if (e) e.preventDefault();
      if (progressCircle) {
        progressCircle.style.transition = 'stroke-dashoffset 2s linear';
        progressCircle.style.strokeDashoffset = '0';
      }
      pressTimer = window.setTimeout(() => {
        powersaveOverlay.style.display = 'none';
        if (progressCircle) {
          progressCircle.style.transition = 'none';
          progressCircle.style.strokeDashoffset = '176';
        }
      }, 2000);
    }
    function cancelPress() {
      clearTimeout(pressTimer);
      if (progressCircle) {
        progressCircle.style.transition = 'none';
        progressCircle.style.strokeDashoffset = '176';
      }
    }`;
js = js.replace(powersaveOld, powersaveNew);


// Language Translation mappings and updates
const btnLangOld = `if (btnLangToggle) btnLangToggle.innerText = currentLang.toUpperCase();`;
const btnLangNew = `if (btnLangToggle) btnLangToggle.innerText = currentLang === 'id' ? '[ ID | en ]' : '[ id | EN ]';`;
js = js.replace(btnLangOld, btnLangNew);

const gridOld = `btnGridToggle.innerText = isGridOn ? 'ON' : 'OFF';`;
const gridNew = `btnGridToggle.innerText = isGridOn ? '[ ON ]' : '[ OFF ]';`;
js = js.replace(gridOld, gridNew);

const btnGridSetupOld = `if (btnGridToggle) btnGridToggle.innerText = isGridOn ? 'ON' : 'OFF';`; // If there's any initialization... wait, let's just make sure it initializes:
const gridInit = `if (btnGridToggle) btnGridToggle.innerText = isGridOn ? '[ ON ]' : '[ OFF ]';`;
js = js.replace('if (btnLangToggle) btnLangToggle.innerText', gridInit + '\n    if (btnLangToggle) btnLangToggle.innerText');


// Update HUD status translations to handle 'Menunggu' properly
// since it replaces span, we need to adapt it. Wait, the old code already has status mapping.

// Update telemetry badges
const telemetryTickOld = `      resolutionEl.innerText = \`\${s.width}x\${s.height} @ \${Math.round(s.frameRate || 0)}fps\`;
      const kbps = (currentBitrate / 1000).toFixed(0);
      bitrateEl.innerText = \`\${kbps} kbps\`;
      lossEl.innerText = \`Loss: \${stats.loss}\`;`;

const telemetryTickNew = `      resolutionEl.innerText = \`[ \${s.width}x\${s.height} @ \${Math.round(s.frameRate || 0)}fps ]\`;
      const mbps = (currentBitrate / 1000000).toFixed(1);
      bitrateEl.innerText = \`[ \${mbps} Mbps ]\`;
      lossEl.innerText = \`[ LOSS: \${stats.loss} ]\`;`;
js = js.replace(telemetryTickOld, telemetryTickNew);


const batterySaverOld = `      if (powersaveBattery) powersaveBattery.innerText = \`Bat: \${batPercent}%\`;
      if (powersaveBitrate) powersaveBitrate.innerText = \`\${kbps} kbps\`;`;

const batterySaverNew = `      if (powersaveBattery) powersaveBattery.innerText = \`Bat: \${batPercent}%\`;
      if (powersaveBitrate) {
         const s = localStream ? localStream.getVideoTracks()[0].getSettings() : {};
         const mbps = (currentBitrate / 1000000).toFixed(1);
         powersaveBitrate.innerText = \`\${mbps} Mbps | \${Math.round(s.frameRate || 0)} fps\`;
      }
      
      const psName = document.getElementById('powersave-cam-name');
      if (psName) psName.innerText = document.getElementById('cam-name-display').innerText;
      
      const psTallyBadge = document.getElementById('powersave-tally-badge');
      if (psTallyBadge) {
        const border = document.getElementById('powersave-tally');
        if (border.classList.contains('tally-red')) {
          psTallyBadge.innerText = '[ PROGRAM / ON-AIR ]';
          psTallyBadge.style.background = '#ff3b30';
        } else if (border.classList.contains('tally-green')) {
          psTallyBadge.innerText = '[ PREVIEW ]';
          psTallyBadge.style.background = '#34c759';
          psTallyBadge.style.color = '#000';
        } else {
          psTallyBadge.innerText = '[ STANDBY ]';
          psTallyBadge.style.background = '#33333a';
          psTallyBadge.style.color = '#fff';
        }
      }
      
      const psBatLvl = document.getElementById('powersave-battery-level');
      const psBatText = document.getElementById('powersave-battery-text');
      if (psBatLvl && psBatText) {
         psBatLvl.style.width = batPercent + '%';
         if (batPercent > 40) psBatLvl.style.backgroundColor = '#34c759';
         else if (batPercent > 20) psBatLvl.style.backgroundColor = '#ffd600';
         else psBatLvl.style.backgroundColor = '#ff3b30';
         psBatText.innerText = batPercent + '%';
      }
`;
js = js.replace(batterySaverOld, batterySaverNew);


// Setup Camera logic mapping to setup screen
const setupCamOld = `  camSelect.onchange = async () => {
    currentDeviceId = camSelect.value;
    await startCamera(currentDeviceId);
  };`;

const setupCamNew = `  camSelect.onchange = async () => {
    currentDeviceId = camSelect.value;
    await startCamera(currentDeviceId);
  };
  const setupCamSelect = document.getElementById('setup-cam-select');
  if (setupCamSelect) {
     setupCamSelect.onchange = () => {
       currentDeviceId = setupCamSelect.value;
       camSelect.value = currentDeviceId;
     };
  }
  const setupQualityPreset = document.getElementById('setup-quality-preset');
  if (setupQualityPreset) {
     setupQualityPreset.onchange = () => {
       qualityPreset.value = setupQualityPreset.value;
     };
  }
`;
js = js.replace(setupCamOld, setupCamNew);

// Populate cameras also needs to target setup screen
const populateCamOld = `  camSelect.innerHTML = '';
  videoDevices.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.text = d.label || \`\${window.i18n[currentLang].camDefault} \${i + 1}\`;
    camSelect.appendChild(opt);
  });
  if (videoDevices.length > 0 && !currentDeviceId) {
    // Prefer back camera by default
    const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('belakang'));
    currentDeviceId = backCam ? backCam.deviceId : videoDevices[0].deviceId;
    camSelect.value = currentDeviceId;
  }`;

const populateCamNew = `  camSelect.innerHTML = '';
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
  }`;
js = js.replace(populateCamOld, populateCamNew);

// Fix btn-start to call populateCameras BEFORE startCamera... wait, btnStart.onclick already does this.

fs.writeFileSync(senderJsPath, js, 'utf8');
console.log("Sender update JS done.");
