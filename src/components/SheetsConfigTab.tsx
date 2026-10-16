import React, { useState, useEffect } from 'react';
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
  Server,
  Share2,
  QrCode,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Radio,
  X,
  Info,
} from 'lucide-react';
import { AttendanceSchedule, SheetsConfig } from '../types';
import { testSheetsConnection } from '../services/sheetsService';
import QRCode from 'qrcode';

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

  // Sync state with parent props if updated remotely or from server
  useEffect(() => {
    setWebhookUrl(config.webhookUrl);
    setSpreadsheetId(config.spreadsheetId);
    setSheetName(config.sheetName || 'Log_Presensi');
    setAutoSync(config.autoSync);
  }, [config]);

  // Schedule state
  const [jamMasukMulai, setJamMasukMulai] = useState(schedule.jamMasukMulai);
  const [jamMasukTepatWaktu, setJamMasukTepatWaktu] = useState(schedule.jamMasukTepatWaktu);
  const [jamPulangMulai, setJamPulangMulai] = useState(schedule.jamPulangMulai);

  // Testing & Save states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Device Link & QR Modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareQrUrl, setShareQrUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const getShareableUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (webhookUrl.trim()) {
      params.set('webhook', encodeURIComponent(webhookUrl.trim()));
    }
    if (spreadsheetId.trim()) {
      params.set('sheetId', encodeURIComponent(spreadsheetId.trim()));
    }
    if (sheetName.trim()) {
      params.set('sheetName', encodeURIComponent(sheetName.trim()));
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const handleOpenShareModal = async () => {
    const url = getShareableUrl();
    try {
      const qr = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: '#04101e', light: '#ffffff' },
      });
      setShareQrUrl(qr);
      setShowShareModal(true);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  const handleCopyShareLink = () => {
    const url = getShareableUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSheetsConnection(webhookUrl, spreadsheetId);
      setTestResult(res);
      if (res.success) {
        const updated = {
          ...config,
          webhookUrl: webhookUrl.trim(),
          spreadsheetId: spreadsheetId.trim(),
          sheetName: sheetName.trim() || 'Log_Presensi',
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
      isConnected: !!webhookUrl.trim(),
    });
    onSaveSchedule({
      ...schedule,
      jamMasukMulai,
      jamMasukTepatWaktu,
      jamPulangMulai,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Multi-Device Synchronized Server Status Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border border-emerald-500/30 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Sinkronisasi Terpusat Antar Perangkat Aktif
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Semua Perangkat Otomatis Terhubung
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Setelah Webhook URL dan Spreadsheet ID disimpan, data ini tersimpan terpusat di server.
              Saat aplikasi dibuka di <strong>laptop lain, monitor presensi, tablet, atau smartphone</strong>,
              sistem langsung mengenali database Google Sheets tanpa perlu memasukkan URL atau ID lagi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={handleOpenShareModal}
            disabled={!webhookUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-emerald-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            title="Bagikan ke perangkat lain via Tautan Cepat atau QR Code"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Tautan &amp; QR Perangkat</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Google Sheets Integration Card */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Integrasi Database Google Sheets
                </h2>
                <p className="text-xs text-slate-400">
                  Hubungkan endpoint Google Apps Script Webhook agar log presensi otomatis dicatat di Spreadsheet Anda.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToScript}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 text-xs font-semibold transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Lihat Skrip &amp; Panduan</span>
            </button>
          </div>

          {saveSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <strong>Pengaturan Berhasil Disimpan di Server!</strong> Berlaku otomatis untuk semua perangkat yang membuka aplikasi ini.
              </div>
            </div>
          )}

          {testResult && (
            <div
              className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
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
                <div className="font-bold">{testResult.success ? 'Koneksi Berhasil Diverifikasi' : 'Koneksi Gagal'}</div>
                <div className="text-slate-300 mt-0.5 leading-relaxed">{testResult.message}</div>
              </div>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  URL Aplikasi Web Google Apps Script (Webhook URL) *
                </label>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Otomatis tersimpan untuk semua perangkat
                </span>
              </div>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                required
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1.5 block">
                Didapatkan dari menu <strong>Deploy &gt; New Deployment &gt; Web App</strong> pada Google Spreadsheet Anda. Pastikan akses diatur ke <em>"Anyone" (Siapa Saja)</em>.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-200">
                    Spreadsheet ID (Opsional jika skrip terikat langsung)
                  </label>
                </div>
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="Opsional - kosongkan jika skrip dibuat langsung di spreadsheet"
                  className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Boleh dikosongkan jika skrip dibuat melalui menu <em>Ekstensi &gt; Apps Script</em> di Spreadsheet yang sama.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Nama Lembar / Sheet Tab Log Presensi
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Log_Presensi"
                  className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Nama tab di Spreadsheet untuk menyimpan catatan presensi (bawaan: <code>Log_Presensi</code>).
                </span>
              </div>
            </div>

            {/* Test Connection Button & AutoSync */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 mt-4">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !webhookUrl}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Google Sheets'}</span>
              </button>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-900"
                />
                <span>Otomatis kirim presensi ke Sheets secara realtime saat scan</span>
              </label>
            </div>
          </div>
        </div>

        {/* Schedule & Tolerance Configuration Card */}
        <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Jadwal Jam Kerja &amp; Batas Toleransi Keterlambatan
              </h2>
              <p className="text-xs text-slate-400">
                Atur parameter waktu untuk klasifikasi status otomatis (Hadir vs Terlambat). Berlaku sama di semua perangkat.
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
              <span className="text-[10px] text-slate-500 mt-1 block">Waktu awal presensi masuk dibuka.</span>
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
              <span className="text-[10px] text-amber-400/80 mt-1 block">Presensi setelah waktu ini terhitung TERLAMBAT.</span>
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
              <span className="text-[10px] text-slate-500 mt-1 block">Waktu awal pegawai diizinkan presensi pulang.</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan ke Server &amp; Terapkan ke Semua Perangkat</span>
            </button>
          </div>
        </div>
      </form>

      {/* Share / QR Code Modal for Instant Device Setup */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0b1325] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Hubungkan Perangkat Baru</h3>
                  <p className="text-[11px] text-slate-400">Scan QR atau buka tautan di perangkat lain</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Pengaturan sudah tersimpan di server. Anda dapat membuka URL aplikasi secara langsung di perangkat lain, atau scan QR code di bawah ini untuk menghubungkan seketika.
              </span>
            </div>

            {/* QR Code Container */}
            {shareQrUrl && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner">
                <img
                  src={shareQrUrl}
                  alt="QR Code Konfigurasi Perangkat"
                  className="w-56 h-56 object-contain"
                />
                <span className="text-[10px] text-slate-700 font-mono mt-2 font-semibold">
                  Arahkan kamera HP / Tablet ke QR Code ini
                </span>
              </div>
            )}

            {/* Copy Link Button */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Tautan Berhasil Disalin!' : 'Salin Tautan Konfigurasi Perangkat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
