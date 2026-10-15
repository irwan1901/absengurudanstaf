# Aplikasi Absensi Wajah & QR Code Guru dan Staf Tata Usaha (Integrasi Google Sheets)

Aplikasi presensi digital modern berbasis web untuk Guru dan Staf Tata Usaha sekolah dengan sistem pengenalan wajah (Face Recognition AI) serta pemindai QR Code NIP, mengadopsi tampilan antarmuka *dark-slate & emerald* presisi tinggi sesuai referensi, dan terhubung langsung ke Google Sheets secara real-time via Google Apps Script Webhook.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan sesi klarifikasi, seluruh preferensi utama Anda telah dikonfirmasi dan dijadikan acuan spesifikasi sistem:

- **Metode Penyimpanan Data**: Google Sheets sebagai basis data utama melalui integrasi **Google Apps Script Webhook URL & Spreadsheet ID**. Aplikasi dilengkapi generator kode Apps Script siap pakai, penguji koneksi instan, sinkronisasi otomatis dua arah (push & pull), serta antrean lokal (*offline queue*) agar absensi tetap berjalan tanpa hambatan jika koneksi terputus.
- **Metode Absensi Kamera**: **Dual-Mode Presensi** terpadu di modul kamera:
  1. *Deteksi & Pengenalan Wajah AI* (pencocokan visual terhadap data wajah terdaftar dengan akurasi tinggi dan feedback instan).
  2. *Pemindai QR Code / Barcode Kartu NIP* (alternatif kilat tanpa sentuh).
- **Alur & Status Presensi**: Mendukung siklus **Presensi Masuk & Pulang** dengan klasifikasi status otomatis:
  - **Hadir (Tepat Waktu)**
  - **Terlambat** (dapat disesuaikan batas toleransi jam masuk, misalnya setelah 07.15 WIB)
  - **Izin / Sakit** (pencatatan manual/disposisi via tab Data Guru & Staf)
  - Pencatatan durasi kerja dan rekapitulasi kehadiran per kategori (Guru vs Staf Tata Usaha).

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**: Aplikasi presensi *Single-Page Application* (SPA) berkinerja tinggi tanpa server eksternal berbayar. Dirancang khusus untuk sekolah (SD/SMP/SMA/SMK/Madrasah) guna mencatat kehadiran Guru dan Staf TU secara cepat di gerbang/lobi kantor.
- **Sasaran Pengguna**: Operator Sekolah, Kepala Tata Usaha, Guru, dan Staf Sekolah yang membutuhkan sistem presensi mandiri (*kiosk mode*) yang transparan dan dapat dipantau langsung di Google Spreadsheet oleh pimpinan dari mana saja.
- **Nilai Utama**:
  - Tampilan visual *cyber-emerald dark mode* premium yang identik dengan mockup yang diunggah.
  - Bebas biaya langganan database server dengan memanfaatkan kapasitas Google Sheets.
  - Respon deteksi instan (<150ms) dengan panduan audio sintetis ("Terima kasih Bapak/Ibu [Nama], Presensi Berhasil").

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Monitor Presensi (Dashboard Utama)**:
   - Panel kiri: Layar monitor kamera aktif dengan deteksi wajah/QR dinamis, status deteksi *bounding box*, audio feedback toggle, dan tombol switch kamera depan/belakang.
   - Panel kanan: Rekap KPI hari ini (Total Guru & Staf, Hadir Masuk, Terlambat, Belum Hadir), bilah persentase kehadiran, filter instan (Semua / Guru / Staf TU / Hadir / Belum Hadir), pencarian cepat nama/NIP, dan tabel log presensi realtime yang diperbarui per detik.
2. **Pendaftaran Wajah & Biodata**:
   - Pendaftaran cepat Guru/Staf baru: input NIP, Nama Lengkap, Kategori (Guru / Staf Tata Usaha), Jabatan/Mata Pelajaran, dan pengambilan sampel foto wajah dari webcam dengan ekstraksi vektor wajah.
3. **Data Guru & Staf TU**:
   - Master data lengkap dengan kartu identitas QR code siap cetak (*ID card printable*), edit profil, input manual izin/sakit hari berjalan, dan ekspor data ke format CSV/Excel.
4. **Konfigurasi Google Sheets & Jadwal Kerja**:
   - Form input Webhook URL dan Spreadsheet ID.
   - Pengaturan jam operasional presensi (Jam Masuk, Batas Terlambat, Jam Buka Presensi Pulang).
   - Tombol "Uji Koneksi" dengan indikator status hijau/merah.
5. **Skrip Apps Script & Template Spreadsheet**:
   - Generator skrip Google Apps Script (`Code.gs`) yang dapat disalin dengan satu tombol klik.
   - Struktur kolom Google Sheet otomatis (Timestamp, NIP, Nama, Kategori, Tipe Absen, Status, Jam, Keterangan).

