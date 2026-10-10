const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '../public/cam/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Replace hud-top
const hudTopOriginal = `<div class="hud-top">
    <div class="top-left">
      <div class="brand-logo">
        <div class="brand-dot"></div>
        <div class="brand-logo-text">OMNICAM</div>
        <div class="brand-pill">BROADCAST</div>
      </div>
      <div class="cam-name" id="cam-name-display">CAM 1</div>
      <div class="status-dot" id="status-dot"></div>
    </div>
    <div class="top-right">
      <div id="battery-container" class="battery-container" title="Battery">
        <div class="battery-body">
          <div id="battery-level" class="battery-level"></div>
        </div>
        <div class="battery-nipple"></div>
        <div id="battery-text" class="mono-text battery-text">--%</div>
      </div>
      <div id="clock" class="mono-text">00:00:00</div>
      <div id="status" class="mono-text"><span class="lang-id">Menunggu...</span><span class="lang-en" style="display:none;">Waiting...</span></div>
      <button id="btn-pro-menu" class="btn-flat btn-menu">[MENU]</button>
    </div>
  </div>`;

const hudTopNew = `<div class="hud-top">
    <div class="hud-top-left">
      <div class="brand-logo-text" style="font-family: sans-serif; font-weight: bold;">OMNICAM [BROADCAST]</div>
      <div class="header-divider" style="color: #33333a; font-weight: bold; margin: 0 5px;">|</div>
      <div class="cam-name" id="cam-name-display" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">CAM 1</div>
      <div class="tally-led-dot" id="status-dot"></div>
    </div>
    <div class="hud-top-right">
      <div id="battery-container" class="battery-container" title="Battery">
        <div class="battery-body">
          <div id="battery-level" class="battery-level"></div>
        </div>
        <div class="battery-nipple"></div>
        <div id="battery-text" class="mono-text battery-text">--%</div>
      </div>
      <div id="clock" class="mono-text" style="color: #8e8e93;">00:00:00</div>
      <div id="status" class="mono-text hud-badge" style="color: #34c759; border-color: #34c759;">[ LIVE ]</div>
      <button id="btn-pro-menu" class="btn-flat btn-menu" style="border-color: #2a2a32;">[MENU]</button>
    </div>
  </div>`;

html = html.replace(hudTopOriginal, hudTopNew);

// Replace menu panel
const menuOriginal = `<div class="pro-menu-panel" id="pro-menu-panel" style="display:none;">
    <div class="menu-header">
      <strong class="lang-id">Pengaturan Pro</strong>
      <strong class="lang-en" style="display:none;">Pro Settings</strong>
      <button id="btn-close-menu" class="btn-flat">X</button>
    </div>
    <div class="menu-item">
      <span class="lang-id">Bahasa</span><span class="lang-en" style="display:none;">Language</span>
      <button id="btn-lang-toggle" class="btn-flat">ID</button>
    </div>
    <div class="menu-item">
      <span class="lang-id">Grid 3x3</span><span class="lang-en" style="display:none;">3x3 Grid</span>
      <button id="btn-grid-toggle" class="btn-flat">OFF</button>
    </div>
    <!-- Re-use the existing setup panel items but placed elegantly -->
    <div class="menu-item">
      <span class="lang-id">Lensa</span><span class="lang-en" style="display:none;">Lens</span>
      <select id="cam-select"></select>
    </div>
    <div class="menu-item">
      <span class="lang-id">Resolusi</span><span class="lang-en" style="display:none;">Resolution</span>
      <select id="quality-preset">
        <option value="720p30_2500">720p30 (2.5 Mbps)</option>
        <option value="1080p30_5000" selected>1080p30 (5.0 Mbps)</option>
        <option value="1080p60_8000">1080p60 (8.0 Mbps)</option>
      </select>
    </div>
    <div class="menu-item-audio">
      <label><input type="checkbox" id="chk-echo"> Echo</label>
      <label><input type="checkbox" id="chk-noise"> Noise</label>
      <label><input type="checkbox" id="chk-agc"> AGC</label>
    </div>
  </div>`;

