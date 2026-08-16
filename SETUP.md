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

7. Sheet `Sessions`, `Events`, `Parameters` akan otomatis dibuat pas pertama kali ada yang sync. Sheet `CounterPings` juga udah disiapin di backend (buat upgrade counter sensor di bab 6), tapi baru kebentuk kalau ada alat yang ngirim data — belum dipakai selama hardware-nya belum ada.

> Setiap kali `Code.gs` diupdate (ada perubahan kolom/fitur baru), paste ulang isinya ke Apps Script editor lalu **Deploy > Manage deployments > Edit (pensil) > New version > Deploy** — kalau cuma disimpan (Ctrl+S) tanpa versi baru, deployment yang aktif masih pakai kode lama.

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
2. **(Cara cepat)** Tab Admin → kartu paling atas **Import Master Data Standar** → sekali klik langsung isi **66 kode Master Kategori Downtime** & **19 Master Mesin** standar (Distribusi, Internal PU, Production RMP, Quality, Technical Services, dst). Sesi/event yang udah tercatat gak kehapus, cuma master data yang ke-replace. Bisa diedit/ditambah manual lagi setelahnya.
3. Tambah PU & Line kalau beda dari default (PUG/PUC/PUJ contoh awal).
4. **Master Kategori Downtime** — satu daftar terpusat berlaku semua line, mengikuti skema MASTER_KATEGORI: Kode, Nama Kategori, Grouping Besar (Fungsi), Grouping Sub-Fungsi, Status, Atribusi/PIC. Tiap baris bisa di-**edit** (✎) langsung, gak perlu hapus+tambah ulang.
   - **Status = Unplanned** → masuk hitungan OEE (mengurangi Availability).
   - **Status = Planned (Penuh) / Planned dengan Toleransi** → dikeluarkan dari waktu produksi sebelum hitung OEE.
   - Durasi event tetap dicatat **raw/mentah** — app ini tidak menerapkan potongan toleransi (beda dengan workbook alignment yang punya kolom Toleransi & Persentase Ditanggung untuk rekonsiliasi lanjutan).
   - Default hasil Import: cuma **CF (Change Format)**, **SO (Stock Opname)**, **PM (Preventive Maintenance)**, **SM (Setting mesin)** yang di-set Planned — sisanya Unplanned. Cek ulang & sesuaikan kalau ada yang menurut kalian harusnya Planned juga.
5. **Master Mesin** — daftar nama mesin/alat per line (Filler, Capper, Conveyor, dst). **Bukan** buat downtime (downtime tetap dicatat di level line/sesi, bukan per mesin) — ini khusus dipakai sebagai pilihan dropdown pas **Catat Parameter Mesin** (lihat bab 4).
6. **Master Produk & Speed Ideal** — per Line: nama produk, ukuran kemasan, ideal speed (bpm). Ini yang bikin Nominal Speed di form Mulai Sesi keisi otomatis (basis hitung Performance), tinggal pilih produknya, gak perlu inget-inget angka speed manual.

## 4. Cara Pakai di Lapangan
1. Tab **Sesi** → pilih mode (Observasi/Harian), PU, Line, Shift, isi nominal speed & product counter awal → opsional isi **Planned Production Time** (jam) kalau ini SAT/running test dengan target waktu tetap (misal 4 jam) → **Mulai Sesi**. Status line langsung jadi **Running** dan argo (Sesi Berjalan + Running) langsung jalan.
2. Ada downtime → tap tombol **⏸ Downtime** → argo Running berhenti, muncul form: pilih Kategori downtime, isi keterangan, **opsional foto** (dari kamera langsung atau galeri) → Konfirmasi → argo Downtime mulai jalan.
3. Tap **▶ Selesai Downtime** → downtime kecatet selesai, status otomatis balik ke Running dan argo Running mulai lagi dari 0.
4. **Catat Parameter Mesin** (kapan aja selama sesi, dipakai kalau lagi performance test/SAT yang butuh detail per mesin) → pilih **Mesin** dari dropdown (Master Mesin di Admin), isi **Nama Parameter** (bebas, misal "Tekanan Filling", "Suhu Zona 1", dst — gak dibatasi daftar, jadi bisa parameter A sampai Z apa aja), **Value**, **UOM** (satuan), catatan opsional → Simpan. Semua kecatet di card **Log Parameter Mesin**, bisa dicatat berkali-kali per sesi.
5. Semua tersimpan otomatis di HP (localStorage, foto sudah dikompres) — aman walau sinyal jelek.
6. Selesai observasi/shift → **Akhiri Sesi** (kalau status masih Downtime, app bakal konfirmasi dulu), isi product counter akhir & reject → lihat preview OEE + Actual Speed → simpan.
7. Tab **Sync** → tap **Sync Sekarang** buat kirim sesi, event, & parameter mesin ke Google Sheet (butuh internet). Foto otomatis diupload ke folder Google Drive terpisah ("OEE Monitoring - Foto Downtime"), link-nya masuk kolom `photoUrl` di sheet Events.
8. Tab **Dashboard** → **Tarik Data Terbaru** buat lihat rekap OEE (chart Pareto downtime per kategori & per fungsi) dari semua device yang udah sync.
9. Tab **Sync** juga ada tombol **Export Backup (JSON)** — download salinan semua data lokal sebagai jaring pengaman kalau HP/browser bermasalah sebelum sempat sync.

