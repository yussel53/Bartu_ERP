import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Search, Zap } from 'lucide-react';
import { crmApi, type CrmAction } from '../../api/crmApi';
import { appToast } from '../../utils/appToast';
import { findScreenByFormCode } from '../../utils/findScreenByForm';
import { useAppModules } from '../../contexts/AppModulesContext';
import { buildOpenDocHref } from '../../contexts/OpenDocumentsContext';

const TABLE_FORM: Record<string, string> = {
  Invoice: 'SalesInvoiceForm',
  ProductVoucher: 'SalesDispatchForm',
  OrderVoucher: 'SalesOrderForm',
  SafeVoucher: 'SafeVoucherForm',
  AccountVoucher: 'AccountVoucherForm',
  BankVoucher: 'BankVoucherForm',
  CustomerVoucher: 'CustomerVoucherForm',
};

/** CRM → Aksiyonlar: fırsat + belge aksiyonları listesi */
export function CrmActionsPage() {
  const { modules } = useAppModules();
  const [rows, setRows] = useState<CrmAction[]>([]);
  const [q, setQ] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await crmApi.listAllActions({ q: q.trim() || undefined, openOnly, take: 300 });
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Liste alınamadı', { kind: 'error' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, openOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openSource = (a: CrmAction) => {
    if (!a.sourceTable || !(a.sourceID! > 0)) return;
    const formCode = TABLE_FORM[a.sourceTable] || '';
    const screen = formCode ? findScreenByFormCode(modules, formCode) : null;
    if (!screen?.path) {
      appToast('Belge ekranı bulunamadı', { kind: 'error' });
      return;
    }
    window.location.hash = `#/${buildOpenDocHref(screen.path, 'edit', { recordId: String(a.sourceID) })}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3 p-1">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-violet-600" />
            Aksiyonlar
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Fırsat ve belge (fatura, irsaliye…) aksiyonları · Outlook ile de eklenebilir
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="h-8 pl-7 pr-2 text-[12px] border border-slate-300 rounded-sm w-48"
              placeholder="Ara…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void reload()}
            />
          </label>
          <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            Yalnız açık
          </label>
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1 px-2 h-8 text-[11px] font-semibold border border-slate-300 rounded-sm bg-white hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Tip / Konu</th>
              <th className="px-2 py-1.5 font-semibold">Kaynak</th>
              <th className="px-2 py-1.5 font-semibold">Cari / Fırsat</th>
              <th className="px-2 py-1.5 font-semibold">Vade</th>
              <th className="px-2 py-1.5 font-semibold">Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                  Yükleniyor…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Kayıt yok
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr
                  key={a.actionID}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                >
                  <td className="px-2 py-1.5 align-top">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {a.actionTypeTitle || 'Aksiyon'}
                    </div>
                    {a.title && <div className="text-slate-600">{a.title}</div>}
                    {a.description && (
                      <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{a.description}</div>
                    )}
                    {a.outlookItemId && (
                      <span className="text-[10px] text-sky-700">Outlook</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {a.sourceTable && a.sourceID ? (
                      <button
                        type="button"
                        className="text-left text-violet-700 hover:underline font-medium"
                        onClick={() => openSource(a)}
                        title="Belgeyi aç"
                      >
                        {a.sourceTable}
                        {a.sourceDocNo ? ` · ${a.sourceDocNo}` : ` #${a.sourceID}`}
                      </button>
                    ) : a.opportunityID ? (
                      <span className="text-slate-600">Fırsat #{a.opportunityID}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top text-slate-700 dark:text-slate-200">
                    {a.customerTitle || a.opportunityTitle || '—'}
                  </td>
                  <td className="px-2 py-1.5 align-top tabular-nums text-slate-600">
                    {a.dueDate ? String(a.dueDate).slice(0, 10) : '—'}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {a.isDone ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Tamam
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                        onClick={async () => {
                          try {
                            await crmApi.setActionDone(a.actionID, true);
                            void reload();
                          } catch (e) {
                            appToast(e instanceof Error ? e.message : 'Hata', { kind: 'error' });
                          }
                        }}
                      >
                        Tamamla
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
