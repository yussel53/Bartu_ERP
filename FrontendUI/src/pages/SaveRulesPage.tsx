import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { apiJson } from '../config/api';
import { appConfirm } from '../utils/appConfirm';

type SaveRule = {
  saveRuleID: number;
  name: string;
  scope: string;
  tableName: string;
  whenField?: string | null;
  whenOp: string;
  whenValue?: string | null;
  mustField: string;
  mustOp: string;
  mustValue?: string | null;
  onLine: boolean;
  message?: string | null;
  isActive: boolean;
};

const TABLES = [
  'Invoice',
  'EGovDocument',
  'CustomerCard',
  'ProductCard',
  'OrderVoucher',
  'ProductVoucher',
  'CustomerVoucher',
  'AccountVoucher',
];

const OPS = [
  { v: 'eq', l: 'eşittir' },
  { v: 'ne', l: 'eşit değildir' },
  { v: 'contains', l: 'içerir' },
  { v: 'starts', l: 'ile başlar' },
  { v: 'notempty', l: 'dolu olmalı' },
  { v: 'empty', l: 'boş olmalı' },
];

const input =
  'w-full h-7 px-2 text-xs border border-slate-300 rounded-sm bg-white dark:bg-slate-900 dark:border-slate-600 focus:outline-none focus:border-blue-500';
const lbl = 'text-[11px] text-slate-500';

const blank = (): SaveRule => ({
  saveRuleID: 0,
  name: '',
  scope: 'data',
  tableName: 'Invoice',
  whenField: '',
  whenOp: 'eq',
  whenValue: '',
  mustField: '',
  mustOp: 'notempty',
  mustValue: '',
  onLine: false,
  message: '',
  isActive: true,
});

/** Sistem → Kurallar. Koşul tutunca alan zorunlu; Kaydet sağlamadan yazmaz. */
export const SaveRulesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [rows, setRows] = useState<SaveRule[]>([]);
  const [edit, setEdit] = useState<SaveRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiJson<SaveRule[]>('/api/save-rules'));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiJson<{ id: number }>('/api/save-rules', {
        method: 'POST',
        body: JSON.stringify(edit),
      });
      setMsg({ text: 'Kural kaydedildi. Bundan sonraki Kaydet bu kurala bakar.' });
      await load();
      setEdit({ ...edit, saveRuleID: r.id });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: SaveRule) => {
    if (!(await appConfirm(`«${r.name}» kuralı silinsin mi?`, { title: 'Kural sil', okLabel: 'Sil', danger: true })))
      return;
    await apiJson(`/api/save-rules/${r.saveRuleID}`, { method: 'DELETE' });
    if (edit?.saveRuleID === r.saveRuleID) setEdit(null);
    await load();
  };

  const set = (patch: Partial<SaveRule>) => edit && setEdit({ ...edit, ...patch });
  const needsValue = (op: string) => op !== 'empty' && op !== 'notempty';

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="p-1 text-slate-500 hover:text-slate-800" title="Geri">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kurallar</h1>
          <p className="text-[11px] text-slate-500">
            Koşul tutunca zorunlu alan böyle olmak zorunda. Tutmazsa Kaydet yazmaz. Kapsam «Gidecek e-Fatura»
            yalnız cari e-Fatura / e-Arşiv faturalarında ve giden e-belgede çalışır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdit(blank())}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2 text-xs font-semibold text-white bg-slate-800 rounded-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Yeni kural
        </button>
      </div>

      {msg && (
        <div
          className={`px-3 py-1.5 text-xs rounded-md border ${
            msg.error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
        <ul className="border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-800 max-h-[70vh] overflow-auto">
          {rows.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">Henüz kural yok.</li>}
          {rows.map((r) => (
            <li key={r.saveRuleID} className="flex items-start gap-1 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setEdit(r)}
                className={`flex-1 text-left min-w-0 ${edit?.saveRuleID === r.saveRuleID ? 'text-blue-700' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <div className="text-xs font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {r.scope === 'einvoice' ? 'e-Fatura' : 'Veri'} · {r.tableName}
                  {r.isActive ? '' : ' · kapalı'}
                </div>
              </button>
              <button type="button" onClick={() => void remove(r)} className="p-1 text-slate-400 hover:text-red-600" title="Sil">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {edit ? (
          <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2">
                <span className={lbl}>Kural adı</span>
                <input className={input} value={edit.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label>
                <span className={lbl}>Kapsam</span>
                <select className={input} value={edit.scope} onChange={(e) => set({ scope: e.target.value })}>
                  <option value="data">Veri (her kayıt)</option>
                  <option value="einvoice">Gidecek e-Fatura</option>
                </select>
              </label>
              <label>
                <span className={lbl}>Tablo</span>
                <input
                  className={input}
                  list="save-rule-tables"
                  value={edit.tableName}
                  onChange={(e) => set({ tableName: e.target.value })}
                />
                <datalist id="save-rule-tables">
                  {TABLES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label className="col-span-2 flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={edit.onLine} onChange={(e) => set({ onLine: e.target.checked })} />
                  Satırda kontrol et
                </span>
                <span className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={edit.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                  Etkin
                </span>
              </label>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-sm p-2 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500">Koşul — boşsa her kayıtta bakar</div>
              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span className={lbl}>Alan</span>
                  <input
                    className={input}
                    placeholder="InvoiceType"
                    value={edit.whenField ?? ''}
                    onChange={(e) => set({ whenField: e.target.value })}
                  />
                </label>
                <label>
                  <span className={lbl}>İşlem</span>
                  <select className={input} value={edit.whenOp} onChange={(e) => set({ whenOp: e.target.value })}>
                    {OPS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={lbl}>Değer</span>
                  <input
                    className={input}
                    disabled={!needsValue(edit.whenOp)}
                    value={edit.whenValue ?? ''}
                    onChange={(e) => set({ whenValue: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-sm p-2 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500">Zorunlu — koşul tutunca böyle olmalı</div>
              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span className={lbl}>Alan</span>
                  <input
                    className={input}
                    placeholder="Description"
                    value={edit.mustField}
                    onChange={(e) => set({ mustField: e.target.value })}
                  />
                </label>
                <label>
                  <span className={lbl}>İşlem</span>
                  <select className={input} value={edit.mustOp} onChange={(e) => set({ mustOp: e.target.value })}>
                    {OPS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={lbl}>Değer</span>
                  <input
                    className={input}
                    disabled={!needsValue(edit.mustOp)}
                    value={edit.mustValue ?? ''}
                    onChange={(e) => set({ mustValue: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <label className="block">
              <span className={lbl}>Kaydet engellenince mesaj (boşsa kural adı)</span>
              <input
                className={input}
                value={edit.message ?? ''}
                onChange={(e) => set({ message: e.target.value })}
              />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="inline-flex items-center gap-1 h-7 px-3 text-xs font-semibold text-white bg-blue-600 rounded-sm disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Kaydet
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-md p-6">
            Soldan bir kural seçin ya da yeni kural ekleyin. Örnek: kapsam Gidecek e-Fatura, tablo Invoice, koşul
            InvoiceType = 1, zorunlu alan Description dolu olmalı.
          </div>
        )}
      </div>
    </div>
  );
};
