import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Database, Loader2, MapPin, Search } from 'lucide-react';
import {
  AddressLevel,
  getAddressMeta,
  listCountries,
  listProvinces,
  listDistricts,
  listNeighborhoods,
  AddressCountry,
  AddressProvince,
  AddressDistrict,
  AddressNeighborhood,
  AddressMeta,
  provinceName,
  districtName,
} from '../data/addressRegistry';
import { ActiveStatusBadge } from '../components/ActiveToggle';
import { API_BASE, apiJson } from '../config/api';
import { appConfirm } from '../utils/appConfirm';

interface Props {
  onBack: () => void;
  /** İlk açılış sekmesi */
  initialLevel?: AddressLevel;
}

const TABS: { id: AddressLevel; label: string }[] = [
  { id: 'country', label: 'Ülke' },
  { id: 'province', label: 'İl' },
  { id: 'district', label: 'İlçe' },
  { id: 'neighborhood', label: 'Mahalle' },
];

export const AddressAdminPage: React.FC<Props> = ({ onBack, initialLevel = 'province' }) => {
  const [level, setLevel] = useState<AddressLevel>(initialLevel);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<AddressMeta | null>(null);
  const [countries, setCountries] = useState<AddressCountry[]>([]);
  const [provinces, setProvinces] = useState<AddressProvince[]>([]);
  const [districts, setDistricts] = useState<AddressDistrict[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<AddressNeighborhood[]>([]);

  const [countryId, setCountryId] = useState<number>(1);
  const [provinceId, setProvinceId] = useState<number>(34);
  const [districtId, setDistrictId] = useState<number>(0);
  const [q, setQ] = useState('');
  const [dbStatus, setDbStatus] = useState<{
    seeded?: boolean;
    provinces?: number;
    districts?: number;
    neighborhoods?: number;
  } | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const refreshDbStatus = async () => {
    try {
      const st = await apiJson<{
        seeded?: boolean;
        provinces?: number;
        districts?: number;
        neighborhoods?: number;
      }>('/api/address/status');
      setDbStatus(st);
    } catch {
      setDbStatus(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [m, c, p, d] = await Promise.all([
          getAddressMeta(),
          listCountries(),
          listProvinces(),
          listDistricts(),
        ]);
        if (cancelled) return;
        setMeta(m);
        setCountries(c);
        setProvinces(p);
        setDistricts(d);
        await refreshDbStatus();
        // Mahalle büyük — lazy
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Yükleme hatası');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (level !== 'neighborhood') return;
    let cancelled = false;
    (async () => {
      try {
        const n = await listNeighborhoods();
        if (!cancelled) setNeighborhoods(n);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Mahalle yüklenemedi');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [level]);

  const districtsOfProvince = useMemo(
    () => districts.filter((d) => d.provinceId === provinceId),
    [districts, provinceId],
  );

  useEffect(() => {
    if (districtsOfProvince.length && !districtsOfProvince.some((d) => d.id === districtId)) {
      setDistrictId(districtsOfProvince[0].id);
    }
  }, [districtsOfProvince, districtId]);

  const seedToDb = async () => {
    if (
      !await appConfirm(
        'Türkiye il / ilçe / mahalle listesi SQL tablolarına yazılacak.\nMevcut satırlar silinip yeniden yüklenir. Devam?',
      )
    ) {
      return;
    }
    setSeedBusy(true);
    setSeedMsg(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/address/seed`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Seed başarısız (${res.status})`);
      }
      setSeedMsg(data.message || 'Yüklendi');
      await refreshDbStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DB aktarımı başarısız');
    } finally {
      setSeedBusy(false);
    }
  };

  const query = q.trim().toLocaleLowerCase('tr-TR');

  const rows = useMemo(() => {
    if (level === 'country') {
      return countries
        .filter((c) => !query || c.name.toLocaleLowerCase('tr-TR').includes(query) || c.code.toLowerCase().includes(query))
        .map((c) => ({
          id: c.id,
          cols: [c.code, c.name] as (string | boolean)[],
          active: c.isActive,
        }));
    }
    if (level === 'province') {
      return provinces
        .filter((p) => p.countryId === countryId)
        .filter((p) => !query || p.name.toLocaleLowerCase('tr-TR').includes(query) || p.code.includes(query))
        .map((p) => ({
          id: p.id,
          cols: [p.code, p.name] as (string | boolean)[],
          active: p.isActive,
        }));
    }
    if (level === 'district') {
      return districtsOfProvince
        .filter((d) => !query || d.name.toLocaleLowerCase('tr-TR').includes(query))
        .map((d) => ({
          id: d.id,
          cols: [provinceName(d.provinceId, provinces), d.name] as (string | boolean)[],
          active: d.isActive,
        }));
    }
    return neighborhoods
      .filter((n) => n.districtId === districtId)
      .filter((n) => !query || n.name.toLocaleLowerCase('tr-TR').includes(query) || n.postalCode.includes(query))
      .slice(0, 500)
      .map((n) => ({
        id: n.id,
        cols: [
          provinceName(n.provinceId, provinces),
          districtName(n.districtId, districts),
          n.name,
          n.postalCode || '—',
        ] as (string | boolean)[],
        active: n.isActive as boolean | undefined,
      }));
  }, [
    level,
    countries,
    provinces,
    districtsOfProvince,
    neighborhoods,
    countryId,
    districtId,
    query,
    districts,
  ]);

  const headers =
    level === 'country'
      ? ['Kod', 'Ülke', 'Durum']
      : level === 'province'
        ? ['Plaka', 'İl', 'Durum']
        : level === 'district'
          ? ['İl', 'İlçe', 'Durum']
          : ['İl', 'İlçe', 'Mahalle', 'PK'];

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            Adres Tanımları
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Ülke → İl → İlçe → Mahalle
            {meta && (
              <span className="text-slate-400">
                {' '}
                · TR: {meta.counts.provinces} il, {meta.counts.districts} ilçe,{' '}
                {meta.counts.neighborhoods.toLocaleString('tr-TR')} mahalle
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1.5">
          <button
            type="button"
            disabled={seedBusy}
            onClick={() => void seedToDb()}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {seedBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            Veritabanına Aktar
          </button>
          {dbStatus && (
            <span className="text-[10px] text-slate-500">
              DB: {dbStatus.provinces ?? 0} il · {dbStatus.districts ?? 0} ilçe ·{' '}
              {(dbStatus.neighborhoods ?? 0).toLocaleString('tr-TR')} mahalle
              {dbStatus.seeded ? ' ✓' : ' (boş)'}
            </span>
          )}
          {seedMsg && <span className="text-[11px] text-emerald-700 max-w-xs text-right">{seedMsg}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setLevel(t.id)}
            className={`px-3 h-8 text-[12px] font-semibold rounded-md transition-colors ${
              level === t.id
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
            {meta && (
              <span className="ml-1 opacity-70 font-normal">
                (
                {t.id === 'country'
                  ? meta.counts.countries
                  : t.id === 'province'
                    ? meta.counts.provinces
                    : t.id === 'district'
                      ? meta.counts.districts
                      : meta.counts.neighborhoods.toLocaleString('tr-TR')}
                )
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(level === 'province' || level === 'district' || level === 'neighborhood') && (
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2"
            value={countryId}
            onChange={(e) => setCountryId(Number(e.target.value))}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        )}
        {(level === 'district' || level === 'neighborhood') && (
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2 min-w-[160px]"
            value={provinceId}
            onChange={(e) => setProvinceId(Number(e.target.value))}
          >
            {provinces
              .filter((p) => p.countryId === countryId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
          </select>
        )}
        {level === 'neighborhood' && (
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2 min-w-[160px]"
            value={districtId}
            onChange={(e) => setDistrictId(Number(e.target.value))}
          >
            {districtsOfProvince.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…"
            className="w-full h-8 pl-7 pr-2 text-[12px] border border-slate-300 rounded-md"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-[12px] text-slate-500">Adres verisi yükleniyor…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="min-w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-400">
                      Kayıt yok
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 h-8"
                    >
                      {r.cols.map((c, i) => (
                        <td key={i} className="px-3 py-1 text-slate-700 whitespace-nowrap">
                          {String(c)}
                        </td>
                      ))}
                      {level !== 'neighborhood' && (
                        <td className="px-3 py-1">
                          <ActiveStatusBadge value={r.active ?? true} disabled />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {level === 'neighborhood' && (
            <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50">
              Seçili ilçedeki mahalleler gösterilir (arama ile daraltın). Kaynak: TurkiyeAPI 2025.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
