import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CloudDownload, Loader2, RefreshCw } from 'lucide-react';
import {
  ELogoCompany,
  ELogoSyncResult,
  listELogoCompanies,
  syncELogoDocuments,
} from '../api/elogoApi';
import { getCurrentUserId } from '../data/permissions';

interface ELogoSyncPageProps {
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const ELogoSyncPage: React.FC<ELogoSyncPageProps> = ({ onBack }) => {
  const [companies, setCompanies] = useState<ELogoCompany[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [beginDate, setBeginDate] = useState(daysAgoIso(7));
  const [endDate, setEndDate] = useState(todayIso());
  const [direction, setDirection] = useState(1);
  const [docKind, setDocKind] = useState(1);
  const [downloadPdf, setDownloadPdf] = useState(true);
  const [downloadXml, setDownloadXml] = useState(true);
  const [startProcess, setStartProcess] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [result, setResult] = useState<ELogoSyncResult | null>(null);

  const reloadCompanies = useCallback(async () => {
    try {
      const list = await listELogoCompanies();
      setCompanies(list);
      const elogo = list.find((c) => {
        const n = (c.integratorName || '').toUpperCase();
        return (n.includes('ELOGO') || n === 'LOGO') && c.hasPassword;
      });
      if (elogo) setCompanyId(elogo.companyId);
      else if (list[0]) setCompanyId(list[0].companyId);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Firmalar okunamadı' });
    }
  }, []);

  useEffect(() => {
    void reloadCompanies();
  }, [reloadCompanies]);

  const onSync = async () => {
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const res = await syncELogoDocuments({
        companyId: companyId === '' ? undefined : Number(companyId),
        beginDate: `${beginDate}T00:00:00`,
        endDate: `${endDate}T23:59:59`,
        direction,
        docKind,
        downloadPdf,
        downloadXml,
        startProcess,
        startedBy: Number(getCurrentUserId()) || 1,
      });
      setResult(res);
      setMsg({ kind: res.ok ? 'ok' : 'err', text: res.message });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Senkron başarısız' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h2 className="text-[15px] font-semibold text-slate-800">e-Logo Belge Çekme</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            PostBoxService GetDocumentList / GetDocumentData → EGovDocument · PDF DB · onay kuyruğu
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reloadCompanies()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Firmalar
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-md border px-3 py-2 text-[12px] ${
            msg.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-md border border-slate-200 bg-white p-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-slate-600 sm:col-span-2">
          Firma (entegratör bilgisi)
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
          >
            <option value="">— seçin —</option>
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.title}
                {c.integratorName ? ` · ${c.integratorName}` : ''}
                {c.hasPassword ? '' : ' (şifre yok)'}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] text-slate-600">
          Başlangıç
          <input
            type="date"
            value={beginDate}
            onChange={(e) => setBeginDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
          />
        </label>
        <label className="block text-[12px] text-slate-600">
          Bitiş
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
          />
        </label>

        <label className="block text-[12px] text-slate-600">
          Yön
          <select
            value={direction}
            onChange={(e) => setDirection(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
          >
            <option value={1}>Gelen</option>
            <option value={2}>Giden</option>
          </select>
        </label>
        <label className="block text-[12px] text-slate-600">
          Belge türü
          <select
            value={docKind}
            onChange={(e) => setDocKind(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
          >
            <option value={1}>e-Fatura</option>
            <option value={2}>e-Arşiv</option>
            <option value={3}>e-İrsaliye</option>
          </select>
        </label>

        <div className="sm:col-span-2 flex flex-wrap gap-4 text-[12px] text-slate-700">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={downloadPdf} onChange={(e) => setDownloadPdf(e.target.checked)} />
            PDF indir → DB
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={downloadXml} onChange={(e) => setDownloadXml(e.target.checked)} />
            UBL/XML indir
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={startProcess} onChange={(e) => setStartProcess(e.target.checked)} />
            Gelenleri onay kuyruğuna düşür
          </label>
        </div>

        <div className="sm:col-span-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSync()}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            e-Logo’dan çek
          </button>
          <p className="text-[11px] text-slate-400 mt-2">
            Kaynak: eftaura_elogo_kontrol · GetDocumentList (EINVOICEDETAIL / EARCHIVEDETAIL / EDESPATCHDETAIL) ·
            GetDocumentData (PDF/UBL)
          </p>
        </div>
      </div>

      {result && result.items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-medium px-3 py-2">Belge No</th>
                <th className="text-left font-medium px-3 py-2">UUID</th>
                <th className="text-left font-medium px-3 py-2">ID</th>
                <th className="text-left font-medium px-3 py-2">İşlem</th>
                <th className="text-left font-medium px-3 py-2">PDF</th>
                <th className="text-left font-medium px-3 py-2">Süreç</th>
                <th className="text-left font-medium px-3 py-2">Hata</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((it, i) => (
                <tr key={`${it.uuid}-${i}`} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{it.documentNo || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 max-w-[140px] truncate">
                    {it.uuid || '—'}
                  </td>
                  <td className="px-3 py-1.5">{it.eGovDocumentId ?? '—'}</td>
                  <td className="px-3 py-1.5">{it.action}</td>
                  <td className="px-3 py-1.5">{it.pdfSaved ? '✓' : '—'}</td>
                  <td className="px-3 py-1.5">{it.processStarted ? '✓' : '—'}</td>
                  <td className="px-3 py-1.5 text-rose-600 max-w-[200px] truncate">{it.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
