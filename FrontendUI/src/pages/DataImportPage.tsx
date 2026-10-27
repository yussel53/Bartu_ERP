import React from 'react';
import { FileSpreadsheet, Download, Upload, Eye, CheckCircle2, X, Play, ScrollText } from 'lucide-react';
import { RowActions } from '../components/RowActions';
import {
  applyImport,
  deleteImportProfile,
  fetchImportFields,
  fetchImportHistory,
  fetchImportProfile,
  fetchImportProfiles,
  fetchImportSourceColumns,
  testImportSource,
  fetchImportSourceRows,
  fetchImportSources,
  fetchImportTargets,
  importTemplateUrl,
  parseImportFile,
  saveImportProfile,
  setImportProfileLog,
  runImportProfile,
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

const KIND_ORDER: ImportKind[] = [
  'product', 'customer', 'account', 'invoice', 'customer-voucher', 'bank-voucher', 'account-voucher',
];

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
  { value: '1', label: 'SQL Server' },
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

/** Başlık adını Kavi Soft alanına önerir. Kullanıcı eşlemeyi değiştirebilir. */
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
const fmtRun = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('tr-TR');
};

export const DataImportPage: React.FC<DataImportPageProps> = () => {
  const [targets, setTargets] = React.useState<ImportTargetDef[]>([]);
  const [sources, setSources] = React.useState<ImportSourceDef[]>([]);
  const [sourceId, setSourceId] = React.useState('bartu');
  const [kind, setKind] = React.useState<ImportKind>('product');
  const [catalog, setCatalog] = React.useState<ImportFieldDef[]>([]);
  const [extraKeys, setExtraKeys] = React.useState<string[]>([]);
  const [removedKeys, setRemovedKeys] = React.useState<string[]>([]);
  const [alias, setAlias] = React.useState<Record<string, string>>({});
  const aliasRef = React.useRef(alias);
  aliasRef.current = alias;
  const [fixedKeys, setFixedKeys] = React.useState<string[]>([]);
  const fixedRef = React.useRef(fixedKeys);
  fixedRef.current = fixedKeys;
  const touchedRef = React.useRef<string[]>([]);
  const [channel, setChannel] = React.useState<Channel>('excel');
  const [link, setLink] = React.useState<ImportSourceRequest>(emptySource);
  const [colMap, setColMap] = React.useState<Record<string, string>>({});
  const [profileId, setProfileId] = React.useState(0);
  const [profileTitle, setProfileTitle] = React.useState('');
  const [intervalMin, setIntervalMin] = React.useState('');
  const [afterSql, setAfterSql] = React.useState('');
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
  const [screen, setScreen] = React.useState<'list' | 'form'>('list');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [linkTest, setLinkTest] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [keepLog, setKeepLog] = React.useState(true);
  const [logFor, setLogFor] = React.useState<number | null>(null);
  const [profileLogs, setProfileLogs] = React.useState<ImportLogRow[]>([]);
  const [runningId, setRunningId] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const target = targets.find((t) => t.kind === kind) ?? null;
  const source = sources.find((s) => s.id === sourceId) ?? sources[0] ?? null;
  const fields = catalog.length ? catalog : (target?.fields ?? []);
  const curated = target?.fields?.length ? target.fields : fields;
  const baseTemplate = curated.filter((f) => f.required || f.defaultOn !== false);
  const known = new Map<string, ImportFieldDef>();
  for (const f of [...curated, ...fields]) known.set(f.key, f);
  const templateFields = [
    ...baseTemplate.filter((f) => !removedKeys.includes(f.key)),
    ...extraKeys
      .map((k) => known.get(k))
      .filter((f): f is ImportFieldDef => {
        if (!f) return false;
        return !baseTemplate.some((b) => b.key === f.key) && !removedKeys.includes(f.key);
      }),
  ];
  const addable = [...known.values()]
    .filter((f) => !templateFields.some((t) => t.key === f.key))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  const headerSource = channel === 'excel' ? source : null;
  const headerOf = (f: ImportFieldDef) => sourceHeader(headerSource, kind, f);
  const constantOf = (key: string) => (fixedKeys.includes(key) ? (alias[key] ?? '').trim() : '');
  /** Alanın kaynak kolonu: elle / otomatik eşleme, yoksa yazılan kaynak adı. Bir kolon birden çok alana gidebilir (ör. DESCRIPTION → Ad + Açıklama). */
  const boundHeader = (key: string): string => {
    if (!sheet || fixedKeys.includes(key)) return '';
    const direct = sheet.headers.find((h) => colMap[h] === key);
    if (direct) return direct;
    const want = (alias[key] ?? '').trim();
    return want ? sheet.headers.find((h) => norm(h) === norm(want)) ?? '' : '';
  };
  const sourceName = (f: ImportFieldDef) => {
    if (alias[f.key] !== undefined) return alias[f.key];
    if (sheet) return boundHeader(f.key);
    return headerOf(f);
  };

  React.useEffect(() => {
    let cancel = false;
    fetchImportFields(kind)
      .then((rows) => { if (!cancel) setCatalog(rows); })
      .catch(() => { if (!cancel) setCatalog([]); });
    return () => { cancel = true; };
  }, [kind]);

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
    if (!logFor) {
      setProfileLogs([]);
      return;
    }
    let cancel = false;
    fetchImportHistory(40, logFor)
      .then((rows) => { if (!cancel) setProfileLogs(rows); })
      .catch(() => { if (!cancel) setProfileLogs([]); });
    return () => { cancel = true; };
  }, [logFor, profiles]);

  React.useEffect(() => {
    if (!sheet) {
      setColMap((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    const map = autoMap(sheet.headers, templateFields, channel === 'excel' ? source : null, kind);
    const becomeFixed: string[] = [];
    for (const f of templateFields) {
      if (fixedRef.current.includes(f.key)) {
        for (const h of Object.keys(map)) if (map[h] === f.key) map[h] = '';
        continue;
      }
      if (aliasRef.current[f.key] === undefined) continue;
      const want = aliasRef.current[f.key].trim();
      for (const h of Object.keys(map)) if (map[h] === f.key) map[h] = '';
      const hit = want ? sheet.headers.find((h) => norm(h) === norm(want)) : undefined;
      if (hit) map[hit] = f.key;
      else if (want && touchedRef.current.includes(f.key)) becomeFixed.push(f.key);
    }
    if (savedMap.current) {
      for (const item of savedMap.current) {
        if (item.literal || !item.field) continue;
        if (fixedRef.current.includes(item.field)) continue;
        if (sheet.headers.includes(item.header)) map[item.header] = item.field;
      }
      savedMap.current = null;
    }
    setColMap(map);
    if (becomeFixed.length > 0)
      setFixedKeys((prev) => [...new Set([...prev, ...becomeFixed])]);
  }, [sheet, catalog, target, source, kind, channel]);

  const mappedValues = Object.values(colMap).filter(Boolean);
  const duplicateFields = [...new Set(mappedValues.filter((key, i) => mappedValues.indexOf(key) !== i))];
  const assigned = templateFields.filter((f) => Boolean(boundHeader(f.key))).map((f) => f.key);
  const missingRequired = templateFields.filter((f) => f.required && !assigned.includes(f.key) && !constantOf(f.key));
  const templateOk = Boolean(sheet && sheet.rows.length > 0 && missingRequired.length === 0 && duplicateFields.length === 0);

  React.useEffect(() => {
    setResult(null);
    setInfo(null);
  }, [target, sheet, mode, productType, accountPrefixParent, createMissingCards, sourceId, extraKeys]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setSheet(await parseImportFile(file, kind));
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
      // Aynı kolonu paylaşan alanlar (colMap tek alan tutar)
      for (const f of templateFields) {
        if (rec[f.key] !== undefined || constantOf(f.key)) continue;
        const h = boundHeader(f.key);
        if (!h) continue;
        const v = (cells[sheet.headers.indexOf(h)] ?? '').trim();
        if (!v) continue;
        rec[f.key] = v;
        any = true;
      }
      for (const f of templateFields) {
        const fixed = constantOf(f.key);
        if (!fixed) continue;
        rec[f.key] = fixed;
        any = true;
      }
      if (any) out.push(rec);
    });
    return out;
  };

  const buildSourceRows = (): Record<string, string>[] => {
    if (!sheet) return [];
    const out: Record<string, string>[] = [];
    sheet.rows.forEach((cells, i) => {
      const rec: Record<string, string> = { __row: String(i + 2) };
      sheet.headers.forEach((header, col) => {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(header)) return;
        const v = (cells[col] ?? '').trim();
        if (v) rec[header] = v;
      });
      out.push(rec);
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
      setInfo(`${headers.length} kolon başlığı SELECT altında listelendi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kolonlar okunamadı');
    } finally {
      setBusy(false);
    }
  };

  const testLink = async () => {
    setBusy(true);
    setError(null);
    setLinkTest(null);
    try {
      const res = await testImportSource(sourceRequest());
      setLinkTest({ ok: res.ok, message: res.message });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const canList = channel === '3' || Boolean((link.sql ?? '').trim());
      if (!canList) {
        setInfo(res.message);
        return;
      }
      const headers = await fetchImportSourceColumns(sourceRequest());
      savedMap.current = null;
      setSheet({ fileName: channel === '3' ? 'API' : 'SQL', sheetName: '', headers, rows: [], truncated: false });
      setInfo(`${res.message} ${headers.length} kolon başlığı listelendi.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Bağlantı kurulamadı';
      setLinkTest({ ok: false, message });
      setError(message);
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
    const title = profileTitle.trim();
    if (!title) {
      setError('Aktarım adı yazın.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Veri çekilmeden kaydetmede boundHeader boş kalır — alias / önceki eşleme korunur
      const built: ImportMapItem[] = [];
      for (const f of templateFields) {
        const fixed = constantOf(f.key);
        if (fixed) {
          built.push({ header: fixed, field: f.key, literal: true });
          continue;
        }
        const bound = boundHeader(f.key);
        if (bound) {
          built.push({ header: bound, field: f.key });
          continue;
        }
        const named = (alias[f.key] ?? '').trim();
        if (!named) continue;
        built.push(
          fixedKeys.includes(f.key)
            ? { header: named, field: f.key, literal: true }
            : { header: named, field: f.key },
        );
      }
      let map = built;
      if (map.length === 0 && profileId > 0) {
        const prev = profiles.find((p) => p.importProfileID === profileId)?.map ?? [];
        if (prev.length > 0) map = prev;
      }
      if (map.length === 0) {
        setError('Şablon eşlemesi boş. Kaynak başlıklarını alıp kolonları bağlayın, sonra kaydedin.');
        return;
      }
      const saved = await saveImportProfile({
        importProfileID: profileId,
        title,
        kind,
        sourceKind: channel === 'excel' ? 4 : Number(channel),
        source: channel === 'excel' ? { ...emptySource(), sourceType: 4 } : sourceRequest(),
        map,
        mode,
        createMissingCards,
        productType: kind === 'product' ? productType : null,
        intervalMinutes: channel === 'excel' || !intervalMin.trim() ? null : Number(intervalMin),
        afterSql: channel === 'excel' || channel === '3' ? null : (afterSql.trim() || null),
        keepLog,
        isActive: true,
      });
      setProfileId(saved.importProfileID);
      savedMap.current = map;
      setAlias(Object.fromEntries(map.filter((m) => m.field).map((m) => [m.field, m.header])));
      setFixedKeys(map.filter((m) => m.literal && m.field).map((m) => m.field));
      setProfiles(await fetchImportProfiles());
      setScreen('list');
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setProfileId(0);
    setProfileTitle('');
    setKind('product');
    setChannel('excel');
    setLink(emptySource());
    setAlias({});
    setFixedKeys([]);
    touchedRef.current = [];
    setExtraKeys([]);
    setRemovedKeys([]);
    setSheet(null);
    setAfterSql('');
    setIntervalMin('');
    setResult(null);
    setError(null);
    setInfo(null);
    setLinkTest(null);
    setKeepLog(true);
    setMode('upsert');
    setScreen('form');
  };

  const openProfile = (p: ImportProfile) => {
    setKind(p.kind);
    setChannel(p.sourceKind === 4 ? 'excel' : String(p.sourceKind) as Channel);
    setScreen('form');
    setLink({ ...emptySource(), ...p.source, password: '' });
    setProfileId(p.importProfileID);
    setProfileTitle(p.title);
    setIntervalMin(p.intervalMinutes ? String(p.intervalMinutes) : '');
    setAfterSql(p.afterSql ?? '');
    setKeepLog(p.keepLog !== false);
    setMode(p.mode);
    setCreateMissingCards(p.createMissingCards);
    if (p.productType) setProductType(p.productType);
    savedMap.current = p.map;
    const baseKeys = new Set(
      (targets.find((t) => t.kind === p.kind)?.fields ?? [])
        .filter((f) => f.required || f.defaultOn !== false)
        .map((f) => f.key),
    );
    const mapped = p.map.map((m) => m.field).filter((k) => Boolean(k));
    if (mapped.length === 0) {
      setExtraKeys([]);
      setRemovedKeys([]);
    } else {
      setExtraKeys(mapped.filter((k) => !baseKeys.has(k)));
      setRemovedKeys([...baseKeys].filter((k) => !mapped.includes(k)));
    }
    setAlias(Object.fromEntries(p.map.filter((m) => m.field).map((m) => [m.field, m.header])));
    setFixedKeys(p.map.filter((m) => m.literal && m.field).map((m) => m.field));
    touchedRef.current = [];
    void fetchImportProfile(p.importProfileID)
      .then((full) => {
        const pwd = full.source?.password ?? '';
        if (pwd) setLink((cur) => ({ ...cur, password: pwd }));
      })
      .catch(() => { /* şifre alanı boş kalır; kayıtlı değer sunucuda durur */ });
    setSheet(null);
    setLinkTest(null);
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
        afterSql: channel !== 'excel' && channel !== '3' ? afterSql.trim() || undefined : undefined,
        source: channel !== 'excel' && channel !== '3' && afterSql.trim() ? sourceRequest() : undefined,
        sourceRows: channel !== 'excel' && channel !== '3' && afterSql.trim() ? buildSourceRows() : undefined,
      });
      setResult(r);
      setOnlyProblems(r.failed > 0 || (r.afterFailed ?? 0) > 0);
      const summary = `${r.inserted} yeni · ${r.updated} güncelleme · ${r.skipped} atlanan · ${r.failed} hata`;
      const after = r.afterError
        ? ` · kaynak güncellenemedi: ${r.afterError}`
        : (r.afterUpdated || r.afterFailed)
          ? ` · kaynak ${r.afterUpdated ?? 0} güncellendi${r.afterFailed ? `, ${r.afterFailed} hata` : ''}`
          : dryRun && afterSql.trim() ? ' · kaynak güncellemesi kayıtta çalışır' : '';
      const cut = r.rowsTruncated ? ' · listede yalnız hatalar var, sayılar tamdır' : '';
      setInfo((dryRun ? `Kontrol tamamlandı: ${summary}` : `Aktarım tamamlandı: ${summary}`) + (after ?? '') + cut);
      if (!dryRun) void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım başarısız');
    } finally {
      setBusy(false);
    }
  };

  const previewRows = sheet ? sheet.rows.slice(0, 5) : [];
  const mappedFields = templateFields.filter((f) => Boolean(boundHeader(f.key)) || Boolean(constantOf(f.key)));
  const colOf = (key: string) => {
    const h = boundHeader(key);
    return sheet && h ? sheet.headers.indexOf(h) : -1;
  };
  const headerFor = (key: string) => boundHeader(key);

  const bindField = (fieldKey: string, header: string) => {
    setColMap((prev) => {
      const next = { ...prev };
      for (const h of Object.keys(next)) {
        if (next[h] === fieldKey) next[h] = '';
      }
      if (header) next[header] = fieldKey;
      return next;
    });
  };

  const setSourceName = (fieldKey: string, name: string) => {
    if (!touchedRef.current.includes(fieldKey)) touchedRef.current = [...touchedRef.current, fieldKey];
    setAlias((prev) => ({ ...prev, [fieldKey]: name }));
    if (!sheet) {
      setFixedKeys((prev) => prev.filter((k) => k !== fieldKey));
      return;
    }
    const trimmed = name.trim();
    const hit = sheet.headers.find((h) => norm(h) === norm(trimmed)) ?? '';
    const asValue = Boolean(trimmed) && !hit;
    setFixedKeys((prev) => {
      const has = prev.includes(fieldKey);
      if (asValue && !has) return [...prev, fieldKey];
      if (!asValue && has) return prev.filter((k) => k !== fieldKey);
      return prev;
    });
    bindField(fieldKey, asValue ? '' : hit);
  };

  const bindByOrder = () => {
    if (!sheet) return;
    const next: Record<string, string> = {};
    const names: Record<string, string> = {};
    templateFields.forEach((f, i) => {
      const h = sheet.headers[i];
      if (!h) return;
      next[h] = f.key;
      names[f.key] = h;
    });
    for (const h of sheet.headers) if (!(h in next)) next[h] = '';
    setAlias((prev) => ({ ...prev, ...names }));
    setFixedKeys((prev) => prev.filter((k) => !templateFields.some((f) => f.key === k)));
    setColMap(next);
    setInfo('Kolonlar şablon sırasına bağlandı.');
  };
  const runNow = async (p: ImportProfile) => {
    if (p.sourceKind === 4) {
      setError('Excel aktarımı dosya seçilerek çalışır. Aç ile dosyayı seçin.');
      return;
    }
    if (!await appConfirm(`"${p.title}" şimdi aktarılsın mı?`)) return;
    setBusy(true);
    setRunningId(p.importProfileID);
    setError(null);
    try {
      const r = await runImportProfile(p.importProfileID, false);
      setInfo(`${p.title}: ${r.inserted} yeni, ${r.updated} güncelleme, ${r.skipped} atlanan, ${r.failed} hata.`);
      setProfiles(await fetchImportProfiles());
      if (p.keepLog !== false) setLogFor(p.importProfileID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım çalışmadı');
      setProfiles(await fetchImportProfiles().catch(() => profiles));
    } finally {
      setBusy(false);
      setRunningId(null);
    }
  };

  const removeProfile = async (p: ImportProfile) => {
    if (!await appConfirm(`"${p.title}" silinsin mi?`)) return;
    try {
      await deleteImportProfile(p.importProfileID);
      if (logFor === p.importProfileID) setLogFor(null);
      setProfiles((prev) => prev.filter((x) => x.importProfileID !== p.importProfileID));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const toggleLog = async (p: ImportProfile, keep: boolean) => {
    setError(null);
    try {
      await setImportProfileLog(p.importProfileID, keep);
      setProfiles((prev) => prev.map((x) => x.importProfileID === p.importProfileID ? { ...x, keepLog: keep } : x));
      if (keep) setLogFor(p.importProfileID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Log ayarı kaydedilemedi');
    }
  };

  const resultRows = result ? (onlyProblems ? result.rows.filter((r) => r.action === 'error' || r.message) : result.rows) : [];
  const sourceLabel = (sourceKind: number) =>
    sourceKind === 4 ? 'Excel / CSV' : (CHANNELS.find((c) => c.value === String(sourceKind))?.label ?? 'SQL');

  if (screen === 'list') {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Veri Aktarımı</h2>
          <button
            type="button"
            onClick={startNew}
            className="ml-auto inline-flex items-center px-3 h-8 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md"
          >
            Ekle
          </button>
        </div>
        {error && <div className="text-[12px] text-red-600">{error}</div>}
        {info && <div className="text-[12px] text-emerald-700">{info}</div>}
        <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr className="text-[11px] text-slate-600">
                <th className="px-2 py-1.5 w-14" />
                <th className="px-2 py-1.5">Ad</th>
                <th className="px-2 py-1.5">Tür</th>
                <th className="px-2 py-1.5">Kaynak</th>
                <th className="px-2 py-1.5">Aralık</th>
                <th className="px-2 py-1.5">Son aktarım</th>
                <th className="px-2 py-1.5">Son durum</th>
                <th className="px-2 py-1.5">Log takibi</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                    Kayıtlı aktarım yok. Ekle ile yeni aktarım tanımlayın.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.importProfileID} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 h-9 group">
                    <td className="px-2 py-1 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40">
                      <RowActions
                        allowed={{ view: true, create: false, update: true, delete: true }}
                        handlers={{
                          onView: () => openProfile(p),
                          onEdit: () => openProfile(p),
                          onDelete: () => void removeProfile(p),
                        }}
                        extraItems={[
                          {
                            key: 'run',
                            label: runningId === p.importProfileID ? 'Aktarılıyor' : 'Şimdi aktar',
                            icon: <Play className="w-3.5 h-3.5" />,
                            onClick: () => void runNow(p),
                          },
                          {
                            key: 'log',
                            label: 'Log',
                            icon: <ScrollText className="w-3.5 h-3.5" />,
                            onClick: () => setLogFor(p.importProfileID),
                          },
                        ]}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-medium">{p.title}</td>
                    <td className="px-2 py-1.5">{KIND_LABEL[p.kind] ?? p.kind}</td>
                    <td className="px-2 py-1.5 text-slate-600">{sourceLabel(p.sourceKind)}</td>
                    <td className="px-2 py-1.5 text-slate-500">{p.intervalMinutes ? `${p.intervalMinutes} dk` : 'elle'}</td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtRun(p.lastRunAt)}</td>
                    <td className="px-2 py-1.5 text-slate-500">{p.lastStatus || '—'}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        title="Log takibi"
                        checked={p.keepLog !== false}
                        onChange={(e) => void toggleLog(p, e.target.checked)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {logFor != null && (
          <section className="space-y-1.5">
            <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              Log — {profiles.find((p) => p.importProfileID === logFor)?.title ?? 'Aktarım'}
            </h3>
            <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr className="text-[11px] text-slate-600">
                    <th className="px-2 py-1.5">Zaman</th>
                    <th className="px-2 py-1.5 text-right">Satır</th>
                    <th className="px-2 py-1.5 text-right">Yeni</th>
                    <th className="px-2 py-1.5 text-right">Güncelleme</th>
                    <th className="px-2 py-1.5 text-right">Atlanan</th>
                    <th className="px-2 py-1.5 text-right">Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {profileLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-center text-slate-400">Bu aktarımın logu yok.</td>
                    </tr>
                  ) : profileLogs.map((h) => (
                    <tr key={h.ImportLogID} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1 text-slate-500">{fmtTime(h.ImportedAt)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{h.TotalRows}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-emerald-700">{h.Inserted}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-blue-700">{h.Updated}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{h.Skipped}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${h.Failed ? 'text-red-600' : ''}`}>{h.Failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setScreen('list'); setError(null); }}
            className="px-3 h-8 text-[12px] font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Geri
          </button>
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
            {profileId ? 'Aktarımı düzenle' : 'Yeni aktarım'}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveProfile()}
            className="ml-auto px-3 h-8 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>

      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-3">
        <label className="block max-w-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-600">Aktarım</span>
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              setCatalog([]);
              setExtraKeys([]);
              setRemovedKeys([]);
              setAlias({});
              setFixedKeys([]);
              touchedRef.current = [];
              setSheet(null);
              setProfileId(0);
            }}
          >
            {(targets.length ? [...targets.map((t) => t.kind)].sort((a, b) => KIND_ORDER.indexOf(a as ImportKind) - KIND_ORDER.indexOf(b as ImportKind)) : KIND_ORDER).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k] ?? targets.find((t) => t.kind === k)?.title ?? k}</option>
            ))}
          </select>
        </label>

        {target && (
          <ul className="text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-0.5">
            <li>
              Hedef tablo: <span className="font-mono">{target.tableName}</span>
            </li>
            {target.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {channel === 'excel' && source?.note && <li>{source.note}</li>}
          </ul>
        )}
        {target && templateFields.length > 0 && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-600">Kolon başlık şablonu</span>
              <span className="text-[11px] text-slate-400">{templateFields.length} kolon</span>
              {sheet && sheet.headers.length > 0 && (
                <button type="button" className="text-[11px] text-blue-700 hover:underline" onClick={bindByOrder}>
                  Kolon sırasına bağla
                </button>
              )}
              <select
                className="h-7 max-w-[220px] rounded border border-slate-300 bg-white px-1 text-[11px]"
                value=""
                onChange={(e) => {
                  const key = e.target.value;
                  if (!key) return;
                  setRemovedKeys((prev) => prev.filter((k) => k !== key));
                  if (!baseTemplate.some((b) => b.key === key))
                    setExtraKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
                }}
              >
                <option value="">Şablona kolon ekle…</option>
                {addable.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500">
              Kaynak kolon, listedeki bir başlıksa o kolondan okunur. Listede yoksa yazdığınız metin her satıra sabit değer olarak yazılır.
              {kind === 'account-voucher' ? ' e-Defter yevmiye XML veya ZIP yalnız bu aktarımda okunur.' : ''}
            </p>
            <div className="max-h-56 overflow-auto rounded border border-slate-200 bg-white dark:bg-slate-900">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2 py-1 w-16">Sıra</th>
                    <th className="px-2 py-1">Başlık</th>
                    <th className="px-2 py-1 w-[220px]">Kaynak kolon</th>
                  </tr>
                </thead>
                <tbody>
                  {templateFields.map((f, i) => (
                    <tr key={f.key} className="border-t border-slate-100">
                      <td className="px-2 py-1">
                        <span className="inline-flex items-center gap-1 tabular-nums text-slate-400">
                          <button
                            type="button"
                            title="Çıkar"
                            className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 text-[12px] leading-none text-slate-500 hover:border-red-300 hover:text-red-600"
                            onClick={() => {
                              if (baseTemplate.some((b) => b.key === f.key))
                                setRemovedKeys((prev) => (prev.includes(f.key) ? prev : [...prev, f.key]));
                              setExtraKeys((prev) => prev.filter((k) => k !== f.key));
                            }}
                          >
                            −
                          </button>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <span className="font-medium text-slate-800">{headerOf(f)}</span>
                        {f.required && <span className="text-red-600"> *</span>}
                        {f.label !== headerOf(f) && <span className="text-slate-400"> · {f.label}</span>}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={`h-7 w-full rounded border bg-white px-1.5 text-[11px] ${f.required && sheet && !headerFor(f.key) && !constantOf(f.key) ? 'border-red-300' : 'border-slate-300'}`}
                          value={sourceName(f)}
                          placeholder={headerOf(f)}
                          title="Kolon adı veya her satıra yazılacak sabit değer"
                          list={sheet && sheet.headers.length > 0 ? `imp-col-${f.key}` : undefined}
                          onChange={(e) => setSourceName(f.key, e.target.value)}
                        />
                        {sheet && sheet.headers.length > 0 && (
                          <datalist id={`imp-col-${f.key}`}>
                            {sheet.headers.map((h) => <option key={h} value={h} />)}
                          </datalist>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <label className="md:col-span-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Kaynak</span>
            <select className={inputCls} value={channel} onChange={(e) => { setChannel(e.target.value as Channel); setSheet(null); setLinkTest(null); }}>
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          {channel === 'excel' && (
          <label className="md:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Excel şablonu</span>
            <select className={inputCls} value={source?.id ?? 'bartu'} onChange={(e) => { setSourceId(e.target.value); setAlias({}); setFixedKeys([]); touchedRef.current = []; }}>
              {(sources.length ? sources : [{ id: 'bartu', title: 'Kavi Soft', note: '', headers: {} }]).map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          )}
          {kind === 'product' && (
            <label className="md:col-span-3 space-y-1" title="Kaynakta Kart Tipi / CARDTYPE bağlıysa satırdaki değer kullanılır">
              <span className="text-[11px] font-medium text-slate-600">Varsayılan tip (kolon yoksa)</span>
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
              href={importTemplateUrl(kind, source?.id ?? 'bartu', templateFields.map((f) => f.key))}
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
              {kind === 'account-voucher' ? 'Dosya / Yevmiye' : 'Dosya Seç'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={kind === 'account-voucher' ? '.xlsx,.csv,.txt,.xml,.zip' : '.xlsx,.csv,.txt'}
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          )}
        </div>
        {channel !== 'excel' && (
          <div className="space-y-2 rounded border border-sky-200 bg-white/70 p-2">
            <p className="text-[11px] text-slate-600">
              Kendi SELECT sorgunuzu yazın. Kolon sırası şablondaki 1, 2, 3 sırasıdır. Başlığı şablondaki adla verirseniz (AS) kendiliğinden bağlanır.
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
                      <input type="password" className={inputCls} value={link.password ?? ''} autoComplete="new-password" placeholder={profileId ? 'kayıtlı şifre burada durur' : ''} onChange={(e) => setLink({ ...link, password: e.target.value })} />
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
            {sheet && sheet.headers.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-600">Kolon başlıkları</span>
                <ul className="flex flex-wrap gap-1">
                  {sheet.headers.map((h) => (
                    <li key={h} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {channel !== '3' && (
              <label className="block text-[11px]">Aktarımdan sonra
                <textarea
                  className={`${inputCls} h-20 font-mono py-1`}
                  spellCheck={false}
                  value={afterSql}
                  placeholder={'UPDATE dbo.Kaynak SET Aktarildi = 1, HedefId = @KayitId WHERE EvrakNo = @BelgeNo'}
                  onChange={(e) => setAfterSql(e.target.value)}
                />
                <span className="mt-0.5 block text-slate-500">
                  Her başarılı kayıttan sonra kaynakta çalışır. @KayitId oluşan kayıt no, @BelgeNo belge no, @FisNo fiş no, @Kod kart veya fiş kodu. Kaynak kolon adı da yazılır: @StokKodu.
                </span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void testLink()} className="rounded border border-emerald-300 bg-emerald-50 px-2 h-8 text-[12px] font-semibold text-emerald-800 disabled:opacity-50">Bağlantıyı kontrol et</button>
              {linkTest && (
                <span className={`text-[11px] ${linkTest.ok ? 'text-emerald-700' : 'text-red-600'}`}>{linkTest.message}</span>
              )}
              <button type="button" disabled={busy} onClick={() => void pullColumns()} className="rounded border border-sky-300 bg-white px-2 h-8 text-[12px] text-sky-800 disabled:opacity-50">Başlıkları al</button>
              <button type="button" disabled={busy} onClick={() => void pullRows()} className="rounded border border-sky-300 bg-white px-2 h-8 text-[12px] text-sky-800 disabled:opacity-50">Veriyi çek</button>
              {channel !== '3' && <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 h-8 text-[12px] text-slate-700 disabled:opacity-50"
                onClick={() => {
                  if ((link.sql ?? '').trim()) {
                    setInfo('SELECT dolu. Kolonları şablon sırasına göre yazın ya da başlıkları aldıktan sonra listeden bağlayın.');
                    return;
                  }
                  const lines = templateFields.map((f) => `  '' AS [${sourceName(f)}]`);
                  setLink({ ...link, sql: `SELECT\n${lines.join(',\n')}\nFROM ` });
                }}
              >
                Şablon sırasını SQL’e yaz
              </button>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <label className="md:col-span-4 block text-[11px]">Aktarım adı
            <input className={inputCls} value={profileTitle} placeholder="Cari kart aktarımı" onChange={(e) => setProfileTitle(e.target.value)} />
          </label>
          <label className="md:col-span-2 block text-[11px]">Aralık (dk)
            <input className={inputCls} type="number" min={5} value={intervalMin} placeholder="elle" onChange={(e) => setIntervalMin(e.target.value)} />
          </label>
          <label className="md:col-span-2 inline-flex items-center gap-2 h-8 text-[12px] text-slate-700 dark:text-slate-200">
            <input type="checkbox" className="accent-blue-600" checked={keepLog} onChange={(e) => setKeepLog(e.target.checked)} />
            Log takibi
          </label>
          <button type="button" disabled={busy || channel === 'excel'} onClick={() => void saveProfile()} className="md:col-span-3 h-8 rounded bg-amber-600 text-white text-[12px] font-semibold disabled:opacity-50">Sürece bağla ve kaydet</button>
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
          {missingRequired.length > 0 && (
            <p className="text-[12px] text-red-700">Zorunlu başlık bağlanmadı: {missingRequired.map((f) => headerOf(f)).join(', ')}</p>
          )}
          {duplicateFields.length > 0 && (
            <p className="text-[12px] text-red-700">Aynı Kavi Soft alanına birden fazla kolon bağlandı.</p>
          )}
          {templateOk && (
            <p className="text-[12px] text-emerald-700">
              {assigned.length} kolon bağlandı
              {fixedKeys.length > 0 ? ` · ${fixedKeys.length} sabit değer` : ''}
              {' · '}{sheet.rows.length} satır
            </p>
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
                          {constantOf(f.key) || (cells[colOf(f.key)] ?? '')}
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
