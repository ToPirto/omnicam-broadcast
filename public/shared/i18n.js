export const i18n = {
  id: {
    connecting: 'Menghubungkan...',
    connected: 'Terhubung',
    disconnected: 'Terputus',
    startCamera: 'Mulai Kamera',
    addCamera: 'Tambah Kamera',
    scanQr: 'Scan QR ini dengan HP kamu',
    certWarning: '⚠️ Pertama kali? Baca panduan sertifikat →',
    cameraList: 'Daftar Kamera',
    notSupported: 'Tidak didukung',
    obsNotConnected: 'OBS: Tidak terhubung'
  },
  en: {
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    startCamera: 'Start Camera',
    addCamera: 'Add Camera',
    scanQr: 'Scan this QR with your phone',
    certWarning: '⚠️ First time? Read cert guide →',
    cameraList: 'Camera List',
    notSupported: 'Not supported',
    obsNotConnected: 'OBS: Not connected'
  }
};

let currentLang = 'id';

export function setLang(lang) {
  if (i18n[lang]) currentLang = lang;
}

export function t(key) {
  return i18n[currentLang][key] || key;
}
