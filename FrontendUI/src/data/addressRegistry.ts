/**
 * Adres tanımları — Ülke / İl / İlçe / Mahalle
 * Kaynak: public/data/tr-address (TurkiyeAPI 2025)
 */

export interface AddressCountry {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface AddressProvince {
  id: number;
  countryId: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface AddressDistrict {
  id: number;
  provinceId: number;
  name: string;
  isActive: boolean;
}

export interface AddressNeighborhood {
  id: number;
  provinceId: number;
  districtId: number;
  name: string;
  postalCode: string;
  isActive: boolean;
}

export interface AddressMeta {
  source: string;
  generatedAt: string;
  counts: {
    countries: number;
    provinces: number;
    districts: number;
    neighborhoods: number;
  };
}

export type AddressLevel = 'country' | 'province' | 'district' | 'neighborhood';

const BASE = '/data/tr-address';

let cache: {
  meta?: AddressMeta;
  countries?: AddressCountry[];
  provinces?: AddressProvince[];
  districts?: AddressDistrict[];
  neighborhoods?: AddressNeighborhood[];
} = {};

async function loadJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Adres verisi yüklenemedi: ${file}`);
  return res.json() as Promise<T>;
}

export async function getAddressMeta(): Promise<AddressMeta> {
  if (!cache.meta) cache.meta = await loadJson<AddressMeta>('meta.json');
  return cache.meta;
}

export async function listCountries(): Promise<AddressCountry[]> {
  if (!cache.countries) cache.countries = await loadJson<AddressCountry[]>('countries.json');
  return cache.countries;
}

export async function listProvinces(): Promise<AddressProvince[]> {
  if (!cache.provinces) cache.provinces = await loadJson<AddressProvince[]>('iller.json');
  return cache.provinces;
}

export async function listDistricts(): Promise<AddressDistrict[]> {
  if (!cache.districts) cache.districts = await loadJson<AddressDistrict[]>('ilceler.json');
  return cache.districts;
}

export async function listNeighborhoods(): Promise<AddressNeighborhood[]> {
  if (!cache.neighborhoods) cache.neighborhoods = await loadJson<AddressNeighborhood[]>('mahalleler.json');
  return cache.neighborhoods;
}

export function provinceName(id: number, provinces: AddressProvince[]): string {
  return provinces.find((p) => p.id === id)?.name || String(id);
}

export function districtName(id: number, districts: AddressDistrict[]): string {
  return districts.find((d) => d.id === id)?.name || String(id);
}

function norm(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function matchSuggest(query: string, name: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  return norm(name).includes(q);
}

export async function suggestProvinces(query: string, limit = 15): Promise<AddressProvince[]> {
  const all = await listProvinces();
  const q = query.trim();
  const filtered = q ? all.filter((p) => matchSuggest(q, p.name) || matchSuggest(q, p.code)) : all;
  return filtered.slice(0, limit);
}

export async function suggestDistricts(
  provinceNameOrId: string | number | null | undefined,
  query: string,
  limit = 20,
): Promise<AddressDistrict[]> {
  const [provinces, districts] = await Promise.all([listProvinces(), listDistricts()]);
  let provinceId: number | null = null;
  if (typeof provinceNameOrId === 'number') provinceId = provinceNameOrId;
  else if (provinceNameOrId && String(provinceNameOrId).trim()) {
    const name = String(provinceNameOrId).trim();
    const p =
      provinces.find((x) => norm(x.name) === norm(name)) ||
      provinces.find((x) => matchSuggest(name, x.name));
    provinceId = p?.id ?? null;
  }
  let list = provinceId != null ? districts.filter((d) => d.provinceId === provinceId) : districts;
  const q = query.trim();
  if (q) list = list.filter((d) => matchSuggest(q, d.name));
  return list.slice(0, limit);
}

export async function suggestNeighborhoods(
  opts: {
    provinceName?: string | null;
    districtName?: string | null;
    query: string;
    limit?: number;
  },
): Promise<AddressNeighborhood[]> {
  const [provinces, districts, neighborhoods] = await Promise.all([
    listProvinces(),
    listDistricts(),
    listNeighborhoods(),
  ]);
  let provinceId: number | null = null;
  let districtId: number | null = null;
  if (opts.provinceName?.trim()) {
    const name = opts.provinceName.trim();
    const p =
      provinces.find((x) => norm(x.name) === norm(name)) ||
      provinces.find((x) => matchSuggest(name, x.name));
    provinceId = p?.id ?? null;
  }
  if (opts.districtName?.trim()) {
    const name = opts.districtName.trim();
    let cand = districts;
    if (provinceId != null) cand = cand.filter((d) => d.provinceId === provinceId);
    const d =
      cand.find((x) => norm(x.name) === norm(name)) ||
      cand.find((x) => matchSuggest(name, x.name));
    districtId = d?.id ?? null;
  }
  let list = neighborhoods;
  if (districtId != null) list = list.filter((n) => n.districtId === districtId);
  else if (provinceId != null) list = list.filter((n) => n.provinceId === provinceId);
  const q = opts.query.trim();
  if (q) list = list.filter((n) => matchSuggest(q, n.name));
  return list.slice(0, opts.limit ?? 25);
}

export async function suggestCountries(query: string, limit = 10): Promise<AddressCountry[]> {
  const all = await listCountries();
  const q = query.trim();
  const filtered = q
    ? all.filter((c) => matchSuggest(q, c.name) || matchSuggest(q, c.code))
    : all;
  return filtered.slice(0, limit);
}
