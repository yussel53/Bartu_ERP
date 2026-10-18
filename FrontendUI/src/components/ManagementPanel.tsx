import React from 'react';
import { AlertTriangle, CalendarClock, CheckSquare, Coins, PackageX, ShoppingCart, Wallet } from 'lucide-react';
import { apiJson } from '../config/api';

interface PanelItem {
  label?: string | null;
  sub?: string | null;
  amount: number;
  days?: number | null;
  id?: number | null;
}

interface PanelData {
  receivableOverdue: number;
  receivableOverdueCustomers: number;
  receivableDue7: number;
  payableOverdue: number;
  payableDue7: number;
  topOverdue: PanelItem[];
  boundsIn7: number;
  boundsIn30: number;
  boundsOut30: number;
  boundsOverdue: number;
  salesToday: number;
  salesMonth: number;
  salesPrevMonth: number;
  openOrders: number;
  openOrdersAmount: number;
  salesLast7: PanelItem[];
  criticalStock: PanelItem[];
  criticalStockCount: number;
  pendingApprovals: number;
  approvals: PanelItem[];
  rates: PanelItem[];
  cashByCurrency: PanelItem[];
  warnings: string[];
}

const n = (v: number, d = 2) => v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

const Card: React.FC<{ title: string; icon: React.ReactNode; onOpen?: () => void; children: React.ReactNode }> = ({ title, icon, onOpen, children }) => (
  <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
        {icon} {title}
      </h2>
      {onOpen && (
        <button type="button" onClick={onOpen} className="text-[11px] text-blue-700 hover:underline dark:text-blue-300">
          Aç
        </button>
      )}
    </div>
    {children}
  </section>
);

const Stat: React.FC<{ label: string; value: string; tone?: 'red' | 'green' | 'amber' }> = ({ label, value, tone }) => (
  <div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
    <div
      className={`text-[15px] font-semibold tabular-nums ${
        tone === 'red' ? 'text-red-700 dark:text-red-400' : tone === 'green' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'
      }`}
    >
      {value}
    </div>
  </div>
);

