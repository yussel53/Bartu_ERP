import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { apiJson } from '../config/api';
import { appToast } from '../utils/appToast';
import {
  MODULE_PARAM_DEFS,
  MODULE_PARAM_TITLES,
  type ModuleParamKey,
  type ParamDef,
} from '../data/paramDefs';

interface ApiItem {
  code?: string;
  Code?: string;
  title?: string;
  Title?: string;
  value?: string;
  Value?: string;
}

function pick(r: ApiItem, ...keys: string[]): string {
  const o = r as Record<string, unknown>;
  for (const k of keys) {
    if (o[k] != null && String(o[k]).length) return String(o[k]);
    const f = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
    if (f && o[f] != null) return String(o[f]);
  }
  return '';
}

const HEADER_COLORS: Record<ModuleParamKey, string> = {
  kasa: 'bg-violet-700',
  fatura: 'bg-sky-700',
  stok: 'bg-emerald-700',
  cari: 'bg-amber-700',
};

/** Sistem → Parametreler → modül grid (Mikro Adı / Değeri) */
export const ModuleParamsPage: React.FC<{
  moduleKey: ModuleParamKey;
  onBack: () => void;
}> = ({ moduleKey, onBack }) => {
  const defs = MODULE_PARAM_DEFS[moduleKey];
  const title = MODULE_PARAM_TITLES[moduleKey];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const rows = await apiJson<ApiItem[]>(`/api/module-params/${moduleKey}`);
        const map: Record<string, string> = {};
        for (const d of defs) map[d.code] = d.defaultValue;
        for (const r of rows || []) {
          const code = pick(r, 'code', 'Code');
          if (code) map[code] = pick(r, 'value', 'Value') || map[code] || '';
        }
        setValues(map);
        setSectionFilter('all');
      } catch (e) {
        appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [moduleKey, defs]);

  const sections = useMemo(() => {
    const s = new Set<string>();
    for (const d of defs) if (d.section) s.add(d.section);
    return ['all', ...[...s]];
  }, [defs]);

  const visible = useMemo(
    () => (sectionFilter === 'all' ? defs : defs.filter((d) => d.section === sectionFilter)),
    [defs, sectionFilter],
  );

  const setVal = (code: string, v: string) => setValues((prev) => ({ ...prev, [code]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const items = defs.map((d) => ({
        code: d.code,
        title: d.title,
        value: values[d.code] ?? d.defaultValue,
      }));
      await apiJson(`/api/module-params/${moduleKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      appToast(`${title} parametreleri kaydedildi`);
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = (d: ParamDef, v: string) => {
    if (d.editor.kind === 'yesno') {
      return (
        <select
          value={v === '1' ? '1' : '0'}
          onChange={(e) => setVal(d.code, e.target.value)}
          className="h-7 w-full max-w-[220px] px-1.5 border border-slate-300 rounded-sm bg-white"
        >
          <option value="0">Hayır</option>
          <option value="1">Evet</option>
        </select>
      );
    }
    if (d.editor.kind === 'number') {
      return (
        <input
          type="number"
          step={d.editor.step || '0.01'}
          value={v}
          onChange={(e) => setVal(d.code, e.target.value)}
          className="h-7 w-full max-w-[120px] px-1.5 border border-slate-300 rounded-sm tabular-nums"
        />
      );
    }
    return (
      <select
        value={v}
        onChange={(e) => setVal(d.code, e.target.value)}
        className="h-7 w-full max-w-[320px] px-1.5 border border-slate-300 rounded-sm bg-white"
      >
        {d.editor.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[30vh] flex items-center justify-center text-[12px] text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  let lastSection = '';

  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800">{title} Parametreleri</h1>
          <p className="text-[11px] text-slate-500 max-w-xl mt-0.5">
            Aktif = kayda bağlı · Yakında = kayıtlı, sonraki turda bağlanır · Öndeğer işaretli satırlar varsayılan
            değer taşır
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Kaydet
        </button>
      </div>

      {sections.length > 2 && (
        <div className="flex flex-wrap gap-1">
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSectionFilter(s)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded-sm border ${
                sectionFilter === s
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Tümü' : s}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
        <div className={`px-3 py-2 text-white text-[13px] font-semibold ${HEADER_COLORS[moduleKey]}`}>
          {title}
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="text-left font-semibold px-3 py-1.5 w-[55%]">Adı</th>
              <th className="text-left font-semibold px-3 py-1.5">Değeri</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => {
              const showSec = d.section && d.section !== lastSection && sectionFilter === 'all';
              if (d.section) lastSection = d.section;
              const v = values[d.code] ?? d.defaultValue;
              return (
                <React.Fragment key={d.code}>
                  {showSec ? (
                    <tr className="bg-slate-100/80">
                      <td colSpan={2} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {d.section}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-1.5 text-slate-800 align-middle">
                      {d.title}
                      {d.kind === 'ondeger' ? (
                        <span className="ml-1.5 text-[9px] font-medium text-sky-700 uppercase">öndeğer</span>
                      ) : null}
                      {d.upcoming ? (
                        <span className="ml-1.5 text-[9px] font-medium text-slate-400 uppercase">yakında</span>
                      ) : (
                        <span className="ml-1.5 text-[9px] font-medium text-emerald-600 uppercase">aktif</span>
                      )}
                    </td>
                    <td className="px-3 py-1 align-middle">{renderEditor(d, v)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
