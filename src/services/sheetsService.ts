import { AttendanceRecord, Person, SheetsConfig } from '../types';

export const DEFAULT_SHEETS_CONFIG: SheetsConfig = {
  webhookUrl: '',
  spreadsheetId: '',
  sheetName: 'Log_Presensi',
  autoSync: true,
  lastSyncTime: null,
  isConnected: false,
  isSimulatedMode: true,
};

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

  try {
    const payload = {
      action: 'ping',
      spreadsheetId: spreadsheetId || '',
      timestamp: new Date().toISOString(),
    };

    // Google Apps Script requires mode: 'cors' and text/plain to avoid preflight issues in some browsers
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
    } else {
      return {
        success: false,
        message: `Server merespon dengan status ${response.status}: ${response.statusText}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Gagal menghubungi endpoint: ${errorMsg}. Pastikan izin deployment Apps Script diatur ke 'Anyone' (Siapa Saja).`,
    };
  }
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

  try {
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
    } else {
      return {
        success: false,
        message: `Gagal sinkron (HTTP ${response.status})`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Antrean offline: ${errorMsg}`,
    };
  }
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

  try {
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
    return {
      success: false,
      message: `Gagal menghubungi server Apps Script (HTTP ${response.status}).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Gagal sinkronisasi data master: ${errorMsg}`,
    };
  }
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
