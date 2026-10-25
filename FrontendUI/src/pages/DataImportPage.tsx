import React from 'react';
import { FileSpreadsheet, Download, Upload, Eye, CheckCircle2, Package, Users, BookOpen, X } from 'lucide-react';
import {
  applyImport,
  deleteImportProfile,
  fetchImportFields,
  fetchImportHistory,
  fetchImportProfiles,
  fetchImportSourceColumns,
  fetchImportSourceRows,
  fetchImportSources,
  fetchImportTargets,
  importTemplateUrl,
  parseImportFile,
  runImportProfile,
  saveImportProfile,
  sourceHeader,
  type ImportApplyResult,
  type ImportFieldDef,
  type ImportKind,
  type ImportLogRow,
  type ImportMapItem,
  type ImportMode,
  type ImportProfile,
  type ImportSourceDef,
  type ImportSourceRequest,
  type ImportTargetDef,
  type ParsedSheet,
} from '../api/importApi';
import { getCurrentUserId } from '../data/permissions';
import { appConfirm } from '../utils/appConfirm';

interface DataImportPageProps {
  onBack?: () => void;
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  product: Package,
  customer: Users,
  account: BookOpen,
  invoice: FileSpreadsheet,
  'customer-voucher': Users,
  'bank-voucher': FileSpreadsheet,
  'account-voucher': BookOpen,
};

const KIND_LABEL: Record<string, string> = {
  product: 'Malzeme / Hizmet',
  customer: 'Cari Kart',
  account: 'Hesap Kodu',
  invoice: 'Fatura',
  'customer-voucher': 'Cari Fiş',
  'bank-voucher': 'Banka Fişi',
  'account-voucher': 'Muhasebe Fişi',
};

const voucherKind = (kind: string) =>
  kind === 'invoice' || kind === 'customer-voucher' || kind === 'bank-voucher' || kind === 'account-voucher';

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

const CHANNELS = [
  { value: 'excel', label: 'Excel / CSV' },
  { value: '0', label: 'Bu veritabanı (SELECT)' },
  { value: '1', label: 'SQL Server (Logo, Mikro…)' },
  { value: '2', label: 'MySQL' },
  { value: '3', label: 'REST API' },
] as const;

type Channel = (typeof CHANNELS)[number]['value'];

const emptySource = (): ImportSourceRequest => ({
  sourceType: 0,
  sql: '',
  server: '',
  port: '',
  database: '',
  user: '',
  password: '',
  windowsAuth: false,
  trustCertificate: true,
  apiUrl: '',
  apiMethod: 'GET',
  apiHeaders: '',
  jsonPath: '',
  body: '',
});

/** Başlık adını Bartu alanına önerir. Kullanıcı eşlemeyi değiştirebilir. */
function autoMap(headers: string[], fields: ImportFieldDef[], source: ImportSourceDef | null, kind: string): Record<string, string> {
  const by = new Map<string, string>();
  for (const f of fields) {
    for (const name of [sourceHeader(source, kind, f), f.label, f.key, ...(f.aliases ?? [])]) {
      const key = norm(name);
      if (key && !by.has(key)) by.set(key, f.key);
    }
  }
  const used = new Set<string>();
  const map: Record<string, string> = {};
  for (const h of headers) {
    const key = by.get(norm(h));
    if (key && !used.has(key)) {
      map[h] = key;
      used.add(key);
    } else map[h] = '';
  }
  return map;
}

const fmtTime = (v: string) => new Date(v.endsWith('Z') ? v : `${v}Z`).toLocaleString('tr-TR');

