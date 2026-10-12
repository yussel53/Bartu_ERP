import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  ExtraFieldDataType,
  ExtraFieldDef,
  ExtraFieldTarget,
  deleteExtraField,
  listExtraFieldTargets,
  listExtraFields,
  listTableColumns,
  saveExtraField,
} from '../api/extraFieldsApi';
import { FORMULA_FUNCTIONS, evaluateFormula } from '../data/formulaEval';
import { loadExtraFields } from '../data/extraFields';

interface ExtraFieldsAdminPageProps {
  /** Dolu ise yalnızca bu tablonun alanları yönetilir */
  tableFilter?: string;
  onBack: () => void;
}

const DATA_TYPES: { value: ExtraFieldDataType; label: string; hint: string }[] = [
  { value: 'text', label: 'Metin', hint: 'NVARCHAR' },
  { value: 'date', label: 'Tarih', hint: 'DATETIME' },
  { value: 'float', label: 'Ondalık', hint: 'FLOAT' },
];

const DATA_TYPE_LABEL: Record<string, string> = {
  text: 'Metin',
  date: 'Tarih',
  float: 'Ondalık',
};

export const ExtraFieldsAdminPage: React.FC<ExtraFieldsAdminPageProps> = ({
  tableFilter,
  onBack,
}) => {
  const [targets, setTargets] = useState<ExtraFieldTarget[]>([]);
  const [rows, setRows] = useState<ExtraFieldDef[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [tableName, setTableName] = useState(tableFilter || 'ProductCard');
  const [label, setLabel] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [dataType, setDataType] = useState<ExtraFieldDataType>('text');
  const [textLength, setTextLength] = useState(200);
  const [colSpan, setColSpan] = useState(6);
  const [isRequired, setIsRequired] = useState(false);
  const [formulaText, setFormulaText] = useState('');

  const activeTable = tableFilter || tableName;

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const [defs, cols] = await Promise.all([
        listExtraFields(tableFilter),
        listTableColumns(activeTable).catch(() => [] as string[]),
      ]);
      setRows(defs);
      setColumns(cols);
      await loadExtraFields(true);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Ek alanlar okunamadı' });
    } finally {
      setBusy(false);
    }
  }, [tableFilter, activeTable]);

  useEffect(() => {
    listExtraFieldTargets()
      .then(setTargets)
      .catch(() => setTargets([]));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const suggestedName = useMemo(() => {
    const base = (fieldName || label)
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '');
    if (!base) return 'U_YeniAlan';
    return base.startsWith('U_') ? base : `U_${base}`;
  }, [fieldName, label]);

  const formulaCheck = useMemo(() => {
    if (!formulaText.trim()) return null;
    const sample: Record<string, unknown> = {};
    for (const c of columns) sample[c] = 1;
    return evaluateFormula(formulaText, sample);
  }, [formulaText, columns]);

  const grouped = useMemo(() => {
    const out = new Map<string, ExtraFieldTarget[]>();
    for (const t of targets) {
      const list = out.get(t.group) ?? [];
      list.push(t);
      out.set(t.group, list);
    }
    return [...out.entries()];
  }, [targets]);

  const visibleRows = tableFilter ? rows : rows.filter((r) => r.tableName === activeTable);
  const targetTitle = targets.find((t) => t.tableName === activeTable)?.title || activeTable;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveExtraField({
        tableName: activeTable,
        fieldName: suggestedName,
        label: label.trim(),
        dataType,
        textLength: dataType === 'text' ? textLength : null,
        formulaText: formulaText.trim() || null,
        isRequired,
        colSpan,
        orderIndex: (visibleRows.length + 1) * 10,
        isActive: true,
      });
      setMsg({ kind: 'ok', text: res.message });
      setLabel('');
      setFieldName('');
      setFormulaText('');
      setIsRequired(false);
      await reload();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Alan eklenemedi' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: ExtraFieldDef) => {
    const dropColumn = window.confirm(
      `${row.fieldName} alanı:\n\nTamam → kolon ve içindeki veri ${row.tableName} tablosundan tamamen silinir.\nİptal → yalnızca formlardan kaldırılır, veri korunur.`,
    );
    setBusy(true);
    try {
      const res = await deleteExtraField(row.extraFieldID, dropColumn);
      setMsg({ kind: 'ok', text: res.message });
      await reload();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Silinemedi' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Ana Sayfa
          </button>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white">Ek Alanlar</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Alan eklendiğinde hedef tabloya <span className="font-mono">U_…</span> kolonu açılır ·{' '}
            {targetTitle} ({activeTable})
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={busy}
          className="inline-flex items-center gap-1 h-7 px-2 text-[11px] font-semibold rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Yenile
        </button>
      </div>

      {msg && (
        <div
          className={`text-[12px] px-3 py-2 rounded border ${
            msg.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <form
          onSubmit={handleAdd}
          className="lg:col-span-2 p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 space-y-2"
        >
          <h2 className="text-[13px] font-semibold text-slate-800">Yeni Ek Alan</h2>

          {!tableFilter && (
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-600">Hedef Tablo</span>
              <select
                className="w-full h-8 px-2 text-[13px] rounded-md border border-slate-300"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              >
                {grouped.map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((t) => (
                      <option key={t.tableName} value={t.tableName}>
                        {t.title} — {t.tableName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">Etiket</span>
            <input
              className="w-full h-8 px-2 text-[13px] rounded-md border border-slate-300"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Örn: Marka"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">Kolon Adı</span>
            <input
              className="w-full h-8 px-2 text-[13px] rounded-md border border-slate-300 font-mono"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder={suggestedName}
            />
            <span className="text-[10px] text-slate-500">
              Açılacak kolon: <span className="font-mono">{suggestedName}</span>
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1 col-span-1">
              <span className="text-[11px] font-semibold text-slate-600">Tip</span>
              <select
                className="w-full h-8 px-2 text-[13px] rounded-md border border-slate-300"
                value={dataType}
                onChange={(e) => setDataType(e.target.value as ExtraFieldDataType)}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {dataType === 'text' ? (
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Uzunluk</span>
                <input
                  type="number"
                  min={1}
                  max={4000}
                  className="w-full h-8 px-2 text-[13px] rounded-md border border-slate-300"
                  value={textLength}
                  onChange={(e) => setTextLength(Number(e.target.value) || 200)}
                />
              </label>
            ) : (
              <div />
            )}
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-600">Genişlik</span>
              <input
                type="number"
                min={1}
                max={12}
                className="w-full h-8 px-2 text-[13px] rounded-md border border-slate-300"
                value={colSpan}
                onChange={(e) => setColSpan(Number(e.target.value) || 6)}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">
              Formül <span className="font-normal text-slate-400">(boş = elle girilir)</span>
            </span>
            <textarea
              className="w-full px-2 py-1 text-[12px] rounded-md border border-slate-300 font-mono"
              rows={2}
              value={formulaText}
              onChange={(e) => setFormulaText(e.target.value)}
              placeholder="[Quantity] * [Price]"
            />
            {formulaCheck?.error ? (
              <span className="text-[10px] text-red-600">{formulaCheck.error}</span>
            ) : (
              <span className="text-[10px] text-slate-500">
                Alanlar <span className="font-mono">[KolonAdı]</span> · Fonksiyonlar:{' '}
                {FORMULA_FUNCTIONS.slice(0, 8).join(', ')}…
              </span>
            )}
          </label>

          <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
            <input
              type="checkbox"
              checked={isRequired}
              disabled={Boolean(formulaText.trim())}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Zorunlu alan
          </label>

          <button
            type="submit"
            disabled={busy || Boolean(formulaCheck?.error)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-500 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Alanı Ekle (kolon aç)
          </button>
        </form>

        <div className="lg:col-span-3 space-y-3">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold">Etiket</th>
                  <th className="px-3 py-2 text-left font-semibold">Kolon</th>
                  <th className="px-3 py-2 text-left font-semibold">Tip</th>
                  <th className="px-3 py-2 text-left font-semibold">Formül</th>
                  <th className="px-3 py-2 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      {activeTable} için ek alan yok
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.extraFieldID} className="border-b border-slate-100 h-9">
                      <td className="px-3 py-1.5 font-medium text-slate-800">
                        {row.label}
                        {row.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">
                        {row.fieldName}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">
                        {DATA_TYPE_LABEL[row.dataType] || row.dataType}
                        {row.dataType === 'text' && row.textLength ? ` (${row.textLength})` : ''}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 max-w-[220px] truncate">
                        {row.formulaText || <span className="text-slate-300">elle</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-[11px]"
                        >
                          <Trash2 className="w-3 h-3" />
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
            <h3 className="text-[12px] font-semibold text-slate-800 mb-1">
              {activeTable} kolonları — formülde kullanılabilir
            </h3>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
              {columns.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormulaText((prev) => `${prev}[${c}]`)}
                  className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-600 hover:bg-blue-50 hover:border-blue-300"
                >
                  {c}
                </button>
              ))}
              {columns.length === 0 && (
                <span className="text-[11px] text-slate-400">Kolon listesi okunamadı</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