### Visual Identity & Theme
- **Color Palette**:
  - Latar Belakang Utama: `#080E1A` (Deep Slate / Dark Navy)
  - Kartu & Kontainer: `#0F172A` dengan border halus `#1E293B`
  - Aksen Utama: `#10B981` (Emerald Glow) & `#059669` untuk status sukses dan tombol aksi utama
  - Aksen Peringatan/Terlambat: `#F59E0B` (Warm Amber)
  - Aksen Info/Sakit: `#38BDF8` (Sky Blue) & `#EC4899` (Rose)
  - Teks: `#F8FAFC` (High-contrast Slate White) dan `#94A3B8` (Muted Slate)
- **Tipografi**:
  - Sans Modern: `Plus Jakarta Sans` untuk judul dan teks UI.
  - Tabular & Data: `JetBrains Mono` / `tabular-nums` untuk jam digital, NIP, dan indikator persentase agar tidak bergetar.
- **Top Bar Contract**:
  - Logo & Judul: Wordmark `"Absensi Guru & Staf"` dengan badge live clock dan status koneksi Google Sheets.
  - Tab Navigasi Bersih: Monitor Presensi, Pendaftaran Wajah, Data Guru & Staf, Konfigurasi Google Sheets, Skrip Google Sheets.
  - Action Kanan: Jam realtime berformat WIB/lokal + status sinkronisasi.

---

## 3. Key Product Decisions & Trade-Offs

- **Penyimpanan Utama Google Sheets via Apps Script Webhook**:
  - *Pendekatan*: Aplikasi mengirimkan `POST` request berformat JSON ke Web App Apps Script yang langsung menyisipkan baris log ke Google Sheet serta mengembalikan data master guru/staf secara live.
  - *Alasan*: Mudah dibagikan ke Kepala Sekolah atau pengawas melalui Google Drive tanpa perlu mengelola database SQL yang rumit.
  - *Offline Fallback*: Jika perangkat kehilangan koneksi internet saat guru melakukan scan, log disimpan di `IndexedDB`/`localStorage` dan otomatis disinkronkan (*auto-flush*) saat internet kembali pulih.
- **Deteksi Wajah Klien (Client-Side AI)**:
  - *Pendekatan*: Deteksi wajah dan QR code diproses 100% di peramban menggunakan Canvas & media stream API dengan algoritma pencocokan fitur wajah.
  - *Alasan*: Privasi foto guru tetap terlindungi, kecepatan presensi di bawah 200ms, dan hemat kuota internet sekolah.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Aplikasi Presensi Guru & Staf                         │
│                                                                             │
│  ┌─────────────────────────┐           ┌─────────────────────────────────┐  │
│  │   Modul Kamera Realtime │           │       Dashboard Log Presensi    │  │
│  │  • Video Stream Canvas  │           │  • KPI Ringkasan Kehadiran      │  │
│  │  • AI Face Recognition  │──────────>│  • Filter Kategori (Guru / TU)  │  │
│  │  • QR Scanner Engine    │           │  • Log Masuk & Pulang Realtime  │  │
│  │  • Audio Voice Feedback │           │  • Ekspor Laporan CSV           │  │
│  └─────────────────────────┘           └─────────────────────────────────┘  │
│               │                                         │                   │
│               ▼                                         ▼                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │       State Manager & Offline Queue (IndexedDB / LocalStorage)         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                        ▲                                    │
│                                        │ HTTPS POST / GET                   │
│                                        ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │        Google Apps Script Web App Endpoint (doPost & doGet)           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                        ▲                                    │
│                                        │ Spreadsheet API                    │
│                                        ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │      Google Sheets Database (Sheet 'Data_Guru_TU' & 'Log_Presensi')   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Skema Data Utama
1. **Master Guru & Staf (`Data_Guru_TU`)**:
   - `nip`: Nomor Induk Pegawai / NIK
   - `nama`: Nama Lengkap beserta Gelar
   - `kategori`: `'GURU'` | `'TATA_USAHA'`
   - `jabatan`: Mata Pelajaran / Posisi di Tata Usaha
   - `face_descriptor`: Vektor fitur wajah (JSON array)
   - `foto_url`: Gambar profil
2. **Log Presensi (`Log_Presensi`)**:
   - `id`: UUID log
   - `timestamp`: Tanggal & Jam (ISO String)
   - `tanggal`: YYYY-MM-DD
   - `nip`: ID unik guru/staf
   - `nama`: Nama
   - `kategori`: GURU / TATA USAHA
   - `tipe`: `'MASUK'` | `'PULANG'`
   - `status`: `'HADIR'` | `'TERLAMBAT'` | `'IZIN'` | `'SAKIT'`
   - `jam_absen`: HH:mm:ss
   - `metode`: `'WAJAH_AI'` | `'QR_CODE'` | `'MANUAL'`
   - `keterangan`: Catatan jika ada