const menuNew = `<div class="pro-menu-panel" id="pro-menu-panel" style="display:none;">
    <div class="menu-header">
      <strong class="lang-id">[ PENGATURAN KAMERA ]</strong>
      <strong class="lang-en" style="display:none;">[ CAMERA SETTINGS ]</strong>
      <button id="btn-close-menu" class="btn-flat" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">[ X ]</button>
    </div>
    
    <div class="menu-item">
      <span class="lang-id">BAHASA / LANG</span><span class="lang-en" style="display:none;">BAHASA / LANG</span>
      <button id="btn-lang-toggle" class="btn-flat">[ ID | EN ]</button>
    </div>
    
    <div class="menu-item">
      <span class="lang-id">GRID 3x3</span><span class="lang-en" style="display:none;">GRID 3x3</span>
      <button id="btn-grid-toggle" class="btn-flat">[ OFF ]</button>
    </div>
    
    <div class="menu-item">
      <span class="lang-id">LENSA / LENS</span><span class="lang-en" style="display:none;">LENSA / LENS</span>
    </div>
    <select id="cam-select" class="full-width-select"></select>
    
    <div class="menu-item">
      <span class="lang-id">KUALITAS / QUALITY</span><span class="lang-en" style="display:none;">KUALITAS / QUALITY</span>
    </div>
    <select id="quality-preset" class="full-width-select">
      <option value="720p30_2500">720p30 - 2.5 Mbps</option>
      <option value="1080p30_5000" selected>1080p30 - 5 Mbps</option>
      <option value="1080p60_8000">1080p60 - 8 Mbps</option>
    </select>
    
    <div class="menu-item" style="margin-top: 10px;">
      <span class="lang-id">AUDIO FILTERS</span><span class="lang-en" style="display:none;">AUDIO FILTERS</span>
    </div>
    <div class="menu-item-audio">
      <button class="btn-flat audio-chip active" id="btn-chk-echo">Echo</button>
      <button class="btn-flat audio-chip active" id="btn-chk-noise">Noise</button>
      <button class="btn-flat audio-chip active" id="btn-chk-agc">AGC</button>
      <input type="checkbox" id="chk-echo" checked style="display:none;">
      <input type="checkbox" id="chk-noise" checked style="display:none;">
      <input type="checkbox" id="chk-agc" checked style="display:none;">
    </div>
  </div>`;

html = html.replace(menuOriginal, menuNew);

// Replace setup panel
const setupOriginal = `<div class="setup-panel" id="setup-panel">
    <button id="btn-start">
      <span class="lang-id">Mulai Kamera</span>
      <span class="lang-en" style="display:none;">Start Camera</span>
    </button>
  </div>`;

const setupNew = `<div class="setup-panel" id="setup-panel">
    <div class="brand-logo-text" style="font-size: 20px; text-align: center; margin-bottom: 5px;">OMNICAM BROADCAST</div>
    <div style="text-align: center; color: #888; margin-bottom: 20px; font-family: sans-serif; font-size: 12px;">Wireless Transmitter</div>
    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
      <select id="setup-cam-select" class="full-width-select" style="background: #222; color: #fff; padding: 10px; border: 1px solid #444; border-radius: 4px;"></select>
      <select id="setup-quality-preset" class="full-width-select" style="background: #222; color: #fff; padding: 10px; border: 1px solid #444; border-radius: 4px;">
        <option value="720p30_2500">720p30 - 2.5 Mbps</option>
        <option value="1080p30_5000" selected>1080p30 - 5 Mbps</option>
        <option value="1080p60_8000">1080p60 - 8 Mbps</option>
      </select>
    </div>
    <button id="btn-start" style="width: 100%; font-weight: bold; background: #34c759; color: black; border: none; padding: 15px; border-radius: 4px; font-size: 16px;">
      <span class="lang-id">[ MULAI KAMERA / START STREAM ]</span>
      <span class="lang-en" style="display:none;">[ MULAI KAMERA / START STREAM ]</span>
    </button>
  </div>`;

html = html.replace(setupOriginal, setupNew);

// Battery saver 
const powersaveOriginal = `<div id="powersave-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:black; z-index:9999; flex-direction:column; justify-content:center; align-items:center;">
    <div id="powersave-tally" style="position:absolute; top:0; left:0; right:0; bottom:0; border: 5px solid #555; pointer-events:none;"></div>
    <div style="color:white; font-size:24px; margin-bottom: 20px;">
      <span id="powersave-battery">Bat: --</span> | <span id="powersave-bitrate">0 kbps</span>
    </div>
    <div style="color:#777; user-select:none;" class="lang-id">Tahan 2 detik untuk bangun</div>
    <div style="color:#777; user-select:none; display:none;" class="lang-en">Hold 2 seconds to wake</div>
  </div>`;

