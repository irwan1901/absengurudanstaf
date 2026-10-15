import { AuthUser, Person, UserAccount, UserRole } from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'absensi_guru_tu_auth_user',
  ACCOUNTS: 'absensi_guru_tu_user_accounts',
};

// Default Accounts for Administrator & Regular Staff / User
export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: 'acc-admin',
    username: 'admin',
    password: 'admin123',
    nama: 'Administrator Sekolah',
    role: 'admin',
    nip: 'ADMIN-01',
    jabatan: 'Kepala Bagian IT & Presensi',
    createdAt: '2026-01-01',
  },
  {
    id: 'acc-operator',
    username: 'operator',
    password: 'operator123',
    nama: 'Budi Santoso, S.Kom',
    role: 'admin',
    nip: '198906212015021003',
    jabatan: 'Operator Sekolah & Dapodik',
    createdAt: '2026-01-05',
  },
  {
    id: 'acc-user',
    username: 'user',
    password: 'user123',
    nama: 'Pengguna Umum',
    role: 'user',
    nip: '-',
    jabatan: 'Operator Monitor Presensi',
    createdAt: '2026-01-10',
  },
];

export function getAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (raw) {
      let parsed: UserAccount[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrasi akun user lama (guru tertentu) menjadi akun user umum
        let hasChanges = false;
        parsed = parsed.map((acc) => {
          if (acc.username === 'user' && (acc.nama.includes('Siti') || acc.nip === '198203152008012004')) {
            hasChanges = true;
            return {
              ...acc,
              nama: 'Pengguna Umum',
              jabatan: 'Operator Monitor Presensi',
              nip: '-',
            };
          }
          return acc;
        });
        if (hasChanges) {
          saveAccounts(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to get accounts:', err);
  }
  // Initialize with default accounts
  saveAccounts(DEFAULT_ACCOUNTS);
  return DEFAULT_ACCOUNTS;
}

export function saveAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save accounts:', err);
  }
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (raw) {
      const parsed: AuthUser = JSON.parse(raw);
      // Migrasi akun aktif jika sebelumnya login sebagai guru tertentu
      if (parsed.username === 'user' && (parsed.nama.includes('Siti') || parsed.nip === '198203152008012004')) {
        parsed.nama = 'Pengguna Umum';
        parsed.jabatan = 'Operator Monitor Presensi';
        parsed.nip = '-';
        delete parsed.fotoUrl;
        setCurrentUser(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Failed to get current user:', err);
  }
  return null;
}

export function setCurrentUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  } catch (err) {
    console.error('Failed to set current user:', err);
  }
}

export function logout(): void {
  setCurrentUser(null);
}

export function authenticate(
  usernameInput: string,
  passwordInput: string,
  _persons: Person[] = []
): { success: boolean; user?: AuthUser; message: string } {
  const username = usernameInput.trim();
  const password = passwordInput.trim();

  if (!username || !password) {
    return {
      success: false,
      message: 'Username dan Password tidak boleh kosong.',
    };
  }

  // 1. Check in custom / pre-seeded accounts (Admin & User Umum)
  const accounts = getAccounts();
  const matchedAccount = accounts.find(
    (acc) => acc.username.toLowerCase() === username.toLowerCase()
  );

  if (matchedAccount) {
    if (matchedAccount.password === password) {
      const authUser: AuthUser = {
        id: matchedAccount.id,
        username: matchedAccount.username,
        nama: matchedAccount.nama,
        role: matchedAccount.role,
        nip: matchedAccount.nip,
        jabatan: matchedAccount.jabatan,
      };
      setCurrentUser(authUser);
      return {
        success: true,
        user: authUser,
        message: `Selamat datang kembali, ${authUser.nama}!`,
      };
    } else {
      return {
        success: false,
        message: 'Password yang Anda masukkan salah. Silakan coba lagi.',
      };
    }
  }

  return {
    success: false,
    message: 'Akun tidak ditemukan. Pastikan username dan password benar.',
  };
}

export function createAccount(data: {
  username: string;
  password: string;
  nama: string;
  role: UserRole;
  nip?: string;
  jabatan?: string;
}): { success: boolean; message: string; account?: UserAccount } {
  const accounts = getAccounts();
  const cleanUsername = data.username.trim().toLowerCase();

  if (accounts.some((a) => a.username.toLowerCase() === cleanUsername)) {
    return {
      success: false,
      message: `Username "${data.username}" sudah digunakan.`,
    };
  }

  const newAcc: UserAccount = {
    id: 'acc-' + Date.now(),
    username: cleanUsername,
    password: data.password.trim(),
    nama: data.nama.trim(),
    role: data.role,
    nip: data.nip?.trim() || undefined,
    jabatan: data.jabatan?.trim() || undefined,
    createdAt: new Date().toISOString().split('T')[0],
  };

  const updated = [...accounts, newAcc];
  saveAccounts(updated);

  return {
    success: true,
    message: `Akun ${newAcc.nama} (${newAcc.role.toUpperCase()}) berhasil dibuat!`,
    account: newAcc,
  };
}

export function deleteAccount(id: string): { success: boolean; message: string } {
  const accounts = getAccounts();
  if (accounts.length <= 1) {
    return {
      success: false,
      message: 'Tidak dapat menghapus semua akun. Minimal harus ada 1 akun.',
    };
  }

  const target = accounts.find((a) => a.id === id);
  if (!target) {
    return { success: false, message: 'Akun tidak ditemukan.' };
  }

  if (target.username === 'admin') {
    return {
      success: false,
      message: 'Akun Administrator utama tidak dapat dihapus.',
    };
  }

  const filtered = accounts.filter((a) => a.id !== id);
  saveAccounts(filtered);
  return {
    success: true,
    message: `Akun ${target.username} berhasil dihapus.`,
  };
}
