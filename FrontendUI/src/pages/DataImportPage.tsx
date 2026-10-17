import React from 'react';
import { FileSpreadsheet, Download, Upload, Eye, CheckCircle2, Package, Users, BookOpen, X } from 'lucide-react';
import {
  applyImport,
  fetchImportHistory,
  fetchImportTargets,
  importTemplateUrl,
  parseImportFile,
  type ImportApplyResult,
  type ImportKind,
  type ImportLogRow,
  type ImportMode,
  type ImportTargetDef,
  type ParsedSheet,
} from '../api/importApi';
import { getCurrentUserId } from '../data/permissions';
import { appConfirm } from '../utils/appConfirm';

interface DataImportPageProps {
  onBack?: () => void;
}

const KIND_ICON: Record<ImportKind, React.ComponentType<{ className?: string }>> = {
  product: Package,
  customer: Users,
  account: BookOpen,
};

const KIND_LABEL: Record<ImportKind, string> = {
  product: 'Malzeme / Hizmet',
  customer: 'Cari Kart',
  account: 'Hesap Kodu',
};

const MODE_LABEL: Record<ImportMode, string> = {
  upsert: 'Ekle + Güncelle',
  insert: 'Sadece yeni kodlar',
  update: 'Sadece mevcut kodlar',
};

const ACTION_LABEL: Record<string, { text: string; cls: string }> = {
  insert: { text: 'Yeni', cls: 'bg-emerald-50 text-emerald-700' },
  update: { text: 'Güncelle', cls: 'bg-blue-50 text-blue-700' },
  skip: { text: 'Atlandı', cls: 'bg-slate-100 text-slate-600' },
  error: { text: 'Hata', cls: 'bg-red-50 text-red-700' },
};

const inputCls =
  'w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900';

/** Başlık karşılaştırma: yalnızca büyük/küçük harf ve baş/son boşluk farkı yok sayılır */
const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');

type TemplateCheck = { mapping: Record<string, number>; missing: string[]; extra: string[]; duplicate: string[] };

/** Dosya başlıkları şablonla birebir aynı olmalı — eksik / fazla / tekrar eden kolon kabul edilmez */
function checkTemplate(target: ImportTargetDef, headers: string[]): TemplateCheck {
  const mapping: Record<string, number> = {};
  const byLabel = new Map(target.fields.map((f) => [norm(f.label), f]));
  const extra: string[] = [];
  const duplicate: string[] = [];
  headers.forEach((h, i) => {
    if (!h.trim()) return;
    const f = byLabel.get(norm(h));
    if (!f) extra.push(h);
    else if (mapping[f.key] !== undefined) duplicate.push(h);
    else mapping[f.key] = i;
  });
  const missing = target.fields.filter((f) => mapping[f.key] === undefined).map((f) => f.label);
  return { mapping, missing, extra, duplicate };
}

const fmtTime = (v: string) => new Date(v.endsWith('Z') ? v : `${v}Z`).toLocaleString('tr-TR');