const powersaveNew = `<div id="powersave-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:#000000; z-index:9999; flex-direction:column; justify-content:center; align-items:center;">
    <div id="powersave-tally" style="position:absolute; top:0; left:0; right:0; bottom:0; border: 5px solid #33333a; pointer-events:none; transition: border-color 0.2s;"></div>
    
    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; z-index: 10;">
      <div style="font-family: monospace; font-size: 18px; font-weight: bold; text-align: center;">
        <span id="powersave-cam-name" style="margin-right: 10px;">CAM 1</span>
        <span id="powersave-tally-badge" style="background: #33333a; color: white; padding: 4px 8px; border-radius: 4px;">[ PREVIEW ]</span>
      </div>
      
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="battery-container" title="Battery">
          <div class="battery-body" style="width: 36px; height: 18px; border: 1px solid #aaa;">
            <div id="powersave-battery-level" class="battery-level" style="background-color: #34c759;"></div>
          </div>
          <div class="battery-nipple" style="width: 3px; height: 9px; background: #aaa;"></div>
          <div id="powersave-battery-text" class="mono-text" style="font-size: 18px; color: #aaa; margin-left: 5px;">--%</div>
        </div>
      </div>
      
      <div id="powersave-bitrate" style="color: #aaa; font-family: monospace; font-size: 16px;">0.0 Mbps | 0 fps</div>
      
      <div style="margin-top: 40px; position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
        <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg);">
          <circle cx="30" cy="30" r="28" fill="none" stroke="#222" stroke-width="4"></circle>
          <circle id="powersave-progress" cx="30" cy="30" r="28" fill="none" stroke="#34c759" stroke-width="4" stroke-dasharray="176" stroke-dashoffset="176" style="transition: stroke-dashoffset 0.1s linear;"></circle>
        </svg>
        <div style="width: 20px; height: 20px; border-radius: 50%; background: #333;"></div>
      </div>
      
      <div style="color:#777; user-select:none; font-family: sans-serif; font-size: 14px; margin-top: 10px;" id="powersave-instruction">
        Tahan layar 2 detik untuk keluar
      </div>
    </div>
  </div>`;
  
html = html.replace(powersaveOriginal, powersaveNew);

fs.writeFileSync(indexHtmlPath, html, 'utf8');

const senderCssPath = path.join(__dirname, '../public/cam/sender.css');
let css = fs.readFileSync(senderCssPath, 'utf8');

// Replace HUD Top CSS
const cssHudTopOld = `.hud-top {
  position: absolute; top: 0; left: 0; right: 0; padding: 15px; 
  background: linear-gradient(rgba(0,0,0,0.8), transparent);
  display: flex; justify-content: space-between; z-index: 20;
  white-space: nowrap; flex-wrap: nowrap; overflow: hidden;
}`;
const cssHudTopNew = `.hud-top {
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; box-sizing: border-box; padding: 8px 16px;
  background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
  z-index: 20;
  white-space: nowrap; flex-wrap: nowrap; overflow: hidden;
}
.hud-top-left, .hud-top-right { display: flex; align-items: center; gap: 10px; min-width: 0; white-space: nowrap; flex-wrap: nowrap; overflow: hidden; }
.tally-led-dot { width: 8px; height: 8px; border-radius: 50%; background: #33333a; }
.tally-led-dot.preview { background: #34c759; box-shadow: 0 0 8px #34c759; }
.tally-led-dot.program { background: #ff3b30; box-shadow: 0 0 8px #ff3b30; }
`;
css = css.replace(cssHudTopOld, cssHudTopNew);

// Replace Menu Panel CSS
const cssMenuOld = `.pro-menu-panel {
  position: absolute;
  top: 60px; right: 15px;
  background: rgba(15, 15, 20, 0.95);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 15px;
  width: 250px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}`;
const cssMenuNew = `.pro-menu-panel {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 320px; max-width: 85vw; height: 100vh;
  background: rgba(14, 14, 18, 0.95);
  backdrop-filter: blur(12px);
  border-left: 1px solid #2a2a32;
  padding: 16px;
  box-sizing: border-box;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.pro-menu-panel.open {
  transform: translateX(0);
}
.full-width-select {
  width: 100%;
  background: #1e1e24;
  color: white;
  border: 1px solid #2a2a32;
  padding: 8px;
  border-radius: 4px;
  font-family: sans-serif;
  font-size: 14px;
}
.audio-chip {
  flex: 1;
  text-align: center;
  padding: 6px;
  background: #16161a;
  border: 1px solid #2a2a32;
  color: #8e8e93;
  font-size: 12px;
}
.audio-chip.active {
  background: rgba(52, 199, 89, 0.2);
  color: #34c759;
  border-color: #34c759;
}`;
css = css.replace(cssMenuOld, cssMenuNew);

// Replace .setup-panel
const setupCssOld = `.setup-panel {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; z-index: 25;
  display: flex; flex-direction: column; gap: 10px; text-align: center;
}`;
const setupCssNew = `.setup-panel {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(14, 14, 18, 0.95); padding: 24px; border-radius: 12px; z-index: 25;
  display: flex; flex-direction: column; text-align: center;
  border: 1px solid #2a2a32; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  width: 300px; max-width: 85vw;
}`;
css = css.replace(setupCssOld, setupCssNew);

fs.writeFileSync(senderCssPath, css, 'utf8');

console.log("HUD Update Done.");
