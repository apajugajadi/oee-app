# Setup OEE Monitoring App

## 1. Backend (Google Sheet + Apps Script)
1. Buat Google Sheet baru (kosong), rename bebas (misal "OEE Monitoring - Data").
2. Copy **Sheet ID** dari URL: `https://docs.google.com/spreadsheets/d/`**`SHEET_ID`**`/edit`
1zuSMx-1qZxhpra1ghRWARktOQzX_OTFIGWdxMWs39aU

3. Buka **Extensions > Apps Script**, hapus isi default, paste isi `Code.gs`.
4. Ganti baris `const SHEET_ID = 'PASTE_SHEET_ID_DI_SINI';` dengan Sheet ID dari langkah 2.
5. Klik **Deploy > New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
6. Copy **Web app URL** hasil deploy (bentuknya `https://script.google.com/macros/s/xxx/exec`).
https://script.google.com/macros/s/AKfycbxuRpxi8K3wX1qphygrDwdv3p37Y7OURfodgyVQ9TS3rZLzoUFrG38LoFxg9LAw8vpajw/exec

7. Sheet `Sessions` dan `Events` akan otomatis dibuat pas pertama kali ada yang sync.

## 2. Frontend (Web App) — deploy ke GitHub Pages lewat VS Code
Folder ini belum jadi git repo, jadi push pertama kali harus lewat panel **Source Control** di VS Code (bukan drag-drop manual ke github.com):

1. Buka folder ini di VS Code → klik ikon **Source Control** (ikon cabang di sidebar kiri) → klik **Initialize Repository**.
2. Stage semua file (`index.html`, `app.js`, `Code.gs`, `SETUP.md`) → isi commit message (misal "initial commit") → klik ✓ **Commit**.
3. Klik **Publish Branch** (atau **Publish to GitHub** kalau baru pertama kali) → pilih **Publish to GitHub public repository** → kasih nama repo (misal `oee-monitoring-app`) → VS Code otomatis buat repo di akun GitHub lo dan push.
   - Kalau belum pernah connect akun GitHub, VS Code bakal minta sign in dulu (ikuti prompt-nya, cukup sekali).
4. Buka repo itu di github.com → **Settings > Pages** → di **Branch**, pilih `main` dan folder `/ (root)` → **Save**. Tunggu ~1 menit, URL app-nya muncul di bagian atas (bentuknya `https://apajugajadi.github.io/oee-monitoring-app/`).
5. Untuk update selanjutnya: edit file di VS Code → Source Control → Commit → **Sync Changes** (tombol dengan panah), otomatis push ke GitHub dan Pages ke-update sendiri dalam ~1 menit.
6. Buka app di HP, masuk tab **Sync**, paste Web app URL dari langkah 1.6, klik Simpan.
7. Ganti PIN admin default (`2027`) di `app.js` baris `const ADMIN_PIN = '2027';` sebelum deploy ke lapangan (commit & Sync Changes lagi setelah ganti).

> Bagian backend (`Code.gs`, Google Apps Script) tetap harus di-setup manual lewat Extensions > Apps Script di Google Sheet — itu gak bisa dilakukan dari VS Code karena jalan di server Google, bukan file yang di-hosting.

## 3. Isi Master Data (tab Admin)
1. Masuk PIN admin.
2. Tambah PU & Line kalau beda dari default (PUG/PUC/PUJ contoh awal).
3. Tambah daftar mesin (Unscrambler, Filler, dst — sesuai line masing-masing).
4. Tambah **Master Kategori Downtime** — satu daftar terpusat berlaku semua mesin/line, mengikuti skema MASTER_KATEGORI di workbook alignment: Kode, Nama Kategori, Grouping Besar (Fungsi), Grouping Sub-Fungsi, Status, Atribusi/PIC.
   - **Status = Unplanned** → masuk hitungan OEE (mengurangi Availability).
   - **Status = Planned (Penuh) / Planned dengan Toleransi** → dikeluarkan dari waktu produksi sebelum hitung OEE.
   - Durasi event tetap dicatat **raw/mentah** — app ini tidak menerapkan potongan toleransi (beda dengan workbook alignment yang punya kolom Toleransi & Persentase Ditanggung untuk rekonsiliasi lanjutan).
5. Tambah **Master Produk & Speed Ideal** — per Line: nama produk, ukuran kemasan, ideal speed (bpm). Ini yang bikin Nominal Speed di form Mulai Sesi keisi otomatis (basis hitung Performance), tinggal pilih produknya, gak perlu inget-inget angka speed manual.

## 4. Cara Pakai di Lapangan
1. Tab **Sesi** → pilih mode (Observasi/Harian), PU, Line, Shift, isi nominal speed & product counter awal → **Mulai Sesi**.
2. Tap kartu mesin yang lagi Running → mesin berhenti dari Running, langsung muncul form: pilih Kategori downtime, isi keterangan, **opsional foto** (dari kamera langsung atau galeri) → Konfirmasi → stopwatch downtime mulai jalan.
3. Tap lagi kartu itu → downtime kecatet selesai, mesin otomatis balik ke status Running.
4. Semua tersimpan otomatis di HP (localStorage, foto sudah dikompres) — aman walau sinyal jelek.
5. Selesai observasi/shift → **Akhiri Sesi**, isi product counter akhir & reject → lihat preview OEE → simpan.
6. Tab **Sync** → tap **Sync Sekarang** buat kirim data ke Google Sheet (butuh internet). Foto otomatis diupload ke folder Google Drive terpisah ("OEE Monitoring - Foto Downtime"), link-nya masuk kolom `photoUrl` di sheet Events.
7. Tab **Dashboard** → **Tarik Data Terbaru** buat lihat rekap OEE dari semua device yang udah sync.

> Pas pertama kali deploy Apps Script, Google akan minta izin akses Drive (buat upload foto) selain akses Sheet — wajar, approve aja.

## Rumus OEE (persis workbook referensi)
- **Actual Runtime** = Waktu total sesi − Downtime External (Customer)
- **Availability** = (Actual Runtime − Downtime Internal) / Actual Runtime
- **Performance** = Actual Produced / (Nominal Speed × Actual Runtime)
- **Quality** = (Actual Produced − Reject) / Actual Produced × 100
- **OEE** = Availability × Performance × Quality / 100