export const DataImportPage: React.FC<DataImportPageProps> = () => {
  const [targets, setTargets] = React.useState<ImportTargetDef[]>([]);
  const [kind, setKind] = React.useState<ImportKind>('product');
  const [productType, setProductType] = React.useState(1);
  const [accountPrefixParent, setAccountPrefixParent] = React.useState(true);
  const [mode, setMode] = React.useState<ImportMode>('upsert');
  const [sheet, setSheet] = React.useState<ParsedSheet | null>(null);
  const [result, setResult] = React.useState<ImportApplyResult | null>(null);
  const [onlyProblems, setOnlyProblems] = React.useState(false);
  const [history, setHistory] = React.useState<ImportLogRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const target = targets.find((t) => t.kind === kind) ?? null;

  const loadHistory = React.useCallback(async () => {
    try {
      setHistory(await fetchImportHistory());
    } catch {
      setHistory([]);
    }
  }, []);

  React.useEffect(() => {
    fetchImportTargets()
      .then(setTargets)
      .catch((e) => setError(e instanceof Error ? e.message : 'Aktarım türleri alınamadı'));
    void loadHistory();
  }, [loadHistory]);

  const check = React.useMemo(
    () => (target && sheet ? checkTemplate(target, sheet.headers) : null),
    [target, sheet],
  );
  const mapping = check?.mapping ?? {};
  const templateOk = Boolean(check && !check.missing.length && !check.extra.length && !check.duplicate.length);

  React.useEffect(() => {
    setResult(null);
    setInfo(null);
  }, [target, sheet, mode, productType, accountPrefixParent]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setSheet(await parseImportFile(file));
    } catch (e) {
      setSheet(null);
      setError(e instanceof Error ? e.message : 'Dosya okunamadı');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const buildRows = (): Record<string, string>[] => {
    if (!sheet || !target) return [];
    const out: Record<string, string>[] = [];
    sheet.rows.forEach((cells, i) => {
      const rec: Record<string, string> = { __row: String(i + 2) };
      let any = false;
      for (const f of target.fields) {
        const col = mapping[f.key];
        if (col === undefined || col < 0) continue;
        const v = (cells[col] ?? '').trim();
        if (v) any = true;
        rec[f.key] = v;
      }
      if (any) out.push(rec);
    });
    return out;
  };

  const run = async (dryRun: boolean) => {
    if (!target || !sheet || !templateOk) return;
    const rows = buildRows();
    if (rows.length === 0) {
      setError('Dosyada aktarılacak veri yok');
      return;
    }
    if (!dryRun) {
      const msg = `${rows.length} satır ${target.title} tablosuna aktarılacak (${MODE_LABEL[mode]}). Onaylıyor musunuz?`;
      if (!await appConfirm(msg)) return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await applyImport(kind, {
        rows,
        mode,
        dryRun,
        productType: kind === 'product' ? productType : undefined,
        accountPrefixParent: kind === 'account' ? accountPrefixParent : undefined,
        fileName: sheet.fileName,
        importedBy: String(getCurrentUserId() ?? ''),
      });
      setResult(r);
      setOnlyProblems(r.failed > 0);
      const summary = `${r.inserted} yeni · ${r.updated} güncelleme · ${r.skipped} atlanan · ${r.failed} hata`;
      setInfo(dryRun ? `Kontrol tamamlandı: ${summary}` : `Aktarım tamamlandı: ${summary}`);
      if (!dryRun) void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım başarısız');
    } finally {
      setBusy(false);
    }
  };

  const previewRows = sheet ? sheet.rows.slice(0, 5) : [];
  const mappedFields = target && templateOk ? target.fields : [];
  const resultRows = result ? (onlyProblems ? result.rows.filter((r) => r.action === 'error' || r.message) : result.rows) : [];

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <div>
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Veri Aktarımı</h2>
          <p className="text-[11px] text-slate-500">
            Excel (.xlsx) veya CSV dosyasından malzeme, cari ve muhasebe hesap kartlarını içeri aktarın. Kod eşleşmesine göre
            yeni kart açılır veya mevcut kart güncellenir.
          </p>
        </div>
      </div>

      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['product', 'customer', 'account'] as ImportKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            const active = k === kind;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-md border ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>

        {target && (
          <ul className="text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-0.5">
            <li>
              Hedef tablo: <span className="font-mono">{target.tableName}</span>
            </li>
            {target.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {target && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[11px] font-medium text-slate-600 mr-1">Şablon kolonları:</span>
            {target.fields.map((f) => (
              <span
                key={f.key}
                title={[f.hint, f.options ? `Değerler: ${Object.keys(f.options).join(', ')}` : ''].filter(Boolean).join(' · ') || undefined}
                className={`px-1.5 py-0.5 rounded text-[11px] border ${
                  f.required
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white dark:bg-slate-900 text-slate-600'
                }`}
              >
                {f.label}
                {f.required && ' *'}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {kind === 'product' && (
            <label className="md:col-span-3 space-y-1">
              <span className="text-[11px] font-medium text-slate-600">Kart Tipi</span>
              <select className={inputCls} value={productType} onChange={(e) => setProductType(Number(e.target.value))}>
                <option value={1}>1 — Malzeme</option>
                <option value={2}>2 — Verilen Hizmet</option>
                <option value={3}>3 — Alınan Hizmet</option>
              </select>
            </label>
          )}
          {kind === 'account' && (
            <label className="md:col-span-5 inline-flex items-center gap-2 h-8 text-[12px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={accountPrefixParent}
                onChange={(e) => setAccountPrefixParent(e.target.checked)}
              />
              Noktasız kodlarda üst hesabı önekten bul (1 ← 10 ← 100)
            </label>
          )}
          <label className="md:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Aktarım Modu</span>
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
              {(Object.keys(MODE_LABEL) as ImportMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <a
              href={importTemplateUrl(kind)}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
            >
              <Download className="w-3.5 h-3.5" />
              Şablon İndir
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Dosya Seç
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {sheet && (
          <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">{sheet.fileName}</span>
            <span className="text-slate-500">
              {sheet.sheetName ? `· ${sheet.sheetName} ` : ''}· {sheet.rows.length} satır · {sheet.headers.length} kolon
              {sheet.truncated ? ' · ilk 20.000 satır alındı' : ''}
            </span>
            <button
              type="button"
              title="Dosyayı kaldır"
              onClick={() => setSheet(null)}
              className="ml-1 text-slate-400 hover:text-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {error && <div className="text-[12px] text-red-600">{error}</div>}
      </section>

      {sheet && target && (
        <section className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Şablon Kontrolü</h3>
          {templateOk ? (
            <p className="text-[12px] text-emerald-700">Dosya şablona uygun — {target.fields.length} kolon eşleşti.</p>
          ) : (
            check && (
              <div className="rounded border border-red-200 bg-red-50 dark:bg-red-950/30 p-2 text-[12px] text-red-700 space-y-0.5">
                <p className="font-semibold">
                  Dosya şablona uymuyor. Lütfen “Şablon İndir” ile aldığınız Excel’i kolonlarını değiştirmeden doldurun.
                </p>
                {check.missing.length > 0 && <p>Eksik kolon: {check.missing.join(', ')}</p>}
                {check.extra.length > 0 && <p>Şablonda olmayan kolon: {check.extra.join(', ')}</p>}
                {check.duplicate.length > 0 && <p>Tekrar eden kolon: {check.duplicate.join(', ')}</p>}
              </div>
            )
          )}

          {mappedFields.length > 0 && previewRows.length > 0 && (
            <div className="overflow-auto rounded border border-slate-200 dark:border-slate-700">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600">
                  <tr>
                    <th className="px-2 py-1 w-[50px]">Satır</th>
                    {mappedFields.map((f) => (
                      <th key={f.key} className="px-2 py-1 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((cells, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 2}</td>
                      {mappedFields.map((f) => (
                        <td key={f.key} className="px-2 py-1 whitespace-nowrap">
                          {cells[mapping[f.key]] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy || !templateOk}
              onClick={() => void run(true)}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Kontrol Et
            </button>
            <button
              type="button"
              disabled={busy || !templateOk || !result || !result.dryRun}
              title={!result?.dryRun ? 'Önce Kontrol Et' : undefined}
              onClick={() => void run(false)}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aktar
            </button>
            {busy && <span className="text-[12px] text-slate-500">İşleniyor…</span>}
            {info && <span className="text-[12px] text-emerald-700">{info}</span>}
          </div>
        </section>
      )}

      {result && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              {result.dryRun ? 'Kontrol Sonucu' : 'Aktarım Sonucu'}
            </h3>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              />
              Sadece hata / uyarılar
            </label>
          </div>
          <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-auto max-h-[45vh]">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr className="text-[11px] text-slate-600">
                  <th className="px-2 py-1.5 w-[60px]">Satır</th>
                  <th className="px-2 py-1.5 w-[180px]">Kod</th>
                  <th className="px-2 py-1.5 w-[90px]">İşlem</th>
                  <th className="px-2 py-1.5">Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                      Gösterilecek satır yok.
                    </td>
                  </tr>
                ) : (
                  resultRows.map((r) => {
                    const a = ACTION_LABEL[r.action] ?? ACTION_LABEL.skip;
                    return (
                      <tr key={`${r.rowNo}-${r.code}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-1 tabular-nums text-slate-500">{r.rowNo}</td>
                        <td className="px-2 py-1 font-mono">{r.code || '—'}</td>
                        <td className="px-2 py-1">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${a.cls}`}>{a.text}</span>
                        </td>
                        <td className={`px-2 py-1 ${r.action === 'error' ? 'text-red-600' : 'text-amber-700'}`}>
                          {r.message}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-1.5">
        <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Aktarım Geçmişi</h3>
        <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr className="text-[11px] text-slate-600">
                <th className="px-2 py-1.5">Zaman</th>
                <th className="px-2 py-1.5">Tür</th>
                <th className="px-2 py-1.5">Dosya</th>
                <th className="px-2 py-1.5">Mod</th>
                <th className="px-2 py-1.5 text-right">Satır</th>
                <th className="px-2 py-1.5 text-right">Yeni</th>
                <th className="px-2 py-1.5 text-right">Güncelleme</th>
                <th className="px-2 py-1.5 text-right">Atlanan</th>
                <th className="px-2 py-1.5 text-right">Hata</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-center text-slate-400">
                    Henüz aktarım yapılmadı.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.ImportLogID} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1 text-slate-500">{fmtTime(h.ImportedAt)}</td>
                    <td className="px-2 py-1">{KIND_LABEL[h.Kind] ?? h.Kind}</td>
                    <td className="px-2 py-1">{h.FileName || '—'}</td>
                    <td className="px-2 py-1">{MODE_LABEL[h.Mode as ImportMode] ?? h.Mode}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.TotalRows}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-emerald-700">{h.Inserted}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-blue-700">{h.Updated}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.Skipped}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${h.Failed ? 'text-red-600' : ''}`}>{h.Failed}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
