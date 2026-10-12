import React from 'react';
import { Building2, CheckCircle2, Layers, Mail, Pencil, Plus, Send, Trash2, User, Users, Globe2 } from 'lucide-react';
import {
  MAIL_SCOPES,
  crmApi,
  fmtDateTime,
  type CrmMailProfile,
  type CrmOrgItem,
  type CrmResolvedProfile,
  type CrmUser,
} from '../../api/crmApi';
import { getCurrentUserId } from '../../data/permissions';
import { Badge, Btn, Empty, ErrorNote, Field, Modal, Spinner, errMsg, inputCls, textareaCls } from './CrmUi';

const SCOPE_ICON = [
  <Globe2 key="0" className="w-3.5 h-3.5" />,
  <Building2 key="1" className="w-3.5 h-3.5" />,
  <Layers key="2" className="w-3.5 h-3.5" />,
  <Users key="3" className="w-3.5 h-3.5" />,
  <User key="4" className="w-3.5 h-3.5" />,
];
const SCOPE_CLS = [
  'bg-slate-100 text-slate-700 border-slate-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
];

interface Refs {
  companies: CrmOrgItem[];
  orgUnits: CrmOrgItem[];
  users: CrmUser[];
}

function targetOptions(scope: number, refs: Refs): { id: number; label: string }[] {
  const lbl = (o: CrmOrgItem) => `${o.code ? `${o.code} — ` : ''}${o.title ?? ''}`;
  switch (scope) {
    case 1:
      return refs.companies.map((c) => ({ id: c.id, label: lbl(c) }));
    case 2:
      return refs.orgUnits.filter((u) => u.unitKind === 1).map((u) => ({ id: u.id, label: lbl(u) }));
    case 3:
      return refs.orgUnits.filter((u) => u.unitKind === 2).map((u) => ({ id: u.id, label: lbl(u) }));
    case 4:
      return refs.users.map((u) => ({ id: u.systemUserID, label: u.fullName || u.nickName || `#${u.systemUserID}` }));
    default:
      return [];
  }
}

