import React, { useState } from 'react';
import {
  Settings,
  Cloud,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Save,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { AttendanceSchedule, SheetsConfig } from '../types';
import { testSheetsConnection } from '../services/sheetsService';

interface SheetsConfigTabProps {
  config: SheetsConfig;
  onSaveConfig: (newConfig: SheetsConfig) => void;
  schedule: AttendanceSchedule;
  onSaveSchedule: (newSchedule: AttendanceSchedule) => void;
  onNavigateToScript: () => void;
}

export const SheetsConfigTab: React.FC<SheetsConfigTabProps> = ({
  config,
  onSaveConfig,
  schedule,
  onSaveSchedule,
  onNavigateToScript,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl);
  const [spreadsheetId, setSpreadsheetId] = useState(config.spreadsheetId);
  const [sheetName, setSheetName] = useState(config.sheetName || 'Log_Presensi');
  const [autoSync, setAutoSync] = useState(config.autoSync);

  // Schedule state
  const [jamMasukMulai, setJamMasukMulai] = useState(schedule.jamMasukMulai);
  const [jamMasukTepatWaktu, setJamMasukTepatWaktu] = useState(schedule.jamMasukTepatWaktu);
  const [jamPulangMulai, setJamPulangMulai] = useState(schedule.jamPulangMulai);

  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSheetsConnection(webhookUrl, spreadsheetId);
      setTestResult(res);
      if (res.success) {
        const updated = {
          ...config,
          webhookUrl,
          spreadsheetId,
          sheetName,
          autoSync,
          isConnected: true,
        };
        onSaveConfig(updated);
      }
    } catch (e: unknown) {
      setTestResult({
        success: false,
        message: 'Gagal terhubung: ' + String(e),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: spreadsheetId.trim(),
      sheetName: sheetName.trim() || 'Log_Presensi',
      autoSync,
    });
    onSaveSchedule({
      ...schedule,
      jamMasukMulai,
      jamMasukTepatWaktu,
      jamPulangMulai,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Google Sheets Integration Card */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Integrasi Database Google Sheets
                </h2>
                <p className="text-xs text-slate-400">
                  Hubungkan endpoint Google Apps Script Webhook agar log presensi otomatis dicatat di Google Spreadsheet Anda.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToScript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 text-xs font-semibold transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Lihat Skrip &amp; Panduan</span>
            </button>
          </div>

          {saveSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Konfigurasi berhasil disimpan!</span>
            </div>
          )}

          {testResult && (
            <div
              className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">{testResult.success ? 'Koneksi Berhasil' : 'Koneksi Gagal'}</div>
                <div className="text-slate-300 mt-0.5">{testResult.message}</div>
              </div>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                URL Aplikasi Web Google Apps Script (Webhook URL) *
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Didapatkan dari menu Deploy &gt; New Deployment &gt; Web App pada Google Sheets Apps Script.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Spreadsheet ID (Opsional jika skrip terikat langsung)
                </label>
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Nama Lembar / Sheet Tab Log
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Log_Presensi"
                  className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !webhookUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Google Sheets'}</span>
              </button>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-900"
                />
                <span>Otomatis sinkronisasi setiap ada scan wajah/QR</span>
              </label>
            </div>
          </div>
        </div>

        {/* Schedule & Tolerance Configuration Card */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Jadwal Jam Kerja &amp; Batas Toleransi Keterlambatan
              </h2>
              <p className="text-xs text-slate-400">
                Atur parameter waktu untuk klasifikasi status otomatis (Hadir vs Terlambat).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Jam Masuk Dibuka
              </label>
              <input
                type="time"
                value={jamMasukMulai}
                onChange={(e) => setJamMasukMulai(e.target.value)}
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono-numbers"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Waktu mulai presensi masuk.</span>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Batas Tepat Waktu (Toleransi)
              </label>
              <input
                type="time"
                value={jamMasukTepatWaktu}
                onChange={(e) => setJamMasukTepatWaktu(e.target.value)}
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono-numbers"
              />
              <span className="text-[10px] text-amber-400/80 mt-1 block">Absen setelah jam ini = TERLAMBAT.</span>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Jam Buka Presensi Pulang
              </label>
              <input
                type="time"
                value={jamPulangMulai}
                onChange={(e) => setJamPulangMulai(e.target.value)}
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono-numbers"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Waktu guru/staf mulai boleh absen pulang.</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Seluruh Pengaturan</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
