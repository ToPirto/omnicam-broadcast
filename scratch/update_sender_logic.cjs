const fs = require('fs');
const path = require('path');

const senderPath = path.join(__dirname, '../public/cam/sender.js');
let js = fs.readFileSync(senderPath, 'utf8');

// 1. Update Powersave Bitrate Formatting in Telemetry
const oldPowersaveBitrate = `    if (powersaveBitrate) {
      powersaveBitrate.innerText = mainValid ? \`\${Math.round(mainBitrate)} kbps\` : '- kbps';
    }`;

const newPowersaveBitrate = `    if (powersaveBitrate) {
      const mbps = mainValid ? (mainBitrate / 1000000).toFixed(1) : '0.0';
      const fpsStr = mainValid ? Math.round(mainFps) : 0;
      powersaveBitrate.innerText = \`\${mbps} Mbps | \${fpsStr} fps\`;
    }
    
    // Update Powersave UI elements
    const psCamName = document.getElementById('powersave-cam-name');
    if (psCamName && camNameDisplay) psCamName.innerText = camNameDisplay.innerText;
    
    const psTallyBadge = document.getElementById('powersave-tally-badge');
    const psTallyBorder = document.getElementById('powersave-tally');
    const mainTally = document.getElementById('tally-border');
    
    if (psTallyBadge && psTallyBorder && mainTally) {
      if (mainTally.classList.contains('tally-red')) {
        psTallyBadge.className = 'status-badge-tag program';
        psTallyBadge.textContent = '[ PROGRAM ]';
        psTallyBorder.style.borderColor = '#ff3b30';
      } else if (mainTally.classList.contains('tally-green')) {
        psTallyBadge.className = 'status-badge-tag preview';
        psTallyBadge.textContent = '[ PREVIEW ]';
        psTallyBorder.style.borderColor = '#34c759';
      } else {
        psTallyBadge.className = 'status-badge-tag standby';
        psTallyBadge.textContent = '[ STANDBY ]';
        psTallyBorder.style.borderColor = '#33333a';
      }
    }`;

if (js.includes(oldPowersaveBitrate)) {
  js = js.replace(oldPowersaveBitrate, newPowersaveBitrate);
  console.log('Powersave bitrate formatting updated');
}

// 2. Update 2-second hold-to-wake logic for powersave
const oldPowersaveHold = `  if (btnPowersave && powersaveOverlay) {
    let holdTimer;
    const startHold = () => {
      holdTimer = setTimeout(() => {
        powersaveOverlay.style.display = 'none';
      }, 2000);
    };
    const cancelHold = () => {
      clearTimeout(holdTimer);
    };
    btnPowersave.onclick = () => {
      powersaveOverlay.style.display = 'flex';
    };
    powersaveOverlay.addEventListener('mousedown', startHold);
    powersaveOverlay.addEventListener('mouseup', cancelHold);
    powersaveOverlay.addEventListener('touchstart', startHold);
    powersaveOverlay.addEventListener('touchend', cancelHold);
  }`;

const newPowersaveHold = `  if (btnPowersave && powersaveOverlay) {
    let holdTimer;
    let progressAnim;
    const ring = document.getElementById('powersave-progress-ring');
    const circumference = 213.6; // 2 * PI * 34
    
    const startHold = (e) => {
      if (e.cancelable) e.preventDefault();
      let startTime = Date.now();
      if (ring) ring.style.strokeDashoffset = circumference;
      
      clearInterval(progressAnim);
      progressAnim = setInterval(() => {
        let elapsed = Date.now() - startTime;
        let pct = Math.min(elapsed / 2000, 1.0);
        if (ring) ring.style.strokeDashoffset = circumference * (1 - pct);
      }, 30);

      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        clearInterval(progressAnim);
        if (ring) ring.style.strokeDashoffset = circumference;
        powersaveOverlay.style.display = 'none';
      }, 2000);
    };
    
    const cancelHold = () => {
      clearTimeout(holdTimer);
      clearInterval(progressAnim);
      if (ring) ring.style.strokeDashoffset = circumference;
    };
    
    btnPowersave.onclick = () => {
      if (ring) ring.style.strokeDashoffset = circumference;
      powersaveOverlay.style.display = 'flex';
    };
    
    powersaveOverlay.addEventListener('mousedown', startHold);
    powersaveOverlay.addEventListener('mouseup', cancelHold);
    powersaveOverlay.addEventListener('mouseleave', cancelHold);
    powersaveOverlay.addEventListener('touchstart', startHold, { passive: false });
    powersaveOverlay.addEventListener('touchend', cancelHold);
    powersaveOverlay.addEventListener('touchcancel', cancelHold);
  }`;

