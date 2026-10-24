import React, { useEffect, useState } from 'react';
import { listTableColumns, type ExtraFieldTarget } from '../api/extraFieldsApi';
import { previewProcessSource, testProcessSource } from '../api/processApi';

type ScanCol = { name: string; kind: 'alan' | 'tablo' };
type MapRow = { alan: string; mod: 'column' | 'template' | 'fixed'; deger: string };

const SOURCES = [
  { value: 0, label: 'Bu veritabanı (SELECT)' },
  { value: 1, label: 'SQL Server' },
  { value: 2, label: 'MySQL' },
  { value: 3, label: 'REST API (JSON)' },
];

function readCfg(json?: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeCfg(json: string | null | undefined, patch: Record<string, unknown>): string | null {
  const next: Record<string, unknown> = { ...readCfg(json), ...patch };
  for (const key of Object.keys(next)) {
    if (next[key] == null || next[key] === '') delete next[key];
  }
  return Object.keys(next).length ? JSON.stringify(next) : null;
}

function text(cfg: Record<string, unknown>, key: string): string {
  const v = cfg[key];
  return typeof v === 'string' ? v : '';
}

function readCols(cfg: Record<string, unknown>): ScanCol[] {
  if (!Array.isArray(cfg.columns)) return [];
  return cfg.columns.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rec = item as { name?: unknown; kind?: unknown };
    const name = String(rec.name ?? '').trim();
    if (!name) return [];
    return [{ name, kind: rec.kind === 'tablo' ? 'tablo' as const : 'alan' as const }];
  });
}

function readMaps(cfg: Record<string, unknown>): MapRow[] {
  if (!Array.isArray(cfg.eslesme)) return [];
  return cfg.eslesme.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rec = item as { alan?: unknown; mod?: unknown; deger?: unknown };
    const alan = String(rec.alan ?? '').trim();
    if (!alan) return [];
    const mod = rec.mod === 'template' || rec.mod === 'fixed' ? rec.mod : 'column';
    return [{ alan, mod, deger: String(rec.deger ?? '') }];
  });
}

const inputCls = 'mt-0.5 w-full rounded border border-black/10 bg-white px-2 py-1 text-[12px]';

