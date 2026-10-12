/**
 * Organizasyon:
 *   Firma (Company) → İşyeri (Workplace) → Ambar (Whouse)
 *   Bölüm / Birim (OrgUnit) bağımsız
 */

import type { AuthCodeLine } from './authCodes';

export interface OrgCompany {
  id: string;
  code: string;
  title: string;
  isActive: boolean;
}

export interface OrgWorkplace {
  id: string;
  companyId: string;
  code: string;
  title: string;
  isActive: boolean;
}

export interface OrgWarehouse {
  id: string;
  companyId: string;
  /** Ambar işyerine bağlı */
  workplaceId: string;
  code: string;
  title: string;
  isActive: boolean;
}

/** Bölüm / Birim — hiyerarşiden bağımsız */
export interface OrgUnit {
  id: string;
  code: string;
  title: string;
  /** 1 Bölüm, 2 Birim */
  unitKind: 1 | 2;
  companyId?: string | null;
  isActive: boolean;
}

export interface UserOrgAuth {
  companyIds: string[];
  workplaceIds: string[];
  whouseIds: string[];
}

export interface CompanyScopeAuth {
  companyId: string;
  enabled: boolean;
  workplaceIds: string[];
  whouseIds: string[];
  authCodeLines: AuthCodeLine[];
}

/** Kullanıcı öndeğerleri */
export interface UserOrgDefaults {
  defaultCompanyId?: string;
  defaultWorkplaceId?: string;
  defaultWhouseId?: string;
  defaultOrgUnitId?: string;
}

export const EMPTY_ORG_AUTH: UserOrgAuth = {
  companyIds: [],
  workplaceIds: [],
  whouseIds: [],
};

export function emptyCompanyScope(companyId: string): CompanyScopeAuth {
  return {
    companyId,
    enabled: false,
    workplaceIds: [],
    whouseIds: [],
    authCodeLines: [],
  };
}

export function scopesToOrgAuth(scopes: CompanyScopeAuth[]): UserOrgAuth {
  const enabled = scopes.filter((s) => s.enabled);
  if (enabled.length === 0) return { ...EMPTY_ORG_AUTH };
  return {
    companyIds: enabled.map((s) => s.companyId),
    workplaceIds: enabled.flatMap((s) => s.workplaceIds),
    whouseIds: enabled.flatMap((s) => s.whouseIds),
  };
}

export function collectAuthCodeLines(
  scopes: CompanyScopeAuth[] | null | undefined,
  companyId?: string | null,
): AuthCodeLine[] {
  const list = scopes || [];
  const filtered = companyId
    ? list.filter((s) => s.companyId === companyId && s.enabled)
    : list.filter((s) => s.enabled);
  return filtered.flatMap((s) => s.authCodeLines);
}

export const ORG_COMPANIES: OrgCompany[] = [
  { id: '1', code: '01', title: 'Bartu Ticaret A.Ş.', isActive: true },
  { id: '2', code: '02', title: 'Bartu Anadolu Ltd.', isActive: true },
];

export const ORG_WORKPLACES: OrgWorkplace[] = [
  { id: '1', companyId: '1', code: 'IY-01', title: 'Merkez', isActive: true },
  { id: '2', companyId: '1', code: 'IY-02', title: 'Şube Kadıköy', isActive: true },
  { id: '3', companyId: '2', code: 'IY-AN', title: 'Ankara', isActive: true },
];

export const ORG_WAREHOUSES: OrgWarehouse[] = [
  { id: '1', companyId: '1', workplaceId: '1', code: 'MRK', title: 'Merkez Depo', isActive: true },
  { id: '2', companyId: '1', workplaceId: '2', code: 'SB', title: 'Şube Depo', isActive: true },
  { id: '3', companyId: '2', workplaceId: '3', code: 'ANK', title: 'Ankara Depo', isActive: true },
];

export const ORG_UNITS: OrgUnit[] = [
  { id: '1', code: 'SAT', title: 'Satış', unitKind: 1, companyId: '1', isActive: true },
  { id: '2', code: 'MUH', title: 'Muhasebe', unitKind: 1, companyId: '1', isActive: true },
  { id: '3', code: 'DEP-A', title: 'Depo Operasyon', unitKind: 2, companyId: '1', isActive: true },
  { id: '4', code: 'ANK-SAT', title: 'Ankara Satış', unitKind: 1, companyId: '2', isActive: true },
];

export function workplacesOfCompany(companyId: string): OrgWorkplace[] {
  return ORG_WORKPLACES.filter((w) => w.companyId === companyId && w.isActive);
}

