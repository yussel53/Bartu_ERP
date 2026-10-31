import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Database, Loader2, Search } from 'lucide-react';
import { listRecords } from '../api/recordsApi';
import { API_BASE, apiJson } from '../config/api';
import { appConfirm } from '../utils/appConfirm';
import { ActiveStatusBadge } from '../components/ActiveToggle';

interface Props {
  onBack: () => void;
  initialTab?: 'bank' | 'branch';
}

type BankRow = {
  SYS_BankID?: number;
  Code?: string;
  Title?: string;
  ShortTitle?: string;
  Swift?: string;
  IsActive?: boolean | number;
};

type BranchRow = {
  SYS_BankBranchID?: number;
  SYS_BankID?: number;
  Code?: string;
  Title?: string;
  City?: string;
  IsActive?: boolean | number;
};

export const BankCatalogAdminPage: React.FC<Props> = ({ onBack, initialTab = 'bank' }) => {
  const [tab, setTab] = useState<'bank' | 'branch'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banks, setBanks] = useState<BankRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [bankId, setBankId] = useState<number>(0);
  const [q, setQ] = useState('');
  const [dbStatus, setDbStatus] = useState<{ seeded?: boolean; banks?: number; branches?: number } | null>(
    null,
  );
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const refreshStatus = async () => {
    try {
      setDbStatus(await apiJson('/api/banks/status'));
    } catch {
      setDbStatus(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, br] = await Promise.all([
        listRecords('SYS_Bank', { take: 500 }),
        listRecords('SYS_BankBranch', { take: 2000 }),
      ]);
      const bankRows = (b.rows || []) as BankRow[];
      setBanks(bankRows);
      setBranches((br.rows || []) as BranchRow[]);
      if (!bankId && bankRows[0]?.SYS_BankID) setBankId(Number(bankRows[0].SYS_BankID));
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bankMap = useMemo(() => {
    const m = new Map<number, BankRow>();
    for (const b of banks) m.set(Number(b.SYS_BankID), b);
    return m;
  }, [banks]);

  const filteredBanks = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr-TR');
    if (!s) return banks;
    return banks.filter((b) =>
      [b.Code, b.Title, b.ShortTitle, b.Swift]
        .map((x) => String(x ?? '').toLocaleLowerCase('tr-TR'))
        .some((t) => t.includes(s)),
    );
  }, [banks, q]);

  const filteredBranches = useMemo(() => {
    let rows = branches;
    if (bankId > 0) rows = rows.filter((r) => Number(r.SYS_BankID) === bankId);
    const s = q.trim().toLocaleLowerCase('tr-TR');
    if (!s) return rows;
    return rows.filter((r) => {
      const bank = bankMap.get(Number(r.SYS_BankID));
      return [r.Code, r.Title, r.City, bank?.ShortTitle, bank?.Code]
        .map((x) => String(x ?? '').toLocaleLowerCase('tr-TR'))
        .some((t) => t.includes(s));
    });
  }, [branches, bankId, q, bankMap]);

  const seed = async () => {
    const ok = await appConfirm(
      'Türkiye banka / örnek şube listesi SYS_Bank ve SYS_BankBranch tablolarına yazılacak.\nMevcut kodlar güncellenir. Devam?',
    );
    if (!ok) return;
    setSeedBusy(true);
    setSeedMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/banks/seed`, { method: 'POST' });
      const body = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok) throw new Error(body.message || res.statusText);
      setSeedMsg(body.message || 'Tamam');
      await load();
    } catch (e) {
      setSeedMsg(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setSeedBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 h-7 px-2 text-[12px] border border-slate-300 rounded-sm hover:bg-slate-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Geri
        </button>
        <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-slate-500" />
          Banka / Şube Kataloğu
        </h2>
        <span className="text-[11px] text-slate-400">SYS_Bank · SYS_BankBranch</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={seedBusy}
            onClick={() => void seed()}
            className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-sm disabled:opacity-50"
          >
            {seedBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            SYS’e yükle
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>
          DB: {dbStatus?.banks ?? 0} banka · {dbStatus?.branches ?? 0} şube
          {dbStatus?.seeded ? ' · yüklü' : ''}
        </span>
        {seedMsg && <span className="text-emerald-700">{seedMsg}</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          onClick={() => setTab('bank')}
          className={`h-7 px-2.5 text-[11px] rounded-sm border ${
            tab === 'bank' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300'
          }`}
        >
          Bankalar
        </button>
        <button
          type="button"
          onClick={() => setTab('branch')}
          className={`h-7 px-2.5 text-[11px] rounded-sm border ${
            tab === 'branch' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-300'
          }`}
        >
          Şubeler
        </button>
        {tab === 'branch' && (
          <select
            className="h-7 px-2 text-[11px] border border-slate-300 rounded-sm"
            value={bankId || ''}
            onChange={(e) => setBankId(Number(e.target.value) || 0)}
          >
            <option value="0">Tüm bankalar</option>
            {banks.map((b) => (
              <option key={b.SYS_BankID} value={b.SYS_BankID}>
                {b.Code} — {b.ShortTitle || b.Title}
              </option>
            ))}
          </select>
        )}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…"
            className="h-7 pl-7 pr-2 w-48 text-[11px] border border-slate-300 rounded-sm"
          />
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-2 py-1.5">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-400 text-[12px]">Yükleniyor…</div>
      ) : tab === 'bank' ? (
        <div className="overflow-auto max-h-[calc(100vh-14rem)] border border-slate-200 rounded-sm">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-2 py-1.5 text-left">EFT</th>
                <th className="px-2 py-1.5 text-left">Kısa Ad</th>
                <th className="px-2 py-1.5 text-left">Unvan</th>
                <th className="px-2 py-1.5 text-left">SWIFT</th>
                <th className="px-2 py-1.5 text-left">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredBanks.map((b) => (
                <tr key={b.SYS_BankID} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-1 font-mono">{b.Code}</td>
                  <td className="px-2 py-1">{b.ShortTitle}</td>
                  <td className="px-2 py-1">{b.Title}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{b.Swift}</td>
                  <td className="px-2 py-1">
                    <ActiveStatusBadge value={b.IsActive !== false && b.IsActive !== 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-14rem)] border border-slate-200 rounded-sm">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-2 py-1.5 text-left">Banka</th>
                <th className="px-2 py-1.5 text-left">Şube Kodu</th>
                <th className="px-2 py-1.5 text-left">Şube Adı</th>
                <th className="px-2 py-1.5 text-left">İl</th>
                <th className="px-2 py-1.5 text-left">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                    Şube yok — «SYS’e yükle» ile örnek şubeler gelir; tam şube listesi ayrıca eklenebilir.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((r) => {
                  const bank = bankMap.get(Number(r.SYS_BankID));
                  return (
                    <tr key={r.SYS_BankBranchID} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1">
                        {bank?.Code} {bank?.ShortTitle || bank?.Title}
                      </td>
                      <td className="px-2 py-1 font-mono">{r.Code}</td>
                      <td className="px-2 py-1">{r.Title}</td>
                      <td className="px-2 py-1">{r.City}</td>
                      <td className="px-2 py-1">
                        <ActiveStatusBadge value={r.IsActive !== false && r.IsActive !== 0} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