> Pas pertama kali deploy Apps Script, Google akan minta izin akses Drive (buat upload foto) selain akses Sheet — wajar, approve aja.

## 5. Rumus OEE (persis workbook referensi)
- **Actual Runtime** = Waktu produksi (durasi sesi real, atau Planned Production Time kalau diisi) − Downtime External (Customer)
- **Availability** = (Actual Runtime − Downtime Internal) / Actual Runtime
- **Performance** = Actual Produced / (Nominal Speed × Actual Runtime)
- **Quality** = (Actual Produced − Reject) / Actual Produced × 100
- **OEE** = Availability × Performance × Quality / 100
- **Actual Speed** = Actual Produced / Actual Runtime (satuan sama kayak Nominal Speed, misal bpm)

## 6. (Opsional, belum aktif) Upgrade Counter Otomatis — Sensor Proximity di Conveyor

**Status sekarang:** fitur ini **sengaja dimatikan** di web app (`FEATURE_AUTO_COUNTER = false` di `app.js`) — belum ada tombol/tampilan buat makainya. Backend-nya **sudah disiapkan** (`Code.gs` punya endpoint `action=counterPing` yang nampung data ke sheet `CounterPings`), jadi begitu alatnya jadi dan mulai ngirim data, tinggal bilang ke saya buat dibikinin UI-nya (misal auto-isi Product Counter pas Akhiri Sesi, gantiin input manual).

Bab ini panduan bikin **alatnya** duluan, dari nol, sesimpel mungkin (colok-pasang di conveyor, ditenagain power bank).

### 6.1 Konsep singkat
Sensor proximity dipasang ngadep jalur botol di conveyor. Tiap botol lewat, sensor ngirim sinyal ke controller (ESP32). ESP32 ngitung jumlahnya, lalu tiap beberapa detik kirim **total count** via WiFi ke Apps Script Web App yang sama kayak yang dipakai app ini — datanya numpuk di sheet `CounterPings` di Google Sheet.

```
[Botol lewat] → [Sensor Proximity] → [ESP32: hitung + debounce]
                                          │  WiFi (hotspot HP / WiFi pabrik)
                                          ▼
                              Apps Script Web App (Code.gs)
                                          │
                                          ▼
                         Sheet "CounterPings" di Google Sheet
                                          │  (nanti, kalau fiturnya udah dinyalain)
                                          ▼
                            Web App tarik & auto-isi Product Counter
```

### 6.2 Belanja alat (BOM)
| Alat | Kegunaan | Perkiraan harga | Catatan |
|---|---|---|---|
| **ESP32 DevKit V1** | Controller + WiFi jadi satu board | ~Rp 50–80rb | Cari di marketplace: "ESP32 DevKit V1 38pin" |
| **Sensor IR Obstacle Avoidance** (3 pin: VCC/GND/OUT) | Deteksi botol lewat — buat mulai coba-coba/prototype | ~Rp 5–10rb | 3.3–5V, langsung nyambung ke ESP32 tanpa komponen tambahan |
| Kabel jumper female-female | Sambung sensor ke ESP32 | ~Rp 5rb | Minimal 3 helai |
| Power bank biasa (output 5V USB) | Sumber daya, portable, plug-and-play | Punya sendiri / ~Rp 100rb | Minimal 10.000 mAh biar tahan lama; hindari power bank yang suka auto-off kalau arusnya kecil |
| Kabel USB (micro-USB atau USB-C, sesuai board) | Power bank → ESP32 | ~Rp 15rb | |
| *(Opsional, buat pasang permanen)* Sensor photoelectric industrial mis. **Omron E3F-DS30C4** (NPN, 10–30VDC) | Lebih tahan lama/akurat dari sensor IR hobbyist | ~Rp 50–100rb | Butuh modul step-down/optocoupler tambahan karena tegangannya beda dari ESP32 (3.3V) — pakai versi IR dulu buat coba-coba |
| *(Opsional)* Box kecil kedap air + cable tie/bracket | Mounting ESP32+power bank di rangka conveyor, lindungi dari cairan | ~Rp 20–30rb | |