function ProfileModal({
  initial,
  refs,
  usedKeys,
  onClose,
  onSaved,
}: {
  initial: Partial<CrmMailProfile>;
  refs: Refs;
  usedKeys: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = React.useState<Partial<CrmMailProfile>>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (x: Partial<CrmMailProfile>) => setP((o) => ({ ...o, ...x }));
  const scope = p.scopeType ?? 0;
  const opts = targetOptions(scope, refs);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await crmApi.saveMailProfile({ ...p, scopeID: scope === 0 ? null : p.scopeID });
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={p.mailProfileID ? 'Mail tanımını düzenle' : 'Yeni mail tanımı'}
      subtitle="CRM_MailProfile · öncelik: Kullanıcı → Birim → Bölüm → Firma → Genel"
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <Btn onClick={onClose}>Vazgeç</Btn>
          <Btn variant="primary" busy={busy} onClick={save}>
            Kaydet
          </Btn>
        </>
      }
    >
      <ErrorNote error={error} />
      <Field label="Kapsam">
        <div className="flex flex-wrap gap-1">
          {MAIL_SCOPES.map((name, i) => {
            const taken = i === 0 && usedKeys.has('0:') && initial.scopeType !== 0;
            return (
              <button
                key={name}
                type="button"
                disabled={taken || !!p.mailProfileID}
                onClick={() => set({ scopeType: i, scopeID: null })}
                title={taken ? 'Genel tanım zaten var' : ''}
                className={`inline-flex items-center gap-1 h-8 px-3 rounded-md border text-[12px] font-medium disabled:opacity-40 ${
                  scope === i ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                {SCOPE_ICON[i]} {name}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 mt-2.5">
        {scope !== 0 && (
          <Field label={`${MAIL_SCOPES[scope]} *`} className="sm:col-span-4">
            <select
              className={inputCls}
              disabled={!!p.mailProfileID}
              value={p.scopeID ?? ''}
              onChange={(e) => set({ scopeID: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">{opts.length ? 'Seçiniz…' : `Tanımlı ${MAIL_SCOPES[scope].toLowerCase()} yok`}</option>
              {opts.map((o) => (
                <option key={o.id} value={o.id} disabled={usedKeys.has(`${scope}:${o.id}`) && o.id !== initial.scopeID}>
                  {o.label}
                  {usedKeys.has(`${scope}:${o.id}`) && o.id !== initial.scopeID ? ' (tanımlı)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Tanım adı" className={scope !== 0 ? 'sm:col-span-2' : 'sm:col-span-6'}>
          <input className={inputCls} value={p.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="örn. Satış ekibi Office365" />
        </Field>

        <div className="sm:col-span-6 text-[11px] font-semibold uppercase tracking-wide text-slate-400 pt-1">SMTP sunucusu</div>
        <Field label="Sunucu" className="sm:col-span-3" hint="Boş bırakılırsa SMTP bir üst kapsamdan (Birim → Bölüm → Firma → Genel) alınır.">
          <input className={inputCls} value={p.smtpHost || ''} onChange={(e) => set({ smtpHost: e.target.value })} placeholder="smtp.office365.com" />
        </Field>
        <Field label="Port" className="sm:col-span-1">
          <input
            className={inputCls}
            type="number"
            value={p.smtpPort ?? ''}
            onChange={(e) => set({ smtpPort: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="587"
          />
        </Field>
        <Field label="SSL/TLS" className="sm:col-span-2">
          <select className={inputCls} value={p.smtpSsl === false ? 'false' : 'true'} onChange={(e) => set({ smtpSsl: e.target.value === 'true' })}>
            <option value="true">Açık</option>
            <option value="false">Kapalı</option>
          </select>
        </Field>
        <Field label="Kullanıcı adı" className="sm:col-span-3">
          <input className={inputCls} value={p.smtpUser || ''} onChange={(e) => set({ smtpUser: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Parola" className="sm:col-span-3">
          <input className={inputCls} type="password" value={p.smtpPassword || ''} onChange={(e) => set({ smtpPassword: e.target.value })} autoComplete="new-password" />
        </Field>

        <div className="sm:col-span-6 text-[11px] font-semibold uppercase tracking-wide text-slate-400 pt-1">Gönderen</div>
        <Field label="Gönderen adresi" className="sm:col-span-3">
          <input className={inputCls} value={p.fromAddress || ''} onChange={(e) => set({ fromAddress: e.target.value })} placeholder="satis@firma.com" />
        </Field>
        <Field label="Gönderen adı" className="sm:col-span-3">
          <input className={inputCls} value={p.fromName || ''} onChange={(e) => set({ fromName: e.target.value })} placeholder="Firma Satış" />
        </Field>
        <Field label="Yanıt adresi (Reply-To)" className="sm:col-span-3" hint="Boşsa teklifi gönderen kullanıcının e-postası kullanılır.">
          <input className={inputCls} value={p.replyTo || ''} onChange={(e) => set({ replyTo: e.target.value })} />
        </Field>
        <Field label="Gizli kopya (BCC)" className="sm:col-span-3" hint="Örn. arşiv / yönetici adresi">
          <input className={inputCls} value={p.bccAddress || ''} onChange={(e) => set({ bccAddress: e.target.value })} />
        </Field>
        <Field label="İmza" className="sm:col-span-6" hint="Teklif mailinin sonuna eklenir.">
          <textarea className={textareaCls} rows={4} value={p.signature || ''} onChange={(e) => set({ signature: e.target.value })} placeholder={'Saygılarımızla,\nAd Soyad\nFirma · 0212 000 00 00'} />
        </Field>
        <label className="sm:col-span-6 inline-flex items-center gap-1.5 text-[12px] text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={p.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} /> Aktif
        </label>
      </div>
    </Modal>
  );
}

function TestModal({ profile, onClose }: { profile: CrmMailProfile; onClose: () => void }) {
  const [to, setTo] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await crmApi.testMailProfile(profile.mailProfileID, to);
      setMsg({ ok: true, text: `Test maili gönderildi: ${to}` });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Mail tanımını test et"
      subtitle={`${MAIL_SCOPES[profile.scopeType]} · ${profile.scopeName ?? ''} · ${profile.smtpHost ?? 'SMTP yok'}`}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Btn onClick={onClose}>Kapat</Btn>
          <Btn variant="primary" icon={<Send className="w-3.5 h-3.5" />} busy={busy} disabled={!to.trim()} onClick={run}>
            Gönder
          </Btn>
        </>
      }
    >
      <Field label="Alıcı">
        <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder="ornek@firma.com" autoFocus />
      </Field>
      {msg && (
        <div className={`mt-2 rounded-md border px-2.5 py-1.5 text-[12px] ${msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {msg.text}
        </div>
      )}
    </Modal>
  );
}

/** Sistem Yönetimi → Tanımlar → CRM Ayarları → Mail Tanımları */
export function MailProfilesPanel() {
  const [profiles, setProfiles] = React.useState<CrmMailProfile[] | null>(null);
  const [refs, setRefs] = React.useState<Refs>({ companies: [], orgUnits: [], users: [] });
  const [filter, setFilter] = React.useState<number | 'all'>('all');
  const [editing, setEditing] = React.useState<Partial<CrmMailProfile> | null>(null);
  const [testing, setTesting] = React.useState<CrmMailProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [checkUser, setCheckUser] = React.useState<number>(Number(getCurrentUserId()) || 0);
  const [resolved, setResolved] = React.useState<CrmResolvedProfile | null>(null);

  const load = React.useCallback(() => {
    crmApi
      .mailProfiles()
      .then((r) => {
        setProfiles(r.profiles);
        setRefs({ companies: r.companies, orgUnits: r.orgUnits, users: r.users });
        setError(null);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);
  React.useEffect(load, [load]);

  React.useEffect(() => {
    if (!checkUser) {
      setResolved(null);
      return;
    }
    crmApi.resolveMailProfile(checkUser).then(setResolved).catch(() => setResolved(null));
  }, [checkUser, profiles]);

  const usedKeys = React.useMemo(() => new Set((profiles || []).map((p) => `${p.scopeType}:${p.scopeID ?? ''}`)), [profiles]);
  const list = (profiles || []).filter((p) => filter === 'all' || p.scopeType === filter);

  const remove = async (p: CrmMailProfile) => {
    if (!window.confirm(`${MAIL_SCOPES[p.scopeType]} · ${p.scopeName ?? ''} mail tanımı silinsin mi?`)) return;
    try {
      await crmApi.deleteMailProfile(p.mailProfileID);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex flex-wrap items-start gap-2 mb-2">
        <div className="mr-auto">
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
            <Mail className="w-4 h-4" /> Mail tanımları
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            Firma, bölüm, birim veya kullanıcı bazında SMTP / gönderen / imza tanımlayın. Teklif maili gönderen kullanıcıya göre
            <b> Kullanıcı → Birim → Bölüm → Firma → Genel</b> sırasıyla ilk bulunan tanım kullanılır; boş alanlar bir üst kapsamdan tamamlanır.
          </p>
        </div>
        <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditing({ mailProfileID: 0, scopeType: usedKeys.has('0:') ? 1 : 0, smtpSsl: true, isActive: true, smtpPort: 587 })}>
          Yeni tanım
        </Btn>
      </div>
      <ErrorNote error={error} />

      <div className="flex flex-wrap gap-1 mb-2">
        {(['all', 0, 1, 2, 3, 4] as const).map((k) => {
          const n = k === 'all' ? profiles?.length ?? 0 : (profiles || []).filter((p) => p.scopeType === k).length;
          return (
            <button
              key={String(k)}
              type="button"
              onClick={() => setFilter(k)}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[11.5px] font-medium ${
                filter === k ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {k === 'all' ? 'Tümü' : (
                <>
                  {SCOPE_ICON[k]} {MAIL_SCOPES[k]}
                </>
              )}
              <span className="opacity-60">({n})</span>
            </button>
          );
        })}
      </div>

      {profiles == null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty>Bu kapsamda mail tanımı yok.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
          <table className="w-full text-[12px] min-w-[760px]">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500">
              <tr>
                <th className="text-left font-medium px-2 py-1.5">Kapsam</th>
                <th className="text-left font-medium px-2">Hedef</th>
                <th className="text-left font-medium px-2">SMTP</th>
                <th className="text-left font-medium px-2">Gönderen</th>
                <th className="text-left font-medium px-2">İmza</th>
                <th className="text-left font-medium px-2">Güncelleme</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.mailProfileID} className={`border-t border-slate-100 dark:border-slate-800 ${p.isActive ? '' : 'opacity-50'}`}>
                  <td className="px-2 py-1.5">
                    <Badge className={SCOPE_CLS[p.scopeType]}>
                      {SCOPE_ICON[p.scopeType]} {MAIL_SCOPES[p.scopeType]}
                    </Badge>
                  </td>
                  <td className="px-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{p.scopeName || '-'}</div>
                    {p.title && <div className="text-[11px] text-slate-400">{p.title}</div>}
                  </td>
                  <td className="px-2 font-mono text-[11px]">{p.smtpHost ? `${p.smtpHost}:${p.smtpPort ?? 587}` : <span className="text-slate-400 font-sans">üst kapsamdan</span>}</td>
                  <td className="px-2">
                    {p.fromName && <div>{p.fromName}</div>}
                    <div className="text-[11px] text-slate-500">{p.fromAddress || p.smtpUser || '-'}</div>
                  </td>
                  <td className="px-2">{p.signature ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 text-[11px] text-slate-500">{fmtDateTime(p.updateDate)}</td>
                  <td className="px-2">
                    <div className="flex justify-end gap-0.5">
                      <button type="button" title="Düzenle" className="p-1 rounded hover:bg-slate-100 text-slate-500" onClick={() => setEditing(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title={p.smtpHost ? 'Test maili gönder' : 'SMTP yok'}
                        disabled={!p.smtpHost}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                        onClick={() => setTesting(p)}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Sil" className="p-1 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600" onClick={() => void remove(p)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* hangi kullanıcı hangi tanımı kullanır */}
      <div className="mt-3 rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">Kontrol: bu kullanıcı teklif gönderirse</span>
          <select className={`${inputCls} w-56`} value={checkUser || ''} onChange={(e) => setCheckUser(Number(e.target.value) || 0)}>
            <option value="">Kullanıcı seçin…</option>
            {refs.users.map((u) => (
              <option key={u.systemUserID} value={u.systemUserID}>
                {u.fullName || u.nickName}
              </option>
            ))}
          </select>
        </div>
        {resolved && (
          <div className="mt-2 text-[12px]">
            {resolved.profile ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={resolved.smtpReady ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                  {resolved.smtpReady ? 'SMTP hazır' : 'SMTP yok'}
                </Badge>
                <span>
                  Kullanılacak: <b>{resolved.source}</b>
                </span>
                {resolved.profile.smtpHost && <span className="font-mono text-[11px] text-slate-500">{resolved.profile.smtpHost}</span>}
                {resolved.profile.fromAddress && <span className="text-slate-500">· {resolved.profile.fromName ? `${resolved.profile.fromName} ` : ''}&lt;{resolved.profile.fromAddress}&gt;</span>}
              </div>
            ) : (
              <span className="text-amber-700">Bu kullanıcı için hiçbir kapsamda mail tanımı yok — yalnızca “Outlook'ta Aç” kullanılabilir.</span>
            )}
            <div className="mt-1 text-[11px] text-slate-400">Bakılan sıra: {resolved.chain.join('  →  ')}</div>
          </div>
        )}
      </div>

      {editing && (
        <ProfileModal
          initial={editing}
          refs={refs}
          usedKeys={usedKeys}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {testing && <TestModal profile={testing} onClose={() => setTesting(null)} />}
    </div>
  );
}