/** Genel Durum → yönetim paneli (Y-14): vadeler, çek / senet, satış, kritik stok, onaylar, döviz */
export const ManagementPanel: React.FC<{ refreshKey?: number; onNavigate?: (path: string) => void }> = ({ refreshKey, onNavigate }) => {
  const [data, setData] = React.useState<PanelData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    apiJson<PanelData>('/api/dashboard/management')
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <div className="px-3 py-1.5 rounded-md text-xs border border-amber-200 bg-amber-50 text-amber-800">Yönetim paneli: {error}</div>;
  if (!data) return <div className="text-xs text-slate-400 px-1">Yönetim paneli yükleniyor…</div>;

  const go = (p: string) => (onNavigate ? () => onNavigate(p) : undefined);
  const max7 = Math.max(1, ...data.salesLast7.map((x) => x.amount));
  const monthDelta = data.salesPrevMonth ? ((data.salesMonth - data.salesPrevMonth) / data.salesPrevMonth) * 100 : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <Card title="Alacak / borç vadeleri" icon={<CalendarClock className="w-4 h-4 text-slate-500" />} onOpen={go('finans/raporlar/cari-yaslandirma')}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={`Vadesi geçen alacak (${data.receivableOverdueCustomers} cari)`} value={n(data.receivableOverdue)} tone={data.receivableOverdue > 0 ? 'red' : undefined} />
            <Stat label="7 gün içinde vadesi gelen" value={n(data.receivableDue7)} tone="amber" />
            <Stat label="Vadesi geçen borcumuz" value={n(data.payableOverdue)} tone={data.payableOverdue > 0 ? 'red' : undefined} />
            <Stat label="7 gün içinde ödenecek" value={n(data.payableDue7)} />
          </div>
          {data.topOverdue.length > 0 && (
            <table className="w-full text-[11px]">
              <tbody>
                {data.topOverdue.map((x) => (
                  <tr key={x.id ?? x.label} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-0.5 truncate max-w-[180px]" title={x.label ?? ''}>
                      {x.label}
                    </td>
                    <td className="py-0.5 text-right text-slate-500">{x.days} gün</td>
                    <td className="py-0.5 text-right tabular-nums font-semibold text-red-700 dark:text-red-400">{n(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Satış" icon={<ShoppingCart className="w-4 h-4 text-slate-500" />} onOpen={go('satis/raporlar')}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Bugün" value={n(data.salesToday)} />
            <Stat label="Bu ay" value={n(data.salesMonth)} tone="green" />
            <Stat
              label="Geçen ayın aynı dönemi"
              value={`${n(data.salesPrevMonth)}${monthDelta == null ? '' : ` (${monthDelta >= 0 ? '+' : ''}${n(monthDelta, 0)}%)`}`}
            />
          </div>
          <div className="flex items-end gap-1 h-12" title="Son 7 gün (KDV hariç, iadeler düşülmüş)">
            {data.salesLast7.map((x) => (
              <div key={x.label} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full bg-blue-500/80 dark:bg-blue-400/70 rounded-sm" style={{ height: `${Math.max(2, (x.amount / max7) * 36)}px` }} title={`${x.label}: ${n(x.amount)}`} />
                <span className="text-[9px] text-slate-400">{x.label}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">
            Açık satış siparişi: <b className="text-slate-700 dark:text-slate-200">{data.openOrders}</b> · {n(data.openOrdersAmount)}
          </div>
        </Card>

        <Card title="Çek / senet" icon={<Wallet className="w-4 h-4 text-slate-500" />} onOpen={go('finans/hareketler/cek-senet')}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="7 gün içinde tahsil" value={n(data.boundsIn7)} tone="green" />
            <Stat label="30 gün içinde tahsil" value={n(data.boundsIn30)} />
            <Stat label="30 gün içinde ödenecek (kendi)" value={n(data.boundsOut30)} tone={data.boundsOut30 > 0 ? 'amber' : undefined} />
            <Stat label="Vadesi geçmiş portföy" value={n(data.boundsOverdue)} tone={data.boundsOverdue > 0 ? 'red' : undefined} />
          </div>
        </Card>

        <Card title={`Kritik stok (${data.criticalStockCount})`} icon={<PackageX className="w-4 h-4 text-slate-500" />} onOpen={go('malzeme/islemler/maliyetlendirme')}>
          {data.criticalStock.length === 0 ? (
            <div className="text-[11px] text-slate-400">Kritik seviyenin altında malzeme yok. Seviye malzeme kartında «Kritik Stok (min.)».</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left font-medium">Malzeme</th>
                  <th className="text-right font-medium">Eldeki</th>
                  <th className="text-right font-medium">Min.</th>
                </tr>
              </thead>
              <tbody>
                {data.criticalStock.map((x) => (
                  <tr key={x.id ?? x.label} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-0.5 truncate max-w-[200px]" title={x.sub ?? ''}>
                      {x.label} <span className="text-slate-400">{x.sub}</span>
                    </td>
                    <td className={`py-0.5 text-right tabular-nums font-semibold ${x.amount < 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>{n(x.amount, 0)}</td>
                    <td className="py-0.5 text-right tabular-nums text-slate-500">{x.days ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={`Onay bekleyenler (${data.pendingApprovals})`} icon={<CheckSquare className="w-4 h-4 text-slate-500" />} onOpen={go('surec/hareketler/onay-kuyrugu')}>
          {data.approvals.length === 0 ? (
            <div className="text-[11px] text-slate-400">Size düşen onay yok.</div>
          ) : (
            <ul className="text-[11px] space-y-0.5">
              {data.approvals.map((x) => (
                <li key={`${x.id}-${x.label}`} className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-0.5">
                  <span className="truncate">{x.label}</span>
                  <span className="text-slate-400 whitespace-nowrap">{x.days ? `${x.days} gün` : 'bugün'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Döviz" icon={<Coins className="w-4 h-4 text-slate-500" />} onOpen={go('sistem/tanimlar/doviz-kurlari')}>
          <div className="grid grid-cols-3 gap-2">
            {data.rates.map((r) => (
              <Stat key={r.label} label={`${r.label} satış · ${r.sub}`} value={n(r.amount, 4)} />
            ))}
          </div>
          {data.cashByCurrency.length > 0 && (
            <div className="text-[11px] text-slate-500">
              Kasa + banka: {data.cashByCurrency.map((c) => `${n(c.amount)} ${c.label}`).join(' · ')}
            </div>
          )}
        </Card>
      </div>
      {data.warnings.length > 0 && (
        <div className="flex items-start gap-1 text-[11px] text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> {data.warnings.join(' · ')}
        </div>
      )}
    </div>
  );
};