export const DataFetchEditor: React.FC<{
  json?: string | null;
  onChange: (json: string | null) => void;
  onError: (text: string) => void;
}> = ({ json, onChange, onError }) => {
  const cfg = readCfg(json);
  const sourceType = Number(cfg.sourceType ?? 0);
  const cols = readCols(cfg);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);

  const set = (patch: Record<string, unknown>) => onChange(writeCfg(json, patch));

  const loadCols = async () => {
    setBusy(true);
    setNote('');
    try {
      const names = await previewProcessSource(cfg);
      const prev = new Map(cols.map((c) => [c.name.toLowerCase(), c.kind]));
      set({ columns: names.map((name) => ({ name, kind: prev.get(name.toLowerCase()) ?? 'alan' })) });
      setNote(`${names.length} kolon alındı. Sonraki Modüle Aktar işi bunları kullanır.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kolonlar okunamadı');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setNote('');
    try {
      const res = await testProcessSource(cfg);
      setDatabases(res.databases ?? []);
      setNote(res.message);
      if (!res.ok) onError(res.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Bağlantı kurulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm:col-span-2 space-y-2 rounded border border-sky-200 bg-sky-50/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-sky-800">Veri çek · kaynak</div>
      <label className="block text-[11px]">
        Kaynak
        <select value={sourceType} onChange={(e) => set({ sourceType: Number(e.target.value) })} className={inputCls}>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>

      {sourceType === 1 || sourceType === 2 ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] col-span-2 sm:col-span-1">
            Sunucu
            <input value={text(cfg, 'server')} onChange={(e) => set({ server: e.target.value })} className={inputCls} placeholder={sourceType === 2 ? 'mysql.site.com' : 'sunucu\\SQLEXPRESS'} />
          </label>
          <label className="block text-[11px]">
            Port
            <input value={text(cfg, 'port')} onChange={(e) => set({ port: e.target.value })} className={inputCls} placeholder={sourceType === 2 ? '3306' : ''} />
          </label>
          {sourceType === 1 && (
            <label className="col-span-2 flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={cfg.windowsAuth === true} onChange={(e) => set({ windowsAuth: e.target.checked })} />
              Windows kimliği
            </label>
          )}
          {!(sourceType === 1 && cfg.windowsAuth === true) && (
            <>
              <label className="block text-[11px]">
                Kullanıcı
                <input value={text(cfg, 'user')} onChange={(e) => set({ user: e.target.value })} className={inputCls} autoComplete="off" />
              </label>
              <label className="block text-[11px]">
                Şifre
                <input type="password" value={text(cfg, 'password')} onChange={(e) => set({ password: e.target.value })} className={inputCls} autoComplete="new-password" />
              </label>
            </>
          )}
          <label className="block text-[11px] col-span-2">
            Veritabanı
            {databases.length > 0 ? (
              <select value={text(cfg, 'database')} onChange={(e) => set({ database: e.target.value })} className={inputCls}>
                <option value="">Seçiniz</option>
                {databases.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            ) : (
              <input value={text(cfg, 'database')} onChange={(e) => set({ database: e.target.value })} className={inputCls} />
            )}
          </label>
          {sourceType === 1 && (
            <label className="col-span-2 flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={cfg.trustCertificate !== false} onChange={(e) => set({ trustCertificate: e.target.checked })} />
              Sunucu sertifikasına güven
            </label>
          )}
        </div>
      ) : null}

      {sourceType === 3 ? (
        <div className="space-y-2">
          <label className="block text-[11px]">
            Yöntem
            <select value={text(cfg, 'apiMethod') || 'GET'} onChange={(e) => set({ apiMethod: e.target.value })} className={inputCls}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </label>
          <label className="block text-[11px]">
            Adres
            <input value={text(cfg, 'apiUrl')} onChange={(e) => set({ apiUrl: e.target.value })} className={inputCls} placeholder="https://site.com/api/kayitlar" />
          </label>
          <label className="block text-[11px]">
            Başlıklar
            <textarea value={text(cfg, 'apiHeaders')} onChange={(e) => set({ apiHeaders: e.target.value })} rows={2} className={`${inputCls} font-mono`} placeholder={'Authorization: Bearer …\nX-Api-Key: …'} />
          </label>
          {(text(cfg, 'apiMethod') || 'GET') === 'POST' && (
            <label className="block text-[11px]">
              İstek gövdesi
              <textarea value={text(cfg, 'body')} onChange={(e) => set({ body: e.target.value })} rows={3} className={`${inputCls} font-mono`} />
            </label>
          )}
          <label className="block text-[11px]">
            Kayıt listesi yolu
            <input value={text(cfg, 'jsonPath')} onChange={(e) => set({ jsonPath: e.target.value })} className={inputCls} placeholder="data.items" />
          </label>
        </div>
      ) : (
        <label className="block text-[11px]">
          SELECT
          <textarea
            value={text(cfg, 'sql')}
            onChange={(e) => set({ sql: e.target.value })}
            rows={4}
            spellCheck={false}
            placeholder="SELECT ... FROM ... WHERE ..."
            className={`${inputCls} font-mono`}
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {sourceType !== 0 && (
          <button type="button" disabled={busy} onClick={() => void test()} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] disabled:opacity-50">
            Bağlantıyı kontrol et
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void loadCols()} className="rounded border border-sky-300 bg-white px-2 py-1 text-[11px] text-sky-800 disabled:opacity-50">
          {busy ? 'Okunuyor…' : 'Kolon başlıklarını al'}
        </button>
      </div>
      {note && <p className="text-[11px] text-slate-600">{note}</p>}

      {cols.length > 0 && (
        <div className="rounded border border-black/10 bg-white p-2 space-y-1">
          {cols.map((col) => (
            <label key={col.name} className="flex items-center gap-2 text-[12px]">
              <span className="font-mono flex-1 min-w-0 truncate">{col.name}</span>
              <select
                value={col.kind}
                onChange={(e) => {
                  const kind = e.target.value === 'tablo' ? 'tablo' : 'alan';
                  set({ columns: cols.map((c) => (c.name === col.name ? { ...c, kind } : c)) });
                }}
                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px]"
              >
                <option value="alan">Alan</option>
                <option value="tablo">Tablo</option>
              </select>
            </label>
          ))}
          {cols.some((c) => c.kind === 'tablo') && (
            <label className="block text-[11px] pt-1">
              Tablo adı
              <input value={text(cfg, 'tabloAdi') || 'Satirlar'} onChange={(e) => set({ tabloAdi: e.target.value.trim() || 'Satirlar' })} className={`${inputCls} font-mono`} />
            </label>
          )}
        </div>
      )}
      <label className="block text-[11px]">
        Benzersiz kolon
        <input value={text(cfg, 'keyField')} onChange={(e) => set({ keyField: e.target.value })} className={inputCls} placeholder="aynı kayıt ikinci kez aktarılmasın" />
      </label>
    </div>
  );
};

export const ModuleTransferEditor: React.FC<{
  json?: string | null;
  targets: ExtraFieldTarget[];
  sourceNames: string[];
  onChange: (json: string | null) => void;
  onError: (text: string) => void;
}> = ({ json, targets, sourceNames, onChange, onError }) => {
  const cfg = readCfg(json);
  const maps = readMaps(cfg);
  const hedef = text(cfg, 'hedefTablo');
  const [fields, setFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const set = (patch: Record<string, unknown>) => onChange(writeCfg(json, patch));

  useEffect(() => {
    if (!hedef) {
      setFields([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    listTableColumns(hedef)
      .then((cols) => {
        if (!cancel) setFields(cols);
      })
      .catch((e) => {
        if (!cancel) onError(e instanceof Error ? e.message : 'Hedef alanlar okunamadı');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [hedef]);

  const updateRow = (index: number, row: MapRow) => {
    set({ eslesme: maps.map((m, i) => (i === index ? row : m)) });
  };

  return (
    <div className="sm:col-span-2 space-y-2 rounded border border-amber-200 bg-amber-50/50 p-2">
      <div className="text-[10px] uppercase tracking-wide text-amber-900">Modüle aktar · hedef</div>
      <p className="text-[11px] text-slate-600">
        Kaynak SQL, dış veritabanı veya REST olsa da aynı iş. Soldaki kolonlar önceki Veri Çek adımından gelir.
      </p>
      <label className="block text-[11px]">
        Modül
        <select value={hedef} onChange={(e) => set({ hedefTablo: e.target.value })} className={inputCls}>
          <option value="">Seçiniz</option>
          {targets.map((t) => (
            <option key={t.tableName} value={t.tableName}>{t.group} · {t.title}</option>
          ))}
        </select>
      </label>
      {sourceNames.length === 0 && (
        <p className="text-[11px] text-amber-800">Önce bir Veri Çek işi ekleyip kolon başlıklarını alın.</p>
      )}
      {maps.map((row, index) => (
        <div key={`${row.alan}-${index}`} className="grid grid-cols-1 sm:grid-cols-4 gap-1 items-end">
          <label className="block text-[11px] sm:col-span-1">
            Hedef alan
            <select value={row.alan} onChange={(e) => updateRow(index, { ...row, alan: e.target.value })} className={inputCls}>
              <option value={row.alan}>{row.alan || 'Seçiniz'}</option>
              {fields.filter((f) => f !== row.alan).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="block text-[11px]">
            Nereden
            <select
              value={row.mod}
              onChange={(e) => updateRow(index, { ...row, mod: e.target.value as MapRow['mod'] })}
              className={inputCls}
            >
              <option value="column">Kolondan</option>
              <option value="template">Şablon</option>
              <option value="fixed">Sabit</option>
            </select>
          </label>
          <label className="block text-[11px] sm:col-span-2">
            Değer
            {row.mod === 'column' ? (
              <select value={row.deger} onChange={(e) => updateRow(index, { ...row, deger: e.target.value })} className={inputCls}>
                <option value="">Seçiniz</option>
                {sourceNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <input value={row.deger} onChange={(e) => updateRow(index, { ...row, deger: e.target.value })} className={`${inputCls} font-mono`} placeholder={row.mod === 'template' ? '{Kolon}' : ''} />
            )}
          </label>
        </div>
      ))}
      <button
        type="button"
        disabled={!hedef || loading}
        onClick={() => set({ eslesme: [...maps, { alan: fields[0] || '', mod: 'column', deger: '' }] })}
        className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-900 disabled:opacity-50"
      >
        {loading ? 'Alanlar okunuyor…' : 'Hedef alan ekle'}
      </button>
    </div>
  );
};
