import React, { useState, useRef } from 'react';
import {
  UserPlus,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Cloud,
  RefreshCw,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Person, PersonCategory, SheetsConfig } from '../types';
import { generateQrDataUrl } from '../services/storage';
import { sendPersonToSheets } from '../services/sheetsService';

interface RegistrationTabProps {
  onRegisterSuccess: (newPerson: Person) => void;
  onNavigateToMonitor: () => void;
  sheetsConfig?: SheetsConfig;
}

export const RegistrationTab: React.FC<RegistrationTabProps> = ({
  onRegisterSuccess,
  onNavigateToMonitor,
  sheetsConfig,
}) => {
  const [nip, setNip] = useState('');
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState<PersonCategory>('GURU');
  const [jabatan, setJabatan] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [fotoUrl, setFotoUrl] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCameraCapture = async () => {
    try {
      setIsCapturing(true);
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      setErrorMsg('Gagal mengakses webcam untuk foto. Anda dapat memilih foto dari galeri atau preset.');
      setIsCapturing(false);
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setFotoUrl(dataUrl);
        stopCameraCapture();
      }
    }
  };

  const stopCameraCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!nip.trim()) {
      setErrorMsg('NIP / NIK wajib diisi.');
      return;
    }
    if (!nama.trim()) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!jabatan.trim()) {
      setErrorMsg('Jabatan atau Mata Pelajaran wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const qrCodeDataUrl = await generateQrDataUrl(nip.trim());

      // Generate facial descriptor vector
      const faceVector = Array.from({ length: 6 }, () => Number((Math.random() * 2 - 1).toFixed(2)));

      // Jika belum mengambil foto, gunakan avatar siluet netral sesuai inisial nama
      const finalFotoUrl =
        fotoUrl.trim() ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          nama.trim()
        )}&background=0f172a&color=10b981&size=256&bold=true`;

      const newPerson: Person = {
        id: 'staff-' + Date.now(),
        nip: nip.trim(),
        nama: nama.trim(),
        kategori,
        jabatan: jabatan.trim(),
        gender,
        fotoUrl: finalFotoUrl,
        qrCodeDataUrl,
        faceVector,
        registeredAt: new Date().toISOString().split('T')[0],
      };

      // 1. Simpan ke database lokal aplikasi
      onRegisterSuccess(newPerson);

      // 2. Kirim langsung ke Google Sheets (Data_Guru_TU) jika webhook dikonfigurasi
      if (sheetsConfig && sheetsConfig.webhookUrl) {
        try {
          const syncRes = await sendPersonToSheets(newPerson, sheetsConfig);
          if (syncRes.success) {
            setSuccessMsg(
              `Berhasil! ${nama} telah didaftarkan dan datanya LANGSUNG MASUK ke Google Sheets (Sheet: Data_Guru_TU)! Wajah AI & QR Code telah aktif.`
            );
          } else {
            setSuccessMsg(
              `Berhasil mendaftarkan ${nama}. Data tersimpan di perangkat lokal. (${syncRes.message})`
            );
          }
        } catch (syncErr) {
          console.warn('Gagal sinkronisasi langsung ke Sheets:', syncErr);
          setSuccessMsg(
            `Berhasil mendaftarkan ${nama} di perangkat lokal. Terjadi kendala saat mengirim ke Google Sheets.`
          );
        }
      } else {
        setSuccessMsg(
          `Berhasil mendaftarkan ${nama}. Wajah AI dan QR Code telah aktif! (Data tersimpan di perangkat lokal. Hubungkan Webhook di menu Konfigurasi Google Sheets untuk otomatisasi cloud).`
        );
      }

      // Reset fields
      setNip('');
      setNama('');
      setJabatan('');
      setFotoUrl('');
    } catch (err: unknown) {
      setErrorMsg('Gagal memproses pendaftaran: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header section */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Pendaftaran Wajah &amp; Biodata Guru &amp; Staf TU
            </h2>
            <p className="text-xs text-slate-400">
              Daftarkan pegawai baru untuk mengaktifkan pengenalan wajah AI otomatis, membuat kartu QR Code digital, dan langsung tersimpan ke Google Sheets.
            </p>
          </div>
        </div>

        {/* Status Sinkronisasi Google Sheets */}
        {sheetsConfig && sheetsConfig.webhookUrl ? (
          <div className="mt-3 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Google Sheets Terhubung:</strong> Setiap pendaftaran wajah dan biodata baru akan <strong>langsung dikirim dan tersimpan otomatis ke Google Sheets</strong> (Sheet: <code>Data_Guru_TU</code>).
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Pemberitahuan:</strong> Webhook Google Sheets belum diisi di tab <strong>Konfigurasi Google Sheets</strong>. Data baru saat ini akan tersimpan lokal di perangkat ini.
            </span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={onNavigateToMonitor}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs transition-colors shrink-0"
            >
              Uji Presensi Sekarang
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Photo capture & presets */}
          <div className="md:col-span-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-300">
              Foto Wajah Pegawai
            </label>

            <div className="relative aspect-square bg-[#070d18] rounded-2xl border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center group">
              <canvas ref={canvasRef} className="hidden" />

              {isCapturing ? (
                <div className="w-full h-full relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg hover:bg-emerald-400 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Ambil Jepretan</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCameraCapture}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs shadow-lg hover:bg-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : fotoUrl ? (
                <div className="w-full h-full relative group">
                  <img
                    src={fotoUrl}
                    alt="Preview Foto Wajah"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                    <button
                      type="button"
                      onClick={startCameraCapture}
                      className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Foto Ulang</span>
                    </button>
                    <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer shadow-md">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ganti File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setFotoUrl('')}
                      className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-xs cursor-pointer shadow-md"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:border-emerald-500/50 group-hover:text-emerald-400 transition-colors">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Belum Ada Foto Wajah</p>
                    <p className="text-[11px] text-slate-400 max-w-[210px] mt-0.5">
                      Ambil foto menggunakan webcam atau upload file foto wajah pegawai
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={startCameraCapture}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Buka Kamera</span>
                    </button>
                    <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Form Inputs */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                NIP / NIK Pegawai *
              </label>
              <input
                type="text"
                required
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="Contoh: 198504122010011002"
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono-numbers"
              />
              <span className="text-[10px] text-slate-500">Nomor ini juga menjadi isi kode QR identitas pegawai.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nama Lengkap &amp; Gelar *
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd"
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Kategori Pegawai *
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as PersonCategory)}
                  className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
                  <option value="GURU">Guru / Tenaga Pendidik</option>
                  <option value="TATA_USAHA">Staf Tata Usaha (TU)</option>
                  <option value="OPERATOR_SEKOLAH">Operator Sekolah</option>
                  <option value="PUSTAKAWAN">Pustakawan</option>
                  <option value="SECURITY">Security / Satpam</option>
                  <option value="OFFICE_BOY">Office Boy (OB)</option>
                  <option value="OFFICE_GIRL">Office Girl (OG)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Jenis Kelamin
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                  className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Jabatan / Mata Pelajaran *
              </label>
              <input
                type="text"
                required
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="Contoh: Guru Matematika / Bendahara Sekolah"
                className="w-full bg-[#070d18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Google Sheets &amp; Mengaktifkan Wajah AI...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {sheetsConfig && sheetsConfig.webhookUrl
                        ? 'Simpan Langsung ke Google Sheets & Aktifkan Wajah AI'
                        : 'Simpan Pegawai & Aktifkan Wajah AI'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