> ⚠️ **Penting:** sensor proximity tipe **inductive** cuma bisa deteksi logam — **jangan** dipakai buat botol plastik/kaca. Pastikan beli yang **optik/IR/photoelectric** (deteksi berdasarkan cahaya/pantulan, bukan medan magnet).

### 6.3 Install software (sekali aja, di laptop)
1. Download & install **Arduino IDE** (gratis, arduino.cc/en/software).
2. Buka Arduino IDE → **File > Preferences** → di kolom "Additional Boards Manager URLs" isi:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. **Tools > Board > Boards Manager** → cari "esp32" → Install (punya Espressif Systems).
4. Colok ESP32 ke laptop pakai kabel USB.
5. **Tools > Board** → pilih **ESP32 Dev Module**. **Tools > Port** → pilih port yang muncul (COM3, COM4, dst).

### 6.4 Wiring (sensor IR ke ESP32)
Cuma 3 kabel:
- Sensor **VCC** → ESP32 **3V3**
- Sensor **GND** → ESP32 **GND**
- Sensor **OUT** → ESP32 **GPIO 4**

### 6.5 Upload program (firmware)
Copy kode di bawah ke Arduino IDE, sesuaikan bagian `WIFI_SSID`, `WIFI_PASSWORD`, `WEBAPP_URL` (pakai URL Apps Script yang sama kayak di app.js/tab Sync), dan `DEVICE_ID` (nama bebas per alat, misal `"CONV-01"`), lalu klik tombol **Upload** (ikon panah) di Arduino IDE.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID     = "NamaWifiKamu";
const char* WIFI_PASSWORD = "PasswordWifiKamu";
const char* WEBAPP_URL    = "https://script.google.com/macros/s/xxx/exec"; // sama kayak URL di app
const char* DEVICE_ID     = "CONV-01"; // ganti sesuai line/conveyor

const int SENSOR_PIN = 4;
volatile unsigned long pulseCount = 0;
volatile unsigned long lastPulseTime = 0;
const unsigned long DEBOUNCE_MS = 80; // jarak minimal antar hitungan, biar 1 botol gak kehitung dobel

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 5000; // kirim total count tiap 5 detik

void IRAM_ATTR onPulse() {
  unsigned long now = millis();
  if (now - lastPulseTime > DEBOUNCE_MS) {
    pulseCount++;
    lastPulseTime = now;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onPulse, FALLING);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

void loop() {
  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    sendCount();
    lastSendTime = millis();
  }
}

void sendCount() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(WEBAPP_URL);
  http.addHeader("Content-Type", "text/plain;charset=utf-8");
  String body = String("{\"action\":\"counterPing\",\"deviceId\":\"") + DEVICE_ID +
                 "\",\"count\":" + pulseCount + ",\"ts\":" + millis() + "}";
  int code = http.POST(body);
  Serial.println("Kirim count=" + String(pulseCount) + " -> HTTP " + code);
  http.end();
}
```

### 6.6 Tes dulu di meja
1. Buka **Tools > Serial Monitor** (baud rate 115200) di Arduino IDE.
2. Lambaikan tangan/benda di depan sensor beberapa kali → angka `pulseCount` di Serial Monitor harus naik, dan tiap 5 detik muncul log `HTTP 200`.
3. Cek Google Sheet — sheet `CounterPings` harus otomatis kebentuk dan ada baris baru masuk tiap 5 detik.
4. Kalau `HTTP` yang muncul bukan 200 (atau gak connect WiFi sama sekali), cek ulang `WIFI_SSID`/`WIFI_PASSWORD`/`WEBAPP_URL`.

### 6.7 Pasang di conveyor
1. Posisikan sensor tegak lurus jalur botol, jarak deteksi disetel (kalau sensornya ada potensiometer/trimmer) secukupnya biar cuma kepicu pas ada botol, bukan kepicu terus-menerus.
2. Pastikan tiap botol cuma motong garis deteksi sensor **satu kali** (posisi & kecepatan conveyor pengaruh — kalau kehitung dobel, naikkan `DEBOUNCE_MS` di kode).
3. Mounting sensor & ESP32+power bank pakai bracket/cable tie di rangka conveyor yang gak kena getaran/cairan langsung. Kalau perlu, taruh ESP32+power bank di box kecil.
4. Sambungkan ke WiFi — paling gampang pakai **hotspot HP kamu sendiri** (portable, sesuai konsep plug-and-play), atau WiFi pabrik kalau sinyalnya stabil di area conveyor.
5. Nyalain (colok power bank), biarin jalan, cek sheet `CounterPings` beberapa menit sekali buat pastiin datanya masuk terus.
6. Begitu alat udah jalan stabil dan datanya numpuk di `CounterPings`, kabarin — bagian web app (auto-isi Product Counter dari data sensor, gantiin input manual) baru akan dibikin & dinyalain setelah ini.
