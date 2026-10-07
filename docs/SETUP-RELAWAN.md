# Panduan Setup Relawan (OmniCam)

Panduan ini berisi langkah-langkah untuk menyiapkan OmniCam di lokasi streaming.

## 1. Persiapan Jaringan (Sangat Penting)
- **Router Wi-Fi**: Gunakan router yang mendukung frekuensi **5 GHz** untuk meminimalkan gangguan.
- **Laptop/PC Server**: Hubungkan PC/Laptop yang menjalankan OBS ke router menggunakan **kabel LAN** (bukan Wi-Fi) untuk menjamin kestabilan.
- **Firewall**: Pastikan Windows Firewall atau antivirus mengizinkan koneksi untuk NodeJS/Server OmniCam (Allow in Firewall).

## 2. Menjalankan Server
1. Buka terminal/Command Prompt di PC server.
2. Jalankan perintah `npm start` di folder aplikasi.
3. Buka Dashboard di browser sesuai URL yang tertera di terminal (contoh: `https://localhost:3001`).
   - *Catatan: Jika muncul peringatan "Not Secure", abaikan dan klik "Proceed/Lanjutkan".*

## 3. Menghubungkan Kamera (HP)
1. Buka Dashboard, klik tombol **"Salin Link Kamera"** atau minta relawan memindai **QR Code** menggunakan HP mereka.
2. Saat HP relawan membuka link tersebut, berikan izin akses Kamera dan Mikrofon jika diminta.
3. Di Dashboard PC, kamera HP akan muncul di daftar.

## 4. Memasukkan ke OBS & Tally
1. Di Dashboard, pastikan status OBS WebSocket sudah "Terhubung" (ikon hijau di pojok atas).
2. Pada kartu kamera di Dashboard, klik **"+ Tambah Otomatis ke OBS"**. 
   - OmniCam akan otomatis membuat sumber Browser di OBS dengan kualitas 1080p, audio terhubung, dan pengaturan yang optimal.
3. Jika OBS sedang menjadikan kamera tersebut sebagai layar utama (Program), bingkai di HP relawan akan berwarna **merah** (Tally Live). Jika di Preview, berwarna hijau.

## 5. Troubleshooting (Jika Gagal)
- **Kamera tidak muncul di OBS**: Hapus sumber browser lama di OBS, lalu klik kembali "+ Tambah Otomatis ke OBS" dari Dashboard.
- **Video macet atau putus-putus**: Pastikan HP terhubung ke Wi-Fi 5 GHz, bukan 2.4 GHz. Cek baterai HP (jika terlalu panas, tekan tombol "Layar hitam hemat baterai" di HP).
- **Tally tidak menyala**: Pastikan OBS WebSocket aktif (Tools -> WebSocket Server Settings -> Enable) dan password cocok dengan yang diatur di Dashboard.
- **Tidak ada suara di OBS**: Pastikan relawan tidak membisukan (Mute) mic di HP, dan cek Audio Mixer di OBS (pastikan sumber browser kamera tidak di-mute).
