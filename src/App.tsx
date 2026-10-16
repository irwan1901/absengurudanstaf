import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CameraMonitor } from './components/CameraMonitor';
import { AttendanceLog, AttendanceLogFilter } from './components/AttendanceLog';
import { RegistrationTab } from './components/RegistrationTab';
import { StaffDataTab } from './components/StaffDataTab';
import { SheetsConfigTab } from './components/SheetsConfigTab';
import { ScriptTemplateTab } from './components/ScriptTemplateTab';
import { LoginModal } from './components/LoginModal';
import { UserManagementModal } from './components/UserManagementModal';
import { getCurrentUser, logout } from './services/authService';
import { Lock, ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceSchedule,
  AttendanceStatus,
  AttendanceType,
  AuthUser,
  Person,
  PersonCategory,
  SheetsConfig,
} from './types';
import {
  getAttendanceRecords,
  getAttendanceSchedule,
  getPersons,
  getSheetsConfig,
  getSoundEnabled,
  saveAttendanceRecords,
  saveAttendanceSchedule,
  savePersons,
  saveSheetsConfig,
  saveSoundEnabled,
} from './services/storage';
import {
  sendAttendanceToSheets,
  sendPersonToSheets,
  fetchSheetsConfigFromServer,
  fetchScheduleFromServer,
} from './services/sheetsService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'register' | 'staff' | 'config' | 'script'>('monitor');
  const [selectedCategory, setSelectedCategory] = useState<'SEMUA' | PersonCategory>('SEMUA');
  const [currentAttendanceType, setCurrentAttendanceType] = useState<AttendanceType>('MASUK');

  // Authentication & Role State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(!getCurrentUser());
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);

  // Core Data States
  const [persons, setPersons] = useState<Person[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(getSheetsConfig());
  const [schedule, setSchedule] = useState<AttendanceSchedule>(getAttendanceSchedule());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(getSoundEnabled());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<AttendanceLogFilter>('ALL');

  // Load initial persons, attendance records, and sync central server config across devices
  useEffect(() => {
    async function loadData() {
      // 1. Check URL parameters for instant 1-click device link: ?webhook=...&sheetId=...
      const urlParams = new URLSearchParams(window.location.search);
      const urlWebhook = urlParams.get('webhook');
      const urlSheetId = urlParams.get('sheetId');
      const urlSheetName = urlParams.get('sheetName');

      if (urlWebhook) {
        const linkedConfig: SheetsConfig = {
          ...getSheetsConfig(),
          webhookUrl: decodeURIComponent(urlWebhook),
          spreadsheetId: urlSheetId ? decodeURIComponent(urlSheetId) : '',
          sheetName: urlSheetName ? decodeURIComponent(urlSheetName) : 'Log_Presensi',
          isConnected: true,
        };
        saveSheetsConfig(linkedConfig);
        setSheetsConfig(linkedConfig);
        showToast('Konfigurasi Google Sheets berhasil diterapkan dari tautan perangkat!');
        // Clean query parameters from URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // 2. Fetch server-side sheets config (shared across all devices)
        try {
          const serverConfig = await fetchSheetsConfigFromServer();
          if (serverConfig && (serverConfig.webhookUrl || serverConfig.spreadsheetId)) {
            setSheetsConfig((prev) => {
              const merged = { ...prev, ...serverConfig, isConnected: !!serverConfig.webhookUrl };
              saveSheetsConfig(merged);
              return merged;
            });
          }
        } catch (err) {
          console.warn('Gagal memuat konfigurasi server:', err);
        }
      }

      // 3. Fetch server-side schedule (shared across all devices)
      try {
        const serverSchedule = await fetchScheduleFromServer();
        if (serverSchedule) {
          setSchedule((prev) => {
            const merged = { ...prev, ...serverSchedule };
            saveAttendanceSchedule(merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Gagal memuat jadwal server:', err);
      }

      // 4. Persons & attendance records
      const p = await getPersons();
      setPersons(p);
      const r = getAttendanceRecords();
      setRecords(r);
    }
    loadData();
  }, []);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sound preference toggle
  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    saveSoundEnabled(nextVal);
  };

  // Auth handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    if (user.role !== 'admin') {
      setActiveTab('monitor');
    }
    showToast(`Berhasil login sebagai ${user.nama} (${user.role.toUpperCase()})`);
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setIsLoginModalOpen(true);
    setActiveTab('monitor');
    showToast('Anda telah keluar dari akun.');
  };

  // Handle Attendance Success from Camera (Wajah AI or QR Code)
  // Aturan: Hanya 1x Masuk dan 1x Pulang per hari per pegawai
  const handleAttendanceSuccess = useCallback(async (newRecord: AttendanceRecord) => {
    // Check if attendance for this type has already been recorded today
    const existing = records.find(
      (r) =>
        r.nip === newRecord.nip &&
        r.tanggal === newRecord.tanggal &&
        r.tipe === newRecord.tipe
    );

    if (existing) {
      showToast(
        `Presensi ${newRecord.tipe} untuk ${newRecord.nama} sudah tercatat hari ini (${existing.jamAbsen} WIB). Presensi hanya boleh 1x untuk Masuk & 1x untuk Pulang!`,
        true
      );
      return;
    }

    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    saveAttendanceRecords(updatedRecords);
    showToast(`Presensi ${newRecord.tipe} ${newRecord.nama} berhasil dicatat!`);

    // Auto-sync to Google Sheets if configured
    if (sheetsConfig.webhookUrl && sheetsConfig.autoSync) {
      try {
        const syncRes = await sendAttendanceToSheets(newRecord, sheetsConfig);
        if (syncRes.success) {
          const marked = updatedRecords.map((r) =>
            r.id === newRecord.id ? { ...r, syncedWithSheets: true } : r
          );
          setRecords(marked);
          saveAttendanceRecords(marked);
          showToast(`Presensi ${newRecord.nama} tersinkron ke Google Sheets!`);
        }
      } catch (err) {
        console.warn('Auto-sync error:', err);
      }
    }
  }, [records, sheetsConfig]);

  // Handle Manual Status Disposition (Izin / Sakit / Hadir)
  const handleManualMarkStatus = useCallback(
    async (person: Person, status: AttendanceStatus, notes: string, targetType?: AttendanceType) => {
      if (currentUser && currentUser.role !== 'admin') {
        showToast('Hanya Administrator yang berwenang menandai status manual.', true);
        return;
      }

      const now = new Date();
      const jamAbsen = now.toTimeString().split(' ')[0];
      const tanggal = now.toISOString().split('T')[0];
      const effectiveType = targetType || currentAttendanceType;

      const newRecord: AttendanceRecord = {
        id: 'rec-manual-' + Date.now(),
        timestamp: now.toISOString(),
        tanggal,
        nip: person.nip,
        nama: person.nama,
        kategori: person.kategori,
        jabatan: person.jabatan,
        tipe: effectiveType,
        status,
        jamAbsen,
        metode: 'MANUAL',
        syncedWithSheets: false,
        keterangan: notes || `Disposisi ${status.toLowerCase()}`,
      };

      const updated = [newRecord, ...records.filter((r) => !(r.nip === person.nip && r.tanggal === tanggal && r.tipe === effectiveType))];
      setRecords(updated);
      saveAttendanceRecords(updated);
      showToast(`Status ${person.nama} (${effectiveType}) ditandai sebagai ${status}`);

      if (sheetsConfig.webhookUrl && sheetsConfig.autoSync) {
        sendAttendanceToSheets(newRecord, sheetsConfig).then((res) => {
          if (res.success) {
            const marked = updated.map((r) =>
              r.id === newRecord.id ? { ...r, syncedWithSheets: true } : r
            );
            setRecords(marked);
            saveAttendanceRecords(marked);
          }
        });
      }
    },
    [currentAttendanceType, currentUser, records, sheetsConfig]
  );

  // Sync all pending records
  const handleSyncPendingRecords = async () => {
    if (currentUser && currentUser.role !== 'admin') {
      showToast('Hanya Administrator yang memiliki akses sinkronisasi.', true);
      return;
    }

    if (!sheetsConfig.webhookUrl) {
      showToast('Konfigurasikan Webhook URL Google Sheets terlebih dahulu!', true);
      return;
    }

    const pending = records.filter((r) => !r.syncedWithSheets);
    if (pending.length === 0) {
      showToast('Semua log presensi sudah tersinkron dengan Google Sheets.');
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    const updated = [...records];

    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].syncedWithSheets) {
        const res = await sendAttendanceToSheets(updated[i], sheetsConfig);
        if (res.success) {
          updated[i] = { ...updated[i], syncedWithSheets: true };
          successCount++;
        }
      }
    }

    setRecords(updated);
    saveAttendanceRecords(updated);
    setIsSyncing(false);
    showToast(`Berhasil menyinkronkan ${successCount} log ke Google Sheets!`);
  };

  // Register new Person
  const handleRegisterPerson = async (newPerson: Person) => {
    if (currentUser && currentUser.role !== 'admin') {
      showToast('Hanya Administrator yang berwenang mendaftarkan pegawai baru.', true);
      return;
    }
    const updated = [newPerson, ...persons];
    setPersons(updated);
    savePersons(updated);

    // Langsung kirim dan simpan ke Google Sheets jika Webhook telah terhubung
    if (sheetsConfig.webhookUrl) {
      try {
        const syncRes = await sendPersonToSheets(newPerson, sheetsConfig);
        if (syncRes.success) {
          showToast(`Biodata ${newPerson.nama} berhasil didaftarkan & langsung tersimpan di Google Sheets (Data_Guru_TU)!`);
          return;
        }
      } catch (err) {
        console.warn('Gagal sinkronisasi data pegawai baru ke Sheets:', err);
      }
    }
    showToast(`${newPerson.nama} berhasil didaftarkan!`);
  };

  // Update Person
  const handleUpdatePerson = (updatedPerson: Person) => {
    if (currentUser && currentUser.role !== 'admin') {
      showToast('Hanya Administrator yang berwenang mengubah data pegawai.', true);
      return;
    }
    const updated = persons.map((p) => (p.id === updatedPerson.id ? updatedPerson : p));
    setPersons(updated);
    savePersons(updated);

    // Also sync metadata in existing attendance records if applicable
    const updatedRecords = records.map((r) => {
      if (r.nip === updatedPerson.nip || r.id === updatedPerson.id) {
        return {
          ...r,
          nip: updatedPerson.nip,
          nama: updatedPerson.nama,
          kategori: updatedPerson.kategori,
          jabatan: updatedPerson.jabatan,
        };
      }
      return r;
    });
    setRecords(updatedRecords);
    saveAttendanceRecords(updatedRecords);

    showToast(`Data ${updatedPerson.nama} berhasil diperbarui!`);

    // Perbarui juga data di Google Sheets jika Webhook aktif
    if (sheetsConfig.webhookUrl) {
      sendPersonToSheets(updatedPerson, sheetsConfig).then((res) => {
        if (res.success) {
          showToast(`Data ${updatedPerson.nama} di Google Sheets berhasil diperbarui!`);
        }
      }).catch((err) => {
        console.warn('Gagal sinkronisasi update pegawai ke Sheets:', err);
      });
    }
  };

  // Delete Person
  const handleDeletePerson = (id: string) => {
    if (currentUser && currentUser.role !== 'admin') {
      showToast('Hanya Administrator yang berwenang menghapus data pegawai.', true);
      return;
    }
    const person = persons.find((p) => p.id === id);
    const updated = persons.filter((p) => p.id !== id);
    setPersons(updated);
    savePersons(updated);
    showToast(`Data pegawai ${person ? person.nama : ''} berhasil dihapus.`);
  };

  // Save Sheets Config
  const handleSaveSheetsConfig = (newConfig: SheetsConfig) => {
    if (currentUser && currentUser.role !== 'admin') {
      showToast('Hanya Administrator yang dapat mengubah konfigurasi Google Sheets.', true);
      return;
    }
    setSheetsConfig(newConfig);
    saveSheetsConfig(newConfig);
    showToast('Konfigurasi Google Sheets berhasil disimpan!');
  };

  // Save Schedule Config
  const handleSaveSchedule = (newSchedule: AttendanceSchedule) => {
    if (currentUser && currentUser.role !== 'admin') {
      showToast('Hanya Administrator yang dapat mengubah jadwal jam kerja.', true);
      return;
    }
    setSchedule(newSchedule);
    saveAttendanceSchedule(newSchedule);
    showToast('Jadwal jam kerja presensi berhasil disimpan!');
  };

  const isAdmin = currentUser?.role === 'admin';

  // Pengguna biasa (role 'user') hanya dapat menampilkan menu Monitor Presensi saja
  useEffect(() => {
    if (!isAdmin && activeTab !== 'monitor') {
      setActiveTab('monitor');
    }
  }, [isAdmin, activeTab]);

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl backdrop-blur-md ${
              toastMessage.isError
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Global Navigation Header with User Auth Info */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        sheetsConfig={sheetsConfig}
        activeFaceCount={persons.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'monitor' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Camera Monitor */}
              <div className="lg:col-span-7">
                <CameraMonitor
                  records={records}
                  persons={persons}
                  onAttendanceSuccess={handleAttendanceSuccess}
                  sheetsConfig={sheetsConfig}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                  onNavigateToRegister={() => {
                    if (isAdmin) {
                      setActiveTab('register');
                    } else {
                      showToast('Pendaftaran pegawai baru memerlukan hak akses Administrator.', true);
                    }
                  }}
                  currentAttendanceType={currentAttendanceType}
                  onChangeAttendanceType={setCurrentAttendanceType}
                />
              </div>

              {/* Right Column: Attendance Log */}
              <div className="lg:col-span-5">
                <AttendanceLog
                  records={records}
                  persons={persons}
                  selectedCategory={selectedCategory}
                  sheetsConfig={sheetsConfig}
                  onRefresh={() => setRecords(getAttendanceRecords())}
                  onManualMarkStatus={handleManualMarkStatus}
                  onSyncPendingRecords={handleSyncPendingRecords}
                  isSyncing={isSyncing}
                  activeStatusFilter={dashboardStatusFilter}
                  onStatusFilterChange={setDashboardStatusFilter}
                  currentUser={currentUser}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          isAdmin ? (
            <RegistrationTab
              onRegisterSuccess={handleRegisterPerson}
              onNavigateToMonitor={() => setActiveTab('monitor')}
              sheetsConfig={sheetsConfig}
            />
          ) : (
            <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-[#0c1424] border border-amber-500/30 text-center shadow-2xl">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Akses Terbatas: Khusus Administrator
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Pendaftaran pegawai dan perekaman model wajah AI hanya dapat dilakukan oleh pengguna dengan hak akses <strong>Administrator</strong>. Anda saat ini masuk sebagai <span className="text-sky-300 font-semibold">{currentUser?.nama} (Role: {currentUser?.role})</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk sebagai Admin</span>
                </button>
                <button
                  onClick={() => setActiveTab('monitor')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Monitor</span>
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'staff' && (
          isAdmin ? (
            <StaffDataTab
              persons={persons}
              onDeletePerson={handleDeletePerson}
              onUpdatePerson={handleUpdatePerson}
              sheetsConfig={sheetsConfig}
              currentUser={currentUser}
            />
          ) : (
            <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-[#0c1424] border border-amber-500/30 text-center shadow-2xl">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Akses Terbatas: Khusus Administrator
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Menu Data Guru &amp; Staf TU hanya dapat diakses oleh Administrator sistem. Akun pengguna biasa hanya memiliki hak akses ke <strong>Monitor Presensi</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk sebagai Admin</span>
                </button>
                <button
                  onClick={() => setActiveTab('monitor')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Monitor Presensi</span>
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'config' && (
          isAdmin ? (
            <SheetsConfigTab
              config={sheetsConfig}
              onSaveConfig={handleSaveSheetsConfig}
              schedule={schedule}
              onSaveSchedule={handleSaveSchedule}
              onNavigateToScript={() => setActiveTab('script')}
            />
          ) : (
            <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-[#0c1424] border border-amber-500/30 text-center shadow-2xl">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Akses Terbatas: Khusus Administrator
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Konfigurasi Google Sheets (Webhook URL, Spreadsheet ID, Sheet Name) dan pengaturan toleransi jam kerja hanya dapat dikelola oleh Administrator sistem.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk sebagai Admin</span>
                </button>
                <button
                  onClick={() => setActiveTab('monitor')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Monitor</span>
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'script' && (
          isAdmin ? (
            <ScriptTemplateTab />
          ) : (
            <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-[#0c1424] border border-amber-500/30 text-center shadow-2xl">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Akses Terbatas: Khusus Administrator
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Kode skrip integrasi Google Apps Script dan template struktur spreadsheet diperuntukkan bagi Administrator IT sekolah.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk sebagai Admin</span>
                </button>
                <button
                  onClick={() => setActiveTab('monitor')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Monitor</span>
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* Login Modal for Admin and User */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={currentUser ? () => setIsLoginModalOpen(false) : undefined}
        onLoginSuccess={handleLoginSuccess}
        persons={persons}
        isSwitchingAccount={!!currentUser}
      />

      {/* User Management Modal for Admin */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
