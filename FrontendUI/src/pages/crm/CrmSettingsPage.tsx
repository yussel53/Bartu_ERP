import React from 'react';
import { Copy, KeyRound, Plus, RefreshCw, Save } from 'lucide-react';
import { crmApi, isNeedsUpdate, type CrmActionType, type CrmUser } from '../../api/crmApi';
import { Btn, ErrorNote, Field, Spinner, errMsg, inputCls, textareaCls } from './CrmUi';
import { MailProfilesPanel } from './MailProfilesPanel';

const SECTION = 'rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3';

function genKey() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function CrmSettingsPage() {
  const [s, setS] = React.useState<Record<string, string | null> | null>(null);
  const [types, setTypes] = React.useState<CrmActionType[]>([]);
  const [users, setUsers] = React.useState<CrmUser[]>([]);
  const [emails, setEmails] = React.useState<Record<number, string | null>>({});
  const [apiUrl, setApiUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    crmApi
      .getSettings()
      .then((r) => {
        setS(r.settings);
        setTypes(r.actionTypes);
        setUsers(r.users);
        setEmails(Object.fromEntries(r.users.map((u) => [u.systemUserID, u.email ?? ''])));
        setApiUrl(r.apiUrl);
      })
      .catch((e) => setError(isNeedsUpdate(e) ? errMsg(e) : `Ayarlar alınamadı: ${errMsg(e)}`));
  }, []);
  React.useEffect(load, [load]);

  const v = (k: string) => s?.[k] ?? '';
  const set = (k: string, val: string) => setS((x) => ({ ...(x || {}), [k]: val }));

  const save = async () => {
    if (!s) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await crmApi.saveSettings({ settings: s, actionTypes: types, userEmails: emails });
      setOk('Ayarlar kaydedildi.');
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!s) return error ? <ErrorNote error={error} /> : <Spinner />;

  const prefix = v('TagPrefix') || 'KS';
  const configText = `ApiUrl=${apiUrl}\nApiKey=${v('ApiKey')}\nRegexPattern=/#(.*?)#/\nEmlGonder=True\nGidenleriDinle=True\nSslDogrulamaKapali=False`;

  return (
    <div className="space-y-3">
      <ErrorNote error={error} />
      {ok && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-700">{ok}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={SECTION}>
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-0.5">Outlook CRM entegrasyonu</h3>
          <p className="text-[11.5px] text-slate-500 mb-2">
            Outlook eklentisi (Outlook_Entegrasyon · CrmComAddin) konusunda <code className="font-mono">/#{prefix}-FırsatNo#/</code> etiketi olan gelen/giden mailleri bu sisteme kaydeder ve “CRM Kartı”nı buradan çeker.
          </p>
          <div className="grid grid-cols-6 gap-2.5">
            <Field label="Konu etiketi öneki" className="col-span-2" hint={`Örnek konu: Teklif No: 1001 /#${prefix}-12#/`}>
              <input className={`${inputCls} font-mono uppercase`} maxLength={10} value={v('TagPrefix')} onChange={(e) => set('TagPrefix', e.target.value.toUpperCase())} />
            </Field>
            <Field label="API anahtarı (X-Api-Key)" className="col-span-4" hint="Boş bırakılırsa anahtar kontrolü yapılmaz (yalnız iç ağ için önerilir).">
              <div className="flex gap-1">
                <input className={`${inputCls} font-mono`} value={v('ApiKey')} onChange={(e) => set('ApiKey', e.target.value)} />
                <Btn icon={<KeyRound className="w-3.5 h-3.5" />} onClick={() => set('ApiKey', genKey())} title="Rastgele anahtar üret" />
              </div>
            </Field>
            <Field label="Eklenti ayar dosyası (%AppData%\CrmEntegrasyon\config.txt)" className="col-span-6">
              <div className="relative">
                <pre className="text-[11px] font-mono rounded-md bg-slate-900 text-slate-100 p-2.5 overflow-x-auto">{configText}</pre>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 p-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                  title="Kopyala"
                  onClick={() => void navigator.clipboard?.writeText(configText)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </Field>
          </div>
          <div className="mt-2 flex gap-2">
            <a href={`${apiUrl}/ping`} target="_blank" rel="noreferrer" className="text-[12px] text-blue-600 hover:underline">
              Bağlantı testi: /api/mailler/ping
            </a>
          </div>
        </div>

        <div className={SECTION}>
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-2">Teklif belgesi</h3>
          <div className="grid grid-cols-6 gap-2.5">
            <Field label="Firma adı (başlık)" className="col-span-4">
              <input className={inputCls} value={v('CompanyName')} onChange={(e) => set('CompanyName', e.target.value)} />
            </Field>
            <Field label="İlk teklif no" className="col-span-2">
              <input className={inputCls} value={v('OfferDocStart')} onChange={(e) => set('OfferDocStart', e.target.value)} />
            </Field>
            <Field label="Firma bilgileri (adres, telefon, vergi no)" className="col-span-6">
              <textarea className={textareaCls} rows={3} value={v('CompanyInfo')} onChange={(e) => set('CompanyInfo', e.target.value)} />
            </Field>
            <Field label="Teklif alt notu / genel şartlar" className="col-span-6">
              <textarea className={textareaCls} rows={3} value={v('OfferFooter')} onChange={(e) => set('OfferFooter', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className={SECTION}>
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-2">Kullanıcı e-postaları</h3>
          <p className="text-[11.5px] text-slate-500 mb-2">Teklif mailinde gönderen / yanıt adresi olarak kullanılır (SystemUser.Email).</p>
          <div className="space-y-1.5">
            {users.map((u) => (
              <div key={u.systemUserID} className="flex items-center gap-2">
                <span className="w-40 text-[12px] text-slate-700 dark:text-slate-200 truncate">{u.fullName || u.nickName}</span>
                <input
                  className={inputCls}
                  type="email"
                  value={emails[u.systemUserID] ?? ''}
                  onChange={(e) => setEmails((x) => ({ ...x, [u.systemUserID]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <MailProfilesPanel />

      <div className={SECTION}>
        <div className="flex items-center mb-2">
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Aksiyon tipleri</h3>
          <Btn
            className="ml-auto"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setTypes((t) => [...t, { actionTypeID: 0, title: '', icon: '', closeKind: 0, sortOrder: (t.length + 1) * 10, isActive: true }])}
          >
            Tip ekle
          </Btn>
        </div>
        <table className="w-full text-[12px]">
          <thead className="text-[11px] text-slate-500">
            <tr>
              <th className="text-left font-medium py-1">Ad</th>
              <th className="text-left font-medium w-40">Kapanış etkisi</th>
              <th className="text-left font-medium w-24">Sıra</th>
              <th className="text-left font-medium w-20">Aktif</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t, i) => (
              <tr key={t.actionTypeID || `n${i}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 pr-2">
                  <input className={`${inputCls} h-7`} value={t.title} onChange={(e) => setTypes((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
                </td>
                <td className="pr-2">
                  <select
                    className={`${inputCls} h-7`}
                    value={t.closeKind}
                    onChange={(e) => setTypes((x) => x.map((y, j) => (j === i ? { ...y, closeKind: Number(e.target.value) } : y)))}
                  >
                    <option value={0}>Yok</option>
                    <option value={1}>Olumlu kapatır</option>
                    <option value={2}>Olumsuz kapatır</option>
                  </select>
                </td>
                <td className="pr-2">
                  <input
                    className={`${inputCls} h-7`}
                    type="number"
                    value={t.sortOrder}
                    onChange={(e) => setTypes((x) => x.map((y, j) => (j === i ? { ...y, sortOrder: Number(e.target.value) } : y)))}
                  />
                </td>
                <td>
                  <input type="checkbox" checked={t.isActive} onChange={(e) => setTypes((x) => x.map((y, j) => (j === i ? { ...y, isActive: e.target.checked } : y)))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Btn icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Yenile
        </Btn>
        <Btn variant="primary" icon={<Save className="w-3.5 h-3.5" />} busy={busy} onClick={save}>
          Kaydet
        </Btn>
      </div>
    </div>
  );
}
