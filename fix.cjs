const fs = require('fs');
let file = fs.readFileSync('public/dashboard/dashboard.js', 'utf8');
file = file.replace("e.target.innerText = 'Berhasil Ditambahkan';", "e.target.innerText = data.exists ? 'Berhasil Diperbarui di OBS' : 'Berhasil Ditambahkan';");
fs.writeFileSync('public/dashboard/dashboard.js', file);
