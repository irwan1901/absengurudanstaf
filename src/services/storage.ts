import { AttendanceRecord, AttendanceSchedule, Person, SheetsConfig } from '../types';
import { DEFAULT_SHEETS_CONFIG, saveSheetsConfigToServer, saveScheduleToServer } from './sheetsService';
import QRCode from 'qrcode';

const STORAGE_KEYS = {
  PERSONS: 'absensi_guru_tu_persons',
  RECORDS: 'absensi_guru_tu_records',
  CONFIG: 'absensi_guru_tu_sheets_config',
  SCHEDULE: 'absensi_guru_tu_schedule',
  SOUND_ENABLED: 'absensi_guru_tu_sound_enabled',
};

export const DEFAULT_SCHEDULE: AttendanceSchedule = {
  jamMasukMulai: '06:00',
  jamMasukTepatWaktu: '07:15', // toleransi keterlambatan
  jamMasukBatasAkhir: '11:00',
  jamPulangMulai: '14:00',
  jamPulangSelesai: '18:00',
};

// Seed initial Indonesian Teachers and Administrative Staff
export const INITIAL_STAFF: Omit<Person, 'qrCodeDataUrl'>[] = [
  {
    id: 'staff-1',
    nip: '197508122002121001',
    nama: 'Drs. H. Ahmad Fauzi, M.Pd',
    kategori: 'KEPALA_SEKOLAH',
    jabatan: 'Kepala Sekolah',
    gender: 'L',
    fotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-01-10',
    faceVector: [0.12, -0.45, 0.88, 0.31, -0.15, 0.76],
  },
  {
    id: 'staff-2',
    nip: '198203152008012004',
    nama: 'Siti Rahmawati, S.Pd',
    kategori: 'GURU',
    jabatan: 'Guru Bahasa Indonesia',
    gender: 'P',
    fotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-01-12',
    faceVector: [0.42, 0.15, -0.22, 0.91, -0.34, 0.11],
  },
  {
    id: 'staff-3',
    nip: '198906212015021003',
    nama: 'Budi Santoso, S.Kom',
    kategori: 'OPERATOR_SEKOLAH',
    jabatan: 'Operator Sekolah & Dapodik',
    gender: 'L',
    fotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-01-15',
    faceVector: [-0.31, 0.65, 0.12, -0.44, 0.88, 0.29],
  },
  {
    id: 'staff-4',
    nip: '199211042019032007',
    nama: 'Dewi Lestari, S.E',
    kategori: 'TATA_USAHA',
    jabatan: 'Bendahara Sekolah & Administrasi',
    gender: 'P',
    fotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-02-01',
    faceVector: [0.65, -0.18, 0.44, 0.27, -0.55, 0.72],
  },
  {
    id: 'staff-5',
    nip: '198604182011011002',
    nama: 'Agus Setiawan, S.Pd',
    kategori: 'GURU',
    jabatan: 'Guru Pendidikan Jasmani & Olahraga',
    gender: 'L',
    fotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-02-10',
    faceVector: [0.29, 0.78, -0.51, 0.36, 0.19, -0.82],
  },
  {
    id: 'staff-6',
    nip: '199507192022032009',
    nama: 'Nurul Hidayah, S.Si',
    kategori: 'PUSTAKAWAN',
    jabatan: 'Kepala Perpustakaan Sekolah',
    gender: 'P',
    fotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-03-01',
    faceVector: [-0.49, 0.28, 0.61, -0.37, 0.45, -0.18],
  },
  {
    id: 'staff-7',
    nip: '199009122018021005',
    nama: 'Hendra Gunawan',
    kategori: 'SECURITY',
    jabatan: 'Petugas Security & Keamanan',
    gender: 'L',
    fotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-03-15',
    faceVector: [0.55, -0.62, 0.19, 0.74, -0.11, 0.38],
  },
  {
    id: 'staff-8',
    nip: '199304152021011006',
    nama: 'Sutrisno',
    kategori: 'OFFICE_BOY',
    jabatan: 'Petugas Kebersihan & Layanan Kantor',
    gender: 'L',
    fotoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-04-01',
    faceVector: [0.15, 0.33, -0.42, 0.58, -0.21, 0.67],
  },
  {
    id: 'staff-9',
    nip: '199602202022022008',
    nama: 'Sri Wahyuni',
    kategori: 'OFFICE_GIRL',
    jabatan: 'Petugas Tata Graha & Layanan Umum',
    gender: 'P',
    fotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    registeredAt: '2026-04-10',
    faceVector: [-0.22, 0.48, 0.31, -0.62, 0.14, -0.45],
  },
];