export function warehousesOfWorkplace(workplaceId: string): OrgWarehouse[] {
  return ORG_WAREHOUSES.filter((w) => w.workplaceId === workplaceId && w.isActive);
}

export function warehousesOfCompany(companyId: string): OrgWarehouse[] {
  return ORG_WAREHOUSES.filter((w) => w.companyId === companyId && w.isActive);
}

export function orgUnitsOfCompany(companyId?: string | null): OrgUnit[] {
  const active = ORG_UNITS.filter((u) => u.isActive);
  if (!companyId) return active;
  return active.filter((u) => !u.companyId || String(u.companyId) === String(companyId));
}

/** Yetkiye göre görülebilir firmalar (boş liste = kısıt yok → tüm aktif) */
export function allowedCompanies(org?: UserOrgAuth | null): OrgCompany[] {
  const auth = org || EMPTY_ORG_AUTH;
  const all = ORG_COMPANIES.filter((c) => c.isActive);
  if (auth.companyIds.length === 0) return all;
  return all.filter((c) => auth.companyIds.includes(c.id));
}

export function allowedWorkplaces(
  companyId: string,
  org?: UserOrgAuth | null,
): OrgWorkplace[] {
  const auth = org || EMPTY_ORG_AUTH;
  let list = workplacesOfCompany(companyId);
  if (auth.workplaceIds.length > 0) {
    list = list.filter((w) => auth.workplaceIds.includes(w.id));
  }
  return list;
}

export function allowedWarehouses(
  companyId: string,
  workplaceId?: string | null,
  org?: UserOrgAuth | null,
): OrgWarehouse[] {
  const auth = org || EMPTY_ORG_AUTH;
  let list = workplaceId
    ? warehousesOfWorkplace(workplaceId)
    : warehousesOfCompany(companyId);
  if (companyId) list = list.filter((w) => w.companyId === companyId);
  if (auth.whouseIds.length > 0) {
    list = list.filter((w) => auth.whouseIds.includes(w.id));
  }
  return list;
}

export function allowedOrgUnits(companyId?: string | null): OrgUnit[] {
  return orgUnitsOfCompany(companyId);
}

export type ResolvedOrgDefaults = {
  companyId: string;
  workplaceId: string;
  whouseId: string;
  orgUnitId: string;
};

/**
 * Kullanıcı öndeğerleri varsa (ve yetkiliyse) onları kullan;
 * yoksa yetkiye göre ilk firma → ilk işyeri → ilk ambar → ilk bölüm/birim.
 */
export function resolveOrgDefaults(
  org?: UserOrgAuth | null,
  defaults?: UserOrgDefaults | null,
): ResolvedOrgDefaults {
  const companies = allowedCompanies(org);
  const preferCo = defaults?.defaultCompanyId;
  const companyId =
    (preferCo && companies.some((c) => c.id === preferCo) ? preferCo : '') ||
    companies[0]?.id ||
    '';

  const workplaces = companyId ? allowedWorkplaces(companyId, org) : [];
  const preferWp = defaults?.defaultWorkplaceId;
  const workplaceId =
    (preferWp && workplaces.some((w) => w.id === preferWp) ? preferWp : '') ||
    workplaces[0]?.id ||
    '';

  const whouses = companyId ? allowedWarehouses(companyId, workplaceId || null, org) : [];
  const preferWh = defaults?.defaultWhouseId;
  const whouseId =
    (preferWh && whouses.some((w) => w.id === preferWh) ? preferWh : '') ||
    whouses[0]?.id ||
    '';

  const units = allowedOrgUnits(companyId || null);
  const preferOu = defaults?.defaultOrgUnitId;
  const orgUnitId =
    (preferOu && units.some((u) => u.id === preferOu) ? preferOu : '') ||
    units[0]?.id ||
    '';

  return { companyId, workplaceId, whouseId, orgUnitId };
}

/** Firma değişince alt alanlar (öndeğer uygunsa onu, değilse ilk yetkili) */
export function resolveOrgChildrenForCompany(
  companyId: string,
  org?: UserOrgAuth | null,
  defaults?: UserOrgDefaults | null,
): Omit<ResolvedOrgDefaults, 'companyId'> {
  const workplaces = allowedWorkplaces(companyId, org);
  const preferWp = defaults?.defaultWorkplaceId;
  const workplaceId =
    (preferWp && workplaces.some((w) => w.id === preferWp) ? preferWp : '') ||
    workplaces[0]?.id ||
    '';

  const whouses = allowedWarehouses(companyId, workplaceId || null, org);
  const preferWh = defaults?.defaultWhouseId;
  const whouseId =
    (preferWh && whouses.some((w) => w.id === preferWh) ? preferWh : '') ||
    whouses[0]?.id ||
    '';

  const units = allowedOrgUnits(companyId);
  const preferOu = defaults?.defaultOrgUnitId;
  const orgUnitId =
    (preferOu && units.some((u) => u.id === preferOu) ? preferOu : '') ||
    units[0]?.id ||
    '';

  return { workplaceId, whouseId, orgUnitId };
}

