import { APP_MODULES, getAllScreens } from './modules';
import { getExtraFields } from './extraFields';
import type { ExtraFieldDef } from '../api/extraFieldsApi';
import {
  EMPTY_ORG_AUTH,
  UserOrgAuth,
  UserOrgDefaults,
  CompanyScopeAuth,
  ORG_COMPANIES,
  ORG_WORKPLACES,
  ORG_WAREHOUSES,
  emptyCompanyScope,
  scopesToOrgAuth,
  collectAuthCodeLines,
} from './orgUnits';
import { AuthCodeLine, mergeAuthCodeExpression, newAuthCodeLine, resolveScreenAuthExpression } from './authCodes';

/** Liste / form satır aksiyonları — yetki kodları */
export type AuthAction = 'view' | 'create' | 'update' | 'delete';

export const AUTH_ACTIONS: { code: AuthAction; label: string }[] = [
  { code: 'view', label: 'İncele' },
  { code: 'create', label: 'Ekle' },
  { code: 'update', label: 'Değiştir' },
  { code: 'delete', label: 'Çıkar' },
];

export interface ScreenAuthFlags {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface FieldAuthFlags {
  canView: boolean;
  canEdit: boolean;
}

export interface UserAuthProfile {
  userId: string;
  userName: string;
  /** true: tüm ekran/alan yetkileri açık (admin) */
  isAdmin: boolean;
  /**
   * Eski tek alan (geriye uyum) — firma satırları yoksa kullanılır
   * Örn: "+SAT,+PER" | "-GIZLI" | boş = tüm kayıtları gör
   */
  authCode?: string;
  /** Firma / işyeri / ambar — companyScopes’tan türetilir */
  orgAuth?: UserOrgAuth;
  /** Logo ağaç: firma → işyeri/ambar + kayıt türü yetki kodları */
  companyScopes?: CompanyScopeAuth[];
  /** Öndeğer firma / işyeri / ambar / bölüm */
  orgDefaults?: UserOrgDefaults;
  screens: Record<string, ScreenAuthFlags>;
  fields: Record<string, FieldAuthFlags>;
  /** Atanmış rol id’leri (SYS_Role) */
  roleIds?: number[];
  /** Rol kodları (görüntü) */
  roleCodes?: string[];
  /** Yetki kaynağı: rollerden mi geldi */
  fromRoles?: boolean;
}

export interface RoleAuthConfig {
  isAdmin?: boolean;
  authCode?: string;
  screens?: Record<string, ScreenAuthFlags>;
  fields?: Record<string, FieldAuthFlags>;
  companyScopes?: CompanyScopeAuth[];
  orgDefaults?: UserOrgDefaults;
}

const STORAGE_KEY = 'bartu_erp_user_auth_v2';
const CURRENT_USER_KEY = 'bartu_erp_current_user_id';
const EFFECTIVE_CACHE_KEY = 'bartu_erp_effective_auth_v1';

export const DEMO_USERS = [
  { userId: '1', userName: 'admin', displayName: 'Sistem Yöneticisi', isAdmin: true },
  { userId: '2', userName: 'muhasebe', displayName: 'Ayşe Yılmaz', isAdmin: false },
  { userId: '3', userName: 'satis', displayName: 'Mehmet Demir', isAdmin: false },
] as const;

function emptyFlags(all = false): ScreenAuthFlags {
  return { view: all, create: all, update: all, delete: all };
}

function fieldKey(tableName: string, fieldName: string) {
  return `${tableName}.${fieldName}`;
}

export function buildScopesFromOrg(
  org: UserOrgAuth,
  linesByCompany?: Record<string, AuthCodeLine[]>,
): CompanyScopeAuth[] {
  const restrictCompanies = org.companyIds.length > 0;
  return ORG_COMPANIES.map((c) => {
    const enabled = restrictCompanies ? org.companyIds.includes(c.id) : false;
    const wpIds = ORG_WORKPLACES.filter((w) => w.companyId === c.id).map((w) => w.id);
    const whIds = ORG_WAREHOUSES.filter((w) => w.companyId === c.id).map((w) => w.id);
    return {
      companyId: c.id,
      enabled,
      workplaceIds: org.workplaceIds.filter((id) => wpIds.includes(id)),
      whouseIds: org.whouseIds.filter((id) => whIds.includes(id)),
      authCodeLines: linesByCompany?.[c.id] || [],
    };
  });
}

function ensureCompanyScopes(profile: UserAuthProfile): CompanyScopeAuth[] {
  if (profile.companyScopes && profile.companyScopes.length) {
    const byId = new Map(profile.companyScopes.map((s) => [s.companyId, s]));
    return ORG_COMPANIES.map((c) => byId.get(c.id) || emptyCompanyScope(c.id));
  }
  const org = profile.orgAuth || EMPTY_ORG_AUTH;
  const legacy = (profile.authCode || '').trim();
  const linesByCompany: Record<string, AuthCodeLine[]> = {};
  if (legacy && org.companyIds.length > 0) {
    for (const cid of org.companyIds) {
      linesByCompany[cid] = [
        { ...newAuthCodeLine('ProductCard'), authCode: legacy },
        { ...newAuthCodeLine('CustomerCard'), authCode: legacy },
      ];
    }
  }
  return buildScopesFromOrg(org, linesByCompany);
}

function syncDerived(profile: UserAuthProfile): UserAuthProfile {
  const scopes = ensureCompanyScopes(profile);
  return {
    ...profile,
    companyScopes: scopes,
    orgAuth: scopesToOrgAuth(scopes),
  };
}

/** Liste filtresi için birleşik yetki kodu ifadesi */
export function resolveProfileAuthCode(
  profile: UserAuthProfile,
  recordType?: string | null,
): string {
  if (profile.isAdmin) return '';
  const scopes = ensureCompanyScopes(profile);
  const lines = collectAuthCodeLines(scopes);
  return mergeAuthCodeExpression(lines, profile.authCode, recordType);
}

/** Ekran bazlı yetki kodu (kart / hareket ekranı ayrı) — tablo bazlı satırlar yedek */
export function resolveScreenAuthCode(
  profile: UserAuthProfile,
  screenId: string,
  tableName?: string | null,
): string {
  if (profile.isAdmin) return '';
  const lines = collectAuthCodeLines(ensureCompanyScopes(profile));
  return resolveScreenAuthExpression(lines, profile.authCode, screenId, tableName);
}

function defaultScreensForRole(kind: 'admin' | 'muhasebe' | 'satis'): Record<string, ScreenAuthFlags> {
  const map: Record<string, ScreenAuthFlags> = {};
  for (const s of getAllScreens()) {
    if (kind === 'admin') {
      map[s.id] = emptyFlags(true);
      continue;
    }
    const mod = s.path.split('/')[0];
    if (kind === 'muhasebe') {
      const ok = ['finans', 'muhasebe'].includes(mod) || (mod === 'sistem' && s.id === 'kullanicilar');
      map[s.id] = {
        view: ok || mod === 'raporlama',
        create: ['finans', 'muhasebe'].includes(mod),
        update: ['finans', 'muhasebe'].includes(mod),
        delete: false,
      };
    } else {
      const ok = ['satis', 'malzeme'].includes(mod) || s.id === 'cari-kartlar';
      map[s.id] = {
        view: ok,
        create: mod === 'satis' || s.id === 'cari-kartlar',
        update: mod === 'satis' || s.id === 'cari-kartlar',
        delete: false,
      };
    }
  }
  return map;
}

function defaultFieldsForRole(kind: 'admin' | 'muhasebe' | 'satis'): Record<string, FieldAuthFlags> {
  const map: Record<string, FieldAuthFlags> = {};
  for (const f of getExtraFields()) {
    const k = fieldKey(f.tableName, f.fieldName);
    if (kind === 'admin') {
      map[k] = { canView: true, canEdit: true };
    } else if (kind === 'muhasebe') {
      map[k] = {
        canView: true,
        canEdit: ['CustomerCard', 'AccountCard', 'AccountVoucher', 'Invoice'].includes(f.tableName),
      };
    } else {
      map[k] = {
        canView: ['ProductCard', 'CustomerCard', 'Invoice', 'OrderVoucher', 'ProductVoucher'].includes(f.tableName),
        canEdit: ['ProductCard', 'OrderVoucher', 'ProductVoucher'].includes(f.tableName),
      };
    }
  }
  return map;
}

function buildDefaultProfiles(): UserAuthProfile[] {
  const admin = syncDerived({
    userId: '1',
    userName: 'admin',
    isAdmin: true,
    authCode: '',
    orgAuth: { ...EMPTY_ORG_AUTH },
    orgDefaults: {
      defaultCompanyId: '1',
      defaultWorkplaceId: '1',
      defaultWhouseId: '1',
    },
    companyScopes: ORG_COMPANIES.map((c) => ({ ...emptyCompanyScope(c.id), enabled: true })),
    screens: defaultScreensForRole('admin'),
    fields: defaultFieldsForRole('admin'),
  });

  const muhasebe = syncDerived({
    userId: '2',
    userName: 'muhasebe',
    isAdmin: false,
    authCode: '+MUH',
    orgAuth: { companyIds: ['1', '2'], workplaceIds: [], whouseIds: [] },
    orgDefaults: {
      defaultCompanyId: '1',
      defaultWorkplaceId: '1',
      defaultWhouseId: '1',
      defaultOrgUnitId: '2',
    },
    companyScopes: [
      {
        companyId: '1',
        enabled: true,
        workplaceIds: [],
        whouseIds: [],
        authCodeLines: [{ ...newAuthCodeLine('AccountVoucher'), authCode: '+MUH' }],
      },
      {
        companyId: '2',
        enabled: true,
        workplaceIds: [],
        whouseIds: [],
        authCodeLines: [{ ...newAuthCodeLine('AccountVoucher'), authCode: '+MUH' }],
      },
    ],
    screens: defaultScreensForRole('muhasebe'),
    fields: defaultFieldsForRole('muhasebe'),
  });

  const satis = syncDerived({
    userId: '3',
    userName: 'satis',
    isAdmin: false,
    authCode: '+SAT,-GIZLI',
    orgAuth: { companyIds: ['1'], workplaceIds: ['1'], whouseIds: ['1'] },
    orgDefaults: {
      defaultCompanyId: '1',
      defaultWorkplaceId: '1',
      defaultWhouseId: '1',
      defaultOrgUnitId: '1',
    },
    companyScopes: [
      {
        companyId: '1',
        enabled: true,
        workplaceIds: ['1'],
        whouseIds: ['1'],
        authCodeLines: [
          { ...newAuthCodeLine('ProductCard'), authCode: '+SAT,-GIZLI' },
          { ...newAuthCodeLine('CustomerCard'), authCode: '+SAT' },
          { ...newAuthCodeLine('OrderVoucher'), authCode: '+SAT' },
        ],
      },
      emptyCompanyScope('2'),
    ],
    screens: defaultScreensForRole('satis'),
    fields: defaultFieldsForRole('satis'),
  });

  return [admin, muhasebe, satis];
}

function loadAll(): UserAuthProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserAuthProfile[];
      if (Array.isArray(parsed) && parsed.length) return mergeNewResources(parsed);
    }
  } catch {
    /* ignore */
  }
  const fresh = buildDefaultProfiles();
  saveAll(fresh);
  return fresh;
}

