import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Pencil, Plus, RefreshCw, Search, Star, Trash2, Users } from 'lucide-react';
import {
  ApprovalGroup,
  ApprovalGroupInput,
  deleteApprovalGroup,
  listApprovalGroups,
  listApprovalUsers,
  memberLabel,
  saveApprovalGroup,
  setDefaultApprovalGroup,
  SystemUserOption,
} from '../api/approvalGroupsApi';
import { appConfirm } from '../utils/appConfirm';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

const emptyForm = (): ApprovalGroupInput => ({
  code: '',
  name: '',
  description: '',
  isActive: true,
  sortOrder: 10,
  memberUserIds: [],
});

const inp = 'h-8 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';

/** Onay grupları: Yönetici / Alt Yönetici / Müdür … — onaya gönderirken seçilir, grubun herhangi bir üyesi onaylar */
export const ApprovalGroupsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [groups, setGroups] = useState<ApprovalGroup[]>([]);
  const [users, setUsers] = useState<SystemUserOption[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ApprovalGroupInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, u] = await Promise.all([listApprovalGroups(), listApprovalUsers()]);
      setReady(g.ready);
      setGroups(g.rows);
      setUsers(u);
      if (!g.ready && g.message) setMsg({ kind: 'err', text: g.message });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Onay grupları okunamadı' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ kind: 'ok', text: r.message });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'İşlem başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => {
    setEditId(null);
    setFormError(null);
    setUserSearch('');
    setForm({ ...emptyForm(), sortOrder: (groups.reduce((m, g) => Math.max(m, g.sortOrder), 0) || 0) + 10 });
  };

  const openEdit = (g: ApprovalGroup) => {
    setEditId(g.approvalGroupID);
    setFormError(null);
    setUserSearch('');
    setForm({
      code: g.code,
      name: g.name,
      description: g.description ?? '',
      isActive: g.isActive,
      sortOrder: g.sortOrder,
      memberUserIds: g.members.map((m) => m.systemUserID),
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) return setFormError('Ad zorunlu.');
    if (!form.code.trim()) return setFormError('Kod zorunlu.');
    if (form.isActive && form.memberUserIds.length === 0) return setFormError('Aktif grupta en az bir üye olmalı.');
    setBusy(true);
    setFormError(null);
    try {
      const r = await saveApprovalGroup(editId, form);
      setForm(null);
      setMsg({ kind: 'ok', text: r.message });
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g: ApprovalGroup) => {
    if (!(await appConfirm(`«${g.name}» onay grubu silinsin mi?`, { danger: true, okLabel: 'Sil' }))) return;
    await run(() => deleteApprovalGroup(g.approvalGroupID));
  };

  const toggleMember = (id: number) =>
    setForm((f) =>
      f
        ? {
            ...f,
            memberUserIds: f.memberUserIds.includes(id) ? f.memberUserIds.filter((x) => x !== id) : [...f.memberUserIds, id],
          }
        : f,
    );

  const filteredUsers = useMemo(() => {
    const s = userSearch.trim().toLocaleLowerCase('tr-TR');
    return users.filter(
      (u) =>
        (u.isActive || form?.memberUserIds.includes(u.systemUserID)) &&
        (!s || `${memberLabel(u)} ${u.nickName ?? ''}`.toLocaleLowerCase('tr-TR').includes(s)),
    );
  }, [users, userSearch, form?.memberUserIds]);

  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Onay Grupları</h2>
          <p className="text-[11px] text-slate-500">
            SYS_ApprovalGroup · onaya gönderirken grup seçilir; grubun herhangi bir üyesi onaylar ya da reddeder
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yenile
          </button>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={openNew}
            className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Yeni Grup
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {groups.length === 0 && !loading && ready && (
          <div className="text-[12px] text-slate-400">Henüz onay grubu yok — «Yeni Grup» ile ekleyin.</div>
        )}
        {groups.map((g) => (
          <section
            key={g.approvalGroupID}
            className={`rounded-sm border bg-white dark:bg-slate-900 flex flex-col ${g.isActive ? 'border-slate-300' : 'border-slate-200 opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-800 truncate">{g.name}</span>
                  {g.isDefault && (
                    <span className="px-1.5 py-px rounded-sm border text-[10px] bg-amber-50 text-amber-800 border-amber-200">Varsayılan</span>
                  )}
                  {!g.isActive && (
                    <span className="px-1.5 py-px rounded-sm border text-[10px] bg-slate-50 text-slate-500 border-slate-200">Pasif</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{g.code}</div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  title={g.isDefault ? 'Varsayılan grup' : 'Varsayılan yap'}
                  disabled={busy || g.isDefault || !g.isActive}
                  onClick={() => void run(() => setDefaultApprovalGroup(g.approvalGroupID))}
                  className="p-1 rounded-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                >
                  <Star className={`w-3.5 h-3.5 ${g.isDefault ? 'fill-amber-400 text-amber-500' : ''}`} />
                </button>
                <button type="button" title="Düzenle" onClick={() => openEdit(g)} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={g.openTaskCount > 0 ? 'Bekleyen onayı var' : 'Sil'}
                  disabled={busy || g.openTaskCount > 0}
                  onClick={() => void remove(g)}
                  className="p-1 rounded-sm text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="px-3 py-2 space-y-1.5 flex-1">
              {g.description && <p className="text-[11px] text-slate-500">{g.description}</p>}
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Users className="w-3 h-3" /> {g.members.length} üye
                {g.openTaskCount > 0 && <span className="ml-auto text-amber-700">{g.openTaskCount} bekleyen onay</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {g.members.length === 0 ? (
                  <span className="text-[11px] text-red-600">Üye yok — bu gruba gönderilemez</span>
                ) : (
                  g.members.map((m) => (
                    <span key={m.systemUserID} className="px-1.5 py-px rounded-sm bg-blue-50 text-blue-800 text-[11px]" title={m.nickName ?? ''}>
                      {memberLabel(m)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Ekle / düzenle */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={() => !busy && setForm(null)}>
          <div className="w-full max-w-lg rounded-md bg-white shadow-xl p-5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">{editId ? 'Onay Grubunu Düzenle' : 'Yeni Onay Grubu'}</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 block space-y-1">
                <span className="text-[12px] text-slate-600">Ad*</span>
                <input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            name,
                            // Yeni grupta kod addan önerilir
                            code: editId ? f.code : name
                              .toLocaleUpperCase('tr-TR')
                              .replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ü/g, 'U')
                              .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
                              .slice(0, 40),
                          }
                        : f,
                    );
                  }}
                  placeholder="Örn. Müdür"
                  className={`${inp} w-full`}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-slate-600">Kod*</span>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  maxLength={40}
                  className={`${inp} w-full font-mono`}
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Açıklama</span>
              <input
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={500}
                className={`${inp} w-full`}
              />
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                Sıra
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                  className={`${inp} w-20`}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Aktif
              </label>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-600">Üyeler* · {form.memberUserIds.length} seçili</span>
                <div className="relative">
                  <Search className="absolute left-1.5 top-1.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Kullanıcı ara"
                    className="w-44 h-7 pl-6 pr-2 text-[12px] rounded-sm border border-slate-300 bg-white"
                  />
                </div>
              </div>
              <ul className="max-h-56 overflow-y-auto rounded-sm border border-slate-200 divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <li className="px-2 py-2 text-[12px] text-slate-400">
                    {users.length === 0 ? 'Sistemde kullanıcı yok.' : 'Eşleşen kullanıcı yok.'}
                  </li>
                ) : (
                  filteredUsers.map((u) => (
                    <li key={u.systemUserID}>
                      <label className="flex items-center gap-2 px-2 py-1.5 text-[12px] cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={form.memberUserIds.includes(u.systemUserID)}
                          onChange={() => toggleMember(u.systemUserID)}
                        />
                        <span className="text-slate-800">{memberLabel(u)}</span>
                        {u.nickName && <span className="text-[11px] text-slate-400">@{u.nickName}</span>}
                        {!u.isActive && <span className="text-[10px] text-slate-400">(pasif kullanıcı)</span>}
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {formError && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{formError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setForm(null)}
                className="px-3 h-8 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" /> Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