if (js.includes(oldPowersaveHold)) {
  js = js.replace(oldPowersaveHold, newPowersaveHold);
  console.log('Powersave hold-to-wake updated');
}

// 3. Update Focus Reticle & AF Lock logic
const oldReticleLogic = `  if (videoContainer && focusReticle) {
    let focusTimer;
    const triggerFocus = (e) => {
      const rect = videoContainer.getBoundingClientRect();
      let x = e.clientX || (e.touches && e.touches[0].clientX);
      let y = e.clientY || (e.touches && e.touches[0].clientY);
      
      focusReticle.style.left = (x - rect.left) + 'px';
      focusReticle.style.top = (y - rect.top) + 'px';
      focusReticle.style.display = 'flex';
      focusReticle.style.opacity = '1';
      
      if (localStream) {
        const track = localStream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities();
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(e => console.warn('AF failed', e));
          }
        }
      }
      
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => { 
        focusReticle.style.opacity = '0'; 
        setTimeout(() => { focusReticle.style.display = 'none'; }, 300);
      }, 1200);
    };
    videoContainer.addEventListener('mousedown', triggerFocus);
    videoContainer.addEventListener('touchstart', triggerFocus);
  }`;

const newReticleLogic = `  if (videoContainer && focusReticle) {
    let focusTimer;
    let holdTimer;
    let isHolding = false;
    const reticleText = document.getElementById('reticle-text');
    const reticleBox = focusReticle.querySelector('.reticle-box');
    
    const startFocus = (e) => {
      // Don't focus if setup panel is visible or disconnected
      const setupPanel = document.getElementById('setup-panel');
      if ((setupPanel && setupPanel.style.display !== 'none') || intentionalDisconnect || !localStream) return;
      
      const rect = videoContainer.getBoundingClientRect();
      let x = e.clientX || (e.touches && e.touches[0].clientX);
      let y = e.clientY || (e.touches && e.touches[0].clientY);
      
      focusReticle.style.left = (x - rect.left) + 'px';
      focusReticle.style.top = (y - rect.top) + 'px';
      focusReticle.style.display = 'flex';
      focusReticle.style.opacity = '1';
      if (reticleBox) reticleBox.style.borderColor = '#34c759';
      if (reticleText) reticleText.textContent = '';
      
      isHolding = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        isHolding = true;
        if (reticleBox) reticleBox.style.borderColor = '#ffd600';
        if (reticleText) reticleText.textContent = '[AF LOCK]';
        
        if (localStream) {
          const track = localStream.getVideoTracks()[0];
          if (track && track.getCapabilities) {
            const caps = track.getCapabilities();
            if (caps.focusMode && caps.focusMode.includes('manual')) {
              track.applyConstraints({ advanced: [{ focusMode: 'manual' }] }).catch(err => console.warn(err));
            }
          }
        }
      }, 1000);
      
      if (localStream) {
        const track = localStream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities();
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(err => console.warn('AF failed', err));
          }
        }
      }
    };
    
    const endFocus = () => {
      clearTimeout(holdTimer);
      if (!isHolding) {
        clearTimeout(focusTimer);
        focusTimer = setTimeout(() => { 
          focusReticle.style.opacity = '0'; 
          setTimeout(() => { if (!isHolding) focusReticle.style.display = 'none'; }, 300);
        }, 1000);
      }
    };
    
    videoContainer.addEventListener('mousedown', startFocus);
    videoContainer.addEventListener('touchstart', startFocus);
    videoContainer.addEventListener('mouseup', endFocus);
    videoContainer.addEventListener('touchend', endFocus);
  }`;

if (js.includes(oldReticleLogic)) {
  js = js.replace(oldReticleLogic, newReticleLogic);
  console.log('Focus reticle logic updated');
}

fs.writeFileSync(senderPath, js, 'utf8');
console.log('sender.js logic updated cleanly');
