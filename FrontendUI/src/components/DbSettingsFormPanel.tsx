import React, { useState } from 'react';
import { Database, Loader2, Plug, Save } from 'lucide-react';
import { apiJson } from '../config/api';

export interface DbSettingsForm {
  server: string;
  database: string;
  trustedConnection: boolean;
  userId: string;
  password: string;
  trustServerCertificate: boolean;
  passwordSet?: boolean;
}

interface Props {
  /** İlk kurulum (tam ekran) */
  setupMode?: boolean;
  initial?: Partial<DbSettingsForm>;
  onSaved?: () => void;
  onCancel?: () => void;
}

const emptyForm: DbSettingsForm = {
  server: 'localhost',
  database: 'Bartu_ERP',
  trustedConnection: true,
  userId: '',
  password: '',
  trustServerCertificate: true,
};

export const DbSettingsFormPanel: React.FC<Props> = ({
  setupMode = false,
  initial,
  onSaved,
  onCancel,
}) => {
  const [form, setForm] = useState<DbSettingsForm>({ ...emptyForm, ...initial });
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const patch = (p: Partial<DbSettingsForm>) => setForm((f) => ({ ...f, ...p }));

  const body = () => ({
    server: form.server.trim(),
    database: form.database.trim(),
    trustedConnection: form.trustedConnection,
    userId: form.trustedConnection ? null : form.userId.trim(),
    password: form.trustedConnection ? null : form.password,
    trustServerCertificate: form.trustServerCertificate,
  });

  const test = async () => {
    setBusy('test');
    setMsg(null);
    try {
      const res = await apiJson<{ success: boolean; message: string; databaseExists?: boolean }>(
        '/api/db-settings/test',
        {
          method: 'POST',
          body: JSON.stringify(body()),
        },
      );
      setMsg({
        type: res.success ? 'ok' : 'err',
        text: res.databaseExists === false && res.success
          ? `${res.message} → Sistem Yönetimi / Sıfırdan Oluştur`
          : res.message,
      });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Test başarısız' });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      const res = await apiJson<{ success: boolean; message: string }>('/api/db-settings', {
        method: 'POST',
        body: JSON.stringify(body()),
      });
      setMsg({ type: 'ok', text: res.message || 'Kaydedildi' });
      onSaved?.();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Kayıt başarısız' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={setupMode ? 'max-w-lg w-full mx-auto' : 'max-w-xl'}>
      {setupMode && (
        <div className="mb-5 text-center">
          <div className="inline-flex w-12 h-12 rounded-xl bg-slate-800 text-white items-center justify-center mb-3">
            <Database className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">SQL Bağlantı Ayarları</h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Programa devam etmek için SQL Server bağlantı bilgilerini girin.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Sunucu</span>
          <input
            className="mt-1 w-full h-9 px-2 text-[12px] border border-slate-300 rounded-md"
            value={form.server}
            onChange={(e) => patch({ server: e.target.value })}
            placeholder="localhost veya SUNUCU\INSTANCE"
            autoFocus={setupMode}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600">Veritabanı</span>
          <input
            className="mt-1 w-full h-9 px-2 text-[12px] border border-slate-300 rounded-md"
            value={form.database}
            onChange={(e) => patch({ database: e.target.value })}
            placeholder="Bartu_ERP"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={form.trustedConnection}
            onChange={(e) => patch({ trustedConnection: e.target.checked })}
          />
          Windows kimlik doğrulama (Trusted Connection)
        </label>

        {!form.trustedConnection && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Kullanıcı</span>
              <input
                className="mt-1 w-full h-9 px-2 text-[12px] border border-slate-300 rounded-md"
                value={form.userId}
                onChange={(e) => patch({ userId: e.target.value })}
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">
                Parola{form.passwordSet ? ' (boş bırakırsanız mevcut korunur)' : ''}
              </span>
              <input
                type="password"
                className="mt-1 w-full h-9 px-2 text-[12px] border border-slate-300 rounded-md"
                value={form.password}
                onChange={(e) => patch({ password: e.target.value })}
                autoComplete="current-password"
              />
            </label>
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={form.trustServerCertificate}
            onChange={(e) => patch({ trustServerCertificate: e.target.checked })}
          />
          Trust Server Certificate
        </label>

        {msg && (
          <div
            className={`rounded-md px-3 py-2 text-[12px] ${
              msg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void test()}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-[12px] font-semibold rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
            Bağlantıyı Dene
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Kaydet
          </button>
          {onCancel && !setupMode && (
            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-3 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
            >
              İptal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
