import React, { useEffect, useState } from 'react';
import { Loader2, Search, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  queryEFaturaMukellef,
  checkEFaturaMukellefViaIntegrator,
  syncEFaturaMukellefFromGib,
  getEFaturaMukellefSyncStatus,
  type EFaturaMukellefQueryResult,
  type EFaturaMukellefRow,
  type EFaturaMukellefSyncStatus,
} from '../api/efaturaMukellefApi';

export interface IntegratorCredentials {
  name?: string;
  wsUrl?: string;
  user?: string;
  password?: string;
  vkn?: string;
}

interface Props {
  /** Sorgulanacak VKN/TCKN */
  taxNr: string;
  disabled?: boolean;
  /** Firma kartı entegrasyon alanları — doluysa kontrol entegratör üzerinden yapılır */
  integrator?: IntegratorCredentials;
  onApplied: (payload: {
    postLabel?: string;
    senderLabel?: string;
    title?: string;
    unitType?: string;
    status: string;
  }) => void;
}

function hasIntegratorCreds(i?: IntegratorCredentials): boolean {
  const name = String(i?.name || '').trim().toUpperCase();
  if (!name || name === 'GIB') return false;
  if (name === 'ELOGO' || name === 'LOGO') {
    return Boolean(String(i?.user || '').trim() && String(i?.password || '').trim());
  }
  return Boolean(String(i?.user || '').trim() && String(i?.password || '').trim());
}

