import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { BaBsDoc, BaBsReport, BaBsRow, getBaBsDocs, getBaBsReport, getKdvReport, KdvReport } from '../api/egovTaxReportApi';
import { LookupOption, loadLookupOptions } from '../api/lookupApi';
import { InvoiceTypeLabels } from '../data/documentTypes';
import { downloadCsv } from '../utils/cardStatementFormat';
import { isoToDisplay } from '../utils/dateFormat';

type Tab = 'kdv' | 'babs';

const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `%${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
/** «1.234,56» / «1234.56» → sayı */
const parseMoney = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/** «2026-10» → ['2026-10-01', '2026-10-31'] */
const monthRange = (m: string): [string, string] => {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return [`${m}-01`, `${m}-${String(last).padStart(2, '0')}`];
};
const monthLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

/**
 * E-Devlet → Raporlar → KDV ve Ba / Bs (E-08): dönemlik hesaplanan / indirilecek KDV (oran bazında, tevkifat / istisna
 * e-belgeden) ve Form Ba / Bs listeleri (VKN bazında, KDV hariç sınır üstü). Excel için CSV.
 */
export const EGovTaxReportPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('kdv');
  const [month, setMonth] = useState(thisMonth());
  const [companies, setCompanies] = useState<LookupOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [carryOver, setCarryOver] = useState('0,00');
  const [limit, setLimit] = useState('5.000');
  const [kdv, setKdv] = useState<KdvReport | null>(null);
  const [babs, setBabs] = useState<BaBsReport | null>(null);
  const [open, setOpen] = useState<{ kind: 'ba' | 'bs'; row: BaBsRow; docs: BaBsDoc[] | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void loadLookupOptions('CompanyID').then((c) => setCompanies(c ?? []));
  }, []);

  const [from, to] = monthRange(month);
  const company = companyId ? Number(companyId) : null;
  const limitValue = parseMoney(limit);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOpen(null);
    try {
      if (tab === 'kdv') setKdv(await getKdvReport(from, to, company));
      else setBabs(await getBaBsReport(from, to, limitValue, company));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Rapor alınamadı');
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, company, limitValue]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRow = async (kind: 'ba' | 'bs', row: BaBsRow) => {
    if (open && open.kind === kind && open.row.key === row.key && open.row.period === row.period) return setOpen(null);
    setOpen({ kind, row, docs: null });
    try {
      const [pf, pt] = monthRange(row.period);
      const docs = await getBaBsDocs(kind, row.key, pf, pt, company);
      setOpen((o) => (o && o.row === row ? { ...o, docs } : o));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Faturalar alınamadı');
    }
  };

  const carry = parseMoney(carryOver);
  const net = kdv ? kdv.calculatedTax - kdv.deductibleTax - carry : 0;

  const exportCsv = () => {
    const fn = (n: number) => money(n);
    if (tab === 'kdv' && kdv) {
      downloadCsv(`kdv-${month}.csv`, ['Oran', 'Satış matrahı', 'Hesaplanan KDV', 'Alış matrahı', 'İndirilecek KDV'], [
        ...kdv.rates.map((r) => [pct(r.rate), fn(r.salesBase), fn(r.salesTax), fn(r.purchaseBase), fn(r.purchaseTax)]),
        ['Toplam', fn(kdv.salesBase), fn(kdv.calculatedTax), fn(kdv.purchaseBase), fn(kdv.deductibleTax)],
        ['Önceki dönemden devreden', '', '', '', fn(carry)],
        [net >= 0 ? 'Ödenecek KDV' : 'Sonraki döneme devreden', '', fn(Math.abs(net)), '', ''],
        ['Tevkifat (e-belgeden)', '', '', '', fn(kdv.withholdingTax)],
        ['İstisna matrahı (e-belgeden)', '', '', fn(kdv.exemptBase), ''],
      ]);
    } else if (babs) {
      const rows = (kind: string, list: BaBsRow[]) =>
        list.map((r) => [kind, r.period, r.taxNr ?? '', r.title ?? '', String(r.docCount), fn(r.amount)]);
      downloadCsv(`ba-bs-${month}.csv`, ['Form', 'Dönem', 'VKN/TCKN', 'Unvan', 'Belge sayısı', 'Tutar (KDV hariç)'], [
        ...rows('Ba', babs.ba),
        ...rows('Bs', babs.bs),
      ]);
    }
  };

  const card = (label: string, value: string, sub: string, tone?: 'warn' | 'ok') => (
    <div
      className={`rounded-md border px-3 py-2 ${
        tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <div className="text-[12px] opacity-80">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] opacity-70">{sub}</div>
    </div>
  );

  const babsTable = (kind: 'ba' | 'bs', title: string, list: BaBsRow[]) => (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
        <span className="text-[11px] text-slate-500">{list.length} satır</span>
      </div>
      {list.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-slate-400">Sınırı aşan cari yok.</div>
      ) : (
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-1 text-left font-medium w-6" />
              <th className="px-2 py-1 text-left font-medium">Cari / VKN</th>
              <th className="px-2 py-1 text-right font-medium">Adet</th>
              <th className="px-2 py-1 text-right font-medium">Tutar (KDV hariç)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const isOpen = open?.kind === kind && open.row.key === r.key && open.row.period === r.period;
              return (
                <React.Fragment key={`${r.key}-${r.period}`}>
                  <tr onClick={() => void toggleRow(kind, r)} className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/50">
                    <td className="px-2 py-1 text-slate-400">{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                    <td className="px-2 py-1">
                      <div className="font-medium truncate max-w-[260px]" title={r.title ?? undefined}>
                        {r.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.taxNr ?? <span className="text-amber-700">VKN/TCKN yok</span>}
                        {r.cardCount > 1 ? ` · ${r.cardCount} cari kart` : ''}
                        {babs && monthRange(month)[0].slice(0, 7) !== r.period ? ` · ${monthLabel(r.period)}` : ''}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.docCount}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money(r.amount)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={3} className="px-2 py-1.5">
                        {!open.docs ? (
                          <span className="text-[11px] text-slate-500">Faturalar okunuyor…</span>
                        ) : (
                          <table className="w-full text-[11px]">
                            <tbody>
                              {open.docs.map((d) => (
                                <tr key={d.invoiceID}>
                                  <td className="py-0.5 pr-2 whitespace-nowrap">{d.invoiceDate ? isoToDisplay(d.invoiceDate.slice(0, 10)) : ''}</td>
                                  <td className="py-0.5 pr-2 font-medium">{d.documentNumber || `#${d.invoiceID}`}</td>
                                  <td className="py-0.5 pr-2 text-slate-500">{InvoiceTypeLabels[String(d.invoiceType)] ?? d.invoiceType}</td>
                                  <td className="py-0.5 text-right tabular-nums">{money(d.amount)}</td>
                                  <td className="py-0.5 pl-2 text-right tabular-nums text-slate-500">KDV {money(d.tax)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`px-3 h-7 text-[12px] rounded-sm ${tab === t ? 'bg-slate-800 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">KDV ve Ba / Bs</h2>
          <p className="text-[11px] text-slate-500">
            {monthLabel(month)} · {isoToDisplay(from)} – {isoToDisplay(to)} · fatura satırlarından, TL'ye kurdan çevrilmiş
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white" />
          {companies.length > 1 && (
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white">
              <option value="">Tüm firmalar</option>
              {companies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yenile
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={tab === 'kdv' ? !kdv : !babs}
            title="Excel'de açılan CSV"
            className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {tabBtn('kdv', 'KDV özeti')}
        {tabBtn('babs', 'Ba / Bs')}
        {tab === 'babs' && (
          <label className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-slate-600">
            Sınır
            <input value={limit} onChange={(e) => setLimit(e.target.value)} className="w-20 h-7 px-2 text-right rounded-sm border border-slate-300 bg-white" />
            TL · KDV hariç
          </label>
        )}
      </div>

      {err && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{err}</div>}

      {tab === 'kdv' && kdv && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {card('Hesaplanan KDV', money(kdv.calculatedTax), `satış + alış iade · ${kdv.issuedCount} fatura`)}
            {card('İndirilecek KDV', money(kdv.deductibleTax), `alış + hizmet + satış iade · ${kdv.receivedCount} fatura`)}
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="text-[12px] text-slate-600">Önceki dönemden devreden</div>
              <input
                value={carryOver}
                onChange={(e) => setCarryOver(e.target.value)}
                className="mt-0.5 w-full h-8 px-2 text-lg font-semibold tabular-nums rounded-sm border border-slate-300"
              />
              <div className="text-[11px] text-slate-500">elle girilir (beyanname geçmişi ERP'de yok)</div>
            </div>
            {net >= 0
              ? card('Ödenecek KDV', money(net), 'hesaplanan − indirilecek − devreden', 'warn')
              : card('Sonraki döneme devreden', money(-net), 'indirilecek KDV hesaplananı aşıyor', 'ok')}
          </div>

          <section className="rounded-md border border-slate-200 bg-white">
            <h3 className="px-3 py-2 border-b border-slate-200 text-[13px] font-semibold text-slate-800">Oran bazında</h3>
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-1 text-left font-medium">Oran</th>
                  <th className="px-3 py-1 text-right font-medium">Satış matrahı</th>
                  <th className="px-3 py-1 text-right font-medium">Hesaplanan</th>
                  <th className="px-3 py-1 text-right font-medium">Alış matrahı</th>
                  <th className="px-3 py-1 text-right font-medium">İndirilecek</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {kdv.rates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                      Bu dönemde fatura yok.
                    </td>
                  </tr>
                )}
                {kdv.rates.map((r) => (
                  <tr key={r.rate} className="border-t border-slate-100">
                    <td className="px-3 py-1">{pct(r.rate)}</td>
                    <td className="px-3 py-1 text-right">{money(r.salesBase)}</td>
                    <td className="px-3 py-1 text-right">{money(r.salesTax)}</td>
                    <td className="px-3 py-1 text-right">{money(r.purchaseBase)}</td>
                    <td className="px-3 py-1 text-right">{money(r.purchaseTax)}</td>
                  </tr>
                ))}
              </tbody>
              {kdv.rates.length > 0 && (
                <tfoot className="tabular-nums font-semibold border-t border-slate-300">
                  <tr>
                    <td className="px-3 py-1">Toplam</td>
                    <td className="px-3 py-1 text-right">{money(kdv.salesBase)}</td>
                    <td className="px-3 py-1 text-right">{money(kdv.calculatedTax)}</td>
                    <td className="px-3 py-1 text-right">{money(kdv.purchaseBase)}</td>
                    <td className="px-3 py-1 text-right">{money(kdv.deductibleTax)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>

          <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 space-y-0.5">
            <div>
              <b>Tevkifat:</b> {money(kdv.withholdingTax)} ({kdv.withholdingDocs} fatura) · <b>İstisna matrahı:</b> {money(kdv.exemptBase)} (
              {kdv.exemptDocs} fatura{kdv.exemptionCodes.length ? `, kod ${kdv.exemptionCodes.join(', ')}` : ''})
            </div>
            <div className="text-[11px] text-slate-500">
              Tevkifat ve istisna ERP'de tutulmaz; yalnız e-belgesi olan faturalarda UBL'den okunur ({kdv.ublDocs} / {kdv.totalDocs} fatura).
            </div>
            {kdv.emptyDocs > 0 && (
              <div className="text-[11px] text-amber-700 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {kdv.emptyDocs} faturanın satırı yok — tutarlara yansımadı.
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'babs' && babs && (
        <>
          {babs.missingTaxNrDocs > 0 && (
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {babs.missingTaxNrDocs} fatura VKN/TCKN'si girilmemiş carilere ait — Ba/Bs'de
              VKN zorunlu, cari kartları tamamlayın.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {babsTable('ba', 'Form Ba · mal ve hizmet alımları', babs.ba)}
            {babsTable('bs', 'Form Bs · mal ve hizmet satışları', babs.bs)}
          </div>
          <p className="text-[11px] text-slate-500">
            Bize kesilen faturalar (alış, alınan hizmet, satış iade, fiyat farkı) Ba'ya; bizim kestiklerimiz (satış, alış iade) Bs'ye girer.
            Aynı VKN'li cari kartlar birleştirilir; iptal faturalar hariç. Satıra tıklayınca faturalar açılır.
          </p>
        </>
      )}
    </div>
  );
};
