const fs = require('fs');
let code = fs.readFileSync('public/cam/sender.js', 'utf8');

// Replace alerts
code = code.replace(/alert\('Izin kamera ditolak atau kamera tidak tersedia.'\);/g, "alert(window.i18n[currentLang].camDenied);");
code = code.replace(/alert\('Gagal mengunci landscape\. Aktifkan Putar Otomatis di HP dan putar HP Anda secara manual\.'\);/g, "alert(window.i18n[currentLang].landscapeFail);");

// Replace camera naming
code = code.replace(/opt\.text = d\.label \|\| `Kamera \$\{i \+ 1\}`;/g, "opt.text = d.label || `${window.i18n[currentLang].camDefault} ${i + 1}`;");

// Replace statusEl.innerHTML assignments (the static ones outside updateLanguage)
code = code.replace(/statusEl\.innerHTML = `<span class="lang-id">Terputus\. Scan QR untuk menyambung lagi<\/span>.*?`;/g, "statusEl.innerHTML = `<span style=\"color:red\">${window.i18n[currentLang].disconnectedMsg}</span>`;");
code = code.replace(/statusEl\.innerHTML = `<span class="lang-id">Menghubungkan \(Signaling\)\.\.\.<\/span>.*?`;/g, "statusEl.innerHTML = window.i18n[currentLang].signaling;");
code = code.replace(/statusEl\.innerHTML = `<span class="lang-id">Terautentikasi \(Menunggu Viewer\)<\/span>.*?`;/g, "statusEl.innerHTML = window.i18n[currentLang].authWait;");
code = code.replace(/statusEl\.innerHTML = `<span class="lang-id">Terputus, menyambungkan ulang\.\.\.<\/span>.*?`;/g, "statusEl.innerHTML = window.i18n[currentLang].reconnecting;");
code = code.replace(/statusEl\.innerHTML = `<span class="lang-id">WebRTC Terhubung \(Live\)<\/span>.*?`;/g, "window.updateStatusBadge(true);");

// Fix the auth_fail error logic which uses statusEl
code = code.replace(/if \(statusEl\) statusEl\.innerHTML = `<span style="color: red;">Gagal: \$\{msg\.payload\.reason\}\. Harap scan QR baru\.<\/span>`;/g, 
  "if (statusEl) statusEl.innerHTML = `<span style=\"color: red;\">${currentLang === 'en' ? 'Failed:' : 'Gagal:'} ${msg.payload.reason}. ${currentLang === 'en' ? 'Please scan new QR.' : 'Harap scan QR baru.'}</span>`;");

// Remove the hardcoded span display toggles right after statusEl.innerHTML assignments
code = code.replace(/if\s*\(currentLang\s*===\s*'en'\)\s*\{\s*statusEl\.querySelector\('\.lang-id'\)\.style\.display\s*=\s*'none';\s*statusEl\.querySelector\('\.lang-en'\)\.style\.display\s*=\s*'';\s*\}/g, "");

fs.writeFileSync('public/cam/sender.js', code);
console.log('Fixed translations in sender.js');
