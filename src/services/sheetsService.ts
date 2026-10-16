import { AttendanceRecord, AttendanceSchedule, Person, SheetsConfig } from '../types';

export const DEFAULT_SHEETS_CONFIG: SheetsConfig = {
  webhookUrl: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_APPS_SCRIPT_URL || '',
  spreadsheetId: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SPREADSHEET_ID || '',
  sheetName: 'Log_Presensi',
  autoSync: true,
  lastSyncTime: null,
  isConnected: false,
  isSimulatedMode: true,
};

// Fetch central configuration from server (shared across all devices)
export async function fetchSheetsConfigFromServer(): Promise<SheetsConfig | null> {
  try {
    const res = await fetch('/api/sheets-config');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        return data.config as SheetsConfig;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat konfigurasi dari server:', err);
  }
  return null;
}

// Save central configuration to server (so all devices inherit it immediately)
export async function saveSheetsConfigToServer(config: SheetsConfig): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/sheets-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: data.message || 'Konfigurasi Google Sheets berhasil disimpan di server untuk semua perangkat.',
      };
    }
  } catch (err) {
    console.warn('Gagal menyimpan konfigurasi ke server:', err);
  }
  return { success: false, message: 'Gagal menghubungkan ke server.' };
}

// Fetch central schedule from server
export async function fetchScheduleFromServer(): Promise<AttendanceSchedule | null> {
  try {
    const res = await fetch('/api/schedule');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.schedule) {
        return data.schedule as AttendanceSchedule;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat jadwal dari server:', err);
  }
  return null;
}

// Save central schedule to server
export async function saveScheduleToServer(schedule: AttendanceSchedule): Promise<void> {
  try {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
  } catch (err) {
    console.warn('Gagal menyimpan jadwal ke server:', err);
  }
}

export async function testSheetsConnection(
  webhookUrl: string,
  spreadsheetId?: string
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      message: 'URL Webhook Google Apps Script belum diisi.',
    };
  }

  const payload = {
    action: 'ping',
    spreadsheetId: spreadsheetId || '',
    timestamp: new Date().toISOString(),
  };

  // 1. Try direct fetch
  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: data.status === 'success' || data.success === true,
        message: data.message || 'Koneksi ke Google Sheets berhasil diverifikasi!',
      };
    }
  } catch (_err) {
    // 2. Fallback to server proxy
    try {
      const proxyRes = await fetch('/api/proxy-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim(), payload }),
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        return {
          success: data.status === 'success' || data.success === true,
          message: data.message || 'Koneksi ke Google Sheets berhasil diverifikasi (via Server Proxy)!',
        };
      }
    } catch (_proxyErr) {
      // Both failed
    }
  }

  return {
    success: false,
    message: 'Gagal menghubungi endpoint Apps Script. Pastikan izin deployment diatur ke "Anyone" (Siapa Saja).',
  };
}

export async function sendAttendanceToSheets(
  record: AttendanceRecord,
  config: SheetsConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.trim()) {
    return {
      success: false,
      message: 'Mode offline: Tersimpan lokal di perangkat (Webhook Google Sheets belum dikonfigurasi)',
    };
  }

  const payload = {
    action: 'addAttendance',
    spreadsheetId: config.spreadsheetId,
    sheetName: config.sheetName || 'Log_Presensi',
    data: {
      id: record.id,
      timestamp: record.timestamp,
      tanggal: record.tanggal,
      nip: record.nip,
      nama: record.nama,
      kategori: record.kategori,
      jabatan: record.jabatan,
      tipe: record.tipe,
      status: record.status,
      jamAbsen: record.jamAbsen,
      metode: record.metode,
      keterangan: record.keterangan || '',
    },
  };

  // 1. Try direct fetch
  try {
    const response = await fetch(config.webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: result.status === 'success' || result.success === true,
        message: 'Tersinkronisasi otomatis ke Google Sheets',
      };
    }
  } catch (_err) {
    // 2. Fallback to server proxy
    try {
      const proxyRes = await fetch('/api/proxy-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: config.webhookUrl.trim(), payload }),
      });
      if (proxyRes.ok) {
        const result = await proxyRes.json();
        return {
          success: result.status === 'success' || result.success === true,
          message: 'Tersinkronisasi otomatis ke Google Sheets (via Server Proxy)',
        };
      }
    } catch (_proxyErr) {
      // Both failed
    }
  }

  return {
    success: false,
    message: 'Antrean lokal: Koneksi ke Google Sheets gagal, data disimpan di perangkat.',
  };
}

