import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Eye, FileUp, Pencil, Plus, RefreshCw, Replace, Trash2, Upload, X } from 'lucide-react';
import {
  createEGovDesignRule,
  deleteEGovDesign,
  deleteEGovDesignRule,
  egovDesignDownloadUrl,
  EGovDesignRow,
  EGovDesignRuleInput,
  EGovDesignRuleRow,
  listEGovDesignRules,
  listEGovDesigns,
  previewEGovDesign,
  replaceEGovDesignContent,
  updateEGovDesign,
  updateEGovDesignRule,
  uploadEGovDesign,
  EGOV_DESIGN_GROUPS,
  egovDesignGroupLabel,
  egovDocTypeGroup,
  guessEGovDesignGroup,
  loadStandardEGovDesigns,
  detectEGovDesignGroups,
  isDocGroupMismatch,
} from '../api/egovDesignApi';
import {
  EGovDesignDocTypes,
  EGovDesignRuleDefault,
  EGovDesignRuleTypes,
  egovDesignSampleKind,
} from '../data/egovTypes';
import { appConfirm } from '../utils/appConfirm';

const docTypeLabel = (v: number) => EGovDesignDocTypes.find((d) => d.value === v)?.label ?? `#${v}`;
const ruleTypeLabel = (v: number) => EGovDesignRuleTypes.find((d) => d.value === v)?.label ?? `#${v}`;
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('tr-TR') : '');
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const PRIORITIES = Array.from({ length: 10 }, (_, i) => i + 1);
const SAMPLES = [
  { value: '', label: 'Örnek: otomatik' },
  { value: 'invoice', label: 'Örnek: e-Fatura' },
  { value: 'earsiv', label: 'Örnek: e-Arşiv' },
  { value: 'despatch', label: 'Örnek: e-İrsaliye' },
];

type Msg = { kind: 'ok' | 'err'; text: string } | null;
type Tab = 'rules' | 'designs';

const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
const td = 'px-2 py-1 border-b border-r border-slate-200 whitespace-nowrap';
const inp = 'h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';
const iconBtn = 'p-1 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30';
const btnPrimary =
  'inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40';

const emptyRule = (docType: number | null): EGovDesignRuleInput => ({
  docType: docType ?? 0,
  ruleType: 0,
  ruleValue: '',
  priority: 1,
  eGovXsltDesignID: 0,
  description: '',
  isActive: true,
});

