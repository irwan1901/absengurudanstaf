import React, { useState, useMemo } from 'react';
import {
  Calendar,
  RotateCw,
  Download,
  Search,
  Users,
  UserCheck,
  UserX,
  Clock,
  ClockAlert,
  FileText,
  HeartPulse,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ScanFace,
  FileSpreadsheet,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, AttendanceType, CATEGORY_BADGES, CATEGORY_LABELS, Person, PersonCategory, SheetsConfig, AuthUser } from '../types';
import { exportAttendanceToCsv } from '../services/storage';

export type AttendanceLogFilter = 'ALL' | 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'BELUM';

interface AttendanceLogProps {
  records: AttendanceRecord[];
  persons: Person[];
  selectedCategory: 'SEMUA' | PersonCategory;
  sheetsConfig: SheetsConfig;
  onRefresh: () => void;
  onManualMarkStatus: (person: Person, status: AttendanceStatus, notes: string, tipe?: AttendanceType) => void;
  onSyncPendingRecords: () => void;
  isSyncing: boolean;
  activeStatusFilter?: AttendanceLogFilter;
  onStatusFilterChange?: (filter: AttendanceLogFilter) => void;
  currentUser?: AuthUser | null;
}

export const AttendanceLog: React.FC<AttendanceLogProps> = ({
  records,
  persons,
  selectedCategory,
  sheetsConfig,
  onRefresh,
  onManualMarkStatus,
  onSyncPendingRecords,
  isSyncing,
  activeStatusFilter,
  onStatusFilterChange,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [internalStatusFilter, setInternalStatusFilter] = useState<AttendanceLogFilter>('ALL');

  const isAdmin = currentUser ? currentUser.role === 'admin' : true;

  const statusFilter = activeStatusFilter !== undefined ? activeStatusFilter : internalStatusFilter;
  const setStatusFilter = (f: AttendanceLogFilter) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(f);
    } else {
      setInternalStatusFilter(f);
    }
  };

  const [selectedPersonForManual, setSelectedPersonForManual] = useState<Person | null>(null);
  const [manualTipe, setManualTipe] = useState<AttendanceType>('MASUK');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('IZIN');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Format today's date in Indonesian
  const todayStr = useMemo(() => {
    const now = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter persons by category (Guru / TU)
  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      if (selectedCategory !== 'SEMUA' && p.kategori !== selectedCategory) return false;
      return true;
    });
  }, [persons, selectedCategory]);

  // Today's records for filtered persons
  const todayRecords = useMemo(() => {
    return records.filter((r) => {
      if (r.tanggal !== todayIso) return false;
      if (selectedCategory !== 'SEMUA' && r.kategori !== selectedCategory) return false;
      return true;
    });
  }, [records, todayIso, selectedCategory]);

  // Map today's records by NIP: { masuk?: AttendanceRecord; pulang?: AttendanceRecord }
  const todayPersonAttendanceMap = useMemo(() => {
    const map = new Map<string, { masuk?: AttendanceRecord; pulang?: AttendanceRecord }>();
    todayRecords.forEach((r) => {
      const entry = map.get(r.nip) || {};
      if (r.tipe === 'MASUK') {
        entry.masuk = r;
      } else if (r.tipe === 'PULANG') {
        entry.pulang = r;
      }
      map.set(r.nip, entry);
    });
    return map;
  }, [todayRecords]);

  // Set of NIPs that have checked in today (primary for stats)
  const attendedNipMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    todayRecords.forEach((r) => {
      // Prioritize masuk or first record
      if (!map.has(r.nip) || r.tipe === 'MASUK') {
        map.set(r.nip, r);
      }
    });
    return map;
  }, [todayRecords]);

  // Stats calculation
  const totalCount = filteredPersons.length;
  const tepatWaktuCount = useMemo(() => {
    return filteredPersons.filter((p) => {
      const rec = attendedNipMap.get(p.nip);
      return rec && rec.status === 'HADIR';
    }).length;
  }, [filteredPersons, attendedNipMap]);

  const hadirCount = useMemo(() => {
    return filteredPersons.filter((p) => {
      const rec = attendedNipMap.get(p.nip);
      return rec && (rec.status === 'HADIR' || rec.status === 'TERLAMBAT');
    }).length;
  }, [filteredPersons, attendedNipMap]);

  const terlambatCount = useMemo(() => {
    return filteredPersons.filter((p) => {
      const rec = attendedNipMap.get(p.nip);
      return rec && rec.status === 'TERLAMBAT';
    }).length;
  }, [filteredPersons, attendedNipMap]);

  const izinCount = useMemo(() => {
    return filteredPersons.filter((p) => {
      const rec = attendedNipMap.get(p.nip);
      return rec && rec.status === 'IZIN';
    }).length;
  }, [filteredPersons, attendedNipMap]);

  const sakitCount = useMemo(() => {
    return filteredPersons.filter((p) => {
      const rec = attendedNipMap.get(p.nip);
      return rec && rec.status === 'SAKIT';
    }).length;
  }, [filteredPersons, attendedNipMap]);

  const belumHadirCount = Math.max(0, totalCount - hadirCount - izinCount - sakitCount);
  const attendanceRate = totalCount > 0 ? Math.round((hadirCount / totalCount) * 100) : 0;

  // Combined list of records + unrecorded persons for the active filter
  const displayItems = useMemo(() => {
    return filteredPersons
      .map((p) => {
        const attendance = todayPersonAttendanceMap.get(p.nip);
        const masukRecord = attendance?.masuk;
        const pulangRecord = attendance?.pulang;
        const record = masukRecord || pulangRecord;
        return {
          person: p,
          record,
          masukRecord,
          pulangRecord,
          hasAttended: !!(masukRecord || pulangRecord),
          status: masukRecord ? masukRecord.status : pulangRecord ? ('HADIR' as const) : ('BELUM' as const),
        };
      })
      .filter((item) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.person.nama.toLowerCase().includes(q);
          const matchNip = item.person.nip.toLowerCase().includes(q);
          const matchJabatan = item.person.jabatan.toLowerCase().includes(q);
          if (!matchName && !matchNip && !matchJabatan) return false;
        }

        // Status tab filter
        if (statusFilter === 'HADIR') {
          return item.status === 'HADIR';
        }
        if (statusFilter === 'TERLAMBAT') {
          return item.status === 'TERLAMBAT';
        }
        if (statusFilter === 'IZIN') {
          return item.status === 'IZIN';
        }
        if (statusFilter === 'SAKIT') {
          return item.status === 'SAKIT';
        }
        if (statusFilter === 'BELUM') {
          return !item.hasAttended;
        }
        return true;
      });
  }, [filteredPersons, todayPersonAttendanceMap, searchQuery, statusFilter]);

  const handleExportCsv = () => {
    exportAttendanceToCsv(todayRecords, `Presensi_Guru_TU_${todayIso}.csv`);
  };

  const handleSaveManual = () => {
    if (!selectedPersonForManual) return;
    onManualMarkStatus(selectedPersonForManual, manualStatus, manualNotes, manualTipe);
    setSelectedPersonForManual(null);
    setManualNotes('');
  };

  const pendingSyncCount = useMemo(() => {
    return records.filter((r) => !r.syncedWithSheets).length;
  }, [records]);

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-[#0c1424] p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
      <div>
        {/* Card Header matching screenshot */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Log Kehadiran Realtime
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-medium">
              {selectedCategory === 'SEMUA' ? 'Semua Pegawai' : (CATEGORY_LABELS[selectedCategory] || selectedCategory)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync to Google Sheets button - Admin Only */}
            {sheetsConfig.webhookUrl && isAdmin && (
              <button
                onClick={onSyncPendingRecords}
                disabled={isSyncing}
                title="Sinkronkan log presensi ke Google Sheets (Admin)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:inline">Sync Sheets</span>
                {pendingSyncCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[10px] flex items-center justify-center font-bold">
                    {pendingSyncCount}
                  </span>
                )}
              </button>
            )}

            {/* Refresh Button matching screenshot */}
            <button
              onClick={onRefresh}
              title="Perbarui Log Kehadiran"
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Export CSV Button matching screenshot */}
            <button
              onClick={handleExportCsv}
              title="Unduh Rekapitulasi CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-emerald-500/50 text-xs font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Date line matching screenshot */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-4 font-medium">
          <Calendar className="w-3.5 h-3.5" />
          <span>Hari ini: {todayStr}</span>
        </div>

        {/* KPI Summary Cards Grid - Total Hadir, Terlambat, Izin, Sakit */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {/* Hadir */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'HADIR' ? 'ALL' : 'HADIR')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'HADIR'
                ? 'bg-emerald-950/60 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-[#070d18] border-slate-800 hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span>Total Hadir</span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono-numbers">
              {tepatWaktuCount}
            </div>
            <div className="text-[10px] text-emerald-400/80">Tepat Waktu</div>
          </button>

          {/* Terlambat */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'TERLAMBAT' ? 'ALL' : 'TERLAMBAT')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'TERLAMBAT'
                ? 'bg-amber-950/60 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-[#070d18] border-slate-800 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span>Terlambat</span>
              <ClockAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400 font-mono-numbers">
              {terlambatCount}
            </div>
            <div className="text-[10px] text-amber-400/80">&gt; Jam 07:15</div>
          </button>

          {/* Izin */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'IZIN' ? 'ALL' : 'IZIN')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'IZIN'
                ? 'bg-sky-950/60 border-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'bg-[#070d18] border-slate-800 hover:border-sky-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span>Izin</span>
              <FileText className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-sky-400 font-mono-numbers">
              {izinCount}
            </div>
            <div className="text-[10px] text-sky-400/80">Dinas / Cuti</div>
          </button>

          {/* Sakit */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'SAKIT' ? 'ALL' : 'SAKIT')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'SAKIT'
                ? 'bg-purple-950/60 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                : 'bg-[#070d18] border-slate-800 hover:border-purple-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span>Sakit</span>
              <HeartPulse className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-400 font-mono-numbers">
              {sakitCount}
            </div>
            <div className="text-[10px] text-purple-400/80">Surat Dokter</div>
          </button>
        </div>

        {/* Compact Sub-KPIs: Total Pegawai & Belum Hadir */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-[#070d18]/70 rounded-lg border border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Total Pegawai:
            </span>
            <strong className="text-white font-mono-numbers">{totalCount}</strong>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'BELUM' ? 'ALL' : 'BELUM')}
            className={`rounded-lg border px-3 py-1.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
              statusFilter === 'BELUM'
                ? 'bg-slate-800 border-slate-600 text-slate-200'
                : 'bg-[#070d18]/70 border-slate-800/80 text-slate-400 hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-amber-500" />
              Belum Hadir:
            </span>
            <strong className="text-amber-400 font-mono-numbers">{belumHadirCount}</strong>
          </button>
        </div>

        {/* Attendance Progress Bar matching screenshot */}
        <div className="bg-[#070d18] rounded-xl border border-slate-800/80 p-3 mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Tingkat Kehadiran</span>
            <span className="text-emerald-400 font-bold font-mono-numbers">{attendanceRate}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        {/* Search Bar & Filter Tabs matching screenshot */}
        <div className="space-y-2.5 mb-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau NIP..."
              className="w-full bg-[#070d18] text-slate-200 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Filter Segmented Buttons matching screenshot */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Semua ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('HADIR')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'HADIR'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Hadir ({hadirCount})
            </button>
            <button
              onClick={() => setStatusFilter('TERLAMBAT')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'TERLAMBAT'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Terlambat ({terlambatCount})
            </button>
            <button
              onClick={() => setStatusFilter('IZIN')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'IZIN'
                  ? 'bg-sky-400 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Izin ({izinCount})
            </button>
            <button
              onClick={() => setStatusFilter('SAKIT')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'SAKIT'
                  ? 'bg-purple-400 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Sakit ({sakitCount})
            </button>
            <button
              onClick={() => setStatusFilter('BELUM')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'BELUM'
                  ? 'bg-slate-700 text-white font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Belum ({belumHadirCount})
            </button>
          </div>
        </div>

        {/* Attendance List Area matching screenshot */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {displayItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Tidak ada data guru atau staf yang cocok dengan filter.
            </div>
          ) : (
            displayItems.map(({ person, masukRecord, pulangRecord }) => (
              <div
                key={person.id}
                className="p-2.5 rounded-xl bg-[#070d18] border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
              >
                {/* Person Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={person.fotoUrl}
                    alt={person.nama}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-emerald-300 transition-colors">
                        {person.nama}
                      </h4>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium border shrink-0 ${
                          CATEGORY_BADGES[person.kategori]?.color || 'bg-slate-800 text-slate-400'
                        } ${CATEGORY_BADGES[person.kategori]?.border || 'border-slate-700'}`}
                      >
                        {CATEGORY_BADGES[person.kategori]?.label || person.kategori}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono-numbers truncate">
                      NIP: {person.nip} • {person.jabatan}
                    </p>
                  </div>
                </div>

                {/* Status & Timing - Aturan 1x Masuk & 1x Pulang */}
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1">
                    {/* Presensi Masuk (1x) */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-[10px] text-slate-400 font-medium">Masuk:</span>
                      {masukRecord ? (
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                              masukRecord.status === 'HADIR'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : masukRecord.status === 'TERLAMBAT'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : masukRecord.status === 'IZIN'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}
                          >
                            {masukRecord.status} • {masukRecord.jamAbsen}
                          </span>
                          {masukRecord.metode === 'WAJAH_AI' ? (
                            <span title="Absen Masuk via Wajah AI" className="text-emerald-400">
                              <ScanFace className="w-3.5 h-3.5" />
                            </span>
                          ) : masukRecord.metode === 'QR_CODE' ? (
                            <span title="Absen Masuk via QR Code" className="text-sky-400">
                              <QrCode className="w-3.5 h-3.5" />
                            </span>
                          ) : null}
                          {masukRecord.syncedWithSheets && (
                            <span title="Tersinkron ke Sheets">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/80 font-medium">
                          Belum Masuk
                        </span>
                      )}
                    </div>

                    {/* Presensi Pulang (1x) */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-[10px] text-slate-400 font-medium">Pulang:</span>
                      {pulangRecord ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            PULANG • {pulangRecord.jamAbsen}
                          </span>
                          {pulangRecord.metode === 'WAJAH_AI' ? (
                            <span title="Absen Pulang via Wajah AI" className="text-amber-400">
                              <ScanFace className="w-3.5 h-3.5" />
                            </span>
                          ) : pulangRecord.metode === 'QR_CODE' ? (
                            <span title="Absen Pulang via QR Code" className="text-sky-400">
                              <QrCode className="w-3.5 h-3.5" />
                            </span>
                          ) : null}
                          {pulangRecord.syncedWithSheets && (
                            <span title="Tersinkron ke Sheets">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800 font-medium">
                          Belum Pulang
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tombol Disposisi Manual - Admin Only */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setManualTipe(masukRecord ? 'PULANG' : 'MASUK');
                        setSelectedPersonForManual(person);
                      }}
                      title="Disposisi Presensi Manual (Admin)"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700 text-[10px] font-medium transition-colors border border-slate-700 shrink-0"
                    >
                      Disposisi
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Status Override Modal */}
      {selectedPersonForManual && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1424] border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">
              Disposisi Presensi Manual
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Tandai kehadiran untuk <strong className="text-emerald-300">{selectedPersonForManual.nama}</strong>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Tipe Presensi (Aturan 1x Masuk &amp; 1x Pulang)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualTipe('MASUK')}
                    className={`py-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                      manualTipe === 'MASUK'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Presensi Masuk (1x)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualTipe('PULANG')}
                    className={`py-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                      manualTipe === 'PULANG'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Presensi Pulang (1x)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Status Kehadiran</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setManualStatus(st)}
                      className={`py-2 rounded-lg font-bold transition-all ${
                        manualStatus === st
                          ? 'bg-emerald-500 text-slate-950 shadow-md'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Keterangan / Alasan (Opsional)</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Misal: Sakit demam, Izin dinas luar, dll."
                  className="w-full bg-[#070d18] text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setSelectedPersonForManual(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                onClick={handleSaveManual}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-all"
              >
                Simpan Presensi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
