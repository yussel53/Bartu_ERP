import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  ProcessDef,
  ProcessInstance,
  ProcessTask,
  approveProcessTask,
  egovPdfUrl,
  linkEgov,
  deleteProcessDef,
  listProcessDefs,
  listProcessInbox,
  listProcessInstances,
  rejectProcessTask,
  transferTalep,
  uploadEgovPdf,
} from '../api/processApi';
import { listRoles, type Role } from '../api/rolesApi';
import { getCurrentUserId } from '../data/permissions';
import { appConfirm } from '../utils/appConfirm';

type TabKey = 'inbox' | 'defs' | 'instances' | 'actions';

interface ProcessManagementPageProps {
  onBack: () => void;
  /** inbox | defs | instances | actions */
  initialTab?: TabKey;
}

const TRIGGER_LABEL: Record<number, string> = {
  1: 'Manuel',
  2: 'Fiş kaydedilince',
  3: 'e-Belge gelince',
  4: 'Aktarım',
  5: 'Kart kaydedilince',
  6: 'Yinelemeli',
  7: 'E-posta kontrol',
  8: 'DB tarama',
};

export const ProcessManagementPage: React.FC<ProcessManagementPageProps> = ({
  onBack,
  initialTab = 'inbox',
}) => {
  const userId = Number(getCurrentUserId()) || 1;
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [inbox, setInbox] = useState<ProcessTask[]>([]);
  const [defs, setDefs] = useState<ProcessDef[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [comment, setComment] = useState('');

  // Aktarım / bağlama formları
  const [talepId, setTalepId] = useState('');
  const [egovId, setEgovId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [pdfEgovId, setPdfEgovId] = useState('');

  const reload = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [ib, df, inst, rl] = await Promise.all([
        listProcessInbox(userId),
        listProcessDefs(true),
        listProcessInstances(),
        listRoles().catch(() => [] as Role[]),
      ]);
      setInbox(ib);
      setDefs(df);
      setInstances(inst);
      setRoles(rl);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Süreç verileri okunamadı' });
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const tabs = useMemo(
    () =>
      [
        { key: 'inbox' as const, label: `Onay kuyruğum (${inbox.length})` },
        { key: 'defs' as const, label: 'Süreç tanımları' },
        { key: 'instances' as const, label: 'Süreç örnekleri' },
        { key: 'actions' as const, label: 'Aktarım / e-Belge' },
      ] as const,
    [inbox.length],
  );

  const onApprove = async (taskId: number) => {
    setBusy(true);
    try {
      await approveProcessTask(taskId, userId, comment || undefined);
      setComment('');
      setMsg({ kind: 'ok', text: 'Görev onaylandı.' });
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Onay başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const onReject = async (taskId: number) => {
    setBusy(true);
    try {
      await rejectProcessTask(taskId, userId, comment || undefined);
      setComment('');
      setMsg({ kind: 'ok', text: 'Görev reddedildi.' });
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Red başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const onDeleteDef = async (def: ProcessDef) => {
    const ok = await appConfirm(
      `«${def.name}» silinsin mi? Adımları, süren örnekleri ve onay görevleri de silinir.`,
      { title: 'Süreç sil', okLabel: 'Sil', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteProcessDef(def.processDefID);
      setMsg({ kind: 'ok', text: 'Süreç silindi.' });
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Silinemedi' });
    } finally {
      setBusy(false);
    }
  };

  const onTransfer = async () => {
    const id = Number(talepId);
    if (!id) {
      setMsg({ kind: 'err', text: 'Talep OrderVoucherID girin.' });
      return;
    }
    setBusy(true);
    try {
      const res = await transferTalep({
        talepOrderVoucherId: id,
        startedBy: userId,
        comment: comment || undefined,
        requireApproval: true,
      });
      setMsg({
        kind: 'ok',
        text: `Talep #${id} → Sipariş #${res.orderVoucherId} oluşturuldu; onay kuyruğuna düştü.`,
      });
      setTalepId('');
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Aktarım başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const onLink = async () => {
    const eId = Number(egovId);
    const oId = Number(orderId);
    if (!eId || !oId) {
      setMsg({ kind: 'err', text: 'e-Belge ve sipariş/talep ID gerekli.' });
      return;
    }
    setBusy(true);
    try {
      await linkEgov({
        eGovDocumentId: eId,
        orderVoucherId: oId,
        startedBy: userId,
        comment: comment || undefined,
        startProcess: true,
      });
      setMsg({ kind: 'ok', text: `e-Belge #${eId} → Sipariş/Talep #${oId} bağlandı; onay kuyruğuna düştü.` });
      setEgovId('');
      setOrderId('');
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Bağlama başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const onPdf = async (file: File | null) => {
    const id = Number(pdfEgovId);
    if (!id || !file) {
      setMsg({ kind: 'err', text: 'e-Belge ID ve PDF seçin.' });
      return;
    }
    setBusy(true);
    try {
      await uploadEgovPdf(id, file);
      setMsg({ kind: 'ok', text: `PDF kaydedildi (e-Belge #${id}).` });
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'PDF yüklenemedi' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h2 className="text-[15px] font-semibold text-slate-800">Süreç Yönetimi</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Talep → sipariş · e-Fatura / e-İrsaliye bağlama · PDF saklama · onay kuyruğu
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Yenile
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-md border px-3 py-2 text-[12px] ${
            msg.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md border border-b-0 ${
              tab === t.key
                ? 'bg-white border-slate-200 text-slate-900 -mb-px'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'inbox' || tab === 'actions') && (
        <label className="block text-[12px] text-slate-600 max-w-xl">
          Onay / red notu
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
            placeholder="İsteğe bağlı açıklama"
          />
        </label>
      )}

      {tab === 'inbox' && (
        <div className="space-y-2">
          {inbox.length === 0 ? (
            <p className="text-[12px] text-slate-500 py-6">Önünüzde bekleyen onay görevi yok.</p>
          ) : (
            inbox.map((t) => (
              <div
                key={t.processTaskID}
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">
                      {t.instanceTitle || t.processName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {t.processName} · {t.stepTitle} ({t.actionType})
                      {t.sourceTable ? ` · ${t.sourceTable}#${t.sourceId}` : ''}
                      {t.targetId ? ` → ${t.targetTable}#${t.targetId}` : ''}
                    </div>
                    {(t.documentNo || t.customerTitle) && (
                      <div className="text-[11px] text-slate-600 mt-1">
                        {t.documentNo && <span className="mr-2">Belge: {t.documentNo}</span>}
                        {t.customerTitle && <span className="mr-2">{t.customerTitle}</span>}
                        {t.amount != null && <span>{Number(t.amount).toLocaleString('tr-TR')} ₺</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.hasPdf && t.sourceId && (
                      <a
                        href={egovPdfUrl(t.sourceId)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <FileText className="w-3.5 h-3.5" /> PDF
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onApprove(t.processTaskID)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Onayla
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onReject(t.processTaskID)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reddet
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'defs' && (
        <div className="space-y-3">
          {defs.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              Süreç tanımı yok. Veritabanı Güncelleme ile <code>67_process_management.sql</code> uygulayın.
            </p>
          ) : (
            defs.map((d) => (
              <div key={d.processDefID} className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-[13px] font-semibold text-slate-800">{d.name}</span>
                    <span className="ml-2 text-[11px] font-mono text-slate-400">{d.code}</span>
                  </div>
                  <span className="flex items-center gap-2 text-[11px] text-slate-500">
                    {TRIGGER_LABEL[d.triggerType] || `Tetik ${d.triggerType}`}
                    {!d.isActive && ' · Pasif'}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onDeleteDef(d)}
                      className="rounded border border-rose-200 px-2 py-0.5 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Sil
                    </button>
                  </span>
                </div>
                {d.description && <p className="text-[12px] text-slate-500 mt-1">{d.description}</p>}
                <ol className="mt-2 space-y-1">
                  {d.steps.map((s) => (
                    <li key={s.processStepID} className="text-[12px] text-slate-700 flex gap-2">
                      <span className="text-slate-400 w-5">{s.stepNo}.</span>
                      <span className="font-medium">{s.title}</span>
                      <span className="text-slate-400">
                        · {s.nodeType || s.actionType}
                      </span>
                      <span className="text-slate-500">
                        →{' '}
                        {s.approverRoleName ||
                          (s.approverRoleId
                            ? roles.find((r) => r.id === s.approverRoleId)?.name || `Rol #${s.approverRoleId}`
                            : s.approverUserId
                              ? `Kullanıcı #${s.approverUserId}`
                              : 'Herkes / admin')}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-slate-400">
                  Düzenlemek için: Süreç Yönetimi → Ana Kayıtlar → Süreçler
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'instances' && (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-medium px-3 py-2">ID</th>
                <th className="text-left font-medium px-3 py-2">Süreç</th>
                <th className="text-left font-medium px-3 py-2">Başlık</th>
                <th className="text-left font-medium px-3 py-2">Kaynak</th>
                <th className="text-left font-medium px-3 py-2">Hedef</th>
                <th className="text-left font-medium px-3 py-2">Durum</th>
                <th className="text-left font-medium px-3 py-2">Başlangıç</th>
              </tr>
            </thead>
            <tbody>
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-slate-500 text-center">
                    Henüz süreç örneği yok.
                  </td>
                </tr>
              ) : (
                instances.map((i) => (
                  <tr key={i.processInstanceID} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-slate-500">{i.processInstanceID}</td>
                    <td className="px-3 py-1.5">{i.processName}</td>
                    <td className="px-3 py-1.5">{i.title}</td>
                    <td className="px-3 py-1.5">
                      {i.sourceTable}#{i.sourceId}
                    </td>
                    <td className="px-3 py-1.5">
                      {i.targetId ? `${i.targetTable}#${i.targetId}` : '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {i.startedAt ? new Date(i.startedAt).toLocaleString('tr-TR') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'actions' && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
            <h3 className="text-[13px] font-semibold text-slate-800">Talep → Sipariş aktarımı</h3>
            <p className="text-[11px] text-slate-500">
              Type_ = 5 (Alış Talep) veya 6 (Satış Talep) olan OrderVoucher kaydını siparişe kopyalar ve{' '}
              <code>TALEP_TO_ORDER</code> sürecini başlatır.
            </p>
            <label className="block text-[12px] text-slate-600">
              Talep OrderVoucherID
              <input
                value={talepId}
                onChange={(e) => setTalepId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                placeholder="örn. 12"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onTransfer()}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" /> Aktar ve onaya gönder
            </button>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
            <h3 className="text-[13px] font-semibold text-slate-800">e-Fatura / e-İrsaliye bağlama</h3>
            <p className="text-[11px] text-slate-500">
              Gelen e-belgeyi sipariş veya talebe bağlar; PDF varsa onaycı PDF’i görür.
            </p>
            <label className="block text-[12px] text-slate-600">
              EGovDocumentID
              <input
                value={egovId}
                onChange={(e) => setEgovId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
              />
            </label>
            <label className="block text-[12px] text-slate-600">
              Sipariş / Talep OrderVoucherID
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onLink()}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" /> Bağla ve onaya gönder
            </button>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-3 space-y-2 md:col-span-2">
            <h3 className="text-[13px] font-semibold text-slate-800">e-Belge PDF kaydet (DB)</h3>
            <p className="text-[11px] text-slate-500">
              PDF <code>EGovDocument.PdfContent</code> alanına yazılır; onay kuyruğunda açılabilir.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-[12px] text-slate-600">
                EGovDocumentID
                <input
                  value={pdfEgovId}
                  onChange={(e) => setPdfEgovId(e.target.value)}
                  className="mt-1 w-40 rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5" />
                PDF seç
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => void onPdf(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'Approved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'Rejected'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : status === 'InProgress' || status === 'Pending'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {status}
    </span>
  );
}
