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
  const [selectedStaffIndex, setSelectedStaffIndex] = useState<number>(0);

  // Floating HUD above person's head: displays Nama & Jabatan
  const [headOverlay, setHeadOverlay] = useState<{
    person: Person;
    statusText: string;
    isSuccess: boolean;
    time: string;
  } | null>(null);

  // Posisi kotak hijau dinamis yang bergerak mengikuti pergerakan wajah (persentase viewport % dan ukuran px yang pas dengan wajah & tidak terlalu besar)
  const [targetBoxPos, setTargetBoxPos] = useState<{
    x: number; // Posisi horizontal tengah dalam persen (0 - 100%)
    y: number; // Posisi vertikal tengah dalam persen (0 - 100%)
    width: number;
    height: number;
  }>({
    x: 50,
    y: 50,
    width: 125,
    height: 155,
  });

  const currentBoxPosRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 50,
    y: 50,
    width: 125,
    height: 155,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const faceAlignmentFramesRef = useRef<number>(0);

  // Anti-repetition & Cooldown Management:
  // Cegah scan berulang-ulang, audio berulang-ulang, dan glitch wajah
  const scannedCooldownMapRef = useRef<Map<string, number>>(new Map());
  const lastSpokenMapRef = useRef<Map<string, number>>(new Map());
  const isProcessingRef = useRef<boolean>(false);
  const noFaceCountRef = useRef<number>(0);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Durasi cooldown pencegah scan berulang (45 detik untuk orang yang sama)
  const SCAN_COOLDOWN_MS = 45000;

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
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
    setHeadOverlay(null);
    isProcessingRef.current = false;
    setTargetBoxPos({ x: 50, y: 50, width: 125, height: 155 });
    currentBoxPosRef.current = { x: 50, y: 50, width: 125, height: 155 };
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
      const now = new Date();
      const nowMs = now.getTime();
      const lastScan = scannedCooldownMapRef.current.get(person.nip) || 0;

      // CEGAH SCAN BERULANG-ULANG:
      // Jika dalam durasi cooldown (45 detik) untuk orang yang sama, jangan lakukan scan ulang atau audio ulang
      if (nowMs - lastScan < SCAN_COOLDOWN_MS) {
        return;
      }

      // Catat waktu scan untuk orang ini agar tidak terulang
      scannedCooldownMapRef.current.set(person.nip, nowMs);

      const jamAbsen = now.toTimeString().split(' ')[0]; // HH:mm:ss
      const tanggal = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Cek apakah pegawai sudah melakukan presensi tipe ini (MASUK / PULANG) hari ini
      const existing = records.find(
        (r) => r.nip === person.nip && r.tanggal === tanggal && r.tipe === currentAttendanceType
      );

      if (existing) {
        // Tampilkan nama dan jabatan diatas kepala yang absen dengan status sudah presensi
        setHeadOverlay({
          person,
          statusText: `Sudah Presensi (${existing.jamAbsen})`,
          isSuccess: false,
          time: existing.jamAbsen,
        });

        // Suara pengingat hanya diputar maksimal 1x per 60 detik untuk orang yang sama (tidak berulang-ulang)
        const lastSpoken = lastSpokenMapRef.current.get(person.nip) || 0;
        if (nowMs - lastSpoken > 60000) {
          lastSpokenMapRef.current.set(person.nip, nowMs);
          playWarningChime();
          speakIndonesian(
            `${person.nama}. Anda sudah presensi ${currentAttendanceType.toLowerCase()} pukul ${existing.jamAbsen}.`,
            soundEnabled
          );
        }
        return;
      }

      // Hitung status Hadir vs Terlambat
      const hours = now.getHours();
      const minutes = now.getMinutes();
      let status: 'HADIR' | 'TERLAMBAT' = 'HADIR';
      if (currentAttendanceType === 'MASUK') {
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

      // Tampilkan nama dan jabatan diatas kepala yang absen
      setHeadOverlay({
        person,
        statusText: status === 'TERLAMBAT' ? `Terlambat (${jamAbsen})` : `Hadir (${jamAbsen})`,
        isSuccess: status === 'HADIR',
        time: jamAbsen,
      });

      // Suara & konfeti hanya dijalankan 1x saat absen berhasil
      lastSpokenMapRef.current.set(person.nip, nowMs);

      if (status === 'TERLAMBAT') {
        playWarningChime();
      } else {
        playSuccessChime();
      }

      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#38bdf8', '#fbbf24'],
      });

      const ucapan =
        currentAttendanceType === 'MASUK'
          ? `Terima kasih ${person.nama}. Presensi masuk berhasil.`
          : `Terima kasih ${person.nama}. Presensi pulang berhasil.`;
      speakIndonesian(ucapan, soundEnabled);

      onAttendanceSuccess(newRecord);
    },
    [records, currentAttendanceType, soundEnabled, onAttendanceSuccess]
  );

  // Manual reset cooldown jika ingin langsung scan orang berikutnya
  const handleResetScanCooldown = useCallback(() => {
    scannedCooldownMapRef.current.clear();
    lastSpokenMapRef.current.clear();
    setHeadOverlay(null);
    faceAlignmentFramesRef.current = 0;
    setFaceMatchProgress(0);
  }, []);

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
        if (now - lastProcessedTimeRef.current > 120) {
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
                // Ikuti posisi QR Code jika terdeteksi
                if (code.location) {
                  const pts = [
                    code.location.topLeftCorner,
                    code.location.topRightCorner,
                    code.location.bottomRightCorner,
                    code.location.bottomLeftCorner,
                  ];
                  const avgX = pts.reduce((acc, p) => acc + p.x, 0) / 4;
                  const avgY = pts.reduce((acc, p) => acc + p.y, 0) / 4;

                  const vW = canvas.width;
                  const vH = canvas.height;
                  const cW = video.clientWidth || vW;
                  const cH = video.clientHeight || vH;
                  const scale = Math.max(cW / vW, cH / vH);
                  const renderedW = vW * scale;
                  const renderedH = vH * scale;
                  const offsetX = (renderedW - cW) / 2;
                  const offsetY = (renderedH - cH) / 2;

                  const dispX = facingMode === 'user' ? (vW - avgX) : avgX;
                  const screenX = dispX * scale - offsetX;
                  const screenY = avgY * scale - offsetY;

                  const pX = Math.max(20, Math.min(80, (screenX / cW) * 100));
                  const pY = Math.max(24, Math.min(76, (screenY / cH) * 100));

                  currentBoxPosRef.current.x += (pX - currentBoxPosRef.current.x) * 0.45;
                  currentBoxPosRef.current.y += (pY - currentBoxPosRef.current.y) * 0.45;
                  currentBoxPosRef.current.width += (125 - currentBoxPosRef.current.width) * 0.25;
                  currentBoxPosRef.current.height += (155 - currentBoxPosRef.current.height) * 0.25;
                  setTargetBoxPos({
                    x: Math.round(currentBoxPosRef.current.x * 10) / 10,
                    y: Math.round(currentBoxPosRef.current.y * 10) / 10,
                    width: Math.round(currentBoxPosRef.current.width),
                    height: Math.round(currentBoxPosRef.current.height),
                  });
                }

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

            // 2. Optical Face Tracking: Kotak hijau ikut bergerak mengikuti pergerakan wajah (pas & tidak terlalu besar)
            if (detectionMode === 'AUTO' || detectionMode === 'FACE') {
              try {
                const w = canvas.width;
                const h = canvas.height;
                const frameImg = ctx.getImageData(0, 0, w, h);
                const data = frameImg.data;

                // Density grid 16 x 12 untuk melacak klaster inti kepala (menghindari gangguan latar belakang & baju)
                const gridCols = 16;
                const gridRows = 12;
                const cellW = w / gridCols;
                const cellH = h / gridRows;
                const grid = new Int32Array(gridCols * gridRows);

                const step = 6;
                for (let y = 0; y < h; y += step) {
                  const row = Math.floor(y / cellH);
                  for (let x = 0; x < w; x += step) {
                    const idx = (y * w + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    // Klasifikasi warna kulit manusia alami (human skin-tone classifier)
                    if (
                      r > 60 &&
                      g > 40 &&
                      b > 20 &&
                      r > g &&
                      r > b &&
                      r - g > 12 &&
                      r - b > 14 &&
                      r < 248
                    ) {
                      const col = Math.floor(x / cellW);
                      if (row < gridRows && col < gridCols) {
                        grid[row * gridCols + col]++;
                      }
                    }
                  }
                }

                // Cari sel dengan konsentrasi kulit tertinggi (area inti wajah/kepala)
                let maxDensity = 0;
                let peakCol = -1;
                let peakRow = -1;
                for (let r = 0; r < gridRows; r++) {
                  // Berikan bobot optimal pada zona atas/tengah tempat wajah berada
                  const rowWeight = r >= 1 && r <= 8 ? 1.3 : 0.6;
                  for (let c = 1; c < gridCols - 1; c++) {
                    const density = grid[r * gridCols + c] * rowWeight;
                    if (density > maxDensity) {
                      maxDensity = density;
                      peakCol = c;
                      peakRow = r;
                    }
                  }
                }

                // Jika terdeteksi klaster wajah yang jelas
                if (maxDensity > 10 && peakCol >= 0 && peakRow >= 0) {
                  const focalX = (peakCol + 0.5) * cellW;
                  const focalY = (peakRow + 0.5) * cellH;

                  // Lingkupi hanya area wajah di sekitar klaster inti (radius ~22% lebar dan ~25% tinggi)
                  const maxRadiusX = w * 0.20;
                  const maxRadiusY = h * 0.24;

                  let sumX = 0;
                  let sumY = 0;
                  let skinCount = 0;
                  let minX = w;
                  let maxX = 0;
                  let minY = h;
                  let maxY = 0;

                  const startY = Math.max(0, Math.floor(focalY - maxRadiusY));
                  const endY = Math.min(h, Math.ceil(focalY + maxRadiusY));
                  const startX = Math.max(0, Math.floor(focalX - maxRadiusX));
                  const endX = Math.min(w, Math.ceil(focalX + maxRadiusX));

                  for (let y = startY; y < endY; y += step) {
                    for (let x = startX; x < endX; x += step) {
                      const idx = (y * w + x) * 4;
                      const r = data[idx];
                      const g = data[idx + 1];
                      const b = data[idx + 2];

                      if (
                        r > 60 &&
                        g > 40 &&
                        b > 20 &&
                        r > g &&
                        r > b &&
                        r - g > 12 &&
                        r - b > 14 &&
                        r < 248
                      ) {
                        sumX += x;
                        sumY += y;
                        skinCount++;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                      }
                    }
                  }

                  if (skinCount > 18) {
                    const rawCenterX = sumX / skinCount;
                    // Pusatkan sedikit ke atas agar pas tepat di tengah wajah (mata & hidung)
                    const rawCenterY = (sumY / skinCount) - (maxY - minY) * 0.04;

                    // Proyeksi presisi ke ukuran container dengan memperhitungkan CSS object-cover
                    const cW = video.clientWidth || w;
                    const cH = video.clientHeight || h;
                    const scale = Math.max(cW / w, cH / h);
                    const renderedW = w * scale;
                    const renderedH = h * scale;
                    const offsetX = (renderedW - cW) / 2;
                    const offsetY = (renderedH - cH) / 2;

                    // Sesuaikan arah cermin (mirror) kamera depan
                    const visualVideoX = facingMode === 'user' ? (w - rawCenterX) : rawCenterX;
                    const screenX = visualVideoX * scale - offsetX;
                    const screenY = rawCenterY * scale - offsetY;

                    const targetPctX = (screenX / cW) * 100;
                    const targetPctY = (screenY / cH) * 100;

                    // Batasi pergerakan agar kotak dan nama di atas kepala selalu dalam viewport
                    const clampedPctX = Math.max(20, Math.min(80, targetPctX));
                    const clampedPctY = Math.max(26, Math.min(74, targetPctY));

                    // Ukuran kotak hijau yang pas dengan wajah dan tidak terlalu besar
                    // Proporsi kepala/wajah standar (1 : 1.25), lebar ramping dan pas antara 115px - 150px
                    const detectedFaceW = (maxX - minX) * scale;
                    const targetW = Math.max(115, Math.min(150, Math.round(detectedFaceW * 1.05 || 125)));
                    const targetH = Math.max(145, Math.min(188, Math.round(targetW * 1.25)));

                    // Interpolasi LERP yang responsif & lincah mengikuti gerakan kepala secara real-time
                    currentBoxPosRef.current.x += (clampedPctX - currentBoxPosRef.current.x) * 0.45;
                    currentBoxPosRef.current.y += (clampedPctY - currentBoxPosRef.current.y) * 0.45;
                    currentBoxPosRef.current.width += (targetW - currentBoxPosRef.current.width) * 0.3;
                    currentBoxPosRef.current.height += (targetH - currentBoxPosRef.current.height) * 0.3;

                    setTargetBoxPos({
                      x: Math.round(currentBoxPosRef.current.x * 10) / 10,
                      y: Math.round(currentBoxPosRef.current.y * 10) / 10,
                      width: Math.round(currentBoxPosRef.current.width),
                      height: Math.round(currentBoxPosRef.current.height),
                    });

                    noFaceCountRef.current = 0;
                    setFaceDetected(true);
                    faceAlignmentFramesRef.current = Math.min(100, faceAlignmentFramesRef.current + 8);
                    setFaceMatchProgress(faceAlignmentFramesRef.current);

                    // Jika wajah terfokus di bingkai (progress >= 80%)
                    if (faceAlignmentFramesRef.current >= 80 && persons.length > 0) {
                      const targetPerson = persons[selectedStaffIndex] || persons[0];
                      if (targetPerson) {
                        const lastScanTime = scannedCooldownMapRef.current.get(targetPerson.nip) || 0;
                        if (Date.now() - lastScanTime >= SCAN_COOLDOWN_MS) {
                          processAttendance(targetPerson, 'WAJAH_AI');
                        } else {
                          const existingToday = records.find(
                            (r) =>
                              r.nip === targetPerson.nip &&
                              r.tanggal === new Date().toISOString().split('T')[0] &&
                              r.tipe === currentAttendanceType
                          );
                          if (existingToday && !headOverlay) {
                            setHeadOverlay({
                              person: targetPerson,
                              statusText: `Sudah Presensi (${existingToday.jamAbsen})`,
                              isSuccess: false,
                              time: existingToday.jamAbsen,
                            });
                          }
                        }
                      }
                    }
                  } else {
                    // Ketika klaster belum cukup kuat, kotak tetap stabil
                    setFaceDetected(false);
                    faceAlignmentFramesRef.current = Math.max(0, faceAlignmentFramesRef.current - 3);
                    setFaceMatchProgress(faceAlignmentFramesRef.current);
                  }
                } else {
                  // Ketika tidak ada wajah terdeteksi, kotak hijau perlahan kembali ke posisi tengah yang kompak & rapi
                  currentBoxPosRef.current.x += (50 - currentBoxPosRef.current.x) * 0.15;
                  currentBoxPosRef.current.y += (50 - currentBoxPosRef.current.y) * 0.15;
                  currentBoxPosRef.current.width += (125 - currentBoxPosRef.current.width) * 0.2;
                  currentBoxPosRef.current.height += (155 - currentBoxPosRef.current.height) * 0.2;

                  setTargetBoxPos({
                    x: Math.round(currentBoxPosRef.current.x * 10) / 10,
                    y: Math.round(currentBoxPosRef.current.y * 10) / 10,
                    width: Math.round(currentBoxPosRef.current.width),
                    height: Math.round(currentBoxPosRef.current.height),
                  });

                  setFaceDetected(false);
                  faceAlignmentFramesRef.current = Math.max(0, faceAlignmentFramesRef.current - 4);
                  setFaceMatchProgress(faceAlignmentFramesRef.current);

                  noFaceCountRef.current++;
                  // Saat orang sudah beranjak / tidak ada wajah selama ~5 detik, bersihkan tampilan nama di atas kepala
                  if (noFaceCountRef.current > 40) {
                    setHeadOverlay(null);
                  }
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
  }, [isCameraActive, detectionMode, persons, processAttendance, headOverlay, records, currentAttendanceType, selectedStaffIndex]);

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
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Dynamic Moving Target Box Wrapper - Kotak hijau ikut bergerak mengikuti posisi wajah */}
            <div
              className="absolute pointer-events-none transition-all duration-75 ease-out"
              style={{
                left: `${targetBoxPos.x}%`,
                top: `${targetBoxPos.y}%`,
                width: `${targetBoxPos.width}px`,
                height: `${targetBoxPos.height}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Floating Name & Jabatan Tag Above Head (Tampil di atas kepala yang absen) */}
              {headOverlay && (
                <div className="absolute -top-16 sm:-top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto animate-in fade-in zoom-in-95 duration-200 w-auto max-w-[95%]">
                  <div
                    className={`px-4 sm:px-5 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 whitespace-nowrap ${
                      headOverlay.isSuccess
                        ? 'bg-slate-950/95 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.55)] ring-1 ring-emerald-400/40'
                        : 'bg-slate-950/95 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.55)] ring-1 ring-amber-400/40'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={headOverlay.person.fotoUrl}
                        alt={headOverlay.person.nama}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-xl object-cover border-2 border-emerald-400/80 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://ui-avatars.com/api/?name=Pegawai&background=0f172a&color=10b981&size=100';
                        }}
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-slate-950 font-black shadow ${
                          headOverlay.isSuccess ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      >
                        ✓
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-extrabold text-white tracking-tight drop-shadow-sm">
                          {headOverlay.person.nama}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            headOverlay.isSuccess
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          }`}
                        >
                          {headOverlay.statusText}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-emerald-300 font-semibold flex items-center gap-1.5 mt-0.5">
                        <span>{headOverlay.person.jabatan}</span>
                        <span className="text-slate-500 text-[10px]">•</span>
                        <span className="text-slate-400 text-xs font-mono">NIP: {headOverlay.person.nip}</span>
                      </div>
                    </div>
                  </div>
                  {/* Arrow Indicator pointing down to person's head */}
                  <div
                    className={`w-3.5 h-3.5 rotate-45 -mt-2 border-r-2 border-b-2 shadow-lg ${
                      headOverlay.isSuccess
                        ? 'bg-slate-950 border-emerald-400'
                        : 'bg-slate-950 border-amber-400'
                    }`}
                  />
                </div>
              )}

              {/* Dynamic Target Box (Kotak Hijau Pelacak Wajah Dinamis & Ramping) */}
              <div
                className={`relative w-full h-full border-2 rounded-2xl overflow-hidden backdrop-contrast-105 transition-colors duration-200 ${
                  headOverlay
                    ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.55)]'
                    : faceDetected
                    ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/50'
                    : 'border-emerald-500/40'
                }`}
              >
                {/* Corner Targeting Brackets - Ukuran proporsional kompak */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

                {/* Animated Horizontal Scanline */}
                <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#10b981] animate-scan" />

                {/* Target icon / Face alignment indicator */}
                <div className="absolute inset-0 flex items-center justify-center text-emerald-400/20">
                  <ScanLine className="w-10 h-10 animate-pulse" />
                </div>

                {/* Face Match Progress Bar - Tampil kompak di bagian bawah kotak */}
                {faceDetected && !headOverlay && faceMatchProgress > 0 && (
                  <div className="absolute inset-x-2.5 bottom-2 pointer-events-auto">
                    <div className="bg-slate-900/90 backdrop-blur-md rounded-lg p-1.5 border border-emerald-500/50 shadow-lg text-center">
                      <div className="flex items-center justify-between text-[9px] text-emerald-300 font-bold mb-0.5">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
                          Mengunci Wajah...
                        </span>
                        <span>{faceMatchProgress}%</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-150"
                          style={{ width: `${faceMatchProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Cepat Scan Pegawai Berikutnya saat overlay aktif */}
            {headOverlay && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto z-30 animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={handleResetScanCooldown}
                  className="px-4 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/60 text-slate-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-all shadow-xl cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scan Pegawai Berikutnya</span>
                </button>
              </div>
            )}

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
                    const idx = persons.findIndex((item) => item.id === p.id);
                    if (idx !== -1) setSelectedStaffIndex(idx);
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
                        'https://ui-avatars.com/api/?name=Pegawai&background=0f172a&color=10b981&size=100';
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

        {/* Head Overlay displays floating above person's head */}
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
