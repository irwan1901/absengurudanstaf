import React, { useMemo } from 'react';
import {
  UserCheck,
  ClockAlert,
  FileText,
  HeartPulse,
  UserX,
  TrendingUp,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, CATEGORY_LABELS, Person, PersonCategory } from '../types';

interface AttendanceStatsSummaryProps {
  records: AttendanceRecord[];
  persons: Person[];
  selectedCategory: 'SEMUA' | PersonCategory;
  onFilterByStatus?: (status: 'ALL' | AttendanceStatus | 'BELUM') => void;
  activeFilter?: string;
}

export const AttendanceStatsSummary: React.FC<AttendanceStatsSummaryProps> = ({
  records,
  persons,
  selectedCategory,
  onFilterByStatus,
  activeFilter,
}) => {
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter persons by active category selector (Guru vs TU vs Semua)
  const categoryPersons = useMemo(() => {
    return persons.filter((p) => {
      if (selectedCategory !== 'SEMUA' && p.kategori !== selectedCategory) return false;
      return true;
    });
  }, [persons, selectedCategory]);

  // Today's records for category persons
  const todayRecords = useMemo(() => {
    return records.filter((r) => {
      if (r.tanggal !== todayIso) return false;
      if (selectedCategory !== 'SEMUA' && r.kategori !== selectedCategory) return false;
      return true;
    });
  }, [records, todayIso, selectedCategory]);

  // Map latest / check-in status per NIP
  const statusMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    todayRecords.forEach((r) => {
      // Prioritize masuk or latest
      if (!map.has(r.nip) || r.tipe === 'MASUK') {
        map.set(r.nip, r.status);
      }
    });
    return map;
  }, [todayRecords]);

  // Counts
  const totalCount = categoryPersons.length;
  let hadirCount = 0;
  let terlambatCount = 0;
  let izinCount = 0;
  let sakitCount = 0;
  let belumCount = 0;

  categoryPersons.forEach((p) => {
    const st = statusMap.get(p.nip);
    if (st === 'HADIR') hadirCount++;
    else if (st === 'TERLAMBAT') terlambatCount++;
    else if (st === 'IZIN') izinCount++;
    else if (st === 'SAKIT') sakitCount++;
    else belumCount++;
  });

  const totalHadirFisik = hadirCount + terlambatCount;
  const attendanceRate = totalCount > 0 ? Math.round((totalHadirFisik / totalCount) * 100) : 0;
  const onTimeRate = totalHadirFisik > 0 ? Math.round((hadirCount / totalHadirFisik) * 100) : 0;

  // Breakdown Guru vs Staf TU
  const guruPersons = persons.filter((p) => p.kategori === 'GURU');
  const tuPersons = persons.filter((p) => p.kategori === 'TATA_USAHA');

  const getHadirForSubgroup = (group: Person[]) => {
    return group.filter((p) => {
      const st = statusMap.get(p.nip);
      return st === 'HADIR' || st === 'TERLAMBAT';
    }).length;
  };

  const guruHadir = getHadirForSubgroup(guruPersons);
  const guruRate = guruPersons.length > 0 ? Math.round((guruHadir / guruPersons.length) * 100) : 0;

  const tuHadir = getHadirForSubgroup(tuPersons);
  const tuRate = tuPersons.length > 0 ? Math.round((tuHadir / tuPersons.length) * 100) : 0;

  return (
    <div className="bg-[#0c1424] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Title & Quick Overview Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Statistik Ringkasan Kehadiran Hari Ini
              <span className="text-[11px] font-normal text-slate-400">
                ({selectedCategory === 'SEMUA' ? 'Semua Pegawai' : (CATEGORY_LABELS[selectedCategory] || selectedCategory)})
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Pantauan langsung status kehadiran fisik, toleransi jam kerja, dan disposisi izin/sakit.
            </p>
          </div>
        </div>

        {/* Aggregate Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#070d18] border border-slate-800">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Guru:</span>
            <strong className="text-white font-mono-numbers">{guruHadir}/{guruPersons.length}</strong>
            <span className="text-emerald-400 font-bold font-mono-numbers">({guruRate}%)</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#070d18] border border-slate-800">
            <Briefcase className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Tata Usaha:</span>
            <strong className="text-white font-mono-numbers">{tuHadir}/{tuPersons.length}</strong>
            <span className="text-sky-400 font-bold font-mono-numbers">({tuRate}%)</span>
          </div>
        </div>
      </div>

      {/* 5-Column Stats Cards Grid matching request */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Hadir Tepat Waktu */}
        <button
          type="button"
          onClick={() => onFilterByStatus?.('HADIR')}
          className={`p-3.5 rounded-xl border text-left transition-all group cursor-pointer ${
            activeFilter === 'HADIR'
              ? 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-[#070d18] border-slate-800/90 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 text-slate-400">
            <span className="font-medium text-slate-300">Tepat Waktu</span>
            <div className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400 group-hover:scale-110 transition-transform">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono-numbers tracking-tight">
            {hadirCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{totalCount > 0 ? `${Math.round((hadirCount / totalCount) * 100)}% dari total` : '0%'}</span>
            <span className="text-emerald-400/90 font-medium">Hadir Awal</span>
          </div>
        </button>

        {/* 2. Terlambat */}
        <button
          type="button"
          onClick={() => onFilterByStatus?.('TERLAMBAT')}
          className={`p-3.5 rounded-xl border text-left transition-all group cursor-pointer ${
            activeFilter === 'TERLAMBAT'
              ? 'bg-amber-950/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-[#070d18] border-slate-800/90 hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 text-slate-400">
            <span className="font-medium text-slate-300">Terlambat</span>
            <div className="p-1 rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-110 transition-transform">
              <ClockAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono-numbers tracking-tight">
            {terlambatCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{totalCount > 0 ? `${Math.round((terlambatCount / totalCount) * 100)}% dari total` : '0%'}</span>
            <span className="text-amber-400/90 font-medium">&gt; Toleransi</span>
          </div>
        </button>

        {/* 3. Izin */}
        <button
          type="button"
          onClick={() => onFilterByStatus?.('IZIN')}
          className={`p-3.5 rounded-xl border text-left transition-all group cursor-pointer ${
            activeFilter === 'IZIN'
              ? 'bg-sky-950/40 border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
              : 'bg-[#070d18] border-slate-800/90 hover:border-sky-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 text-slate-400">
            <span className="font-medium text-slate-300">Izin</span>
            <div className="p-1 rounded-lg bg-sky-500/15 text-sky-400 group-hover:scale-110 transition-transform">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono-numbers tracking-tight">
            {izinCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Disposisi resmi</span>
            <span className="text-sky-400/90 font-medium">Dinas/Cuti</span>
          </div>
        </button>

        {/* 4. Sakit */}
        <button
          type="button"
          onClick={() => onFilterByStatus?.('SAKIT')}
          className={`p-3.5 rounded-xl border text-left transition-all group cursor-pointer ${
            activeFilter === 'SAKIT'
              ? 'bg-purple-950/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
              : 'bg-[#070d18] border-slate-800/90 hover:border-purple-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 text-slate-400">
            <span className="font-medium text-slate-300">Sakit</span>
            <div className="p-1 rounded-lg bg-purple-500/15 text-purple-400 group-hover:scale-110 transition-transform">
              <HeartPulse className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono-numbers tracking-tight">
            {sakitCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Surat/Keterangan</span>
            <span className="text-purple-400/90 font-medium">Pemulihan</span>
          </div>
        </button>

        {/* 5. Belum Hadir / Belum Ada Keterangan */}
        <button
          type="button"
          onClick={() => onFilterByStatus?.('BELUM')}
          className={`p-3.5 rounded-xl border text-left transition-all group cursor-pointer col-span-2 sm:col-span-1 ${
            activeFilter === 'BELUM'
              ? 'bg-slate-800/80 border-slate-500 shadow-[0_0_15px_rgba(148,163,184,0.2)]'
              : 'bg-[#070d18] border-slate-800/90 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 text-slate-400">
            <span className="font-medium text-slate-300">Belum Hadir</span>
            <div className="p-1 rounded-lg bg-slate-800 text-slate-400 group-hover:scale-110 transition-transform">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-400 font-mono-numbers tracking-tight">
            {belumCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{totalCount > 0 ? `${Math.round((belumCount / totalCount) * 100)}% dari total` : '0%'}</span>
            <span className="text-amber-400/80 font-medium">Perlu Cek</span>
          </div>
        </button>
      </div>

      {/* Segmented Distribution Bar showing exact proportion */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-medium">Distribusi Status Presensi Hari Ini</span>
            <span className="text-[11px] text-emerald-400 font-bold font-mono-numbers">
              {attendanceRate}% Total Hadir Fisik
            </span>
            {totalHadirFisik > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {onTimeRate}% Disiplin Tepat Waktu
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono-numbers">
            {totalHadirFisik + izinCount + sakitCount}/{totalCount} Terdata
          </span>
        </div>

        {/* Multi-color Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-800/80 overflow-hidden flex gap-0.5 p-0.5">
          {totalCount > 0 ? (
            <>
              {hadirCount > 0 && (
                <div
                  title={`Hadir Tepat Waktu: ${hadirCount} (${Math.round((hadirCount / totalCount) * 100)}%)`}
                  className="h-full bg-emerald-500 rounded-sm transition-all"
                  style={{ width: `${(hadirCount / totalCount) * 100}%` }}
                />
              )}
              {terlambatCount > 0 && (
                <div
                  title={`Terlambat: ${terlambatCount} (${Math.round((terlambatCount / totalCount) * 100)}%)`}
                  className="h-full bg-amber-500 rounded-sm transition-all"
                  style={{ width: `${(terlambatCount / totalCount) * 100}%` }}
                />
              )}
              {izinCount > 0 && (
                <div
                  title={`Izin: ${izinCount} (${Math.round((izinCount / totalCount) * 100)}%)`}
                  className="h-full bg-sky-400 rounded-sm transition-all"
                  style={{ width: `${(izinCount / totalCount) * 100}%` }}
                />
              )}
              {sakitCount > 0 && (
                <div
                  title={`Sakit: ${sakitCount} (${Math.round((sakitCount / totalCount) * 100)}%)`}
                  className="h-full bg-purple-400 rounded-sm transition-all"
                  style={{ width: `${(sakitCount / totalCount) * 100}%` }}
                />
              )}
              {belumCount > 0 && (
                <div
                  title={`Belum Hadir: ${belumCount} (${Math.round((belumCount / totalCount) * 100)}%)`}
                  className="h-full bg-slate-700/60 rounded-sm transition-all"
                  style={{ width: `${(belumCount / totalCount) * 100}%` }}
                />
              )}
            </>
          ) : (
            <div className="h-full bg-slate-800 w-full rounded-sm" />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Tepat Waktu ({hadirCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Terlambat ({terlambatCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>Izin ({izinCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span>Sakit ({sakitCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span>Belum Absen ({belumCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