/** E-Devlet → Tanımlar → Tasarım Şablonları: XSLT tasarımları + hangi belgede hangi tasarımın kullanılacağı */
export const EGovDesignTemplatesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('rules');
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(true);

  const [designs, setDesigns] = useState<EGovDesignRow[]>([]);
  const [rules, setRules] = useState<EGovDesignRuleRow[]>([]);
  const [docFilter, setDocFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Şablon penceresi
  const [ruleForm, setRuleForm] = useState<EGovDesignRuleInput | null>(null);
  const [ruleEditId, setRuleEditId] = useState<number | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Tasarım yükleme / düzenleme
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<number | null>(null);
  const [designEdit, setDesignEdit] = useState<{ id: number; title: string; isActive: boolean; docGroup: string } | null>(null);
  const [uploadGroup, setUploadGroup] = useState('EFATURA');
  // Seçilen dosyanın içerikten anlaşılan belge grupları (null: henüz bakılmadı / anlaşılamadı)
  const [detected, setDetected] = useState<string[] | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Önizleme
  const [preview, setPreview] = useState<{ designId: number; title: string } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSample, setPreviewSample] = useState('');
  const [previewDocId, setPreviewDocId] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([listEGovDesigns(), listEGovDesignRules(docFilter)]);
      setReady(d.ready && r.ready);
      setDesigns(d.rows);
      setRules(r.rows);
      if (!d.ready && d.message) setMsg({ kind: 'err', text: d.message });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Tasarım şablonları okunamadı' });
    } finally {
      setLoading(false);
    }
  }, [docFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<{ message?: string } | unknown>, okText?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await fn()) as { message?: string } | undefined;
      setMsg({ kind: 'ok', text: okText || r?.message || 'Kaydedildi' });
      await load();
      return true;
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'İşlem başarısız' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** İçerikle uyuşmayan belge grubu: sunucu 409 döner, kullanıcı onaylarsa force ile yeniden gönderilir */
  const withForce = async <T,>(call: (force: boolean) => Promise<T>): Promise<T> => {
    try {
      return await call(false);
    } catch (e) {
      if (!isDocGroupMismatch(e)) throw e;
      const ok = await appConfirm(`${e.message} Yine de kaydedilsin mi?`, { okLabel: 'Yine de kaydet', danger: true });
      if (!ok) throw new Error('Kaydedilmedi: belge türü içerikle uyuşmuyor.');
      return await call(true);
    }
  };

  const onPickFile = async (f: File | null) => {
    setFile(f);
    setDetected(null);
    if (!f) return;
    if (!title.trim()) setTitle(f.name);
    setUploadGroup(guessEGovDesignGroup(f.name));
    setDetecting(true);
    try {
      const r = await detectEGovDesignGroups(f);
      setDetected(r.groups);
      setUploadGroup(r.suggested);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'XSLT incelenemedi' });
    } finally {
      setDetecting(false);
    }
  };

  const renderPreview = useCallback(
    async (designId: number, designTitle: string, sample = previewSample, docIdText = previewDocId) => {
      setPreview({ designId, title: designTitle });
      setPreviewBusy(true);
      setPreviewError(null);
      try {
        const docId = Number(docIdText.trim());
        setPreviewHtml(
          await previewEGovDesign(designId, {
            sample: sample || null,
            egovDocumentId: Number.isFinite(docId) && docId > 0 ? docId : null,
          }),
        );
      } catch (e) {
        setPreviewHtml(null);
        setPreviewError(e instanceof Error ? e.message : 'Önizleme oluşturulamadı');
      } finally {
        setPreviewBusy(false);
        window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    },
    [previewSample, previewDocId],
  );

  // ─── Şablonlar ───────────────────────────────────────────────────────────
  const openNewRule = () => {
    setRuleEditId(null);
    setRuleError(null);
    setRuleForm(emptyRule(docFilter));
  };

  const openEditRule = (r: EGovDesignRuleRow) => {
    setRuleEditId(r.eGovDesignRuleID);
    setRuleError(null);
    setRuleForm({
      docType: r.docType,
      ruleType: r.ruleType,
      ruleValue: r.ruleValue ?? '',
      priority: r.priority,
      eGovXsltDesignID: r.eGovXsltDesignID,
      description: r.description ?? '',
      isActive: r.isActive,
    });
  };

  const saveRule = async () => {
    if (!ruleForm) return;
    const f = ruleForm;
    if (!f.docType) return setRuleError('Belge türü seçin.');
    if (!f.ruleType) return setRuleError('Şablon tipi seçin.');
    if (f.ruleType !== EGovDesignRuleDefault && !f.ruleValue?.trim()) return setRuleError('Değer zorunlu.');
    if (!f.eGovXsltDesignID) return setRuleError('Tasarım seçin.');
    setBusy(true);
    setRuleError(null);
    try {
      const body = { ...f, ruleValue: f.ruleType === EGovDesignRuleDefault ? null : f.ruleValue?.trim() };
      const r = ruleEditId ? await updateEGovDesignRule(ruleEditId, body) : await createEGovDesignRule(body);
      setRuleForm(null);
      setMsg({ kind: 'ok', text: r.message || 'Kaydedildi' });
      await load();
    } catch (e) {
      setRuleError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (r: EGovDesignRuleRow) => {
    const what = r.ruleType === EGovDesignRuleDefault ? 'Öndeğer' : `${ruleTypeLabel(r.ruleType)} = ${r.ruleValue}`;
    if (!(await appConfirm(`${docTypeLabel(r.docType)} · ${what} şablonu silinsin mi?`, { danger: true, okLabel: 'Sil' }))) return;
    await run(() => deleteEGovDesignRule(r.eGovDesignRuleID));
  };

  // Alan değişince eski uyarı kalksın
  useEffect(() => {
    setRuleError(null);
  }, [ruleForm]);

  // Pencerede seçilebilecek tasarımlar: şablonun belge türüne ait aktifler + düzenlenen kaydın mevcut tasarımı
  const ruleGroup = ruleForm ? egovDocTypeGroup(ruleForm.docType) : null;
  const designOptions = useMemo(
    () =>
      designs.filter(
        (d) =>
          (!ruleGroup || !d.docGroup || d.docGroup === ruleGroup) &&
          (d.isActive || d.eGovXsltDesignID === ruleForm?.eGovXsltDesignID),
      ),
    [designs, ruleGroup, ruleForm?.eGovXsltDesignID],
  );
  // Belge türü değişince başka gruba ait seçili tasarım bırakılır
  useEffect(() => {
    if (!ruleForm?.eGovXsltDesignID) return;
    if (!designOptions.some((d) => d.eGovXsltDesignID === ruleForm.eGovXsltDesignID))
      setRuleForm((f) => (f ? { ...f, eGovXsltDesignID: 0 } : f));
  }, [designOptions, ruleForm?.eGovXsltDesignID]);

  // ─── Tasarımlar ──────────────────────────────────────────────────────────
  const upload = async () => {
    if (!file) return;
    const ok = await run(() => withForce((force) => uploadEGovDesign(file, title, uploadGroup, force)));
    if (ok) {
      setFile(null);
      setDetected(null);
      setTitle('');
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const loadStandard = async () => {
    const ok = await appConfirm(
      'GİB standart görünümleri (e-Fatura, e-Arşiv, e-İrsaliye) tasarım kütüphanesine eklensin mi? Zaten yüklü olanlar atlanır; mevcut şablonlarınız değişmez.',
      { okLabel: 'Yükle' },
    );
    if (ok) await run(() => loadStandardEGovDesigns());
  };

  const saveDesignEdit = async () => {
    if (!designEdit) return;
    const ok = await run(() =>
      withForce((force) =>
        updateEGovDesign(designEdit.id, { title: designEdit.title, isActive: designEdit.isActive, docGroup: designEdit.docGroup, force }),
      ),
    );
    if (ok) setDesignEdit(null);
  };

  const removeDesign = async (d: EGovDesignRow) => {
    if (!(await appConfirm(`«${d.title}» tasarımı silinsin mi?`, { danger: true, okLabel: 'Sil' }))) return;
    await run(() => deleteEGovDesign(d.eGovXsltDesignID));
    if (preview?.designId === d.eGovXsltDesignID) {
      setPreview(null);
      setPreviewHtml(null);
    }
  };

  const onReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || replaceId == null) return;
    const id = replaceId;
    setReplaceId(null);
    const ok = await run(() => withForce((force) => replaceEGovDesignContent(id, f, force)));
    if (ok && preview?.designId === id) await renderPreview(id, preview.title);
  };

  const tabBtn = (t: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`px-3 h-7 text-[12px] font-medium border-r last:border-r-0 border-slate-300 ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tasarım Şablonları</h2>
          <p className="text-[11px] text-slate-500">
            EGovDesignRule · EGovXsltDesign · belgeyle eşleşen şablonlardan önceliği en küçük olan → yoksa Öndeğer → yoksa e-Logo varsayılanı
          </p>
        </div>
        <div className="inline-flex rounded-sm border border-slate-300 bg-white overflow-hidden">
          {tabBtn('rules', 'Şablonlar', rules.length)}
          {tabBtn('designs', 'Tasarımlar', designs.length)}
        </div>
      </div>

      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {tab === 'rules' ? (
        <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
            <select
              value={docFilter ?? ''}
              onChange={(e) => setDocFilter(e.target.value ? Number(e.target.value) : null)}
              className={inp}
            >
              <option value="">Tüm belge türleri</option>
              {EGovDesignDocTypes.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Yenile
              </button>
              <button type="button" disabled={!ready || busy} onClick={openNewRule} className={btnPrimary}>
                <Plus className="w-3.5 h-3.5" /> Yeni Şablon
              </button>
            </div>
          </div>
          {designs.length === 0 && ready && (
            <div className="mx-2.5 mt-2 rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
              Önce «Tasarımlar» sekmesinden en az bir XSLT tasarımı yükleyin.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className={th}>İşlem</th>
                  <th className={th}>Belge Türü</th>
                  <th className={th}>Şablon Tipi</th>
                  <th className={th}>Değer</th>
                  <th className={th}>Öncelik</th>
                  <th className={th}>Tasarım</th>
                  <th className={th}>Açıklama</th>
                  <th className={th}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                      {loading ? 'Yükleniyor…' : 'Şablon yok — belgeler e-Logo varsayılan tasarımıyla gönderilir.'}
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr
                      key={r.eGovDesignRuleID}
                      onDoubleClick={() => openEditRule(r)}
                      className={`hover:bg-blue-50/30 ${r.isActive ? '' : 'text-slate-400'}`}
                    >
                      <td className={`${td} py-0.5`}>
                        <div className="flex items-center gap-0.5">
                          <button type="button" title="Düzenle" onClick={() => openEditRule(r)} className={iconBtn}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Tasarımı önizle"
                            onClick={() => {
                              const s = egovDesignSampleKind(r.docType);
                              setPreviewSample(s);
                              void renderPreview(r.eGovXsltDesignID, r.designTitle || '', s);
                            }}
                            className={iconBtn}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title="Sil" disabled={busy} onClick={() => void removeRule(r)} className={`${iconBtn} hover:text-red-600`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className={`${td} font-medium`}>{docTypeLabel(r.docType)}</td>
                      <td className={td}>{ruleTypeLabel(r.ruleType)}</td>
                      <td className={td}>{r.ruleType === EGovDesignRuleDefault ? <span className="text-slate-400">—</span> : r.ruleValue}</td>
                      <td className={`${td} text-center`}>{r.priority}</td>
                      <td className={td}>
                        {r.designTitle}
                        {!r.designActive && <span className="ml-1 text-[10px] text-amber-700">(pasif tasarım)</span>}
                      </td>
                      <td className={`${td} max-w-[260px] truncate`} title={r.description ?? ''}>
                        {r.description}
                      </td>
                      <td className={td}>{r.isActive ? 'Aktif' : 'Pasif'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-2.5 py-2 bg-slate-50 border-b border-slate-300">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold text-slate-700 mr-1">Tasarım yükle</span>
              <input
                ref={fileInput}
                type="file"
                accept=".xslt,.xsl"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                className="text-[12px] file:mr-2 file:h-7 file:px-2 file:rounded-sm file:border file:border-slate-300 file:bg-white file:text-[12px]"
              />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tasarım adı" className={`${inp} w-64`} />
              <label className="inline-flex items-center gap-1 text-[12px] text-slate-600">
                Belge türü
                <select value={uploadGroup} onChange={(e) => setUploadGroup(e.target.value)} className={inp} title="Tasarım hangi belge türünün şablonlarında seçilebilsin">
                  {EGOV_DESIGN_GROUPS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              {detecting && <span className="text-[11px] text-slate-400">İçerik inceleniyor…</span>}
              {!detecting && detected && detected.length > 0 && (
                <span className={`text-[11px] ${detected.includes(uploadGroup) ? 'text-emerald-700' : 'text-amber-700 font-medium'}`}>
                  İçerikten: {detected.map((g) => egovDesignGroupLabel(g)).join(' / ')}
                  {detected.includes(uploadGroup) ? ' ✓' : ' — seçilen türle uyuşmuyor'}
                </span>
              )}
              <button type="button" disabled={busy || !ready || !file} onClick={() => void upload()} className={btnPrimary}>
                <Upload className="w-3.5 h-3.5" /> Yükle
              </button>
              <button
                type="button"
                disabled={busy || !ready}
                onClick={() => void loadStandard()}
                title="GİB UBL-TR paketindeki standart e-Fatura / e-Arşiv / e-İrsaliye görünümlerini ekler"
                className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 text-[12px] font-medium rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" /> Standart şablonları yükle
              </button>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Yenile
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              .xslt / .xsl · en fazla 5 MB · yüklenirken derlenir ve örnek belgede denenir. XSLT içinde msxsl:script ve dış dosya erişimi kabul edilmez; önizleme yalıtılmış çerçevede çalışır.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className={th}>İşlem</th>
                  <th className={th}>Tasarım</th>
                  <th className={th}>Belge Türü</th>
                  <th className={th}>Dosya</th>
                  <th className={th}>Şablon</th>
                  <th className={th}>Durum</th>
                  <th className={th}>Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {designs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                      {loading ? 'Yükleniyor…' : 'Henüz tasarım yüklenmedi.'}
                    </td>
                  </tr>
                ) : (
                  designs.map((d) => {
                    const id = d.eGovXsltDesignID;
                    const editing = designEdit?.id === id;
                    return (
                      <tr key={id} className={`${preview?.designId === id ? 'bg-blue-50/60' : 'hover:bg-blue-50/30'} ${d.isActive ? '' : 'text-slate-400'}`}>
                        <td className={`${td} py-0.5`}>
                          {editing ? (
                            <div className="flex items-center gap-0.5">
                              <button type="button" title="Kaydet" disabled={busy || !designEdit.title.trim()} onClick={() => void saveDesignEdit()} className={iconBtn}>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                              <button type="button" title="Vazgeç" onClick={() => setDesignEdit(null)} className={iconBtn}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button type="button" title="Önizle" onClick={() => void renderPreview(id, d.title)} className={iconBtn}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" title="Düzenle" onClick={() => setDesignEdit({ id, title: d.title, isActive: d.isActive, docGroup: d.docGroup ?? 'EFATURA' })} className={iconBtn}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Dosyayı değiştir"
                                disabled={busy}
                                onClick={() => {
                                  setReplaceId(id);
                                  replaceInput.current?.click();
                                }}
                                className={iconBtn}
                              >
                                <Replace className="w-3.5 h-3.5" />
                              </button>
                              <a href={egovDesignDownloadUrl(id)} title="İndir" className={iconBtn}>
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                title={d.ruleCount > 0 ? 'Şablonlarda kullanılıyor' : 'Sil'}
                                disabled={busy || d.ruleCount > 0}
                                onClick={() => void removeDesign(d)}
                                className={`${iconBtn} hover:text-red-600`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className={td}>
                          {editing ? (
                            <input value={designEdit.title} onChange={(e) => setDesignEdit({ ...designEdit, title: e.target.value })} className={`${inp} w-64`} />
                          ) : (
                            <span className="font-medium">{d.title}</span>
                          )}
                        </td>
                        <td className={td}>
                          {editing ? (
                            <select
                              value={designEdit.docGroup}
                              onChange={(e) => setDesignEdit({ ...designEdit, docGroup: e.target.value })}
                              className={inp}
                            >
                              {EGOV_DESIGN_GROUPS.map((g) => (
                                <option key={g.value} value={g.value}>
                                  {g.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            egovDesignGroupLabel(d.docGroup)
                          )}
                        </td>
                        <td className={`${td} text-[11px] text-slate-500`} title={d.contentHash ? `SHA-256 ${d.contentHash}` : ''}>
                          {d.fileName} · {fmtSize(d.contentLength)}
                        </td>
                        <td className={`${td} text-center`}>{d.ruleCount}</td>
                        <td className={td}>
                          {editing ? (
                            <label className="inline-flex items-center gap-1 text-[12px]">
                              <input type="checkbox" checked={designEdit.isActive} onChange={(e) => setDesignEdit({ ...designEdit, isActive: e.target.checked })} />
                              Aktif
                            </label>
                          ) : d.isActive ? (
                            'Aktif'
                          ) : (
                            'Pasif'
                          )}
                        </td>
                        <td className={`${td} text-[11px] text-slate-500`}>{fmtDateTime(d.updatedAt || d.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <input ref={replaceInput} type="file" accept=".xslt,.xsl" className="hidden" onChange={(e) => void onReplaceFile(e)} />
        </section>
      )}

      {/* Önizleme (iki sekme ortak) */}
      <section ref={previewRef} className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 flex flex-col h-[1000px]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
          <span className="text-[12px] font-semibold text-slate-700">Önizleme{preview ? ` · ${preview.title}` : ''}</span>
          <div className="flex items-center gap-1">
            <select value={previewSample} onChange={(e) => setPreviewSample(e.target.value)} className={inp}>
              {SAMPLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              value={previewDocId}
              onChange={(e) => setPreviewDocId(e.target.value.replace(/\D/g, ''))}
              placeholder="e-Belge ID (boş = örnek)"
              title="Kayıtlı bir e-belgenin UBL'i ile önizlemek için EGovDocument ID girin"
              className={`${inp} w-40`}
            />
            <button
              type="button"
              disabled={!preview || previewBusy}
              onClick={() => preview && void renderPreview(preview.designId, preview.title)}
              className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${previewBusy ? 'animate-spin' : ''}`} /> Oluştur
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
          {previewError ? (
            <div className="m-3 rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{previewError}</div>
          ) : previewHtml != null ? (
            // allow-scripts (QR kod çizimi için) ama allow-same-origin YOK → script ayrı/opak kökende çalışır,
            // uygulama sayfasına, çerezlere ve depolamaya erişemez; yönlendirme ve açılır pencere de kapalı
            <iframe title="Tasarım önizleme" sandbox="allow-scripts" srcDoc={previewHtml} className="absolute inset-0 w-full h-full bg-white" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[12px] text-slate-400">
              <FileUp className="w-6 h-6" />
              <span>
                Bir şablonun ya da tasarımın <Eye className="inline w-3 h-3 -mt-0.5" /> düğmesine basın — örnek belge üzerinde gösterilir.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Yeni / düzenle şablon penceresi */}
      {ruleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={() => !busy && setRuleForm(null)}>
          <div className="w-full max-w-md rounded-md bg-white shadow-xl p-5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">{ruleEditId ? 'Şablonu Düzenle' : 'Yeni Şablon Ekleme'}</h3>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Belge Türü*</span>
              <select
                value={ruleForm.docType || ''}
                onChange={(e) => setRuleForm({ ...ruleForm, docType: Number(e.target.value) })}
                className={`${inp} w-full h-8`}
              >
                <option value="">Belge Türü*</option>
                {EGovDesignDocTypes.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Şablon Tipi*</span>
              <select
                value={ruleForm.ruleType || ''}
                onChange={(e) => setRuleForm({ ...ruleForm, ruleType: Number(e.target.value) })}
                className={`${inp} w-full h-8`}
              >
                <option value="">Şablon Tipi*</option>
                {EGovDesignRuleTypes.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Değer{ruleForm.ruleType === EGovDesignRuleDefault ? '' : '*'}</span>
              <input
                value={ruleForm.ruleType === EGovDesignRuleDefault ? '' : ruleForm.ruleValue ?? ''}
                disabled={ruleForm.ruleType === EGovDesignRuleDefault}
                onChange={(e) => setRuleForm({ ...ruleForm, ruleValue: e.target.value })}
                placeholder={ruleForm.ruleType === EGovDesignRuleDefault ? 'Öndeğer şablonunda değer girilmez' : 'Değer*'}
                maxLength={100}
                className={`${inp} w-full h-8 disabled:bg-slate-100 disabled:text-slate-400`}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Öncelik*</span>
              <select
                value={ruleForm.priority}
                onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })}
                className={`${inp} w-full h-8`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Tasarım*</span>
              <select
                value={ruleForm.eGovXsltDesignID || ''}
                onChange={(e) => setRuleForm({ ...ruleForm, eGovXsltDesignID: Number(e.target.value) })}
                className={`${inp} w-full h-8`}
              >
                <option value="">{designOptions.length ? 'Seçiniz' : `${egovDesignGroupLabel(ruleGroup)} tasarımı yok — Tasarım Aracı'ndan yükleyin`}</option>
                {designOptions.map((d) => (
                  <option key={d.eGovXsltDesignID} value={d.eGovXsltDesignID}>
                    {d.title}
                    {d.isActive ? '' : ' (pasif)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-slate-600">Açıklama</span>
              <textarea
                value={ruleForm.description ?? ''}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                maxLength={500}
                rows={2}
                className="w-full px-2 py-1 text-[12px] rounded-sm border border-slate-300 bg-white"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
              <input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })} />
              Aktif
            </label>
            {ruleError && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{ruleError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setRuleForm(null)}
                className="px-3 h-8 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button type="button" disabled={busy} onClick={() => void saveRule()} className={`${btnPrimary} h-8`}>
                <Check className="w-3.5 h-3.5" /> Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
