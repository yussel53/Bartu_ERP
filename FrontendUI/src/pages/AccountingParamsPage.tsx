import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { apiJson } from '../config/api';
import { InvoiceType, InvoiceTypeLabels, SafeVoucherType, SafeVoucherTypeLabels } from '../data/documentTypes';
import { appToast } from '../utils/appToast';

interface AccConfig {
  autoPost: boolean;
  poolInvoice: boolean;
  poolSafe: boolean;
  invoiceTypes: string;
  safeTypes: string;
  balanceYear: number;
}

function parseTypes(raw: string): Set<string> {
  const s = (raw || '*').trim();
  if (!s || s === '*') return new Set(['*']);
  return new Set(s.split(',').map((x) => x.trim()).filter(Boolean));
}

function serializeTypes(set: Set<string>, allKeys: string[]): string {
  if (set.has('*') || allKeys.every((k) => set.has(k))) return '*';
  return allKeys.filter((k) => set.has(k)).join(',');
}

const INV_KEYS = Object.values(InvoiceType) as string[];
const SAFE_KEYS = Object.values(SafeVoucherType) as string[];

/** Genel Muhasebe → Muhasebe Parametreleri (havuz + otomatik mahsup) */
export const AccountingParamsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoPost, setAutoPost] = useState(false);
  const [poolInvoice, setPoolInvoice] = useState(true);
  const [poolSafe, setPoolSafe] = useState(true);
  const [invTypes, setInvTypes] = useState<Set<string>>(new Set(['*']));
  const [safeTypes, setSafeTypes] = useState<Set<string>>(new Set(['*']));
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());

  useEffect(() => {
    void (async () => {
      try {
        const c = await apiJson<AccConfig & Record<string, unknown>>('/api/accounting/config');
        setAutoPost(Boolean(c.autoPost ?? c.AutoPost));
        setPoolInvoice((c.poolInvoice ?? c.PoolInvoice) !== false);
        setPoolSafe((c.poolSafe ?? c.PoolSafe) !== false);
        setInvTypes(parseTypes(String(c.invoiceTypes ?? c.InvoiceTypes ?? '*')));
        setSafeTypes(parseTypes(String(c.safeTypes ?? c.SafeTypes ?? '*')));
        const y = Number(c.balanceYear ?? c.BalanceYear);
        if (Number.isFinite(y) && y >= 1900 && y <= 2100) setBalanceYear(Math.trunc(y));
      } catch (e) {
        appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleType = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    allKeys: string[],
    key: string,
  ) => {
    const next = new Set(set);
    if (key === '*') {
      setter(new Set(['*']));
      return;
    }
    next.delete('*');
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (next.size === 0) setter(new Set(['*']));
    else if (allKeys.every((k) => next.has(k))) setter(new Set(['*']));
    else setter(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiJson('/api/accounting/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoPost,
          poolInvoice,
          poolSafe,
          invoiceTypes: serializeTypes(invTypes, INV_KEYS),
          safeTypes: serializeTypes(safeTypes, SAFE_KEYS),
          balanceYear,
        }),
      });
      appToast('Parametreler kaydedildi');
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[30vh] flex items-center justify-center text-[12px] text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Geri
        </button>
        <h1 className="text-[16px] font-semibold text-slate-800">Muhasebe Parametreleri</h1>
        <p className="text-[12px] text-slate-500">
          Kayıt sonrası havuza alınacak modül / fiş türleri ve otomatik muhasebeleştirme
        </p>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Hesap bakiyesi
        </h2>
        <label className="flex flex-col gap-1 text-[13px] text-slate-800 max-w-xs">
          <span className="font-semibold">Bakiye yılı (öndeğer)</span>
          <input
            type="number"
            min={1900}
            max={2100}
            value={balanceYear}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 1900 && n <= 2100) setBalanceYear(Math.trunc(n));
            }}
            className="h-8 px-2 rounded-sm border border-slate-200 text-[13px] tabular-nums outline-none focus:border-blue-500"
          />
          <span className="text-[11px] text-slate-500">
            Hesap Kartları listesinde üstteki yıl kutusu bu değerle açılır (ACC_BALANCE_YEAR)
          </span>
        </label>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Kayıt sonrası muhasebeleştirme
        </h2>
        <label className="flex items-start gap-2 text-[13px] text-slate-800 cursor-pointer">
          <input
            type="radio"
            className="mt-1 accent-blue-600"
            checked={!autoPost}
            onChange={() => setAutoPost(false)}
          />
          <span>
            <span className="font-semibold">Elle / seçerek</span>
            <span className="block text-[11px] text-slate-500">
              Muhasebe kodları havuza yazılır; Muhasebe Havuzu’ndan seçerek fişleştirirsiniz
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13px] text-slate-800 cursor-pointer">
          <input
            type="radio"
            className="mt-1 accent-blue-600"
            checked={autoPost}
            onChange={() => setAutoPost(true)}
          />
          <span>
            <span className="font-semibold">Otomatik</span>
            <span className="block text-[11px] text-slate-500">
              Havuza yazıldıktan hemen sonra muhasebe fişi oluşturulur (bağlantı eksikse havuzda bekler)
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Havuza alınacak modüller
        </h2>
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={poolInvoice}
            onChange={(e) => setPoolInvoice(e.target.checked)}
          />
          Faturalar
        </label>
        <label className="inline-flex items-center gap-2 text-[13px] ml-4">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={poolSafe}
            onChange={(e) => setPoolSafe(e.target.checked)}
          />
          Kasa fişleri
        </label>
      </section>

      <section
        className={`rounded-md border border-slate-200 bg-white p-4 space-y-2 ${
          !poolInvoice ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Fatura türleri
        </h2>
        <label className="inline-flex items-center gap-2 text-[12px] font-medium">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={invTypes.has('*')}
            onChange={() => toggleType(invTypes, setInvTypes, INV_KEYS, '*')}
          />
          Tümü
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          {INV_KEYS.map((k) => (
            <label key={k} className="inline-flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={invTypes.has('*') || invTypes.has(k)}
                disabled={invTypes.has('*')}
                onChange={() => toggleType(invTypes, setInvTypes, INV_KEYS, k)}
              />
              {InvoiceTypeLabels[k]}
            </label>
          ))}
        </div>
      </section>

      <section
        className={`rounded-md border border-slate-200 bg-white p-4 space-y-2 ${
          !poolSafe ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Kasa fişi türleri
        </h2>
        <label className="inline-flex items-center gap-2 text-[12px] font-medium">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={safeTypes.has('*')}
            onChange={() => toggleType(safeTypes, setSafeTypes, SAFE_KEYS, '*')}
          />
          Tümü
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          {SAFE_KEYS.map((k) => (
            <label key={k} className="inline-flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={safeTypes.has('*') || safeTypes.has(k)}
                disabled={safeTypes.has('*')}
                onChange={() => toggleType(safeTypes, setSafeTypes, SAFE_KEYS, k)}
              />
              {SafeVoucherTypeLabels[k]}
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-sm bg-blue-700 text-white text-[12px] font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Kaydet
        </button>
      </div>
    </div>
  );
};
