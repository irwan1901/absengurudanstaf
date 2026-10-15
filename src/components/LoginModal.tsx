import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  KeyRound,
  X,
  School,
} from 'lucide-react';
import { AuthUser, Person } from '../types';
import { authenticate } from '../services/authService';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  persons: Person[];
  isSwitchingAccount?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  persons,
  isSwitchingAccount = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'admin' | 'user'>('admin');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = authenticate(username, password, persons);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
        if (onClose) onClose();
      } else {
        setErrorMessage(result.message);
      }
    }, 250);
  };

  const handleQuickLogin = (role: 'admin' | 'user') => {
    setErrorMessage(null);
    setIsLoading(true);

    const targetUser = role === 'admin' ? 'admin' : 'user';
    const targetPass = role === 'admin' ? 'admin123' : 'user123';

    setUsername(targetUser);
    setPassword(targetPass);

    setTimeout(() => {
      const result = authenticate(targetUser, targetPass, persons);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
        if (onClose) onClose();
      } else {
        setErrorMessage(result.message);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0b1325] border border-slate-700/80 rounded-2xl shadow-2xl shadow-emerald-950/30 overflow-hidden flex flex-col">
        {/* Top Decorative Header */}
        <div className="relative p-6 bg-gradient-to-br from-slate-900 via-[#0e1a33] to-slate-900 border-b border-slate-800">
          {/* Close button if switching account or optional */}
          {onClose && isSwitchingAccount && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Portal Masuk Presensi
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Presensi Mandiri
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Silakan masuk menggunakan akun Administrator atau Akun Pengguna Umum
              </p>
            </div>
          </div>

          {/* Quick Role Select Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setUsername('admin');
                setPassword('admin123');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Login Admin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('user');
                setUsername('user');
                setPassword('user123');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'user'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4 text-sky-400" />
              <span>Login User Umum</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Description banner for selected tab */}
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              activeTab === 'admin'
                ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200/90'
                : 'bg-sky-950/30 border-sky-500/20 text-sky-200/90'
            }`}
          >
            {activeTab === 'admin' ? (
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-300">Hak Akses Admin:</strong> Akses penuh semua menu, pendaftaran wajah, edit &amp; hapus data guru/staf, pengaturan jam kerja, dan konfigurasi Google Sheets.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sky-300">Hak Akses User Umum:</strong> Akun publik untuk menampilkan dan mengoperasikan menu <strong>Monitor Presensi</strong> saja (pemindaian kamera wajah AI &amp; QR Code, serta melihat log presensi hari ini).
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={activeTab === 'admin' ? 'admin atau operator' : 'user'}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
                  : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-950/50'
              } disabled:opacity-50 cursor-pointer`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk Sebagai {activeTab === 'admin' ? 'Administrator' : 'User Umum'}</span>
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Access Buttons */}
          <div className="pt-2 border-t border-slate-800">
            <p className="text-[11px] font-medium text-slate-400 text-center mb-2.5">
              Tombol Cepat (1-Klik Tanpa Ketik):
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition-all group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Akun Admin</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  admin / admin123
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('user')}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-sky-500/50 hover:bg-sky-950/20 text-left transition-all group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <User className="w-3.5 h-3.5" />
                  <span>Akun User Umum</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  user / user123
                </div>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-2.5">
              💡 Akun User Umum disediakan untuk publik/petugas agar dapat mengoperasikan layar Monitor Presensi tanpa akses ke menu pengelolaan data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