function mergeNewResources(profiles: UserAuthProfile[]): UserAuthProfile[] {
  const screens = getAllScreens();
  const fields = getExtraFields();
  let dirty = false;

  for (let i = 0; i < profiles.length; i++) {
    let p = profiles[i];
    if (!p.companyScopes) {
      p = syncDerived(p);
      dirty = true;
    } else {
      const ensured = ensureCompanyScopes(p);
      if (ensured.length !== p.companyScopes.length) {
        p = { ...p, companyScopes: ensured, orgAuth: scopesToOrgAuth(ensured) };
        dirty = true;
      }
    }
    for (const s of screens) {
      if (!p.screens[s.id]) {
        p.screens[s.id] = p.isAdmin ? emptyFlags(true) : emptyFlags(false);
        dirty = true;
      }
    }
    for (const f of fields) {
      const k = fieldKey(f.tableName, f.fieldName);
      if (!p.fields[k]) {
        p.fields[k] = p.isAdmin
          ? { canView: true, canEdit: true }
          : { canView: false, canEdit: false };
        dirty = true;
      }
    }
    profiles[i] = p;
  }
  if (dirty) saveAll(profiles);
  return profiles;
}

function saveAll(profiles: UserAuthProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function listAuthProfiles(): UserAuthProfile[] {
  return loadAll();
}

export function getAuthProfile(userId: string): UserAuthProfile | undefined {
  return loadAll().find((p) => p.userId === userId);
}

export function saveAuthProfile(profile: UserAuthProfile) {
  const synced = syncDerived(profile);
  const all = loadAll();
  const idx = all.findIndex((p) => p.userId === synced.userId);
  if (idx >= 0) all[idx] = synced;
  else all.push(synced);
  saveAll(all);
}

export function getCurrentUserId(): string {
  return localStorage.getItem(CURRENT_USER_KEY) || '1';
}

export function setCurrentUserId(userId: string) {
  localStorage.setItem(CURRENT_USER_KEY, userId);
}

export function profileToAuthConfig(profile: UserAuthProfile): RoleAuthConfig {
  return {
    isAdmin: profile.isAdmin,
    authCode: profile.authCode || '',
    screens: profile.screens,
    fields: profile.fields,
    companyScopes: ensureCompanyScopes(profile),
    orgDefaults: profile.orgDefaults || {},
  };
}

export function stringifyAuthConfig(profile: UserAuthProfile): string {
  return JSON.stringify(profileToAuthConfig(profile));
}

export function parseAuthConfig(raw?: string | null): RoleAuthConfig {
  if (!raw?.trim()) return { isAdmin: false, screens: {}, fields: {} };
  try {
    return JSON.parse(raw) as RoleAuthConfig;
  } catch {
    return { isAdmin: false, screens: {}, fields: {} };
  }
}

export function authConfigToProfile(
  userId: string,
  userName: string,
  cfg: RoleAuthConfig,
  extras?: { roleIds?: number[]; roleCodes?: string[] },
): UserAuthProfile {
  const isAdmin = !!cfg.isAdmin;
  const screens = { ...(cfg.screens || {}) };
  const fields = { ...(cfg.fields || {}) };
  // Eksik ekran/alanları doldur
  for (const s of getAllScreens()) {
    if (!screens[s.id]) screens[s.id] = emptyFlags(isAdmin);
  }
  for (const f of getExtraFields()) {
    const k = fieldKey(f.tableName, f.fieldName);
    if (!fields[k]) {
      fields[k] = isAdmin
        ? { canView: true, canEdit: true }
        : { canView: false, canEdit: false };
    }
  }
  return syncDerived({
    userId,
    userName,
    isAdmin,
    authCode: cfg.authCode || '',
    companyScopes: cfg.companyScopes,
    orgDefaults: cfg.orgDefaults || {},
    screens,
    fields,
    roleIds: extras?.roleIds || [],
    roleCodes: extras?.roleCodes || [],
    fromRoles: true,
  });
}

/** Rol şablonundan yeni profil (ADMIN/MUHASEBE/SATIS). */
export function buildProfileFromRoleKind(
  userId: string,
  userName: string,
  kind: 'admin' | 'muhasebe' | 'satis',
): UserAuthProfile {
  if (kind === 'admin') {
    return syncDerived({
      userId,
      userName,
      isAdmin: true,
      authCode: '',
      companyScopes: ORG_COMPANIES.map((c) => ({ ...emptyCompanyScope(c.id), enabled: true })),
      orgDefaults: {},
      screens: defaultScreensForRole('admin'),
      fields: defaultFieldsForRole('admin'),
      fromRoles: true,
    });
  }
  if (kind === 'muhasebe') {
    return syncDerived({
      userId,
      userName,
      isAdmin: false,
      authCode: '+MUH',
      companyScopes: [
        {
          companyId: '1',
          enabled: true,
          workplaceIds: [],
          whouseIds: [],
          authCodeLines: [{ ...newAuthCodeLine('AccountVoucher'), authCode: '+MUH' }],
        },
      ],
      orgDefaults: {},
      screens: defaultScreensForRole('muhasebe'),
      fields: defaultFieldsForRole('muhasebe'),
      fromRoles: true,
    });
  }
  return syncDerived({
    userId,
    userName,
    isAdmin: false,
    authCode: '+SAT,-GIZLI',
    companyScopes: [
      {
        companyId: '1',
        enabled: true,
        workplaceIds: ['1'],
        whouseIds: ['1'],
        authCodeLines: [
          { ...newAuthCodeLine('ProductCard'), authCode: '+SAT,-GIZLI' },
          { ...newAuthCodeLine('CustomerCard'), authCode: '+SAT' },
        ],
      },
    ],
    orgDefaults: {},
    screens: defaultScreensForRole('satis'),
    fields: defaultFieldsForRole('satis'),
    fromRoles: true,
  });
}

interface EffectiveCache {
  systemUserId: number;
  isAdmin: boolean;
  roleIds: number[];
  roleCodes: string[];
  authConfigJson: string;
  updatedAt: string;
}

function readEffectiveCache(): EffectiveCache | null {
  try {
    const raw = localStorage.getItem(EFFECTIVE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EffectiveCache;
  } catch {
    return null;
  }
}

export function getCurrentProfile(): UserAuthProfile {
  const id = getCurrentUserId();
  const base = getAuthProfile(id) || buildDefaultProfiles()[0];
  const cache = readEffectiveCache();
  if (cache && String(cache.systemUserId) === String(id)) {
    const cfg = parseAuthConfig(cache.authConfigJson);
    // Rol config boşsa (sadece isAdmin) local profil ekranlarını koru ama isAdmin/roleIds uygula
    const hasScreens = cfg.screens && Object.keys(cfg.screens).length > 0;
    if (cache.isAdmin || hasScreens) {
      const fromRole = authConfigToProfile(id, base.userName, {
        ...cfg,
        isAdmin: cache.isAdmin || !!cfg.isAdmin,
        // Rolde ekran yoksa local ekranları kullan (geçiş)
        screens: hasScreens ? cfg.screens : base.screens,
        fields: cfg.fields && Object.keys(cfg.fields).length ? cfg.fields : base.fields,
        companyScopes: cfg.companyScopes?.length ? cfg.companyScopes : base.companyScopes,
        orgDefaults: cfg.orgDefaults || base.orgDefaults,
        authCode: cfg.authCode || base.authCode,
      }, {
        roleIds: cache.roleIds,
        roleCodes: cache.roleCodes,
      });
      return fromRole;
    }
    return {
      ...base,
      isAdmin: cache.isAdmin || base.isAdmin,
      roleIds: cache.roleIds,
      roleCodes: cache.roleCodes,
      fromRoles: true,
    };
  }
  return base;
}

/** API’den efektif yetkiyi çekip cache’ler (menü / canScreen için). */
export async function refreshEffectiveAuth(userId?: string): Promise<UserAuthProfile> {
  const id = userId || getCurrentUserId();
  const numId = Number(id) || 0;
  try {
    const { getEffectiveAuth } = await import('../api/rolesApi');
    if (numId > 0) {
      const eff = await getEffectiveAuth(numId);
      const cache: EffectiveCache = {
        systemUserId: eff.systemUserId,
        isAdmin: eff.isAdmin,
        roleIds: (eff.roles || []).map((r) => r.id),
        roleCodes: (eff.roles || []).map((r) => r.code),
        authConfigJson: eff.authConfigJson || '{}',
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(EFFECTIVE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    /* API yoksa local profil */
  }
  return getCurrentProfile();
}

export function canScreen(screenId: string, action: AuthAction, profile?: UserAuthProfile): boolean {
  const p = profile || getCurrentProfile();
  if (p.isAdmin) return true;
  const flags = p.screens[screenId];
  if (!flags) return false;
  return Boolean(flags[action]);
}

export function canField(
  tableName: string,
  fieldName: string,
  mode: 'view' | 'edit',
  profile?: UserAuthProfile,
): boolean {
  const p = profile || getCurrentProfile();
  if (p.isAdmin) return true;
  const flags = p.fields[fieldKey(tableName, fieldName)];
  if (!flags) return false;
  return mode === 'view' ? flags.canView : flags.canEdit;
}

export function permissionTree() {
  return APP_MODULES.map((mod) => ({
    id: mod.id,
    title: mod.title,
    groups: mod.groups.map((g) => ({
      key: g.key,
      title: g.title,
      screens: flatten(g.screens).map((s) => ({
        id: s.id,
        path: s.path,
        title: s.title,
        subtitle: s.subtitle,
        tableHint: s.subtitle,
      })),
    })),
  }));
}

function flatten(
  screens: { id: string; path: string; title: string; subtitle?: string; children?: typeof screens }[],
): typeof screens {
  return screens.flatMap((s) => [s, ...(s.children ? flatten(s.children) : [])]);
}

export function customFieldsForAuth(): ExtraFieldDef[] {
  return getExtraFields().filter((f) => f.isActive);
}

export { fieldKey, ensureCompanyScopes };
