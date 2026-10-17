import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileUp,
  Pencil,
  RefreshCw,
  Replace,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteEGovXslt,
  egovXsltDownloadUrl,
  EGovXsltRow,
  listEGovXslt,
  previewEGovXslt,
  replaceEGovXsltContent,
  setEGovXsltDefault,
  updateEGovXslt,
  uploadEGovXslt,
} from '../api/egovXsltApi';
import { ELogoCompany, listELogoCompanies } from '../api/elogoApi';
import { EGovDocKind, EGovDocKindLabels } from '../data/egovTypes';
import { appConfirm } from '../utils/appConfirm';

const KINDS = [EGovDocKind.EFatura, EGovDocKind.EArsiv, EGovDocKind.EIrsaliye];
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('tr-TR') : '');
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Msg = { kind: 'ok' | 'err'; text: string } | null;

/** E-Devlet → Tanımlar → XSLT Tasarımları: e-Fatura / e-Arşiv / e-İrsaliye görünüm şablonları (EGovXsltTemplate) */
export const EGovXsltPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [docKind, setDocKind] = useState<number>(EGovDocKind.EFatura);
  const [rows, setRows] = useState<EGovXsltRow[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [companies, setCompanies] = useState<ELogoCompany[]>([]);

  // Yükleme formu
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [makeDefault, setMakeDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Satır düzenleme
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ title: string; companyId: number | null; isActive: boolean }>({
    title: '',
    companyId: null,
    isActive: true,
  });
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<number | null>(null);

  // Önizleme
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listEGovXslt(docKind);
      setReady(r.ready);
      setRows(r.rows);
      if (!r.ready && r.message) setMsg({ kind: 'err', text: r.message });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Tasarımlar okunamadı' });
    } finally {
      setLoading(false);
    }
  }, [docKind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listELogoCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  const showPreview = useCallback(
    async (id: number, docIdText = previewDocId) => {
      setPreviewId(id);
      setPreviewBusy(true);
      setPreviewError(null);
      try {
        const docId = Number(docIdText.trim());
        setPreviewHtml(await previewEGovXslt(id, Number.isFinite(docId) && docId > 0 ? docId : null));
      } catch (e) {
        setPreviewHtml(null);
        setPreviewError(e instanceof Error ? e.message : 'Önizleme oluşturulamadı');
      } finally {
        setPreviewBusy(false);
      }
    },
    [previewDocId],
  );

  // Tür değişince önizlemeyi temizle
  useEffect(() => {
    setPreviewId(null);
    setPreviewHtml(null);
    setPreviewError(null);
    setEditId(null);
  }, [docKind]);

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

  const upload = async () => {
    if (!file) {
      setMsg({ kind: 'err', text: 'Önce bir .xslt dosyası seçin.' });
      return;
    }
    const ok = await run(() =>
      uploadEGovXslt({ docKind, file, title, companyId, isDefault: makeDefault }),
    );
    if (ok) {
      setFile(null);
      setTitle('');
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const startEdit = (r: EGovXsltRow) => {
    setEditId(r.eGovXsltTemplateID);
    setEdit({ title: r.title, companyId: r.companyId ?? null, isActive: r.isActive });
  };

  const saveEdit = async () => {
    if (editId == null) return;
    const ok = await run(() => updateEGovXslt(editId, edit), 'Tasarım güncellendi.');
    if (ok) setEditId(null);
  };

  const remove = async (r: EGovXsltRow) => {
    if (!(await appConfirm(`«${r.title}» tasarımı silinsin mi?`, { danger: true, okLabel: 'Sil' }))) return;
    await run(() => deleteEGovXslt(r.eGovXsltTemplateID), 'Tasarım silindi.');
    if (previewId === r.eGovXsltTemplateID) {
      setPreviewId(null);
      setPreviewHtml(null);
    }
  };

  const onReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || replaceId == null) return;
    const id = replaceId;
    setReplaceId(null);
    const ok = await run(() => replaceEGovXsltContent(id, f));
    if (ok && previewId === id) await showPreview(id);
  };

  const companyName = (r: EGovXsltRow) => (r.companyId ? r.companyTitle || `Firma #${r.companyId}` : 'Tüm firmalar');
  const kindLabel = EGovDocKindLabels[docKind];

  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 whitespace-nowrap';
  const inp = 'h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';
  const iconBtn = 'p-1 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30';

  const companySelect = (value: number | null, onChange: (v: number | null) => void, cls = '') => (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={`${inp} ${cls}`}
    >
      <option value="">Tüm firmalar</option>
      {companies.map((c) => (
        <option key={c.companyId} value={c.companyId}>
          {c.title}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">XSLT Tasarımları</h2>
          <p className="text-[11px] text-slate-500">
            EGovXsltTemplate · gönderimde kullanılacak görünüm: firma varsayılanı → genel varsayılan → e-Logo varsayılanı
          </p>
        </div>
        <div className="inline-flex rounded-sm border border-slate-300 bg-white overflow-hidden">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDocKind(k)}
              className={`px-3 h-7 text-[12px] font-medium border-r last:border-r-0 border-slate-300 ${docKind === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {EGovDocKindLabels[k]}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Yükleme */}
      <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 mr-1">{kindLabel} tasarımı yükle</span>
          <input
            ref={fileInput}
            type="file"
            accept=".xslt,.xsl"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title.trim()) setTitle(f.name.replace(/\.(xslt|xsl)$/i, ''));
            }}
            className="text-[12px] file:mr-2 file:h-7 file:px-2 file:rounded-sm file:border file:border-slate-300 file:bg-slate-50 file:text-[12px]"
          />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tasarım adı" className={`${inp} w-48`} />
          {companySelect(companyId, setCompanyId)}
          <label className="inline-flex items-center gap-1 text-[12px] text-slate-600">
            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
            Varsayılan yap
          </label>
          <button
            type="button"
            disabled={busy || !ready || !file}
            onClick={() => void upload()}
            className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
          >
            <Upload className="w-3.5 h-3.5" /> Yükle
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          .xslt / .xsl · en fazla 5 MB · yüklenirken derlenerek doğrulanır. XSLT içinde msxsl:script ve dış dosya erişimi kabul edilmez; önizleme yalıtılmış çerçevede çalışır.
        </p>
      </section>

      {/* Tasarımlar A4 genişliğinde: liste üstte, önizleme altta tam genişlik */}
      <div className="space-y-3">
        {/* Liste */}
        <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
            <span className="text-[12px] font-semibold text-slate-700">{kindLabel} tasarımları</span>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Yenile
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className={th}>İşlem</th>
                  <th className={th}>Tasarım</th>
                  <th className={th}>Firma</th>
                  <th className={th}>Dosya</th>
                  <th className={th}>Durum</th>
                  <th className={th}>Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                      {loading ? 'Yükleniyor…' : `Henüz ${kindLabel} tasarımı yok — e-Logo varsayılan tasarımı kullanılır.`}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const id = r.eGovXsltTemplateID;
                    const editing = editId === id;
                    return (
                      <tr key={id} className={`${previewId === id ? 'bg-blue-50/60' : 'hover:bg-blue-50/30'} ${r.isActive ? '' : 'text-slate-400'}`}>
                        <td className={`${td} py-0.5`}>
                          {editing ? (
                            <div className="flex items-center gap-0.5">
                              <button type="button" title="Kaydet" disabled={busy || !edit.title.trim()} onClick={() => void saveEdit()} className={iconBtn}>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                              <button type="button" title="Vazgeç" onClick={() => setEditId(null)} className={iconBtn}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                title={r.isDefault ? 'Varsayılanı kaldır' : 'Varsayılan yap'}
                                disabled={busy || (!r.isActive && !r.isDefault)}
                                onClick={() => void run(() => setEGovXsltDefault(id, !r.isDefault))}
                                className={iconBtn}
                              >
                                <Star className={`w-3.5 h-3.5 ${r.isDefault ? 'fill-amber-400 text-amber-500' : ''}`} />
                              </button>
                              <button type="button" title="Önizle" onClick={() => void showPreview(id)} className={iconBtn}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" title="Düzenle" onClick={() => startEdit(r)} className={iconBtn}>
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
                              <a href={egovXsltDownloadUrl(id)} title="İndir" className={iconBtn}>
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button type="button" title="Sil" disabled={busy} onClick={() => void remove(r)} className={`${iconBtn} hover:text-red-600`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className={td}>
                          {editing ? (
                            <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={`${inp} w-44`} />
                          ) : (
                            <span className="font-medium">{r.title}</span>
                          )}
                        </td>
                        <td className={td}>
                          {editing ? companySelect(edit.companyId, (v) => setEdit({ ...edit, companyId: v }), 'w-40') : companyName(r)}
                        </td>
                        <td className={`${td} text-[11px] text-slate-500`} title={r.contentHash ? `SHA-256 ${r.contentHash}` : ''}>
                          {r.fileName} · {fmtSize(r.contentLength)}
                        </td>
                        <td className={td}>
                          {editing ? (
                            <label className="inline-flex items-center gap-1 text-[12px]">
                              <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />
                              Aktif
                            </label>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {r.isDefault && (
                                <span className="px-1.5 py-px rounded-sm border text-[11px] bg-amber-50 text-amber-800 border-amber-200">Varsayılan</span>
                              )}
                              {!r.isActive && (
                                <span className="px-1.5 py-px rounded-sm border text-[11px] bg-slate-50 text-slate-500 border-slate-200">Pasif</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className={`${td} text-[11px] text-slate-500`}>{fmtDateTime(r.updatedAt || r.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <input ref={replaceInput} type="file" accept=".xslt,.xsl" className="hidden" onChange={(e) => void onReplaceFile(e)} />
        </section>

        {/* Önizleme */}
        <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 flex flex-col h-[1000px]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
            <span className="text-[12px] font-semibold text-slate-700">
              Önizleme{previewId ? ` · ${rows.find((r) => r.eGovXsltTemplateID === previewId)?.title ?? ''}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <input
                value={previewDocId}
                onChange={(e) => setPreviewDocId(e.target.value.replace(/\D/g, ''))}
                placeholder="e-Belge ID (boş = örnek)"
                title="Kayıtlı bir e-belgenin UBL'i ile önizlemek için EGovDocument ID girin"
                className={`${inp} w-40`}
              />
              <button
                type="button"
                disabled={previewId == null || previewBusy}
                onClick={() => previewId != null && void showPreview(previewId)}
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
              <iframe title="XSLT önizleme" sandbox="allow-scripts" srcDoc={previewHtml} className="absolute inset-0 w-full h-full bg-white" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[12px] text-slate-400">
                <FileUp className="w-6 h-6" />
                <span>
                  Listeden bir tasarımın <Eye className="inline w-3 h-3 -mt-0.5" /> düğmesine basın — örnek belge üzerinde gösterilir.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
