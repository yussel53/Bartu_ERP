import React, { useState } from 'react';
import { Link2, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { generatePaymentLink } from '../api/paymentLinkApi';
import { appToast } from '../utils/appToast';

const CREDIT_TYPES = new Set(['11', '12', '13', '14', 11, 12, 13, 14]);

interface Props {
  recordId: number;
  voucherType: unknown;
  paymentLinkUrl?: string | null;
  paymentProvider?: string | null;
  paymentLinkStatus?: number | string | null;
  onUrlChange?: (url: string, meta: { provider?: string; status?: number }) => void;
  readOnly?: boolean;
}

/** Kredi kartı cari fişinde ödeme linki (iyzico / manuel) */
export const PaymentLinkPanel: React.FC<Props> = ({
  recordId,
  voucherType,
  paymentLinkUrl,
  paymentProvider,
  paymentLinkStatus,
  onUrlChange,
  readOnly,
}) => {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(String(paymentLinkUrl ?? ''));
  const ty = voucherType as string | number;

  React.useEffect(() => {
    setUrl(String(paymentLinkUrl ?? ''));
  }, [paymentLinkUrl]);

  if (!CREDIT_TYPES.has(ty as never) && String(ty) !== '2') return null;
  if (!(recordId > 0) && !url) {
    return (
      <div className="mb-2 rounded-md border border-violet-200 bg-violet-50/80 px-3 py-1.5 text-[11px] text-violet-900">
        Ödeme linki için önce fişi kaydedin (kredi kartı / tahsilat).
      </div>
    );
  }

  const statusLabel =
    Number(paymentLinkStatus) === 2
      ? 'Ödendi'
      : Number(paymentLinkStatus) === 3
        ? 'İptal'
        : Number(paymentLinkStatus) === 1
          ? 'Bekliyor'
          : 'Yok';

  const copy = async () => {
    const u = url.trim();
    if (!u) {
      appToast('Kopyalanacak link yok', { kind: 'error' });
      return;
    }
    try {
      await navigator.clipboard.writeText(u);
      appToast('Ödeme linki kopyalandı');
    } catch {
      appToast('Kopyalanamadı', { kind: 'error' });
    }
  };

  const generate = async () => {
    if (!(recordId > 0)) {
      appToast('Önce fişi kaydedin', { kind: 'error' });
      return;
    }
    setBusy(true);
    try {
      const r = await generatePaymentLink(recordId);
      if (!r.success || !r.url) {
        appToast(r.message || 'Link üretilemedi', { kind: 'error' });
        return;
      }
      setUrl(r.url);
      onUrlChange?.(r.url, { provider: r.provider, status: r.status });
      appToast(r.message || 'Ödeme linki hazır');
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Link üretilemedi', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-2 rounded-md border border-violet-200 bg-violet-50/60 dark:bg-violet-950/30 px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-900 dark:text-violet-200">
          <Link2 className="w-3.5 h-3.5" />
          Ödeme linki
          {paymentProvider ? (
            <span className="font-normal text-violet-700/80">· {paymentProvider}</span>
          ) : null}
          <span className="font-normal text-slate-500">· {statusLabel}</span>
        </span>
        <div className="flex items-center gap-1 ml-auto">
          {!readOnly && (
            <button
              type="button"
              disabled={busy || !(recordId > 0)}
              onClick={() => void generate()}
              className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold rounded-sm border border-violet-300 bg-white text-violet-900 hover:bg-violet-100 disabled:opacity-50"
              title="iyzico ayarlıysa ona göre; değilse manuel link (veya URL yapıştırın)"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Link üret
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!url.trim()}
            className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Copy className="w-3 h-3" />
            Kopyala
          </button>
          {url.trim() && (
            <a
              href={url.trim()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="w-3 h-3" />
              Aç
            </a>
          )}
        </div>
      </div>
      <input
        type="url"
        value={url}
        readOnly={readOnly}
        onChange={(e) => {
          setUrl(e.target.value);
          onUrlChange?.(e.target.value, {});
        }}
        placeholder="https://… (iyzico / PayTR / manuel)"
        className="w-full h-7 px-2 text-[11px] font-mono rounded-sm border border-violet-200 bg-white dark:bg-slate-900 text-slate-800"
      />
      <p className="text-[10px] text-violet-800/80">
        Anlaşmalı firmadan (örn. iyzico) alınan ödeme linkini yapıştırın veya «Link üret» ile token’lı URL oluşturun.
        API anahtarları Sistem → Parametreler / Setting: PAY_PROVIDER, IYZICO_*.
      </p>
    </div>
  );
};