export async function sendPersonToSheets(
  person: Person,
  config: SheetsConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.trim()) {
    return {
      success: false,
      message: 'Mode offline: Data tersimpan di perangkat lokal (Webhook Google Sheets belum dikonfigurasi).',
    };
  }

  const payload = {
    action: 'registerPerson',
    spreadsheetId: config.spreadsheetId || '',
    sheetName: 'Data_Guru_TU',
    data: {
      id: person.id,
      nip: person.nip,
      nama: person.nama,
      kategori: person.kategori,
      jabatan: person.jabatan,
      gender: person.gender,
      registeredAt: person.registeredAt,
      hasFaceVector: !!(person.faceVector && person.faceVector.length > 0),
    },
  };

  // 1. Coba kirim via aksi registerPerson langsung
  try {
    const response = await fetch(config.webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success' || result.success === true) {
        return {
          success: true,
          message: result.message || `Biodata ${person.nama} langsung masuk ke Google Sheets!`,
        };
      }
      // Jika skrip lama belum punya aksi registerPerson, fallback otomatis ke syncStaffMaster
      if (result.message && result.message.includes('Aksi tidak dikenali')) {
        return await syncStaffListToSheets([person], config);
      }
    }
  } catch (_err) {
    // 2. Fallback melalui server proxy
    try {
      const proxyRes = await fetch('/api/proxy-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: config.webhookUrl.trim(), payload }),
      });
      if (proxyRes.ok) {
        const result = await proxyRes.json();
        if (result.status === 'success' || result.success === true) {
          return {
            success: true,
            message: result.message || `Biodata ${person.nama} langsung masuk ke Google Sheets (via Server Proxy)!`,
          };
        }
        if (result.message && result.message.includes('Aksi tidak dikenali')) {
          return await syncStaffListToSheets([person], config);
        }
      }
    } catch (_proxyErr) {
      // Proxy juga gagal, coba syncStaffMaster
    }
  }

  // 3. Fallback ke syncStaffMaster (kompatibel penuh dengan semua versi skrip Apps Script)
  return await syncStaffListToSheets([person], config);
}

export async function syncStaffListToSheets(
  staffList: Person[],
  config: SheetsConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.trim()) {
    return {
      success: false,
      message: 'Webhook Google Sheets belum terhubung.',
    };
  }

  const payload = {
    action: 'syncStaffMaster',
    spreadsheetId: config.spreadsheetId,
    sheetName: 'Data_Guru_TU',
    data: staffList.map((s) => ({
      nip: s.nip,
      nama: s.nama,
      kategori: s.kategori,
      jabatan: s.jabatan,
      gender: s.gender,
      registeredAt: s.registeredAt,
    })),
  };

  try {
    const response = await fetch(config.webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return {
        success: true,
        message: `Berhasil mengekspor ${staffList.length} data Guru & TU ke Google Sheets.`,
      };
    }
  } catch (_err) {
    try {
      const proxyRes = await fetch('/api/proxy-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: config.webhookUrl.trim(), payload }),
      });
      if (proxyRes.ok) {
        return {
          success: true,
          message: `Berhasil mengekspor ${staffList.length} data Guru & TU ke Google Sheets (via Server Proxy).`,
        };
      }
    } catch (_proxyErr) {
      // Both failed
    }
  }

  return {
    success: false,
    message: 'Gagal sinkronisasi data master ke Google Sheets.',
  };
}

