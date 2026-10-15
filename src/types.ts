export type PersonCategory =
  | 'KEPALA_SEKOLAH'
  | 'GURU'
  | 'TATA_USAHA'
  | 'OPERATOR_SEKOLAH'
  | 'PUSTAKAWAN'
  | 'SECURITY'
  | 'OFFICE_BOY'
  | 'OFFICE_GIRL';

export const CATEGORY_LABELS: Record<PersonCategory, string> = {
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  GURU: 'Guru / Tenaga Pendidik',
  TATA_USAHA: 'Staf Tata Usaha',
  OPERATOR_SEKOLAH: 'Operator Sekolah',
  PUSTAKAWAN: 'Pustakawan',
  SECURITY: 'Security / Satpam',
  OFFICE_BOY: 'Office Boy (OB)',
  OFFICE_GIRL: 'Office Girl (OG)',
};

export const CATEGORY_BADGES: Record<PersonCategory, { label: string; color: string; border: string }> = {
  KEPALA_SEKOLAH: { label: 'Kepala Sekolah', color: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500/40' },
  GURU: { label: 'Guru', color: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/30' },
  TATA_USAHA: { label: 'Tata Usaha', color: 'bg-sky-500/20 text-sky-300', border: 'border-sky-500/30' },
  OPERATOR_SEKOLAH: { label: 'Operator', color: 'bg-indigo-500/20 text-indigo-300', border: 'border-indigo-500/30' },
  PUSTAKAWAN: { label: 'Pustakawan', color: 'bg-teal-500/20 text-teal-300', border: 'border-teal-500/30' },
  SECURITY: { label: 'Security', color: 'bg-rose-500/20 text-rose-300', border: 'border-rose-500/30' },
  OFFICE_BOY: { label: 'Office Boy', color: 'bg-orange-500/20 text-orange-300', border: 'border-orange-500/30' },
  OFFICE_GIRL: { label: 'Office Girl', color: 'bg-pink-500/20 text-pink-300', border: 'border-pink-500/30' },
};

export type PersonStatus = 'AKTIF' | 'NONAKTIF';
export type AttendanceType = 'MASUK' | 'PULANG';
export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA';
export type AttendanceMethod = 'WAJAH_AI' | 'QR_CODE' | 'MANUAL';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  nip?: string;
  jabatan?: string;
  fotoUrl?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  nama: string;
  role: UserRole;
  nip?: string;
  jabatan?: string;
  createdAt?: string;
}

export interface Person {
  id: string;
  nip: string;
  nama: string;
  kategori: PersonCategory;
  jabatan: string;
  gender: 'L' | 'P';
  fotoUrl: string;
  qrCodeDataUrl?: string;
  faceVector?: number[]; // Representasi fitur wajah 128 dimensi
  registeredAt: string;
}

export interface AttendanceRecord {
  id: string;
  timestamp: string; // ISO
  tanggal: string; // YYYY-MM-DD
  nip: string;
  nama: string;
  kategori: PersonCategory;
  jabatan: string;
  tipe: AttendanceType;
  status: AttendanceStatus;
  jamAbsen: string; // HH:mm:ss
  metode: AttendanceMethod;
  syncedWithSheets: boolean;
  fotoSnapshot?: string;
  keterangan?: string;
}

export interface SheetsConfig {
  webhookUrl: string;
  spreadsheetId: string;
  sheetName: string;
  autoSync: boolean;
  lastSyncTime: string | null;
  isConnected: boolean;
  isSimulatedMode: boolean;
}

export interface AttendanceSchedule {
  jamMasukMulai: string; // "06:00"
  jamMasukTepatWaktu: string; // "07:15" (sebelum ini = HADIR, setelah ini = TERLAMBAT)
  jamMasukBatasAkhir: string; // "11:00"
  jamPulangMulai: string; // "14:00"
  jamPulangSelesai: string; // "18:00"
}
