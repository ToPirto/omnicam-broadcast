# OmniCam Broadcast

Sistem penyiaran ultra-low-latency dari HP ke OBS Studio tanpa aplikasi native (menggunakan browser PWA). Dibuat untuk multi-kamera di gereja/konser.

## Panduan Singkat

1. **Jalankan Server**
   Buka folder ini, klik ganda `start.bat` (atau ketik `npm start` di terminal).
   Server akan berjalan dan menampilkan QR code.

2. **Sambungkan OBS**
   - Tambahkan **Browser Source** di OBS.
   - URL: `https://localhost:3000/view/cam-1` (contoh).
   - Centang "Control audio via OBS".
   - Lebar: 1920, Tinggi: 1080.

3. **Sambungkan HP**
   - Buka browser HP, scan QR code di terminal atau di Dashboard (`https://localhost:3000`).
   - Karena ini server lokal (HTTPS), browser akan menampilkan peringatan "Tidak Aman" / "Not Secure". Klik "Advanced" -> "Proceed" atau baca panduan lengkap di layar.
   - HP siap siaran!
