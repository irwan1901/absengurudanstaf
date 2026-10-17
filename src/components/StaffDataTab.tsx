import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  QrCode,
  Trash2,
  Printer,
  Cloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  X,
  ExternalLink,
  Pencil,
  Camera,
  Upload,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { CATEGORY_BADGES, CATEGORY_LABELS, Person, PersonCategory, SheetsConfig, AuthUser } from '../types';
import { syncStaffListToSheets } from '../services/sheetsService';
import { generateQrDataUrl } from '../services/storage';

interface StaffDataTabProps {
  persons: Person[];
  onDeletePerson: (id: string) => void;
  onUpdatePerson: (updatedPerson: Person) => void;
  sheetsConfig: SheetsConfig;
  currentUser?: AuthUser | null;
}

export const StaffDataTab: React.FC<StaffDataTabProps> = ({
  persons,
  onDeletePerson,
  onUpdatePerson,
  sheetsConfig,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'SEMUA' | PersonCategory>('SEMUA');
  const [selectedPersonForCard, setSelectedPersonForCard] = useState<Person | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [editFormData, setEditFormData] = useState<{
    nip: string;
    nama: string;
    kategori: PersonCategory;
    jabatan: string;
    gender: 'L' | 'P';
    fotoUrl: string;
  }>({
    nip: '',
    nama: '',
    kategori: 'GURU',
    jabatan: '',
    gender: 'L',
    fotoUrl: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const isAdmin = currentUser ? currentUser.role === 'admin' : true;

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      if (categoryFilter !== 'SEMUA' && p.kategori !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.nama.toLowerCase().includes(q) ||
          p.nip.toLowerCase().includes(q) ||
          p.jabatan.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [persons, categoryFilter, searchQuery]);

  const handleSyncToSheets = async () => {
    if (!isAdmin) {
      alert('Hanya Administrator yang memiliki akses untuk menyinkronkan data master ke Google Sheets.');
      return;
    }
    if (!sheetsConfig.webhookUrl) {
      alert('Silakan hubungkan Webhook Google Sheets terlebih dahulu di tab "Konfigurasi Google Sheets".');
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncStaffListToSheets(persons, sheetsConfig);
      setSyncStatus(res.message);
    } catch (e: unknown) {
      setSyncStatus('Gagal: ' + String(e));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartEdit = (p: Person) => {
    setEditingPerson(p);
    setEditFormData({
      nip: p.nip,
      nama: p.nama,
      kategori: p.kategori,
      jabatan: p.jabatan,
      gender: p.gender,
      fotoUrl: p.fotoUrl,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;
    if (!editFormData.nip.trim()) {
      setEditError('NIP / NIK tidak boleh kosong.');
      return;
    }
    if (!editFormData.nama.trim()) {
      setEditError('Nama lengkap tidak boleh kosong.');
      return;
    }
    if (!editFormData.jabatan.trim()) {
      setEditError('Jabatan / mata pelajaran tidak boleh kosong.');
      return;
    }

    try {
      let qrCode = editingPerson.qrCodeDataUrl;
      // Regenerate QR Code if NIP has changed or was empty
      if (editFormData.nip.trim() !== editingPerson.nip || !qrCode) {
        qrCode = await generateQrDataUrl(editFormData.nip.trim());
      }

      const updatedPerson: Person = {
        ...editingPerson,
        nip: editFormData.nip.trim(),
        nama: editFormData.nama.trim(),
        kategori: editFormData.kategori,
        jabatan: editFormData.jabatan.trim(),
        gender: editFormData.gender,
        fotoUrl: editFormData.fotoUrl,
        qrCodeDataUrl: qrCode,
      };

      onUpdatePerson(updatedPerson);
      setEditingPerson(null);
    } catch (err: unknown) {
      setEditError('Gagal menyimpan perubahan: ' + String(err));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEditFormData((prev) => ({ ...prev, fotoUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header card */}
      <div className="bg-[#0c1424] border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Master Data Guru &amp; Staf Tata Usaha
              </h2>
              <p className="text-xs text-slate-400">
                Kelola daftar pegawai, cetak kartu QR Code presensi, dan sinkronkan data master ke Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sheetsConfig.webhookUrl && isAdmin && (
              <button
                onClick={handleSyncToSheets}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>Ekspor Master ke Google Sheets</span>
              </button>
            )}
          </div>
        </div>

        {/* Read-Only Notice for User Role */}
        {!isAdmin && (
          <div className="mb-4 p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                USER UMUM
              </span>
              <span>
                <strong>Mode Akses Lihat Saja:</strong> Anda dapat melihat informasi pegawai dan kartu QR Code. Untuk menambah, mengedit, atau menghapus data, silakan masuk sebagai Administrator.
              </span>
            </div>
          </div>
        )}

        {syncStatus && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama, NIP, atau mata pelajaran..."
              className="w-full bg-[#070d18] text-slate-200 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              aria-label="Filter Berdasarkan Kategori"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'SEMUA' | PersonCategory)}
              className="w-full bg-[#070d18] text-slate-200 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="SEMUA">Semua Kategori ({persons.length})</option>
              <option value="KEPALA_SEKOLAH">Kepala Sekolah ({persons.filter((p) => p.kategori === 'KEPALA_SEKOLAH').length})</option>
              <option value="GURU">Guru ({persons.filter((p) => p.kategori === 'GURU').length})</option>
              <option value="TATA_USAHA">Staf TU ({persons.filter((p) => p.kategori === 'TATA_USAHA').length})</option>
              <option value="OPERATOR_SEKOLAH">Operator ({persons.filter((p) => p.kategori === 'OPERATOR_SEKOLAH').length})</option>
              <option value="PUSTAKAWAN">Pustakawan ({persons.filter((p) => p.kategori === 'PUSTAKAWAN').length})</option>
              <option value="SECURITY">Security ({persons.filter((p) => p.kategori === 'SECURITY').length})</option>
              <option value="OFFICE_BOY">Office Boy ({persons.filter((p) => p.kategori === 'OFFICE_BOY').length})</option>
              <option value="OFFICE_GIRL">Office Girl ({persons.filter((p) => p.kategori === 'OFFICE_GIRL').length})</option>
            </select>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#070d18] text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Pegawai</th>
                <th className="py-3 px-4">NIP / NIK</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Jabatan / Mapel</th>
                <th className="py-3 px-4 text-center">QR Code</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-[#0c1424]">
              {filteredPersons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    Tidak ada data pegawai yang cocok.
                  </td>
                </tr>
              ) : (
                filteredPersons.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-3">
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
                      <div>
                        <div className="font-bold text-white">{p.nama}</div>
                        <div className="text-[10px] text-slate-400">Gender: {p.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-numbers text-slate-300">{p.nip}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          CATEGORY_BADGES[p.kategori]?.color || 'bg-slate-800 text-slate-300'
                        } ${CATEGORY_BADGES[p.kategori]?.border || 'border-slate-700'}`}
                      >
                        {CATEGORY_BADGES[p.kategori]?.label || p.kategori}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.jabatan}</td>
                    <td className="py-3 px-4 text-center">
                      {p.qrCodeDataUrl ? (
                        <button
                          onClick={() => setSelectedPersonForCard(p)}
                          title="Lihat / Cetak Kartu ID & QR Code"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition-colors inline-flex"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(p)}
                            title="Edit Data Pegawai"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPersonToDelete(p)}
                            title={`Hapus Data Pegawai ${p.nama}`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 hover:border-rose-500/50 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end">
                          <span
                            title="Aksi edit dan hapus hanya dapat dilakukan oleh Administrator"
                            className="text-[10px] text-slate-400 font-medium px-2 py-1 rounded-md bg-slate-900 border border-slate-800"
                          >
                            Read-Only
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ID Card Modal Printable */}
      {selectedPersonForCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1424] border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center">
            <button
              onClick={() => setSelectedPersonForCard(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Printable Badge Preview */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-[#070d18] to-slate-900 border-2 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-2">
                Kartu Presensi Guru &amp; Staf
              </div>

              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-400 mx-auto mb-3 shadow-md">
                <img
                  src={selectedPersonForCard.fotoUrl}
                  alt={selectedPersonForCard.nama}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <h3 className="text-sm font-bold text-white mb-0.5 leading-tight">
                {selectedPersonForCard.nama}
              </h3>
              <p className="text-xs text-emerald-400 font-semibold mb-1">
                {CATEGORY_LABELS[selectedPersonForCard.kategori] || selectedPersonForCard.kategori}
              </p>
              <p className="text-[11px] text-slate-400 mb-4">{selectedPersonForCard.jabatan}</p>

              {/* QR Code Container */}
              <div className="bg-white p-3 rounded-2xl inline-block shadow-inner mx-auto mb-2">
                {selectedPersonForCard.qrCodeDataUrl ? (
                  <img
                    src={selectedPersonForCard.qrCodeDataUrl}
                    alt={`QR Code ${selectedPersonForCard.nip}`}
                    className="w-36 h-36"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-slate-500 text-xs">
                    QR Belum Tersedia
                  </div>
                )}
              </div>

              <div className="font-mono-numbers text-xs font-bold text-slate-300 tracking-wider">
                {selectedPersonForCard.nip}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={handlePrintCard}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kartu</span>
              </button>
              <button
                onClick={() => setSelectedPersonForCard(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Person Modal */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1424] border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative text-left">
            <button
              onClick={() => setEditingPerson(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Edit Data Guru &amp; Staf TU
                </h3>
                <p className="text-xs text-slate-400">
                  Perbarui informasi biodata, jabatan, foto, dan kode QR identitas pegawai.
                </p>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-500/40 shrink-0 bg-[#070d18]">
                  <img
                    src={editFormData.fotoUrl}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <label className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <label className="block text-slate-400 mb-1">URL Foto Profil</label>
                  <input
                    type="url"
                    value={editFormData.fotoUrl}
                    onChange={(e) => setEditFormData({ ...editFormData, fotoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">NIP / NIK *</label>
                <input
                  type="text"
                  required
                  value={editFormData.nip}
                  onChange={(e) => setEditFormData({ ...editFormData, nip: e.target.value })}
                  className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono-numbers"
                />
                <span className="text-[10px] text-slate-500">QR Code akan diperbarui otomatis jika NIP diubah.</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap &amp; Gelar *</label>
                <input
                  type="text"
                  required
                  value={editFormData.nama}
                  onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                  className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Kategori Pegawai *</label>
                  <select
                    value={editFormData.kategori}
                    onChange={(e) => setEditFormData({ ...editFormData, kategori: e.target.value as PersonCategory })}
                    className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
                    <option value="GURU">Guru / Tenaga Pendidik</option>
                    <option value="TATA_USAHA">Staf Tata Usaha</option>
                    <option value="OPERATOR_SEKOLAH">Operator Sekolah</option>
                    <option value="PUSTAKAWAN">Pustakawan</option>
                    <option value="SECURITY">Security / Satpam</option>
                    <option value="OFFICE_BOY">Office Boy (OB)</option>
                    <option value="OFFICE_GIRL">Office Girl (OG)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Jenis Kelamin</label>
                  <select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as 'L' | 'P' })}
                    className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Jabatan / Mata Pelajaran *</label>
                <input
                  type="text"
                  required
                  value={editFormData.jabatan}
                  onChange={(e) => setEditFormData({ ...editFormData, jabatan: e.target.value })}
                  className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingPerson;
                    setEditingPerson(null);
                    setPersonToDelete(target);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Pegawai Ini</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingPerson(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Notifikasi Konfirmasi Hapus Data: Apakah Anda Yakin? */}
      {personToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1424] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setPersonToDelete(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 pr-6">
                <h3 className="text-base font-bold text-white mb-1">
                  Apakah Anda yakin?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Apakah Anda yakin ingin menghapus data pegawai berikut secara permanen?
                </p>
              </div>
            </div>

            {/* Target Person Card Details */}
            <div className="mt-4 p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center gap-3">
              <img
                src={personToDelete.fotoUrl}
                alt={personToDelete.nama}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://ui-avatars.com/api/?name=Pegawai&background=0f172a&color=10b981&size=100';
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-white truncate">{personToDelete.nama}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">NIP: {personToDelete.nip}</div>
                <div className="text-[11px] text-emerald-400 font-medium mt-1">
                  {CATEGORY_LABELS[personToDelete.kategori] || personToDelete.kategori} &bull; {personToDelete.jabatan}
                </div>
              </div>
            </div>

            <div className="mt-3.5 text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 flex items-start gap-2">
              <span className="shrink-0 text-rose-400 font-bold">⚠️</span>
              <span>
                <strong>Perhatian:</strong> Data profil, riwayat foto wajah AI, dan kartu QR code yang bersangkutan akan dihapus dari sistem dan tindakan ini <strong>tidak dapat dibatalkan</strong>.
              </span>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPersonToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = personToDelete.id;
                  setPersonToDelete(null);
                  onDeletePerson(idToDelete);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
