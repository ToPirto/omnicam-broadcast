const fs = require('fs');
const path = require('path');

const senderPath = path.join(__dirname, '../public/cam/sender.js');
let js = fs.readFileSync(senderPath, 'utf8');

const oldPopulate = `async function populateCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  camSelect.innerHTML = '';
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
  }
}`;

const newPopulate = `async function populateCameras() {
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
  } catch(e) {}
}`;

if (js.includes(oldPopulate)) {
  js = js.replace(oldPopulate, newPopulate);
  console.log('populateCameras updated cleanly');
}

// Add sync listeners for setup screen controls
const oldIfNode = `if (!isNode) {
  camSelect.onchange = async () => {
    currentDeviceId = camSelect.value;
    await startCamera(currentDeviceId);
  };`;

const newIfNode = `if (!isNode) {
  const setupCamSelect = document.getElementById('setup-cam-select');
  const setupQualityPreset = document.getElementById('setup-quality-preset');

  if (setupCamSelect) {
    setupCamSelect.onchange = () => {
      camSelect.value = setupCamSelect.value;
      currentDeviceId = setupCamSelect.value;
    };
  }
  if (setupQualityPreset) {
    setupQualityPreset.onchange = () => {
      qualityPreset.value = setupQualityPreset.value;
    };
  }

  // Speculatively populate cameras on load
  navigator.mediaDevices.enumerateDevices().then(devices => {
    if (devices.some(d => d.label)) populateCameras();
  }).catch(() => {});

  camSelect.onchange = async () => {
    currentDeviceId = camSelect.value;
    if (setupCamSelect) setupCamSelect.value = currentDeviceId;
    await startCamera(currentDeviceId);
  };`;

if (js.includes(oldIfNode)) {
  js = js.replace(oldIfNode, newIfNode);
  console.log('Setup select sync added');
}

fs.writeFileSync(senderPath, js, 'utf8');
console.log('Finished updating sender.js');
