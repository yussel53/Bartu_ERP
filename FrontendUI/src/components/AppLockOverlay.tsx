import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from './AuthGate';
import { appToast } from '../utils/appToast';

interface Props {
  locked: boolean;
  onUnlock: () => void;
}

/** Ctrl+L — geçici uygulama kilidi; açmak için oturum şifresi */
export const AppLockOverlay: React.FC<Props> = ({ locked, onUnlock }) => {
  const auth = useAuth();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!locked) setPwd('');
  }, [locked]);

  if (!locked) return null;

  const unlock = async () => {
    if (!auth?.user) {
      onUnlock();
      return;
    }
    setBusy(true);
    try {
      // Yerel oturum: şifre API doğrulaması yoksa displayName/userName ile basit kontrol yerine
      // AuthGate login endpoint'i varsa kullan; yoksa boş şifre engelle
      const user = auth.user.userName;
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userName: user, password: pwd }),
      });
      if (res.ok) {
        onUnlock();
        return;
      }
      // Endpoint yoksa (404) — şifre boş değilse aç (geliştirme)
      if (res.status === 404 || res.status === 405) {
        if (pwd.trim()) {
          onUnlock();
          return;
        }
        appToast('Kilidi açmak için şifrenizi girin', { kind: 'error' });
        return;
      }
      appToast('Şifre hatalı', { kind: 'error' });
    } catch {
      if (pwd.trim()) onUnlock();
      else appToast('Kilidi açmak için şifrenizi girin', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-900/90 p-4">
      <div className="w-full max-w-sm rounded-md border border-slate-600 bg-slate-800 p-4 shadow-2xl space-y-3">
        <div className="flex items-center gap-2 text-slate-100">
          <Lock className="w-5 h-5 text-amber-400" />
          <h2 className="text-[14px] font-semibold">Uygulama kilitli</h2>
        </div>
        <p className="text-[12px] text-slate-300">
          Ctrl+L ile kilitlendi. Devam etmek için {auth?.user?.userName || 'kullanıcı'} şifresini girin.
        </p>
        <input
          type="password"
          autoFocus
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void unlock();
          }}
          placeholder="Şifre"
          className="w-full h-9 px-2 rounded-sm border border-slate-500 bg-slate-900 text-slate-100 text-[13px]"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void unlock()}
          className="w-full h-9 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-sm disabled:opacity-50"
        >
          Kilidi aç
        </button>
      </div>
    </div>
  );
};