export function generateGoogleAppsScriptCode(sheetName = 'Log_Presensi'): string {
  return `/**
 * SKRIP GOOGLE APPS SCRIPT UNTUK APLIKASI ABSENSI GURU & STAF TATA USAHA
 * ---------------------------------------------------------------------
 * Panduan Pemasangan:
 * 1. Buka Google Spreadsheet baru di https://sheets.new
 * 2. Masuk ke menu "Ekstensi" > "Apps Script"
 * 3. Hapus semua kode bawaan, lalu tempel (paste) seluruh kode di bawah ini
 * 4. Klik tombol "Simpan" (ikon disket)
 * 5. Klik tombol biru "Terapkan" (Deploy) > "Deployment baru" (New deployment)
 * 6. Klik ikon gerigi (Select type) > Pilih "Aplikasi Web" (Web app)
 * 7. Konfigurasi:
 *    - Deskripsi: Absensi Guru & TU Webhook
 *    - Jalankan sebagai (Execute as): Saya (email Anda)
 *    - Siapa saja yang memiliki akses (Who has access): "Siapa saja" (Anyone) -> PENTING!
 * 8. Klik "Terapkan" (Deploy), berikan izin akses (Review Permissions -> Advanced -> Go to ...).
 * 9. Salin "URL Aplikasi Web" dan tempelkan ke form Konfigurasi di aplikasi!
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var action = data.action;

    // Akses Spreadsheet aktif atau via ID
    var ss;
    if (data.spreadsheetId && data.spreadsheetId.trim() !== "") {
      ss = SpreadsheetApp.openById(data.spreadsheetId);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (action === "ping") {
      return responseJSON({
        status: "success",
        message: "Koneksi Google Sheets berhasil! Spreadsheet: " + ss.getName(),
        timestamp: new Date()
      });
    }

    if (action === "addAttendance") {
      var sheetName = data.sheetName || "${sheetName}";
      var sheet = ss.getSheetByName(sheetName);

      // Buat sheet jika belum ada beserta header otomatis
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        var headers = [
          "ID Log",
          "Waktu Catat",
          "Tanggal",
          "NIP / NIK",
          "Nama Lengkap",
          "Kategori Pegawai",
          "Jabatan / Mapel",
          "Tipe Presensi",
          "Status Kehadiran",
          "Jam Absen",
          "Metode",
          "Keterangan"
        ];
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
        sheet.setFrozenRows(1);
      }

      var rowData = data.data;
      var newRow = [
        rowData.id,
        new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        rowData.tanggal,
        "'" + rowData.nip, // prefix petik agar angka NIP panjang tidak terpotong
        rowData.nama,
        rowData.kategori,
        rowData.jabatan,
        rowData.tipe,
        rowData.status,
        rowData.jamAbsen,
        rowData.metode,
        rowData.keterangan || ""
      ];

      sheet.appendRow(newRow);

      return responseJSON({
        status: "success",
        message: "Data presensi berhasil dicatat di baris " + sheet.getLastRow(),
        row: sheet.getLastRow()
      });
    }

    // Aksi 1: Pendaftaran Wajah & Biodata Satuan (Langsung masuk ke Sheet Data_Guru_TU)
    if (action === "registerPerson" || action === "addPerson") {
      var staffSheetName = "Data_Guru_TU";
      var staffSheet = ss.getSheetByName(staffSheetName);

      if (!staffSheet) {
        staffSheet = ss.insertSheet(staffSheetName);
        var sHeaders = [
          "NIP / NIK",
          "Nama Lengkap",
          "Kategori",
          "Jabatan / Mapel",
          "Gender",
          "Tanggal Terdaftar",
          "Status Wajah AI"
        ];
        staffSheet.appendRow(sHeaders);
        staffSheet.getRange(1, 1, 1, sHeaders.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#10b981");
        staffSheet.setFrozenRows(1);
      }

      var p = data.data;
      // Periksa apakah NIP sudah ada agar tidak terjadi duplikasi baris
      var dataRange = staffSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < dataRange.length; r++) {
        var existingNip = String(dataRange[r][0]).replace(/^'/, '').trim();
        if (existingNip === String(p.nip).trim()) {
          foundRow = r + 1;
          break;
        }
      }

      var rowValues = [
        "'" + p.nip,
        p.nama,
        p.kategori,
        p.jabatan,
        p.gender === 'L' ? 'Laki-Laki' : 'Perempuan',
        p.registeredAt || new Date().toISOString().split('T')[0],
        p.hasFaceVector ? "Wajah AI Aktif" : "QR Saja"
      ];

      if (foundRow > 0) {
        staffSheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        staffSheet.appendRow(rowValues);
      }

      return responseJSON({
        status: "success",
        message: "Biodata " + p.nama + " berhasil disimpan ke sheet Data_Guru_TU di Google Sheets!",
        row: foundRow > 0 ? foundRow : staffSheet.getLastRow()
      });
    }

    // Aksi 2: Sinkronisasi Massal Data Master Pegawai
    if (action === "syncStaffMaster") {
      var staffSheetName = "Data_Guru_TU";
      var staffSheet = ss.getSheetByName(staffSheetName);

      if (!staffSheet) {
        staffSheet = ss.insertSheet(staffSheetName);
        var sHeaders = ["NIP / NIK", "Nama Lengkap", "Kategori", "Jabatan / Mapel", "Gender", "Tanggal Terdaftar"];
        staffSheet.appendRow(sHeaders);
        staffSheet.getRange(1, 1, 1, sHeaders.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#10b981");
        staffSheet.setFrozenRows(1);
      }

      var staffList = data.data;
      for (var i = 0; i < staffList.length; i++) {
        var s = staffList[i];
        staffSheet.appendRow([
          "'" + s.nip,
          s.nama,
          s.kategori,
          s.jabatan,
          s.gender,
          s.registeredAt
        ]);
      }

      return responseJSON({
        status: "success",
        message: "Berhasil menambahkan " + staffList.length + " data Guru & Staf TU"
      });
    }

    return responseJSON({
      status: "error",
      message: "Aksi tidak dikenali: " + action
    });

  } catch (error) {
    return responseJSON({
      status: "error",
      message: error.toString()
    });
  }
}

function doGet(e) {
  return responseJSON({
    status: "success",
    message: "Google Apps Script Absensi Guru & TU aktif dan siap menerima data presensi!"
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}