export function companyOptions(org?: UserOrgAuth | null) {
  return allowedCompanies(org).map((c) => ({
    label: `${c.code} — ${c.title}`,
    value: c.id,
  }));
}

export function workplaceOptions(companyId?: string | null, org?: UserOrgAuth | null) {
  const list = companyId
    ? allowedWorkplaces(companyId, org)
    : ORG_WORKPLACES.filter((w) => w.isActive);
  return list.map((w) => {
    const co = ORG_COMPANIES.find((c) => c.id === w.companyId);
    return { label: `${w.code} — ${w.title}${co ? ` (${co.code})` : ''}`, value: w.id };
  });
}

export function whouseOptions(
  workplaceId?: string | null,
  companyId?: string | null,
  org?: UserOrgAuth | null,
) {
  let list: OrgWarehouse[];
  if (companyId) {
    list = allowedWarehouses(companyId, workplaceId || null, org);
  } else {
    list = ORG_WAREHOUSES.filter((w) => w.isActive);
    if (workplaceId) list = list.filter((w) => w.workplaceId === workplaceId);
  }
  return list.map((w) => {
    const wp = ORG_WORKPLACES.find((x) => x.id === w.workplaceId);
    return { label: `${w.code} — ${w.title}${wp ? ` / ${wp.code}` : ''}`, value: w.id };
  });
}

export function orgUnitOptions(companyId?: string | null, unitKind?: 1 | 2) {
  let list = allowedOrgUnits(companyId);
  if (unitKind != null) list = list.filter((u) => u.unitKind === unitKind);
  return list.map((u) => ({
    label: `${u.code} — ${u.title}${unitKind == null ? ` (${u.unitKind === 1 ? 'Bölüm' : 'Birim'})` : ''}`,
    value: u.id,
  }));
}

function rowOrgId(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function canViewByOrgAuth(
  org: UserOrgAuth | null | undefined,
  row: Record<string, unknown>,
): boolean {
  const auth = org || EMPTY_ORG_AUTH;
  const companyId = rowOrgId(row, ['companyId', 'CompanyID', 'companyID']);
  const workplaceId = rowOrgId(row, ['workplaceId', 'DepartmentID', 'departmentId', 'WorkplaceID']);
  const whouseId = rowOrgId(row, ['whouseId', 'WhouseID', 'warehouseId', 'WarehouseID']);

  if (auth.companyIds.length > 0 && companyId && !auth.companyIds.includes(companyId)) return false;
  if (auth.workplaceIds.length > 0 && workplaceId && !auth.workplaceIds.includes(workplaceId)) return false;
  if (auth.whouseIds.length > 0 && whouseId && !auth.whouseIds.includes(whouseId)) return false;
  return true;
}

export function filterRowsByOrgAuth<T extends Record<string, unknown>>(
  rows: T[],
  org: UserOrgAuth | null | undefined,
): T[] {
  if (!org) return rows;
  const empty =
    org.companyIds.length === 0 &&
    org.workplaceIds.length === 0 &&
    org.whouseIds.length === 0;
  if (empty) return rows;
  return rows.filter((r) => canViewByOrgAuth(org, r));
}

export function orgAuthSummary(org: UserOrgAuth | null | undefined): string {
  if (!org) return 'Tüm firma / işyeri / ambar';
  const parts: string[] = [];
  if (org.companyIds.length === 0) parts.push('Firma: tümü');
  else {
    parts.push(
      `Firma: ${org.companyIds.map((id) => ORG_COMPANIES.find((c) => c.id === id)?.code || id).join(',')}`,
    );
  }
  if (org.workplaceIds.length === 0) parts.push('İşyeri: tümü');
  else {
    parts.push(
      `İşyeri: ${org.workplaceIds.map((id) => ORG_WORKPLACES.find((w) => w.id === id)?.code || id).join(',')}`,
    );
  }
  if (org.whouseIds.length === 0) parts.push('Ambar: tümü');
  else {
    parts.push(
      `Ambar: ${org.whouseIds.map((id) => ORG_WAREHOUSES.find((w) => w.id === id)?.code || id).join(',')}`,
    );
  }
  return parts.join(' · ');
}

export function toggleId(list: string[], id: string, on: boolean): string[] {
  if (on) return list.includes(id) ? list : [...list, id];
  return list.filter((x) => x !== id);
}
