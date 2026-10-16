import React, { useState } from 'react';
import {
  FileCode2,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Table,
  Sparkles,
} from 'lucide-react';
import { generateGoogleAppsScriptCode } from '../services/sheetsService';

export const ScriptTemplateTab: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const scriptCode = generateGoogleAppsScriptCode('Log_Presensi');

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Skrip Google Apps Script &amp; Panduan Pemasangan
              </h2>
              <p className="text-xs text-slate-400">
                Salin kode berikut ke Google Apps Script Spreadsheet Anda untuk mengaktifkan sinkronisasi database real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://sheets.new"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-semibold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Google Sheets Baru</span>
            </a>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Kode Skrip'}</span>
            </button>
          </div>
        </div>

        {/* 4 Steps Tutorial */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mt-6 mb-6">
          <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-2">
              1
            </div>
            <h4 className="font-bold text-white mb-1">Buat Spreadsheet</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Buka Google Sheets di Google Drive Anda dan beri judul misalnya <em>"Presensi Guru &amp; TU 2026"</em>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-2">
              2
            </div>
            <h4 className="font-bold text-white mb-1">Buka Apps Script</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Klik menu <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong> di bilah atas Spreadsheet.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-2">
              3
            </div>
            <h4 className="font-bold text-white mb-1">Tempel &amp; Simpan</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Hapus kode bawaan <code>myFunction</code>, tempel skrip di bawah, lalu klik ikon Disket (Simpan).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-2">
              4
            </div>
            <h4 className="font-bold text-white mb-1">Deploy Sebagai Web App</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Klik <strong>Terapkan (Deploy)</strong> &gt; <strong>Deployment Baru</strong> &gt; Jenis <strong>Aplikasi Web</strong>. Atur akses: <strong>Siapa Saja (Anyone)</strong>.
            </p>
          </div>
        </div>

        {/* Code Box */}
        <div className="relative rounded-xl border border-slate-800 bg-[#070d18] overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">Code.gs (Google Apps Script)</span>
            <button
              onClick={handleCopy}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              {copied ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <pre className="p-4 text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-[380px] leading-relaxed">
            {scriptCode}
          </pre>
        </div>

        {/* Structure Preview of Spreadsheet */}
        <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <Table className="w-4 h-4 text-emerald-400" />
              <span>1. Sheet Biodata Pegawai: <code>Data_Guru_TU</code> (Tersimpan otomatis saat Pendaftaran Wajah)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-[11px] font-mono text-slate-300">
                <thead className="bg-[#070d18] text-emerald-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">A: NIP / NIK</th>
                    <th className="py-2 px-3">B: Nama Lengkap</th>
                    <th className="py-2 px-3">C: Kategori</th>
                    <th className="py-2 px-3">D: Jabatan / Mapel</th>
                    <th className="py-2 px-3">E: Gender</th>
                    <th className="py-2 px-3">F: Tanggal Daftar</th>
                    <th className="py-2 px-3">G: Status Wajah AI</th>
                  </tr>
                </thead>
                <tbody className="bg-[#0c1424] divide-y divide-slate-800">
                  <tr>
                    <td className="py-2 px-3 font-mono-numbers">19850412...</td>
                    <td className="py-2 px-3 font-bold text-white">Drs. H. Ahmad Fauzi, M.Pd</td>
                    <td className="py-2 px-3 text-emerald-400 font-bold">GURU</td>
                    <td className="py-2 px-3">Guru Matematika</td>
                    <td className="py-2 px-3">Laki-Laki</td>
                    <td className="py-2 px-3 text-slate-400">2026-10-16</td>
                    <td className="py-2 px-3 text-emerald-300 font-semibold">Wajah AI Aktif</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
              <Table className="w-4 h-4 text-sky-400" />
              <span>2. Sheet Presensi Harian: <code>Log_Presensi</code> (Tersimpan otomatis saat scan kamera)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-[11px] font-mono text-slate-300">
                <thead className="bg-[#070d18] text-sky-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">A: ID Log</th>
                    <th className="py-2 px-3">B: Waktu Catat</th>
                    <th className="py-2 px-3">C: Tanggal</th>
                    <th className="py-2 px-3">D: NIP</th>
                    <th className="py-2 px-3">E: Nama Lengkap</th>
                    <th className="py-2 px-3">F: Kategori</th>
                    <th className="py-2 px-3">G: Tipe</th>
                    <th className="py-2 px-3">H: Status</th>
                    <th className="py-2 px-3">I: Jam Absen</th>
                    <th className="py-2 px-3">J: Metode</th>
                  </tr>
                </thead>
                <tbody className="bg-[#0c1424] divide-y divide-slate-800">
                  <tr>
                    <td className="py-2 px-3 text-slate-500">rec-1729...</td>
                    <td className="py-2 px-3">16/10/2026, 06:45:12</td>
                    <td className="py-2 px-3">2026-10-16</td>
                    <td className="py-2 px-3 font-mono-numbers">19850412...</td>
                    <td className="py-2 px-3 font-bold text-white">Drs. H. Ahmad Fauzi, M.Pd</td>
                    <td className="py-2 px-3 text-emerald-400 font-bold">GURU</td>
                    <td className="py-2 px-3">MASUK</td>
                    <td className="py-2 px-3 text-emerald-400 font-bold">HADIR</td>
                    <td className="py-2 px-3 font-mono-numbers">06:45:12</td>
                    <td className="py-2 px-3">WAJAH_AI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
