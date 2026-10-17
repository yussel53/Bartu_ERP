import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { KeyRound, Loader2, LogIn, ShieldCheck, X } from 'lucide-react';
import {
  AuthUser,
  changePassword as apiChangePassword,
  getAuthStatus,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  setupAdmin,
} from '../api/authApi';
import { ApiError, AUTH_REQUIRED_EVENT, installAuthFetch } from '../config/api';
import { refreshEffectiveAuth, setCurrentUserId } from '../data/permissions';
import { loadExtraFields } from '../data/extraFields';
import { useAppModules } from '../contexts/AppModulesContext';
import { ExitAppButton } from './ExitAppButton';

installAuthFetch();

interface AuthContextValue {
  user: AuthUser;
  logout: () => Promise<void>;
  openChangePassword: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Oturumdaki kullanıcı (AuthGate içinde) */
export function useAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const input =
  'w-full h-9 px-3 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

/** Kullanıcı adı + şifre formu — ilk kurulumda yönetici şifresi belirleme */
const LoginForm: React.FC<{
  setup?: boolean;
  expired?: boolean;
  onDone: (u: AuthUser) => void;
}> = ({ setup, expired, onDone }) => {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (setup && password !== password2) {
      setError('Şifreler aynı değil.');
      return;
    }
    setBusy(true);
    try {
      const r = setup ? await setupAdmin(userName, password) : await apiLogin(userName, password, remember);
      onDone(r.user);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-md bg-blue-700 text-white flex items-center justify-center">
          {setup ? <ShieldCheck className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
        </div>
        <div>
          <div className="text-[15px] font-semibold text-slate-800">KaviSoft</div>
          <div className="text-[11px] text-slate-500">
            {setup ? 'İlk kurulum — yönetici şifresi belirleyin' : expired ? 'Oturum süresi doldu — tekrar giriş yapın' : 'Giriş'}
          </div>
        </div>
      </div>

      {setup && (
        <div className="text-[12px] text-slate-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
          Sistemde şifresi olan kullanıcı yok. Tipi «Admin» olan kullanıcının adını girip şifre belirleyin; diğer
          kullanıcıların şifreleri Kullanıcı kartından verilir.
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-[12px] text-slate-600">Kullanıcı adı</span>
        <input autoFocus value={userName} onChange={(e) => setUserName(e.target.value)} className={input} autoComplete="username" />
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] text-slate-600">{setup ? 'Yeni şifre' : 'Şifre'}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
          autoComplete={setup ? 'new-password' : 'current-password'}
        />
      </label>
      {setup ? (
        <label className="block space-y-1">
          <span className="text-[12px] text-slate-600">Yeni şifre (tekrar)</span>
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={input} autoComplete="new-password" />
        </label>
      ) : (
        <label className="flex items-center gap-2 text-[12px] text-slate-600">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Beni hatırla (bu bilgisayarda 30 gün)
        </label>
      )}

      {error && <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <button
        type="submit"
        disabled={busy || !userName.trim() || !password}
        className="w-full h-9 rounded-md bg-blue-700 text-white text-[13px] font-semibold hover:bg-blue-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {setup ? 'Şifreyi kaydet ve giriş yap' : 'Giriş yap'}
      </button>
    </form>
  );
};

/** Şifre değiştir penceresi (zorunlu değişiklikte kapatılamaz) */
const ChangePasswordModal: React.FC<{ forced?: boolean; onClose: () => void }> = ({ forced, onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== next2) {
      setError('Yeni şifreler aynı değil.');
      return;
    }
    setBusy(true);
    try {
      await apiChangePassword(current, next);
      setDone(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
            <KeyRound className="w-4 h-4 text-blue-700" /> Şifre Değiştir
          </div>
          {!forced && (
            <button type="button" onClick={onClose} className="p-1 rounded text-slate-500 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {forced && <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Devam etmeden önce şifrenizi değiştirin.</div>}
        <input type="password" placeholder="Mevcut şifre" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} autoComplete="current-password" />
        <input type="password" placeholder="Yeni şifre (en az 6 karakter)" value={next} onChange={(e) => setNext(e.target.value)} className={input} autoComplete="new-password" />
        <input type="password" placeholder="Yeni şifre (tekrar)" value={next2} onChange={(e) => setNext2(e.target.value)} className={input} autoComplete="new-password" />
        {error && <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        {done && <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">Şifre değiştirildi.</div>}
        <button
          type="submit"
          disabled={busy || !current || !next}
          className="w-full h-9 rounded-md bg-blue-700 text-white text-[13px] font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          Kaydet
        </button>
      </form>
    </div>
  );
};

/**
 * Giriş kapısı: oturum yoksa giriş (ilk kurulumda yönetici şifresi) ekranı; oturum düşerse uygulamayı
 * kapatmadan giriş penceresi açılır (açık fişler kaybolmaz). Kullanıcı kimliği sunucudaki token'dan gelir.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<'checking' | 'login' | 'setup' | 'ready' | 'legacy'>('checking');
  const [expired, setExpired] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const { reloadMenus } = useAppModules();

  const accept = useCallback(async (u: AuthUser) => {
    setCurrentUserId(String(u.userId));
    await refreshEffectiveAuth(String(u.userId));
    // Girişten önce 401 alan yüklemeler (ek alanlar, rapor menüleri) kullanıcıyla yeniden
    await Promise.all([loadExtraFields(true), reloadMenus()]);
    setUser(u);
    setExpired(false);
    setState('ready');
    if (u.mustChangePassword) setPwdOpen(true);
  }, [reloadMenus]);

  useEffect(() => {
    (async () => {
      try {
        await accept(await getMe());
      } catch {
        try {
          const st = await getAuthStatus();
          setState(st.needsSetup ? 'setup' : 'login');
        } catch (e) {
          // Eski backend (girişsiz sürüm, /api/auth yok): giriş istenmez — backend güncellenince giriş açılır
          setState(e instanceof ApiError && e.status === 404 ? 'legacy' : 'login');
        }
      }
    })();
  }, [accept]);

  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(AUTH_REQUIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onExpired);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setState('login');
      window.location.hash = '#/';
      window.location.reload();
    }
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 gap-2 text-[13px] text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin" /> Oturum kontrol ediliyor…
      </div>
    );
  }

  if (state === 'legacy') return <>{children}</>;

  if (state !== 'ready' || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-100 to-slate-200 px-4">
        <LoginForm setup={state === 'setup'} onDone={(u) => void accept(u)} />
        <ExitAppButton />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, logout, openChangePassword: () => setPwdOpen(true) }}>
      {children}
      {expired && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
          <LoginForm
            expired
            onDone={(u) => {
              if (u.userId !== user.userId) {
                // Başka kullanıcıyla girildi: açık ekranlar eski kullanıcıya ait — temiz başlat
                setCurrentUserId(String(u.userId));
                window.location.reload();
                return;
              }
              setExpired(false);
            }}
          />
        </div>
      )}
      {pwdOpen && <ChangePasswordModal forced={user.mustChangePassword} onClose={() => {
        setPwdOpen(false);
        if (user.mustChangePassword) setUser({ ...user, mustChangePassword: false });
      }} />}
    </AuthContext.Provider>
  );
};