export const DataImportPage: React.FC<DataImportPageProps> = () => {
  const [targets, setTargets] = React.useState<ImportTargetDef[]>([]);
  const [sources, setSources] = React.useState<ImportSourceDef[]>([]);
  const [sourceId, setSourceId] = React.useState('bartu');
  const [kind, setKind] = React.useState<ImportKind>('product');
  const [catalog, setCatalog] = React.useState<ImportFieldDef[]>([]);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [channel, setChannel] = React.useState<Channel>('excel');
  const [link, setLink] = React.useState<ImportSourceRequest>(emptySource);
  const [colMap, setColMap] = React.useState<Record<string, string>>({});
  const [profileId, setProfileId] = React.useState(0);
  const [profileTitle, setProfileTitle] = React.useState('');
  const [intervalMin, setIntervalMin] = React.useState('');
  const [profiles, setProfiles] = React.useState<ImportProfile[]>([]);
  const savedMap = React.useRef<ImportMapItem[] | null>(null);
  const [productType, setProductType] = React.useState(1);
  const [accountPrefixParent, setAccountPrefixParent] = React.useState(true);
  const [createMissingCards, setCreateMissingCards] = React.useState(false);
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
  const source = sources.find((s) => s.id === sourceId) ?? sources[0] ?? null;
  const fields = catalog.length ? catalog : (target?.fields ?? []);

  React.useEffect(() => {
    let cancel = false;
    fetchImportFields(kind)
      .then((rows) => { if (!cancel) setCatalog(rows); })
      .catch(() => { if (!cancel) setCatalog([]); });
    return () => { cancel = true; };
  }, [kind]);

  React.useEffect(() => {
    const list = catalog.length ? catalog : (target?.fields ?? []);
    if (!list.length) return;
    setPicked(new Set(list.filter((f) => f.required || f.defaultOn !== false).map((f) => f.key)));
  }, [kind, catalog, target]);

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
    fetchImportSources()
      .then(setSources)
      .catch(() => setSources([]));
    fetchImportProfiles().then(setProfiles).catch(() => setProfiles([]));
    void loadHistory();
  }, [loadHistory]);

  React.useEffect(() => {
    if (!sheet) {
      setColMap((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    const list = catalog.length ? catalog : (target?.fields ?? []);
    const map = autoMap(sheet.headers, list, channel === 'excel' ? source : null, kind);
    if (savedMap.current) {
      for (const item of savedMap.current) {
        if (sheet.headers.includes(item.header)) map[item.header] = item.field;
      }
      savedMap.current = null;
    }
    setColMap(map);
  }, [sheet, catalog, target, source, kind, channel]);

  const assigned = Object.values(colMap).filter(Boolean);
  const duplicateFields = [...new Set(assigned.filter((key, i) => assigned.indexOf(key) !== i))];
  const missingRequired = fields.filter((f) => f.required && !assigned.includes(f.key));
  const templateOk = Boolean(sheet && sheet.rows.length > 0 && missingRequired.length === 0 && duplicateFields.length === 0);

  React.useEffect(() => {
    setResult(null);
    setInfo(null);
  }, [target, sheet, mode, productType, accountPrefixParent, createMissingCards, sourceId, picked]);

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
      sheet.headers.forEach((header, col) => {
        const key = colMap[header];
        if (!key) return;
        const v = (cells[col] ?? '').trim();
        if (!v) return;
        any = true;
        rec[key] = v;
      });
      if (any) out.push(rec);
    });
    return out;
  };

  const sourceRequest = (): ImportSourceRequest => ({
    ...link,
    sourceType: Number(channel),
  });

  const pullColumns = async () => {
    setBusy(true);
    setError(null);
    try {
      const headers = await fetchImportSourceColumns(sourceRequest());
      savedMap.current = null;
      setSheet({ fileName: channel === '3' ? 'API' : 'SQL', sheetName: '', headers, rows: [], truncated: false });
      setInfo(`${headers.length} kolon başlığı alındı. Bartu alanıyla eşleştirin, sonra veriyi çekin.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kolonlar okunamadı');
    } finally {
      setBusy(false);
    }
  };

  const pullRows = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await fetchImportSourceRows(sourceRequest());
      setSheet({ fileName: channel === '3' ? 'API' : 'SQL', sheetName: '', headers: data.headers, rows: data.rows, truncated: false });
      setInfo(`${data.rows.length} satır geldi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri okunamadı');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (channel === 'excel') {
      setError('Zamanlama SQL veya API kaynağı ile kaydedilir. Excel dosyası elle yüklenir.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveImportProfile({
        importProfileID: profileId,
        title: profileTitle.trim() || (target?.title ?? 'Aktarım'),
        kind,
        sourceKind: Number(channel),
        source: sourceRequest(),
        map: Object.entries(colMap).filter(([, field]) => field).map(([header, field]) => ({ header, field })),
        mode,
        createMissingCards,
        productType: kind === 'product' ? productType : null,
        intervalMinutes: intervalMin.trim() ? Number(intervalMin) : null,
        isActive: true,
      });
      setProfileId(saved.importProfileID);
      setProfileTitle(saved.title);
      const when = saved.intervalMinutes ? `her ${saved.intervalMinutes} dk` : 'yalnız elle';
      setInfo(`Profil kaydedildi (${when}). Süreç no: ${saved.processDefID ?? '—'}`);
      setProfiles(await fetchImportProfiles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profil kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const openProfile = (p: ImportProfile) => {
    setKind(p.kind);
    setChannel(String(p.sourceKind) as Channel);
    setLink({ ...emptySource(), ...p.source, password: '' });
    setProfileId(p.importProfileID);
    setProfileTitle(p.title);
    setIntervalMin(p.intervalMinutes ? String(p.intervalMinutes) : '');
    setMode(p.mode);
    setCreateMissingCards(p.createMissingCards);
    if (p.productType) setProductType(p.productType);
    savedMap.current = p.map;
    setSheet(null);
    setInfo(p.lastStatus ? `Son çalışma: ${p.lastStatus}` : 'Profil açıldı. Başlıkları alıp eşlemeyi kontrol edin.');
  };

  const run = async (dryRun: boolean) => {
    if (!target || !sheet || !templateOk) return;
    const rows = buildRows();
    if (rows.length === 0) {
      setError('Dosyada aktarılacak veri yok');
      return;
    }
    if (!dryRun) {
      const voucher = voucherKind(kind);
      const msg = voucher
        ? `${rows.length} satır ${target.title} olarak fişlere bölünüp kaydedilecek (${MODE_LABEL[mode]}). Onaylıyor musunuz?`
        : `${rows.length} satır ${target.title} tablosuna aktarılacak (${MODE_LABEL[mode]}). Onaylıyor musunuz?`;
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
        createMissingCards: voucherKind(kind) ? createMissingCards : undefined,
        fileName: sheet.fileName,
        importedBy: String(getCurrentUserId() ?? ''),
      });
      setResult(r);
      setOnlyProblems(r.failed > 0);
      const summary = `${r.inserted} yeni · ${r.updated} güncelleme · ${r.skipped} atlanan · ${r.failed} hata`;
      const cut = r.rowsTruncated ? ' · listede yalnız hatalar var, sayılar tamdır' : '';
      setInfo((dryRun ? `Kontrol tamamlandı: ${summary}` : `Aktarım tamamlandı: ${summary}`) + cut);
      if (!dryRun) void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım başarısız');
    } finally {
      setBusy(false);
    }
  };

  const previewRows = sheet ? sheet.rows.slice(0, 5) : [];
  const mappedFields = fields.filter((f) => Object.values(colMap).includes(f.key));
  const colOf = (key: string) => sheet ? sheet.headers.findIndex((h) => colMap[h] === key) : -1;
  const resultRows = result ? (onlyProblems ? result.rows.filter((r) => r.action === 'error' || r.message) : result.rows) : [];

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <div>
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Veri Aktarımı</h2>
          <p className="text-[11px] text-slate-500">
            Excel, SQL veya API kaynağından kart ve fiş aktarın. Alanları siz seçer, başlıkları Bartu alanına eşlersiniz. Aralık yazılırsa süreç zamanında kendisi çalışır.
          </p>
        </div>
      </div>

      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(targets.length ? targets.map((t) => t.kind) : (['product', 'customer', 'account'] as ImportKind[])).map((k) => {
            const Icon = KIND_ICON[k] ?? FileSpreadsheet;
            const active = k === kind;
            return (
              <button
                key={k}
                type="button"
                onClick={() => { setKind(k); setCatalog([]); setSheet(null); setProfileId(0); }}
                className={`inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-md border ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {KIND_LABEL[k] ?? targets.find((t) => t.kind === k)?.title ?? k}
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
            {source?.note && <li>{source.note}</li>}
          </ul>
        )}
        {target && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-600">Aktarılacak alanlar</span>
              <span className="text-[11px] text-slate-400">{fields.filter((f) => f.required || picked.has(f.key)).length}/{fields.length}</span>
              <button
                type="button"
                className="text-[11px] text-blue-700 hover:underline"
                onClick={() => setPicked(new Set(fields.map((f) => f.key)))}
              >
                Tümünü seç
              </button>
              <button
                type="button"
                className="text-[11px] text-blue-700 hover:underline"
                onClick={() => setPicked(new Set(fields.filter((f) => f.required).map((f) => f.key)))}
              >
                Yalnız zorunlu
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => {
                const on = f.required || picked.has(f.key);
                return (
                  <label
                    key={f.key}
                    title={[f.hint, f.options ? `Değerler: ${Object.keys(f.options).join(', ')}` : ''].filter(Boolean).join(' · ') || undefined}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                      f.required
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : on
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white dark:bg-slate-900 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={on}
                      disabled={f.required}
                      onChange={(e) => {
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(f.key);
                          else next.delete(f.key);
                          return next;
                        });
                      }}
                    />
                    {sourceHeader(source, kind, f)}
                    {f.required && ' *'}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <label className="md:col-span-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Kaynak</span>
            <select className={inputCls} value={channel} onChange={(e) => { setChannel(e.target.value as Channel); setSheet(null); }}>
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          {channel === 'excel' && (
          <label className="md:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Excel şablonu</span>
            <select className={inputCls} value={source?.id ?? 'bartu'} onChange={(e) => setSourceId(e.target.value)}>
              {(sources.length ? sources : [{ id: 'bartu', title: 'Bartu', note: '', headers: {} }]).map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          )}
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
          {voucherKind(kind) && (
            <label className="md:col-span-5 inline-flex items-center gap-2 h-8 text-[12px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={createMissingCards}
                onChange={(e) => setCreateMissingCards(e.target.checked)}
              />
              Kartı yoksa oluştur (cari, malzeme/hizmet, hesap, banka hesabı)
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
          {channel === 'excel' && (
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <a
              href={importTemplateUrl(kind, source?.id ?? 'bartu', fields.filter((f) => f.required || picked.has(f.key)).map((f) => f.key))}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
            >
              <Download className="w-3.5 h-3.5" />
              {source && source.id !== 'bartu' ? `${source.title} Şablonu` : 'Şablon İndir'}
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
              accept=".xlsx,.csv,.txt,.xml,.zip"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          )}
        </div>
        {channel !== 'excel' && (
          <div className="space-y-2 rounded border border-sky-200 bg-white/70 p-2">
            <p className="text-[11px] text-slate-600">
              Logo veya Mikro veritabanına bağlanıp kendi SELECT sorgunuzu yazın. REST için JSON listesinin adresini verin. Gelen başlıkları Bartu alanına eşleyin.
            </p>
            {(channel === '1' || channel === '2') && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="block text-[11px] col-span-2">Sunucu
                  <input className={inputCls} value={link.server ?? ''} onChange={(e) => setLink({ ...link, server: e.target.value })} placeholder={channel === '2' ? 'mysql.site' : 'sunucu\\SQLEXPRESS'} />
                </label>
                <label className="block text-[11px]">Port
                  <input className={inputCls} value={link.port ?? ''} onChange={(e) => setLink({ ...link, port: e.target.value })} placeholder={channel === '2' ? '3306' : ''} />
                </label>
                <label className="block text-[11px]">Veritabanı
                  <input className={inputCls} value={link.database ?? ''} onChange={(e) => setLink({ ...link, database: e.target.value })} />
                </label>
                {channel === '1' && (
                  <label className="col-span-2 flex items-center gap-2 text-[11px]">
                    <input type="checkbox" checked={link.windowsAuth === true} onChange={(e) => setLink({ ...link, windowsAuth: e.target.checked })} />
                    Windows kimliği
                  </label>
                )}
                {!(channel === '1' && link.windowsAuth) && (
                  <>
                    <label className="block text-[11px]">Kullanıcı
                      <input className={inputCls} value={link.user ?? ''} autoComplete="off" onChange={(e) => setLink({ ...link, user: e.target.value })} />
                    </label>
                    <label className="block text-[11px]">Şifre
                      <input type="password" className={inputCls} value={link.password ?? ''} autoComplete="new-password" placeholder={profileId ? 'boşsa kayıtlı şifre durur' : ''} onChange={(e) => setLink({ ...link, password: e.target.value })} />
                    </label>
                  </>
                )}
              </div>
            )}
            {channel === '3' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="block text-[11px]">Yöntem
                  <select className={inputCls} value={link.apiMethod || 'GET'} onChange={(e) => setLink({ ...link, apiMethod: e.target.value })}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </label>
                <label className="block text-[11px]">Kayıt listesi yolu
                  <input className={inputCls} value={link.jsonPath ?? ''} placeholder="data.items" onChange={(e) => setLink({ ...link, jsonPath: e.target.value })} />
                </label>
                <label className="block text-[11px] md:col-span-2">Adres
                  <input className={inputCls} value={link.apiUrl ?? ''} placeholder="https://site.com/api/kayitlar" onChange={(e) => setLink({ ...link, apiUrl: e.target.value })} />
                </label>
                <label className="block text-[11px] md:col-span-2">Başlıklar
                  <textarea className={`${inputCls} h-16 font-mono py-1`} value={link.apiHeaders ?? ''} placeholder={'Authorization: Bearer …'} onChange={(e) => setLink({ ...link, apiHeaders: e.target.value })} />
                </label>
              </div>
            ) : (
              <label className="block text-[11px]">SELECT
                <textarea className={`${inputCls} h-20 font-mono py-1`} spellCheck={false} value={link.sql ?? ''} placeholder="SELECT kod, unvan FROM ..." onChange={(e) => setLink({ ...link, sql: e.target.value })} />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void pullColumns()} className="rounded border border-sky-300 bg-white px-2 h-8 text-[12px] text-sky-800 disabled:opacity-50">Başlıkları al</button>
              <button type="button" disabled={busy} onClick={() => void pullRows()} className="rounded border border-sky-300 bg-white px-2 h-8 text-[12px] text-sky-800 disabled:opacity-50">Veriyi çek</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <label className="md:col-span-4 block text-[11px]">Profil adı
            <input className={inputCls} value={profileTitle} placeholder="Logo cari aktarımı" onChange={(e) => setProfileTitle(e.target.value)} />
          </label>
          <label className="md:col-span-2 block text-[11px]">Aralık (dk)
            <input className={inputCls} type="number" min={5} value={intervalMin} placeholder="elle" onChange={(e) => setIntervalMin(e.target.value)} />
          </label>
          <button type="button" disabled={busy || channel === 'excel'} onClick={() => void saveProfile()} className="md:col-span-3 h-8 rounded bg-amber-600 text-white text-[12px] font-semibold disabled:opacity-50">Sürece kaydet</button>
        </div>

        {sheet && (
          <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">{sheet.fileName}</span>
            <span className="text-slate-500">
              {sheet.sheetName ? `· ${sheet.sheetName} ` : ''}· {sheet.rows.length} satır · {sheet.headers.length} kolon
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

      {sheet && target && sheet.headers.length > 0 && (
        <section className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Alan eşlemesi</h3>
          <p className="text-[12px] text-slate-600">Kaynak başlığını Bartu alanına bağlayın. Boş bırakılan kolon aktarılmaz.</p>
          {missingRequired.length > 0 && (
            <p className="text-[12px] text-red-700">Zorunlu alan eşlenmedi: {missingRequired.map((f) => f.label).join(', ')}</p>
          )}
          {duplicateFields.length > 0 && (
            <p className="text-[12px] text-red-700">Aynı Bartu alanına birden fazla kolon bağlandı.</p>
          )}
          {templateOk && (
            <p className="text-[12px] text-emerald-700">{assigned.length} kolon eşleşti · {sheet.rows.length} satır</p>
          )}
          <div className="max-h-48 overflow-auto rounded border border-slate-200">
            {sheet.headers.map((header) => (
              <label key={header} className="flex items-center gap-2 px-2 py-1 text-[12px] border-b border-slate-100 last:border-0">
                <span className="font-mono flex-1 min-w-0 truncate">{header}</span>
                <select
                  className="h-7 max-w-[220px] rounded border border-slate-300 bg-white text-[11px]"
                  value={colMap[header] ?? ''}
                  onChange={(e) => setColMap((prev) => ({ ...prev, [header]: e.target.value }))}
                >
                  <option value="">— aktarma —</option>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

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
                          {cells[colOf(f.key)] ?? ''}
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

      {profiles.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Kayıtlı aktarımlar</h3>
          <div className="rounded-md border border-slate-200 overflow-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.importProfileID} className="border-t border-slate-100">
                    <td className="px-2 py-1">{p.title}</td>
                    <td className="px-2 py-1 text-slate-500">{KIND_LABEL[p.kind] ?? p.kind}</td>
                    <td className="px-2 py-1 text-slate-500">{p.intervalMinutes ? `${p.intervalMinutes} dk` : 'elle'}{p.processDefID ? ` · süreç ${p.processDefID}` : ''}</td>
                    <td className="px-2 py-1 text-slate-500">{p.lastStatus}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <button type="button" className="text-blue-700 hover:underline mr-2" onClick={() => openProfile(p)}>Aç</button>
                      <button type="button" className="text-blue-700 hover:underline mr-2" onClick={() => void runImportProfile(p.importProfileID, true).then((r) => setInfo(`Kontrol: ${r.inserted} yeni · ${r.failed} hata`)).catch((e) => setError(e instanceof Error ? e.message : 'Çalışmadı'))}>Kontrol</button>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => void deleteImportProfile(p.importProfileID).then(() => setProfiles((prev) => prev.filter((x) => x.importProfileID !== p.importProfileID)))}>Sil</button>
                    </td>
                  </tr>
                ))}
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