export const EinvoiceMukellefCheck: React.FC<Props> = ({
  taxNr,
  disabled,
  integrator,
  onApplied,
}) => {
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [result, setResult] = useState<EFaturaMukellefQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<EFaturaMukellefSyncStatus | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const viaIntegrator = hasIntegratorCreds(integrator);
  const integratorLabel = String(integrator?.name || '').trim() || 'Entegratör';

  useEffect(() => {
    void getEFaturaMukellefSyncStatus()
      .then(setSyncStatus)
      .catch(() => setSyncStatus(null));
  }, []);

  const applyResult = (res: EFaturaMukellefQueryResult) => {
    setResult(res);
    if (!res.found) {
      onApplied({ status: res.message || 'Mükellef bulunamadı' });
      return;
    }
    const pk = res.suggestedPostLabel;
    const gb = res.suggestedSenderLabel;
    if (pk || gb) {
      onApplied({
        postLabel: pk || undefined,
        senderLabel: gb || undefined,
        title: res.title || undefined,
        unitType: res.suggestedUnitType || undefined,
        status: res.message,
      });
    } else {
      onApplied({ status: res.message });
    }
    if (res.rows.length > 2) setPickOpen(true);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setSyncMsg(null);
    try {
      if (viaIntegrator) {
        const res = await checkEFaturaMukellefViaIntegrator({
          taxNr,
          integratorName: integrator?.name,
          integratorWsUrl: integrator?.wsUrl,
          integratorUser: integrator?.user,
          integratorPassword: integrator?.password,
          integratorVkN: integrator?.vkn,
        });
        applyResult(res);
        return;
      }
      // Entegratör yoksa: yerel + GİB
      const res = await queryEFaturaMukellef(taxNr, true);
      applyResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sorgulama başarısız');
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    if (
      !window.confirm(
        'GİB kayıtlı kullanıcı PK/GB listeleri indirilip yerel tabloya yazılacak.\nBu işlem uzun sürebilir (onlarca dakika). Devam?',
      )
    ) {
      return;
    }
    setSyncBusy(true);
    setError(null);
    setSyncMsg('GİB listeleri indiriliyor…');
    try {
      const res = await syncEFaturaMukellefFromGib();
      setSyncMsg(res.message);
      const st = await getEFaturaMukellefSyncStatus();
      setSyncStatus(st);
      if (String(taxNr || '').trim()) {
        const q = await queryEFaturaMukellef(taxNr, false);
        setResult(q);
        if (q.found) {
          onApplied({
            postLabel: q.suggestedPostLabel || undefined,
            senderLabel: q.suggestedSenderLabel || undefined,
            title: q.title || undefined,
            unitType: q.suggestedUnitType || undefined,
            status: q.message,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GİB senkron başarısız');
      setSyncMsg(null);
    } finally {
      setSyncBusy(false);
    }
  };

  const applyRow = (row: EFaturaMukellefRow) => {
    const type = (row.aliasType || '').toUpperCase();
    onApplied({
      postLabel: type === 'PK' || (!type && /pk/i.test(row.alias)) ? row.alias : undefined,
      senderLabel: type === 'GB' || (!type && /gb/i.test(row.alias)) ? row.alias : undefined,
      title: row.title || result?.title || undefined,
      unitType: row.unitType || undefined,
      status: `Seçildi: ${row.alias}`,
    });
  };

  const sourceLabel =
    result?.source === 'Integrator'
      ? `Entegratör (${integratorLabel})`
      : result?.source === 'GibExternal'
        ? 'GİB harici liste'
        : result?.source === 'GibAuthoritative'
          ? 'Güncel yerel senkron'
          : result
            ? 'Yerel liste'
            : null;

  return (
    <div className="col-span-12 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || busy || syncBusy || !String(taxNr || '').trim()}
          onClick={() => void run()}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          title={
            viaIntegrator
              ? `Entegratör üzerinden kontrol (${integratorLabel})`
              : 'Önce yerel liste; yoksa GİB PK/GB kayıtlı kullanıcı listesi'
          }
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {viaIntegrator ? `Mükellef Kontrol (${integratorLabel})` : 'e-Fatura Mükellef Kontrol'}
        </button>
        <button
          type="button"
          disabled={disabled || busy || syncBusy}
          onClick={() => void runSync()}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="GİB newUserPkListxml / newUserGbListxml zip indir ve yerel tabloyu güncelle"
        >
          {syncBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Listeyi GİB’den Güncelle
        </button>
        <span className="text-[11px] text-slate-500">
          VKN: <span className="font-mono font-semibold text-slate-700">{taxNr || '—'}</span>
          {viaIntegrator ? (
            <span className="ml-2 text-emerald-700 font-semibold">· kaynak: {integratorLabel}</span>
          ) : (
            <span className="ml-2 text-amber-700">· entegratör bilgisi yok → yerel/GİB</span>
          )}
          {typeof result?.localListCount === 'number' && (
            <span className="ml-2 text-slate-400">
              · yerel: {result.localListCount.toLocaleString('tr-TR')}
            </span>
          )}
          {syncStatus?.lastSyncAt && (
            <span className="ml-2 text-slate-400">
              · son sync: {new Date(syncStatus.lastSyncAt).toLocaleString('tr-TR')}
            </span>
          )}
        </span>
        {result?.found && (
          <button
            type="button"
            className="text-[11px] text-blue-700 font-semibold underline"
            onClick={() => setPickOpen(true)}
          >
            Alias listesi ({result.rows.length})
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}

      {syncMsg && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-900">
          {syncMsg}
        </div>
      )}

      {result && !error && (
        <div
          className={`rounded-md border px-2.5 py-1.5 text-[11px] inline-flex items-start gap-1.5 max-w-full ${
            result.found
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {result.found ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span>
            {sourceLabel && <span className="font-semibold mr-1">[{sourceLabel}]</span>}
            {result.message}
            {result.checkedExternal && result.externalMessage && !result.found && (
              <span className="block mt-0.5 opacity-80">{result.externalMessage}</span>
            )}
          </span>
        </div>
      )}

      {pickOpen && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPickOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <div className="text-[13px] font-semibold text-slate-800">e-Fatura Mükellef Aliasları</div>
                <div className="text-[11px] text-slate-500">
                  {result.taxNr}
                  {result.title ? ` — ${result.title}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="text-[12px] text-slate-500 hover:text-slate-800"
                onClick={() => setPickOpen(false)}
              >
                Kapat
              </button>
            </div>
            <div className="overflow-auto p-2 space-y-1">
              {result.rows.map((r, idx) => (
                <button
                  key={r.eFaturaMukellefID || `${r.alias}-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    applyRow(r);
                    setPickOpen(false);
                  }}
                  className="w-full text-left rounded-md border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px]">
                      {r.aliasType || '?'}
                    </span>
                    {r.unitType && (
                      <span className="text-[10px] font-medium text-slate-500">{r.unitType}</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-700 mt-0.5 break-all">{r.alias}</div>
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
              PK → Gelen (PostLabel) · GB → Giden (SenderLabel)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