// Helper to generate QR code data URL for a given NIP string
export async function generateQrDataUrl(nip: string): Promise<string> {
  try {
    return await QRCode.toDataURL(nip, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.warn('QR Code generation error:', err);
    return '';
  }
}

export async function getPersons(): Promise<Person[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PERSONS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load persons from localStorage:', e);
  }

  // First time initialization: populate with default staff and generate QR codes
  const populated: Person[] = [];
  for (const s of INITIAL_STAFF) {
    const qrCodeDataUrl = await generateQrDataUrl(s.nip);
    populated.push({
      ...s,
      qrCodeDataUrl,
    });
  }
  savePersons(populated);
  return populated;
}

export function savePersons(persons: Person[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(persons));
  } catch (e) {
    console.error('Failed to save persons to localStorage:', e);
  }
}

export function getAttendanceRecords(): AttendanceRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load attendance records:', e);
  }
  return [];
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save attendance records:', e);
  }
}

export function getSheetsConfig(): SheetsConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (data) {
      return { ...DEFAULT_SHEETS_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load sheets config:', e);
  }
  return DEFAULT_SHEETS_CONFIG;
}

export function saveSheetsConfig(config: SheetsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save sheets config:', e);
  }
  // Sync to server so any other device gets this config automatically
  saveSheetsConfigToServer(config).catch((err) => {
    console.warn('Failed to sync sheets config to server:', err);
  });
}

export function getAttendanceSchedule(): AttendanceSchedule {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    if (data) {
      return { ...DEFAULT_SCHEDULE, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load schedule:', e);
  }
  return DEFAULT_SCHEDULE;
}

export function saveAttendanceSchedule(schedule: AttendanceSchedule): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
  } catch (e) {
    console.error('Failed to save schedule:', e);
  }
  // Sync schedule to server
  saveScheduleToServer(schedule).catch((err) => {
    console.warn('Failed to sync schedule to server:', err);
  });
}

export function getSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    return val !== null ? val === 'true' : true;
  } catch {
    return true;
  }
}

export function saveSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
  } catch (e) {
    console.error('Failed to save sound preference:', e);
  }
}

// Export attendance records to CSV with UTF-8 BOM
export function exportAttendanceToCsv(records: AttendanceRecord[], filename?: string): void {
  const headers = [
    'ID Presensi',
    'Tanggal',
    'Jam Absen',
    'NIP',
    'Nama Lengkap',
    'Kategori',
    'Jabatan',
    'Tipe Presensi',
    'Status',
    'Metode',
    'Status Sinkron Sheets',
    'Keterangan',
  ];

  const rows = records.map((r) => [
    r.id,
    r.tanggal,
    r.jamAbsen,
    `="${r.nip}"`, // Excel formula wrapper to preserve leading zeros
    `"${r.nama.replace(/"/g, '""')}"`,
    r.kategori,
    `"${r.jabatan.replace(/"/g, '""')}"`,
    r.tipe,
    r.status,
    r.metode,
    r.syncedWithSheets ? 'TERKIRIM' : 'BELUM SINKRON',
    `"${(r.keterangan || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const todayStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `Rekap_Presensi_Guru_TU_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
