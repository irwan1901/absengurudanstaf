import React, { useEffect, useState } from 'react';
import {
  ScanFace,
  Sparkles,
  Cloud,
  Clock,
  Camera,
  UserPlus,
  Users,
  Settings,
  FileCode2,
  ChevronDown,
  ShieldCheck,
  User,
  LogOut,
  LogIn,
  KeyRound,
  Lock,
} from 'lucide-react';
import { AuthUser, PersonCategory, SheetsConfig } from '../types';

interface HeaderProps {
  activeTab: 'monitor' | 'register' | 'staff' | 'config' | 'script';
  setActiveTab: (tab: 'monitor' | 'register' | 'staff' | 'config' | 'script') => void;
  selectedCategory: 'SEMUA' | PersonCategory;
  setSelectedCategory: (cat: 'SEMUA' | PersonCategory) => void;
  sheetsConfig: SheetsConfig;
  activeFaceCount: number;
  currentUser: AuthUser | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenUserManagement?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedCategory,
  setSelectedCategory,
  sheetsConfig,
  currentUser,
  onLogout,
  onOpenLogin,
  onOpenUserManagement,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format time: HH.mm.ss
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hours}.${minutes}.${seconds}`);

      // Format date: Kamis, 15 Oktober 2026
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      const dayName = days[now.getDay()];
      const dayNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      setDateStr(`${dayName}, ${dayNum} ${monthName} ${year}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800/80 bg-[#070d18]/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Top Bar matching screenshot */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-900/40 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            <ScanFace className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#070d18]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Absensi Guru &amp; Staf TU
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                REALTIME AI
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Face Recognition &amp; QR Code • Database Google Sheets Realtime
            </p>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3 text-xs">
          {/* Category Filter Dropdown */}
          <div className="relative inline-block">
            <select
              aria-label="Filter Kategori Pegawai"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as 'SEMUA' | PersonCategory)}
              className="appearance-none bg-slate-900/90 text-slate-200 border border-slate-700 hover:border-emerald-500/60 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              <option value="SEMUA">Kategori: Semua Pegawai</option>
              <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
              <option value="GURU">Guru / Pendidik</option>
              <option value="TATA_USAHA">Staf Tata Usaha</option>
              <option value="OPERATOR_SEKOLAH">Operator Sekolah</option>
              <option value="PUSTAKAWAN">Pustakawan</option>
              <option value="SECURITY">Security / Satpam</option>
              <option value="OFFICE_BOY">Office Boy (OB)</option>
              <option value="OFFICE_GIRL">Office Girl (OG)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* AI Ready Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Siap</span>
          </div>

          {/* Google Sheets Status Badge */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('config')}
              title="Klik untuk membuka Konfigurasi Google Sheets"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
                sheetsConfig.webhookUrl
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Cloud className={`w-3.5 h-3.5 ${sheetsConfig.webhookUrl ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{sheetsConfig.webhookUrl ? 'Google Sheets Aktif' : 'Konfigurasi Sheets'}</span>
            </button>
          )}

          {/* Real-time Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 font-mono-numbers">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">{timeStr}</span>
            <span className="text-slate-500 hidden md:inline">•</span>
            <span className="text-slate-400 hidden md:inline">{dateStr}</span>
          </div>

          {/* User Auth Profile Badge & Controls */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <div
                title={`Login sebagai ${currentUser.nama} (${currentUser.role.toUpperCase()})`}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-700/80"
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isAdmin
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5 leading-none">
                    <span className="truncate max-w-[110px]">{currentUser.nama}</span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold border ${
                        isAdmin
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px] mt-0.5 leading-none">
                    {currentUser.jabatan || currentUser.username}
                  </div>
                </div>
              </div>

              {/* Admin Manage Accounts Button */}
              {isAdmin && onOpenUserManagement && (
                <button
                  onClick={onOpenUserManagement}
                  title="Kelola Akun Pengguna (Admin)"
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Switch Account */}
              <button
                onClick={onOpenLogin}
                title="Ganti Akun"
                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-[11px] font-medium transition-colors"
              >
                Ganti Akun
              </button>

              {/* Logout */}
              <button
                onClick={onLogout}
                title="Keluar (Logout)"
                className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/60 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/40 cursor-pointer transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {/* Tab 1: Monitor Presensi (Tersedia untuk Semua Role) */}
        <button
          onClick={() => setActiveTab('monitor')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'monitor'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Monitor Presensi</span>
        </button>

        {/* Tab Khusus Administrator: Hanya ditampilkan jika login sebagai Admin */}
        {isAdmin && (
          <>
            {/* Tab 2: Data Guru & Staf TU (Admin) */}
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'staff'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Data Guru &amp; Staf TU</span>
            </button>

            {/* Tab 3: Pendaftaran Wajah & Biodata (Admin) */}
            <button
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'register'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Pendaftaran Wajah &amp; Biodata</span>
            </button>

            {/* Tab 4: Konfigurasi Google Sheets (Admin) */}
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'config'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Konfigurasi Google Sheets</span>
            </button>

            {/* Tab 5: Skrip Apps Script & Template (Admin) */}
            <button
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'script'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              <span>Skrip Apps Script &amp; Template</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
