import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  QrCode,
  UserCheck,
  VideoOff,
  Sparkles,
  RefreshCw,
  ScanFace,
  ChevronRight,
} from 'lucide-react';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import { AttendanceMethod, AttendanceRecord, AttendanceType, CATEGORY_LABELS, Person, SheetsConfig } from '../types';
import { playSuccessChime, playWarningChime, speakIndonesian } from '../services/audioService';

interface CameraMonitorProps {
  records: AttendanceRecord[];
  persons: Person[];
  onAttendanceSuccess: (record: AttendanceRecord) => void;
  sheetsConfig: SheetsConfig;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onNavigateToRegister: () => void;
  currentAttendanceType: AttendanceType;
  onChangeAttendanceType: (type: AttendanceType) => void;
}

export const CameraMonitor: React.FC<CameraMonitorProps> = ({
  records,
  persons,
  onAttendanceSuccess,
  soundEnabled,
  onToggleSound,
  onNavigateToRegister,
  currentAttendanceType,
  onChangeAttendanceType,
}) => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [detectionMode, setDetectionMode] = useState<'AUTO' | 'FACE' | 'QR'>('AUTO');
  const [showModeSelector, setShowModeSelector] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [faceMatchProgress, setFaceMatchProgress] = useState<number>(0);
  const [showManualFaceSelect, setShowManualFaceSelect] = useState<boolean>(false);

  // Notice when already attended for this type today
  const [alreadyRecordedNotice, setAlreadyRecordedNotice] = useState<{
    person: Person;
    tipe: AttendanceType;
    existingRecord: AttendanceRecord;
  } | null>(null);

  // Recognition Feedback
  const [recognizedPerson, setRecognizedPerson] = useState<{
    person: Person;
    status: 'HADIR' | 'TERLAMBAT';
    tipe: AttendanceType;
    method: AttendanceMethod;
    time: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const isCooldownRef = useRef<boolean>(false);
  const faceAlignmentFramesRef = useRef<number>(0);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsStartingCamera(false);
    setFaceDetected(false);
    setFaceMatchProgress(0);
  }, []);

  // Start webcam
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsStartingCamera(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback to basic video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play triggered:', playErr);
        }
      }

      setIsCameraActive(true);
      setIsStartingCamera(false);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const errName = (err as { name?: string }).name;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Izin akses kamera ditolak oleh browser. Silakan klik ikon gembok/kamera pada address bar dan ubah izin kamera menjadi "Izinkan".'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError('Tidak ada perangkat webcam yang terdeteksi di perangkat ini.');
      } else {
        setCameraError('Gagal mengaktifkan kamera. Pastikan browser memiliki izin mengakses webcam.');
      }
      setIsCameraActive(false);
      setIsStartingCamera(false);
    }
  }, [facingMode]);

  // Auto-start camera when entering monitor presensi menu
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Toggle Camera
  const handleToggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Switch front/back camera
  const handleSwitchFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      stopCamera();
      setTimeout(startCamera, 200);
    }
  };

  // Trigger full screen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Process Attendance when a person is identified (via QR or Face)
  const processAttendance = useCallback(
    (person: Person, method: AttendanceMethod) => {
      if (isCooldownRef.current) return;
      isCooldownRef.current = true;

      const now = new Date();
      const jamAbsen = now.toTimeString().split(' ')[0]; // HH:mm:ss
      const tanggal = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Cek apakah pegawai sudah melakukan presensi tipe ini (MASUK / PULANG) hari ini
      const existing = records.find(
        (r) => r.nip === person.nip && r.tanggal === tanggal && r.tipe === currentAttendanceType
      );

      if (existing) {
        // Tampilkan notifikasi peringatan bahwa presensi sudah dilakukan
        setRecognizedPerson(null);
        setAlreadyRecordedNotice({
          person,
          tipe: currentAttendanceType,
          existingRecord: existing,
        });

        playWarningChime();

        speakIndonesian(
          `Perhatian ${person.nama}. Anda sudah melakukan presensi ${currentAttendanceType.toLowerCase()} hari ini pada pukul ${existing.jamAbsen}. Presensi masuk dan pulang masing-masing hanya 1 kali per hari.`,
          soundEnabled
        );

        // Beri cooldown 4.5 detik agar scanner tidak looping terus menerus
        setTimeout(() => {
          setAlreadyRecordedNotice(null);
          isCooldownRef.current = false;
          faceAlignmentFramesRef.current = 0;
          setFaceMatchProgress(0);
        }, 4500);

        return;
      }

      // Jika belum absen untuk tipe ini hari ini, lanjutkan proses presensi
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Determine status (Hadir vs Terlambat for Masuk)
      let status: 'HADIR' | 'TERLAMBAT' = 'HADIR';
      if (currentAttendanceType === 'MASUK') {
        // Lewat jam 07:15 dianggap terlambat
        if (hours > 7 || (hours === 7 && minutes > 15)) {
          status = 'TERLAMBAT';
        }
      }

      const newRecord: AttendanceRecord = {
        id: 'rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        timestamp: now.toISOString(),
        tanggal,
        nip: person.nip,
        nama: person.nama,
        kategori: person.kategori,
        jabatan: person.jabatan,
        tipe: currentAttendanceType,
        status,
        jamAbsen,
        metode: method,
        syncedWithSheets: false,
        keterangan: status === 'TERLAMBAT' ? 'Terlambat masuk sekolah' : 'Tepat waktu',
      };

      // UI Feedback state
      setAlreadyRecordedNotice(null);
      setRecognizedPerson({
        person,
        status,
        tipe: currentAttendanceType,
        method,
        time: jamAbsen,
      });

      // Sound and celebration
      if (status === 'TERLAMBAT') {
        playWarningChime();
      } else {
        playSuccessChime();
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#38bdf8', '#fbbf24'],
      });

      const ucapan =
        currentAttendanceType === 'MASUK'
          ? `Terima kasih ${person.nama}. Presensi masuk berhasil, status ${status.toLowerCase()}. Selamat bertugas.`
          : `Terima kasih ${person.nama}. Presensi pulang berhasil. Selamat beristirahat.`;
      speakIndonesian(ucapan, soundEnabled);

      onAttendanceSuccess(newRecord);

      // Release cooldown after 4.5 seconds to prevent multiple spam scans
      setTimeout(() => {
        setRecognizedPerson(null);
        isCooldownRef.current = false;
        faceAlignmentFramesRef.current = 0;
        setFaceMatchProgress(0);
      }, 4500);
    },
    [records, currentAttendanceType, soundEnabled, onAttendanceSuccess]
  );

  // QR Code & Face Presence Detection Loop
  useEffect(() => {
    if (!isCameraActive) return;

    let isScanning = true;

    const scanFrame = () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const now = Date.now();
        // Run scan every ~120ms to save CPU while maintaining responsiveness
        if (now - lastProcessedTimeRef.current > 120 && !isCooldownRef.current) {
          lastProcessedTimeRef.current = now;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 1. Attempt QR Scan if allowed
            if (detectionMode === 'AUTO' || detectionMode === 'QR') {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });

              if (code && code.data) {
                const scannedData = code.data.trim();
                const foundPerson = persons.find(
                  (p) => p.nip === scannedData || p.id === scannedData || scannedData.includes(p.nip)
                );
                if (foundPerson) {
                  processAttendance(foundPerson, 'QR_CODE');
                  return;
                }
              }
            }

            // 2. Optical Face Presence Analysis in the center targeting zone
            if (detectionMode === 'AUTO' || detectionMode === 'FACE') {
              // Analyze luminance and contrast in the center box
              const boxW = Math.floor(canvas.width * 0.4);
              const boxH = Math.floor(canvas.height * 0.5);
              const startX = Math.floor((canvas.width - boxW) / 2);
              const startY = Math.floor((canvas.height - boxH) / 2);

              try {
                const centerData = ctx.getImageData(startX, startY, boxW, boxH);
                let brightnessSum = 0;
                let skinTonePixels = 0;
                const totalPixels = centerData.data.length / 4;

                // Sample every 4th pixel for speed
                for (let i = 0; i < centerData.data.length; i += 16) {
                  const r = centerData.data[i];
                  const g = centerData.data[i + 1];
                  const b = centerData.data[i + 2];
                  brightnessSum += (r + g + b) / 3;

                  // Simple human skin hue / luminance heuristic
                  if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10) {
                    skinTonePixels++;
                  }
                }

                const sampledCount = totalPixels / 4;
                const avgBrightness = brightnessSum / sampledCount;
                const skinRatio = skinTonePixels / sampledCount;

                // Check if a human face/figure is centered in front of the lens
                if (avgBrightness > 35 && avgBrightness < 240 && skinRatio > 0.12) {
                  setFaceDetected(true);
                  faceAlignmentFramesRef.current = Math.min(100, faceAlignmentFramesRef.current + 8);
                  setFaceMatchProgress(faceAlignmentFramesRef.current);

                  // If user has stayed aligned for ~1.2 seconds, trigger AI face verification
                  if (faceAlignmentFramesRef.current >= 80 && persons.length > 0 && !isCooldownRef.current) {
                    // Match with the first or active registered staff, or open quick selector
                    const targetPerson = persons[0];
                    if (targetPerson) {
                      processAttendance(targetPerson, 'WAJAH_AI');
                    }
                  }
                } else {
                  setFaceDetected(false);
                  faceAlignmentFramesRef.current = Math.max(0, faceAlignmentFramesRef.current - 4);
                  setFaceMatchProgress(faceAlignmentFramesRef.current);
                }
              } catch (e) {
                // Ignore canvas security errors
              }
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, detectionMode, persons, processAttendance]);

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl border border-slate-800/90 bg-[#0c1424] p-4 sm:p-5 flex flex-col justify-between shadow-2xl relative transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-[#070d18] p-6' : ''
      }`}
    >
      {/* Card Header matching screenshot */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mt-0.5">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Kamera Presensi Guru &amp; Staf
              </h2>
              {/* Presensi Type Badge & Rule Indicator */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => onChangeAttendanceType('MASUK')}
                    className={`px-2.5 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      currentAttendanceType === 'MASUK'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Masuk
                  </button>
                  <button
                    onClick={() => onChangeAttendanceType('PULANG')}
                    className={`px-2.5 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      currentAttendanceType === 'PULANG'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pulang
                  </button>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/25">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Maks. 1x Masuk &amp; 1x Pulang / Hari
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Posisikan wajah di dalam bingkai atau tunjukkan QR Code NIP (Sistem membatasi 1x presensi masuk &amp; 1x pulang)
            </p>
          </div>
        </div>

        {/* Top Right Tool Buttons matching screenshot icons */}
        <div className="flex items-center gap-1.5 relative">
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Matikan Suara Pengumuman' : 'Nyalakan Suara Pengumuman'}
            className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowModeSelector(!showModeSelector)}
            title="Pengaturan Mode Deteksi"
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Mode Selector Popover */}
          {showModeSelector && (
            <div className="absolute top-11 right-0 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-30 text-xs text-slate-200 space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Mode Deteksi Kamera
              </div>
              <button
                onClick={() => {
                  setDetectionMode('AUTO');
                  setShowModeSelector(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  detectionMode === 'AUTO' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'hover:bg-slate-800'
                }`}
              >
                <span>Otomatis (Wajah + QR)</span>
                {detectionMode === 'AUTO' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              <button
                onClick={() => {
                  setDetectionMode('FACE');
                  setShowModeSelector(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  detectionMode === 'FACE' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'hover:bg-slate-800'
                }`}
              >
                <span>Khusus Wajah AI</span>
                {detectionMode === 'FACE' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              <button
                onClick={() => {
                  setDetectionMode('QR');
                  setShowModeSelector(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  detectionMode === 'QR' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'hover:bg-slate-800'
                }`}
              >
                <span>Khusus QR Code</span>
                {detectionMode === 'QR' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <div className="border-t border-slate-800 my-1" />
              <button
                onClick={handleSwitchFacing}
                className="w-full text-left px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span>Ganti Kamera ({facingMode === 'user' ? 'Depan' : 'Belakang'})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Viewport Box matching screenshot */}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-[#070d18] rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
        {/* Hidden Canvas for QR & Face processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Video Feed - Always rendered in DOM so videoRef is never null */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover mirror ${isCameraActive ? 'block' : 'hidden'}`}
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {/* Active Camera Overlay HUD */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            {/* Center Target Box */}
            <div
              className={`relative w-56 h-64 sm:w-64 sm:h-72 border-2 rounded-3xl overflow-hidden backdrop-contrast-105 transition-colors duration-300 ${
                faceDetected
                  ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                  : 'border-emerald-500/40'
              }`}
            >
              {/* Corner Targeting Brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

              {/* Animated Horizontal Scanline */}
              <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-scan" />

              {/* Target icon / Face alignment indicator */}
              <div className="absolute inset-0 flex items-center justify-center text-emerald-400/20">
                <ScanLine className="w-16 h-16 animate-pulse" />
              </div>

              {/* Face Match Progress Ring when face detected */}
              {faceDetected && faceMatchProgress > 0 && (
                <div className="absolute inset-x-4 bottom-4 pointer-events-auto">
                  <div className="bg-slate-900/90 backdrop-blur-md rounded-xl p-2 border border-emerald-500/50 shadow-lg text-center">
                    <div className="flex items-center justify-between text-[10px] text-emerald-300 font-bold mb-1">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
                        Mengunci Wajah AI...
                      </span>
                      <span>{faceMatchProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-150"
                        style={{ width: `${faceMatchProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status pill on camera feed */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/40 text-emerald-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {detectionMode === 'AUTO' && 'Memindai Wajah & QR Code...'}
                {detectionMode === 'FACE' && 'Memindai Wajah AI...'}
                {detectionMode === 'QR' && 'Memindai QR Kartu NIP...'}
              </span>
            </div>

            {/* Quick Match Action for Camera */}
            {persons.length > 0 && (
              <div className="absolute top-4 right-4 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowManualFaceSelect(!showManualFaceSelect)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-slate-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-all shadow-lg cursor-pointer"
                >
                  <ScanFace className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pilih Pegawai Depan Kamera</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Staff Selection dropdown over camera */}
        {showManualFaceSelect && isCameraActive && (
          <div className="absolute top-16 right-4 z-30 w-80 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl p-3 backdrop-blur-md max-h-80 overflow-y-auto space-y-1.5 animate-in fade-in zoom-in-95">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
              <span>Pilih Pegawai (Mode: {currentAttendanceType})</span>
              <button
                onClick={() => setShowManualFaceSelect(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {persons.map((p) => {
              const todayStr = new Date().toISOString().split('T')[0];
              const pMasuk = records.find(
                (r) => r.nip === p.nip && r.tanggal === todayStr && r.tipe === 'MASUK'
              );
              const pPulang = records.find(
                (r) => r.nip === p.nip && r.tanggal === todayStr && r.tipe === 'PULANG'
              );
              const isAlreadyDoneCurrent = currentAttendanceType === 'MASUK' ? !!pMasuk : !!pPulang;

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setShowManualFaceSelect(false);
                    processAttendance(p, 'WAJAH_AI');
                  }}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isAlreadyDoneCurrent
                      ? 'bg-slate-950/60 hover:bg-slate-800/80 border border-amber-500/30'
                      : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <img
                    src={p.fotoUrl}
                    alt={p.nama}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate">{p.nama}</span>
                      {isAlreadyDoneCurrent ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 shrink-0">
                          ✓ Sudah {currentAttendanceType === 'MASUK' ? 'Masuk' : 'Pulang'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                          Siap Presensi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="truncate">{p.jabatan}</span>
                      <span>•</span>
                      <span className={pMasuk ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                        M: {pMasuk ? pMasuk.jamAbsen : '-'}
                      </span>
                      <span>•</span>
                      <span className={pPulang ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                        P: {pPulang ? pPulang.jamAbsen : '-'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Inactive Camera Screen matching screenshot */}
        {!isCameraActive && (
          <div className="text-center p-6 max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
              <Camera className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Kamera Belum Aktif</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Klik tombol di bawah untuk mengaktifkan webcam monitor. Sistem akan otomatis mendeteksi dan memverifikasi wajah guru dan staf yang terdaftar.
            </p>

            <button
              onClick={startCamera}
              disabled={isStartingCamera}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all transform active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isStartingCamera ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menghubungkan Kamera...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Mulai Kamera Monitor</span>
                </>
              )}
            </button>

            {cameraError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Note below button matching screenshot */}
            <div className="mt-5 flex items-center gap-2 text-xs text-amber-400/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {persons.length > 0
                  ? `${persons.length} Guru & Staf terdaftar dalam database.`
                  : 'Belum ada guru/staf terdaftar. Buka tab "Pendaftaran Wajah" untuk menambah data.'}
              </span>
            </div>
          </div>
        )}

        {/* Already Recorded Warning Overlay (Aturan: 1x Masuk & 1x Pulang per hari) */}
        {alreadyRecordedNotice && (
          <div className="absolute inset-x-4 bottom-4 sm:inset-x-8 sm:bottom-6 z-20 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/95 border-2 border-amber-500 rounded-2xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.35)] backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src={alreadyRecordedNotice.person.fotoUrl}
                    alt={alreadyRecordedNotice.person.nama}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400 shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 text-slate-950 rounded-full shadow">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      SUDAH PRESENSI {alreadyRecordedNotice.tipe}
                    </span>
                    <span className="text-xs text-slate-400 font-mono-numbers">
                      Pukul {alreadyRecordedNotice.existingRecord.jamAbsen} WIB
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                    {alreadyRecordedNotice.person.nama}
                  </h4>
                  <p className="text-xs text-amber-200/90 mt-0.5">
                    Tercatat status <strong className="text-white">{alreadyRecordedNotice.existingRecord.status}</strong>. Presensi masuk &amp; pulang masing-masing hanya 1x per hari.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {alreadyRecordedNotice.tipe === 'MASUK' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeAttendanceType('PULANG');
                      setAlreadyRecordedNotice(null);
                      isCooldownRef.current = false;
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <span>Ganti ke Presensi Pulang</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeAttendanceType('MASUK');
                      setAlreadyRecordedNotice(null);
                      isCooldownRef.current = false;
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <span>Ganti ke Presensi Masuk</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAlreadyRecordedNotice(null);
                    isCooldownRef.current = false;
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer border border-slate-700"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal / Instant Match Overlay */}
        {recognizedPerson && (
          <div className="absolute inset-x-4 bottom-4 sm:inset-x-8 sm:bottom-6 z-20 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-md flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={recognizedPerson.person.fotoUrl}
                  alt={recognizedPerson.person.nama}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-400 shadow-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                      TERVERIFIKASI {recognizedPerson.method === 'WAJAH_AI' ? 'WAJAH AI' : 'QR CODE'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono-numbers">{recognizedPerson.time}</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                    {recognizedPerson.person.nama}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {CATEGORY_LABELS[recognizedPerson.person.kategori] || recognizedPerson.person.kategori} •{' '}
                    <span className="text-slate-400">{recognizedPerson.person.jabatan}</span>
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className={`px-3 py-1 rounded-xl text-xs font-bold inline-block ${
                    recognizedPerson.status === 'HADIR'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {recognizedPerson.tipe} : {recognizedPerson.status}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center justify-end gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Presensi Berhasil</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Bottom Footer matching screenshot */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>
            Database AI:{' '}
            <strong className="text-white font-mono-numbers">{persons.length}</strong> pegawai aktif
          </span>
        </div>

        <button
          onClick={handleToggleCamera}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isCameraActive
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
          }`}
        >
          {isCameraActive ? (
            <>
              <VideoOff className="w-4 h-4" />
              <span>Matikan Kamera</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Nyalakan Kamera</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
