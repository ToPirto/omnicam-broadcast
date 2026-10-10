const fs = require('fs');
const path = require('path');

const senderJsPath = path.join(__dirname, '../public/cam/sender.js');
let js = fs.readFileSync(senderJsPath, 'utf8');

const afLogicOld = `  if (videoContainer && focusReticle) {
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

const afLogicNew = `  if (videoContainer && focusReticle) {
    let focusTimer;
    let holdTimer;
    let isHolding = false;
    
    const startFocus = (e) => {
      // Don't focus if setup panel is visible or disconnected
      const setupPanel = document.getElementById('setup-panel');
      if ((setupPanel && setupPanel.style.display !== 'none') || intentionalDisconnect) return;
      
      const rect = videoContainer.getBoundingClientRect();
      let x = e.clientX || (e.touches && e.touches[0].clientX);
      let y = e.clientY || (e.touches && e.touches[0].clientY);
      
      focusReticle.style.left = (x - rect.left) + 'px';
      focusReticle.style.top = (y - rect.top) + 'px';
      focusReticle.style.display = 'flex';
      focusReticle.style.opacity = '1';
      focusReticle.style.borderColor = '#34c759';
      focusReticle.innerHTML = '';
      
      isHolding = false;
      holdTimer = setTimeout(() => {
        isHolding = true;
        focusReticle.style.borderColor = '#ffd600';
        focusReticle.innerHTML = '<div style="background: rgba(0,0,0,0.5); padding: 2px 4px; font-family: monospace; font-size: 10px; color: #ffd600; margin-top: -20px; white-space: nowrap;">[AF LOCK]</div>';
        
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
    
    const endFocus = (e) => {
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

if (js.includes(afLogicOld)) {
  js = js.replace(afLogicOld, afLogicNew);
  fs.writeFileSync(senderJsPath, js, 'utf8');
  console.log("AF Logic replaced.");
} else {
  console.log("Old AF logic not found.");
}
