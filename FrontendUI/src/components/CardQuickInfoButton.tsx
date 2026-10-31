import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import {
  getCardStatement,
  type CardStatementKind,
  type CardStatementResult,
} from '../api/cardStatementApi';

const money = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type CardQuickHint = {
  borc?: string;
  alacak?: string;
  bakiye?: string;
  ba?: string;
  sonHareket?: string;
  vadesiGecen?: string;
  acikSiparis?: string;
  riskGrubu?: string;
  telefon?: string;
  ilIlce?: string;
};

type Props = {
  kind: CardStatementKind;
  cardId: number;
  /** Liste satırından önceden gelen özet (API gelmeden gösterilir) */
  hint?: CardQuickHint;
  /** Kart kod / ünvan satırı */
  label?: string;
  className?: string;
  onOpenStatement?: () => void;
};

export const CardQuickInfoButton: React.FC<Props> = ({
  kind,
  cardId,
  hint,
  label,
  className,
  onOpenStatement,
}) => {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState<CardStatementResult | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const hasAlert = Boolean(hint?.vadesiGecen) || (hint?.ba === 'B' && Boolean(hint?.bakiye));

  React.useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - 300);
    setPos({ top: r.bottom + 4, left: Math.max(8, left) });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const load = async () => {
    if (!(cardId > 0)) return;
    setBusy(true);
    setErr(null);
    try {
      setData(await getCardStatement(kind, cardId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Özet alınamadı');
      setData(null);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !data && !busy) void load();
  };

  const closing = data?.closing;
  const closingBa =
    closing == null || Math.abs(closing) < 0.005 ? null : closing > 0 ? 'B' : 'A';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Kart özeti"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          hasAlert
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : open
              ? 'border-sky-400 bg-sky-50 text-sky-700'
              : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50'
        } ${className ?? ''}`}
      >
        {hasAlert ? <AlertCircle className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 10000 }}
            className="w-[280px] rounded-md border border-slate-200 bg-white p-2.5 shadow-lg text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold text-[12px] text-slate-800 dark:text-slate-100 mb-1.5 truncate">
              {label || data?.cardCode || `Kart #${cardId}`}
              {data?.cardTitle ? (
                <span className="font-normal text-slate-500"> · {data.cardTitle}</span>
              ) : null}
            </div>
            {busy && (
              <div className="flex items-center gap-1.5 text-slate-500 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Özet yükleniyor…
              </div>
            )}
            {err && <p className="text-red-600 py-1">{err}</p>}
            {!busy && !err && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                {data ? (
                  <>
                    <dt className="text-slate-500">{data.debitLabel}</dt>
                    <dd className="text-right tabular-nums font-medium">{money(data.totalDebit)}</dd>
                    <dt className="text-slate-500">{data.creditLabel}</dt>
                    <dd className="text-right tabular-nums font-medium">{money(data.totalCredit)}</dd>
                    <dt className="text-slate-500">Bakiye</dt>
                    <dd
                      className={`text-right tabular-nums font-semibold ${
                        closingBa === 'B' ? 'text-red-700' : closingBa === 'A' ? 'text-emerald-700' : ''
                      }`}
                    >
                      {money(Math.abs(data.closing))}
                      {closingBa ? ` ${closingBa}` : ''}
                    </dd>
                    {data.warnings?.length > 0 && (
                      <>
                        <dt className="text-amber-700 col-span-2 pt-1">Uyarı</dt>
                        <dd className="col-span-2 text-amber-800">{data.warnings.join(' · ')}</dd>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {hint?.borc != null && hint.borc !== '' && (
                      <>
                        <dt className="text-slate-500">Borç</dt>
                        <dd className="text-right tabular-nums">{hint.borc}</dd>
                      </>
                    )}
                    {hint?.alacak != null && hint.alacak !== '' && (
                      <>
                        <dt className="text-slate-500">Alacak</dt>
                        <dd className="text-right tabular-nums">{hint.alacak}</dd>
                      </>
                    )}
                    {hint?.bakiye != null && hint.bakiye !== '' && (
                      <>
                        <dt className="text-slate-500">Bakiye</dt>
                        <dd
                          className={`text-right tabular-nums font-semibold ${
                            hint.ba === 'B' ? 'text-red-700' : hint.ba === 'A' ? 'text-emerald-700' : ''
                          }`}
                        >
                          {hint.bakiye}
                          {hint.ba ? ` ${hint.ba}` : ''}
                        </dd>
                      </>
                    )}
                    {hint?.sonHareket ? (
                      <>
                        <dt className="text-slate-500">Son hareket</dt>
                        <dd className="text-right">{hint.sonHareket}</dd>
                      </>
                    ) : null}
                    {hint?.vadesiGecen ? (
                      <>
                        <dt className="text-amber-700">Vadesi geçen</dt>
                        <dd className="text-right text-amber-800 font-medium">{hint.vadesiGecen}</dd>
                      </>
                    ) : null}
                    {hint?.acikSiparis ? (
                      <>
                        <dt className="text-slate-500">Açık sipariş</dt>
                        <dd className="text-right">{hint.acikSiparis}</dd>
                      </>
                    ) : null}
                    {hint?.riskGrubu ? (
                      <>
                        <dt className="text-slate-500">Risk</dt>
                        <dd className="text-right">{hint.riskGrubu}</dd>
                      </>
                    ) : null}
                    {hint?.ilIlce ? (
                      <>
                        <dt className="text-slate-500">İl / İlçe</dt>
                        <dd className="text-right">{hint.ilIlce}</dd>
                      </>
                    ) : null}
                    {hint?.telefon ? (
                      <>
                        <dt className="text-slate-500">Telefon</dt>
                        <dd className="text-right">{hint.telefon}</dd>
                      </>
                    ) : null}
                    {!hint?.borc && !hint?.bakiye && !hint?.sonHareket && (
                      <dd className="col-span-2 text-slate-400">Özet yok — ekstreden bakın.</dd>
                    )}
                  </>
                )}
              </dl>
            )}
            {onOpenStatement && (
              <button
                type="button"
                className="mt-2 w-full h-7 rounded border border-sky-300 bg-sky-50 text-sky-800 text-[11px] font-semibold hover:bg-sky-100"
                onClick={() => {
                  setOpen(false);
                  onOpenStatement();
                }}
              >
                Ekstre / hareketler
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};
