import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Plus, Save, Shield, Trash2 } from 'lucide-react';
import {
  AuthAction,
  DEMO_USERS,
  ScreenAuthFlags,
  FieldAuthFlags,
  getAuthProfile,
  saveAuthProfile,
  setCurrentUserId,
  getCurrentUserId,
  UserAuthProfile,
  fieldKey,
  ensureCompanyScopes,
  parseAuthConfig,
  authConfigToProfile,
  stringifyAuthConfig,
  buildProfileFromRoleKind,
  refreshEffectiveAuth,
} from '../data/permissions';
import {
  getSqlReportAuthByUser,
  saveSqlReportAuthByUser,
  type SqlReportUserAuthItem,
} from '../api/sqlReportsApi';
import {
  createRole,
  deleteRole,
  getUserRoles,
  listRoles,
  saveUserRoles,
  updateRole,
  type Role,
} from '../api/rolesApi';
import { useAppModules } from '../contexts/AppModulesContext';
import {
  ORG_COMPANIES,
  ORG_WORKPLACES,
  ORG_WAREHOUSES,
  ORG_UNITS,
  CompanyScopeAuth,
  UserOrgDefaults,
  workplacesOfCompany,
  warehousesOfWorkplace,
  toggleId,
} from '../data/orgUnits';
import {
  AUTH_RECORD_TYPES,
  AuthCodeLine,
  newAuthCodeLine,
  AUTH_CODE_HINT,
} from '../data/authCodes';
import { OperationAuthTreePanel } from '../components/OperationAuthTreePanel';
import { buildAuthCodeScreenGroups } from '../data/operationAuthTree';

interface Props {
  onBack: () => void;
}

type TreeSel =
  | { kind: 'company'; companyId: string }
  | { kind: 'workplaces'; companyId: string }
  | { kind: 'authCodes'; companyId: string }
  | { kind: 'screenAuth'; companyId: string };

function emptyScreen(): ScreenAuthFlags {
  return { view: false, create: false, update: false, delete: false };
}

function companyLabel(id: string) {
  const c = ORG_COMPANIES.find((x) => x.id === id);
  return c ? `(${c.code}) ${c.title}` : id;
}

type PageMode = 'roles' | 'users';

export const UserPermissionsPage: React.FC<Props> = ({ onBack }) => {
  const { reloadMenus } = useAppModules();
  const [mode, setMode] = useState<PageMode>('roles');
  const [userId, setUserId] = useState(getCurrentUserId());
  const [tick, setTick] = useState(0);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [openCompanies, setOpenCompanies] = useState<Record<string, boolean>>({ '1': true });
  const [sel, setSel] = useState<TreeSel>({ kind: 'screenAuth', companyId: '1' });
  const [authCodeQuery, setAuthCodeQuery] = useState('');
  const authCodeGroups = useMemo(() => buildAuthCodeScreenGroups(), []);
  const [sqlReports, setSqlReports] = useState<SqlReportUserAuthItem[]>([]);
  const [sqlBusy, setSqlBusy] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserAuthProfile | null>(null);
  const [userRoleIds, setUserRoleIds] = useState<number[]>([]);
  const [rolesBusy, setRolesBusy] = useState(false);

  const loadRoles = async () => {
    setRolesBusy(true);
    try {
      const list = await listRoles();
      setRoles(list);
      if (roleId == null && list.length) setRoleId(list[0].id);
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'Roller yüklenemedi');
    } finally {
      setRolesBusy(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  useEffect(() => {
    if (mode !== 'roles' || roleId == null) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const cfg = parseAuthConfig(role.authConfigJson);
    const hasScreens = cfg.screens && Object.keys(cfg.screens).length > 0;
    let draft: UserAuthProfile;
    if (role.isAdmin || cfg.isAdmin) {
      draft = buildProfileFromRoleKind(`role-${role.id}`, role.code, 'admin');
    } else if (!hasScreens) {
      const kind =
        role.code.toUpperCase() === 'MUHASEBE'
          ? 'muhasebe'
          : role.code.toUpperCase() === 'SATIS'
            ? 'satis'
            : 'satis';
      draft = buildProfileFromRoleKind(`role-${role.id}`, role.code, kind);
    } else {
      draft = authConfigToProfile(`role-${role.id}`, role.code, cfg);
    }
    draft.isAdmin = role.isAdmin || !!cfg.isAdmin;
    setRoleDraft(draft);
    setTick((t) => t + 1);
  }, [mode, roleId, roles]);

  useEffect(() => {
    if (mode !== 'users') return;
    let cancelled = false;
    (async () => {
      const uid = Number(userId) || 0;
      if (uid <= 0) {
        setUserRoleIds([]);
        return;
      }
      try {
        const asg = await getUserRoles(uid);
        if (!cancelled) setUserRoleIds(asg.roleIds || []);
      } catch {
        if (!cancelled) setUserRoleIds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, userId]);

  const profile = useMemo(() => {
    void tick;
    if (mode === 'roles' && roleDraft) {
      return { ...roleDraft, companyScopes: ensureCompanyScopes(roleDraft) };
    }
    const base =
      getAuthProfile(userId) ||
      ({
        userId,
        userName: DEMO_USERS.find((u) => u.userId === userId)?.userName || userId,
        isAdmin: false,
        authCode: '',
        companyScopes: ORG_COMPANIES.map((c) => ({
          companyId: c.id,
          enabled: false,
          workplaceIds: [],
          whouseIds: [],
          authCodeLines: [],
        })),
        orgDefaults: {},
        screens: {},
        fields: {},
      } as UserAuthProfile);
    return { ...base, companyScopes: ensureCompanyScopes(base) };
  }, [userId, tick, mode, roleDraft]);

  const scopes = profile.companyScopes || [];
  const defaults: UserOrgDefaults = profile.orgDefaults || {};

  const persist = (next: UserAuthProfile) => {
    if (mode === 'roles') {
      setRoleDraft(next);
      setTick((t) => t + 1);
      return;
    }
    saveAuthProfile(next);
    setTick((t) => t + 1);
  };

  const patchDefaults = (patch: Partial<UserOrgDefaults>) => {
    persist({ ...profile, orgDefaults: { ...defaults, ...patch } });
  };

  const patchScope = (companyId: string, patch: Partial<CompanyScopeAuth>) => {
    const nextScopes = scopes.map((s) =>
      s.companyId === companyId ? { ...s, ...patch } : s,
    );
    persist({ ...profile, companyScopes: nextScopes });
  };

  const scopeOf = (companyId: string) =>
    scopes.find((s) => s.companyId === companyId) || {
      companyId,
      enabled: false,
      workplaceIds: [],
      whouseIds: [],
      authCodeLines: [],
    };

  const patchScreen = (screenId: string, action: AuthAction, value: boolean) => {
    const next: UserAuthProfile = {
      ...profile,
      screens: {
        ...profile.screens,
        [screenId]: {
          ...(profile.screens[screenId] || emptyScreen()),
          [action]: value,
        },
      },
    };
    if (profile.isAdmin && !value) next.isAdmin = false;
    persist(next);
  };

  const setAllScreen = (screenId: string, value: boolean) => {
    persist({
      ...profile,
      screens: {
        ...profile.screens,
        [screenId]: {
          view: value,
          create: value,
          update: value,
          delete: value,
        },
      },
    });
  };

  const patchField = (table: string, field: string, patch: Partial<FieldAuthFlags>) => {
    const key = fieldKey(table, field);
    persist({
      ...profile,
      fields: {
        ...profile.fields,
        [key]: {
          canView: profile.fields[key]?.canView ?? true,
          canEdit: profile.fields[key]?.canEdit ?? true,
          ...patch,
        },
      },
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = Number(userId) || 0;
      if (uid <= 0) {
        setSqlReports([]);
        return;
      }
      setSqlBusy(true);
      setSqlError(null);
      try {
        const state = await getSqlReportAuthByUser(uid);
        if (!cancelled) setSqlReports(state.reports || []);
      } catch (e) {
        if (!cancelled) {
          setSqlReports([]);
          setSqlError(e instanceof Error ? e.message : 'SQL rapor yetkileri yüklenemedi');
        }
      } finally {
        if (!cancelled) setSqlBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleSqlReport = (reportId: number) => {
    setSqlReports((prev) =>
      prev.map((r) => (r.reportId === reportId ? { ...r, assigned: !r.assigned } : r)),
    );
  };

  const saveSqlAuth = async () => {
    const uid = Number(userId) || 0;
    if (uid <= 0) return;
    setSqlBusy(true);
    setSqlError(null);
    try {
      const ids = sqlReports.filter((r) => r.assigned).map((r) => r.reportId);
      const state = await saveSqlReportAuthByUser(uid, ids);
      setSqlReports(state.reports || []);
      await reloadMenus();
      setSavedMsg('SQL rapor yetkileri kaydedildi.');
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'SQL rapor yetkisi kaydedilemedi');
    } finally {
      setSqlBusy(false);
    }
  };

  const handleSave = async () => {
    setRolesBusy(true);
    try {
      if (mode === 'roles') {
        if (!roleId || !roleDraft) return;
        const role = roles.find((r) => r.id === roleId);
        if (!role) return;
        await updateRole(roleId, {
          code: role.code,
          name: role.name,
          description: role.description || '',
          isAdmin: roleDraft.isAdmin,
          isActive: role.isActive,
          authConfigJson: stringifyAuthConfig(roleDraft),
          sortOrder: role.sortOrder,
        });
        await loadRoles();
        setSavedMsg('Rol yetkileri kaydedildi.');
      } else {
        setCurrentUserId(userId);
        const uid = Number(userId) || 0;
        if (uid > 0) {
          await saveUserRoles(uid, userRoleIds);
        }
        saveAuthProfile(profile);
        await saveSqlAuth();
        await refreshEffectiveAuth(userId);
        setSavedMsg('Kullanıcı rolleri / yetkileri kaydedildi. Aktif kullanıcı güncellendi.');
      }
      await reloadMenus();
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setRolesBusy(false);
    }
  };

  const createNewRole = async () => {
    const code = window.prompt('Rol kodu (örn. DEPO)', 'YENI_ROL');
    if (!code?.trim()) return;
    const name = window.prompt('Rol adı', code.trim()) || code.trim();
    setRolesBusy(true);
    try {
      const created = await createRole({
        code: code.trim(),
        name: name.trim(),
        description: '',
        isAdmin: false,
        isActive: true,
        authConfigJson: stringifyAuthConfig(
          buildProfileFromRoleKind('tmp', code.trim(), 'satis'),
        ),
        sortOrder: 50,
      });
      await loadRoles();
      setRoleId(created.id);
      setMode('roles');
      setSavedMsg('Rol oluşturuldu.');
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'Rol oluşturulamadı');
    } finally {
      setRolesBusy(false);
    }
  };

  const removeRole = async () => {
    if (!roleId) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    if (role.code === 'ADMIN') {
      setSqlError('ADMIN rolü silinemez.');
      return;
    }
    if (!window.confirm(`“${role.name}” rolü silinsin mi?`)) return;
    setRolesBusy(true);
    try {
      await deleteRole(roleId);
      setRoleId(null);
      await loadRoles();
      setSavedMsg('Rol silindi.');
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'Rol silinemedi');
    } finally {
      setRolesBusy(false);
    }
  };

  const userDisplay =
    DEMO_USERS.find((u) => u.userId === userId)?.displayName || profile.userName;

  const activeCompanyId = sel.companyId;
  const activeScope = scopeOf(activeCompanyId);

  const updateAuthLines = (lines: AuthCodeLine[]) => {
    patchScope(activeCompanyId, { authCodeLines: lines, enabled: true });
  };

  /** Ekran bazlı satır: recordType = ekran id; boş değer satırı kaldırır */
  const screenAuthCode = (screenId: string) =>
    activeScope.authCodeLines.find((l) => l.recordType === screenId)?.authCode ?? '';
  const setScreenAuthCode = (screenId: string, value: string) => {
    const rest = activeScope.authCodeLines.filter((l) => l.recordType !== screenId);
    updateAuthLines(value.trim() ? [...rest, { ...newAuthCodeLine(screenId), authCode: value }] : rest);
  };
  const tableLevelLines = activeScope.authCodeLines.filter((l) =>
    AUTH_RECORD_TYPES.some((t) => t.code === l.recordType),
  );
  const authQ = authCodeQuery.trim().toLocaleLowerCase('tr-TR');
  const visibleAuthGroups = authCodeGroups
    .map((g) => ({
      ...g,
      screens: g.screens.filter(
        (s) =>
          !authQ ||
          `${g.moduleTitle} ${g.groupTitle} ${s.title} ${s.tableName}`.toLocaleLowerCase('tr-TR').includes(authQ),
      ),
    }))
    .filter((g) => g.screens.length);

  const companyNodes = [
    { kind: 'workplaces' as const, label: 'İşyerleri / Ambarlar' },
    { kind: 'authCodes' as const, label: 'Yetki Kodları' },
    { kind: 'screenAuth' as const, label: 'İşlem Yetkileri' },
  ];

  const defaultWpOptions = defaults.defaultCompanyId
    ? workplacesOfCompany(defaults.defaultCompanyId)
    : ORG_WORKPLACES.filter((w) => w.isActive);
  const defaultWhOptions = defaults.defaultWorkplaceId
    ? warehousesOfWorkplace(defaults.defaultWorkplaceId)
    : ORG_WAREHOUSES.filter((w) => w.isActive);

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" />
            Roller &amp; Yetkiler
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Grup (rol) bazlı yetki · Kullanıcıya rol atama · SQL raporları
          </p>
        </div>
        <button
          type="button"
          disabled={rolesBusy}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {rolesBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {mode === 'roles' ? 'Rolü Kaydet' : 'Kaydet / Aktif Yap'}
        </button>
      </div>

      {savedMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          {savedMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 w-fit">
        {(
          [
            { id: 'roles' as const, label: 'Roller (grup yetkisi)' },
            { id: 'users' as const, label: 'Kullanıcıya rol ata' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`px-3 h-7 text-[11px] font-semibold rounded ${
              mode === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'roles' ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3">
          <label className="text-[12px] font-semibold text-slate-600">Rol</label>
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2 min-w-[220px]"
            value={roleId ?? ''}
            onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : null)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code}) · {r.userCount ?? 0} kullanıcı
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-700">
            <input
              type="checkbox"
              checked={profile.isAdmin}
              onChange={(e) => persist({ ...profile, isAdmin: e.target.checked })}
              className="rounded border-slate-300"
            />
            Admin rolü
          </label>
          <button
            type="button"
            onClick={() => void createNewRole()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700"
          >
            <Plus className="w-3 h-3" /> Yeni rol
          </button>
          <button
            type="button"
            onClick={() => void removeRole()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600"
          >
            <Trash2 className="w-3 h-3" /> Sil
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3">
          <label className="text-[12px] font-semibold text-slate-600">Kullanıcı</label>
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2 min-w-[220px]"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            {DEMO_USERS.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.displayName} ({u.userName})
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 w-full">
            <span className="text-[11px] font-semibold text-slate-500 uppercase w-full">Rolleri</span>
            {roles.map((r) => (
              <label
                key={r.id}
                className="inline-flex items-center gap-1.5 text-[12px] border border-slate-200 rounded px-2 py-1 bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={userRoleIds.includes(r.id)}
                  onChange={() =>
                    setUserRoleIds((prev) =>
                      prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                    )
                  }
                />
                {r.name}
                {r.isAdmin ? ' ★' : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === 'users' && (
      <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-slate-700">SQL Rapor Yetkileri (kullanıcı istisnası)</div>
            <p className="text-[11px] text-slate-500">
              Tercihen raporda rol seçin. Burada doğrudan kullanıcı ataması da yapılabilir.
            </p>
          </div>
          <button
            type="button"
            disabled={sqlBusy || profile.isAdmin}
            onClick={() => void saveSqlAuth()}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            {sqlBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Rapor yetkisini kaydet
          </button>
        </div>
        {profile.isAdmin && (
          <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
            Admin kullanıcı tüm SQL raporlara erişir; liste düzenlemesi gerekmez.
          </p>
        )}
        {sqlError && (
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
            {sqlError}
          </div>
        )}
        {!profile.isAdmin && (
          <div className="max-h-[200px] overflow-auto border border-slate-100 rounded divide-y divide-slate-100">
            {sqlBusy && sqlReports.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor…
              </div>
            ) : sqlReports.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400">Henüz SQL rapor yok.</div>
            ) : (
              sqlReports.map((r) => (
                <label
                  key={r.reportId}
                  className="flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={r.assigned}
                    onChange={() => toggleSqlReport(r.reportId)}
                  />
                  <span className="text-slate-800">{r.name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{r.reportGroup}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
      )}

      {mode === 'roles' && (
        <p className="text-[11px] text-slate-500 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
          Aşağıdaki firma / yetki kodu / işlem yetkileri seçili <strong>role</strong> kaydedilir. Kullanıcılara
          bu rolü &quot;Kullanıcıya rol ata&quot; sekmesinden verin.
        </p>
      )}

      <div className="rounded-md border border-slate-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="sm:col-span-2 lg:col-span-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
          Öndeğerler {mode === 'roles' ? '(rol)' : '(yerel profil yedeği)'}
        </div>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          Firma
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2"
            value={defaults.defaultCompanyId || ''}
            disabled={profile.isAdmin}
            onChange={(e) =>
              patchDefaults({
                defaultCompanyId: e.target.value || undefined,
                defaultWorkplaceId: undefined,
                defaultWhouseId: undefined,
              })
            }
          >
            <option value="">—</option>
            {ORG_COMPANIES.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          İşyeri
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2"
            value={defaults.defaultWorkplaceId || ''}
            disabled={profile.isAdmin}
            onChange={(e) =>
              patchDefaults({
                defaultWorkplaceId: e.target.value || undefined,
                defaultWhouseId: undefined,
              })
            }
          >
            <option value="">—</option>
            {defaultWpOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          Ambar
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2"
            value={defaults.defaultWhouseId || ''}
            disabled={profile.isAdmin}
            onChange={(e) => patchDefaults({ defaultWhouseId: e.target.value || undefined })}
          >
            <option value="">—</option>
            {defaultWhOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          Bölüm / Birim
          <select
            className="h-8 text-[12px] border border-slate-300 rounded-md px-2"
            value={defaults.defaultOrgUnitId || ''}
            disabled={profile.isAdmin}
            onChange={(e) => patchDefaults({ defaultOrgUnitId: e.target.value || undefined })}
          >
            <option value="">—</option>
            {ORG_UNITS.filter((u) => u.isActive).map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 min-h-[560px]">
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            Firmalar / Yetkiler
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 text-[12px]">
            {ORG_COMPANIES.filter((c) => c.isActive).map((c) => {
              const sc = scopeOf(c.id);
              const open = openCompanies[c.id];
              const isCompanySel = sel.kind === 'company' && sel.companyId === c.id;
              return (
                <div key={c.id} className="mb-0.5">
                  <div
                    className={`flex items-center gap-1 rounded px-1 py-1 cursor-pointer ${
                      isCompanySel ? 'bg-slate-800 text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      className="p-0.5 shrink-0"
                      onClick={() =>
                        setOpenCompanies((o) => ({ ...o, [c.id]: !o[c.id] }))
                      }
                    >
                      {open ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 shrink-0"
                      checked={sc.enabled || profile.isAdmin}
                      disabled={profile.isAdmin}
                      onChange={(e) => {
                        e.stopPropagation();
                        patchScope(c.id, { enabled: e.target.checked });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="flex-1 text-left truncate font-medium"
                      onClick={() => setSel({ kind: 'company', companyId: c.id })}
                    >
                      ({c.code}) {c.title}
                    </button>
                  </div>
                  {open && (
                    <div className="ml-5 border-l border-slate-200 pl-1 space-y-0.5 my-0.5">
                      {companyNodes.map((n) => {
                        const active = sel.kind === n.kind && sel.companyId === c.id;
                        return (
                          <button
                            key={n.kind}
                            type="button"
                            onClick={() => setSel({ kind: n.kind, companyId: c.id })}
                            className={`w-full text-left px-2 py-1 rounded ${
                              active
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {n.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white overflow-hidden flex flex-col">
          {sel.kind === 'screenAuth' && (
            <OperationAuthTreePanel
              profile={profile}
              companyLabel={companyLabel(activeCompanyId)}
              userDisplay={userDisplay}
              disabled={profile.isAdmin}
              onPatchScreen={patchScreen}
              onSetAllScreen={setAllScreen}
              onPatchField={patchField}
            />
          )}

          {sel.kind === 'authCodes' && (
            <>
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">Yetki Kodları</div>
                  <div className="text-[11px] text-slate-500">
                    {companyLabel(activeCompanyId)} / {userDisplay}
                  </div>
                </div>
                <input
                  type="search"
                  value={authCodeQuery}
                  onChange={(e) => setAuthCodeQuery(e.target.value)}
                  placeholder="Ekran / modül ara…"
                  className="h-7 w-56 border border-slate-300 rounded px-2 text-[12px]"
                />
              </div>
              <div className="p-3 space-y-3 flex-1 overflow-auto">
                <p className="text-[10px] text-slate-500">
                  {AUTH_CODE_HINT} Her kart ve hareket ekranına ayrı kod verilebilir; boş bırakılan ekran
                  tablo bazlı / genel koda göre filtrelenir.
                </p>
                {visibleAuthGroups.map((g) => (
                  <div key={`${g.moduleTitle}/${g.groupTitle}`} className="border border-slate-200 rounded">
                    <div className="px-2 py-1 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                      {g.moduleTitle} <span className="text-slate-400">/</span> {g.groupTitle}
                    </div>
                    <table className="w-full text-[12px]">
                      <tbody>
                        {g.screens.map((s) => (
                          <tr key={s.screenId} className="border-b border-slate-50 last:border-0">
                            <td className="py-1 px-2 w-1/2">
                              <span className="text-slate-800">{s.title}</span>
                              <span
                                className={`ml-2 text-[9px] px-1 rounded ${
                                  s.kind === 'trans' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                                }`}
                              >
                                {s.kind === 'trans' ? 'Hareket' : 'Kart'}
                              </span>
                              <span className="ml-2 text-[10px] text-slate-400">{s.tableName}</span>
                            </td>
                            <td className="py-1 px-2">
                              <input
                                type="text"
                                className="w-full h-7 border border-slate-300 rounded px-2"
                                placeholder="+SAT,+PER"
                                value={screenAuthCode(s.screenId)}
                                disabled={profile.isAdmin}
                                onChange={(e) => setScreenAuthCode(s.screenId, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {visibleAuthGroups.length === 0 && (
                  <div className="py-6 text-center text-slate-400 text-[12px]">Eşleşen ekran yok.</div>
                )}

                {tableLevelLines.length > 0 && (
                <div className="border border-slate-200 rounded">
                  <div className="px-2 py-1 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                    Tablo bazlı (eski) — ekran kodu boşsa uygulanır
                  </div>
                <table className="w-full text-[12px]">
                  <tbody>
                    {(
                      activeScope.authCodeLines
                        .map((line, idx) => ({ line, idx }))
                        .filter(({ line }) => tableLevelLines.includes(line))
                        .map(({ line, idx }) => (
                        <tr key={line.id} className="border-b border-slate-50">
                          <td className="py-1.5 pr-2">
                            <select
                              className="w-full h-8 border border-slate-300 rounded-md px-2"
                              value={line.recordType}
                              disabled={profile.isAdmin}
                              onChange={(e) => {
                                const next = activeScope.authCodeLines.map((l, i) =>
                                  i === idx ? { ...l, recordType: e.target.value } : l,
                                );
                                updateAuthLines(next);
                              }}
                            >
                              {AUTH_RECORD_TYPES.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5">
                            <input
                              type="text"
                              className="w-full h-8 border border-slate-300 rounded-md px-2"
                              placeholder="+SAT,+PER"
                              value={line.authCode}
                              disabled={profile.isAdmin}
                              onChange={(e) => {
                                const next = activeScope.authCodeLines.map((l, i) =>
                                  i === idx ? { ...l, authCode: e.target.value } : l,
                                );
                                updateAuthLines(next);
                              }}
                            />
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              disabled={profile.isAdmin}
                              className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-40"
                              onClick={() =>
                                updateAuthLines(
                                  activeScope.authCodeLines.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
                )}
              </div>
            </>
          )}

          {sel.kind === 'workplaces' && (
            <>
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <div className="text-[13px] font-semibold text-slate-800">İşyerleri / Ambarlar</div>
                <div className="text-[11px] text-slate-500">
                  {companyLabel(activeCompanyId)} / {userDisplay} · Ambarlar işyerinin altında
                </div>
              </div>
              <div className="p-3 space-y-3 flex-1 overflow-auto">
                <p className="text-[10px] text-slate-500">
                  Hiçbiri seçili değilse firmadaki tüm işyerleri / ambarlar. Ambar işaretlemek işyerini de açar.
                </p>
                {workplacesOfCompany(activeCompanyId).map((w) => {
                  const whouses = warehousesOfWorkplace(w.id);
                  const wpOn = profile.isAdmin || activeScope.workplaceIds.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 space-y-1.5"
                    >
                      <label className="flex items-center gap-2 text-[12px] font-medium text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={wpOn}
                          disabled={profile.isAdmin}
                          onChange={(e) => {
                            const on = e.target.checked;
                            let nextWh = activeScope.whouseIds;
                            if (!on) {
                              const drop = new Set(whouses.map((x) => x.id));
                              nextWh = nextWh.filter((id) => !drop.has(id));
                            }
                            patchScope(activeCompanyId, {
                              enabled: true,
                              workplaceIds: toggleId(activeScope.workplaceIds, w.id, on),
                              whouseIds: nextWh,
                            });
                          }}
                        />
                        ({w.code}) {w.title}
                      </label>
                      <div className="ml-6 space-y-1 border-l border-slate-200 pl-3">
                        {whouses.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-0.5">Ambar yok</div>
                        ) : (
                          whouses.map((wh) => (
                            <label
                              key={wh.id}
                              className="flex items-center gap-2 text-[12px] text-slate-700 py-0.5"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={profile.isAdmin || activeScope.whouseIds.includes(wh.id)}
                                disabled={profile.isAdmin}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  const nextWp = on
                                    ? toggleId(activeScope.workplaceIds, w.id, true)
                                    : activeScope.workplaceIds;
                                  patchScope(activeCompanyId, {
                                    enabled: true,
                                    workplaceIds: nextWp,
                                    whouseIds: toggleId(activeScope.whouseIds, wh.id, on),
                                  });
                                }}
                              />
                              ({wh.code}) {wh.title}
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {sel.kind === 'company' && (
            <div className="p-4 space-y-2">
              <h2 className="text-[14px] font-semibold text-slate-800">
                {companyLabel(activeCompanyId)}
              </h2>
              <p className="text-[12px] text-slate-500">
                Soldan <strong>İşyerleri / Ambarlar</strong>, <strong>Yetki Kodları</strong> veya{' '}
                <strong>İşlem Yetkileri</strong> seçin.
              </p>
              <label className="inline-flex items-center gap-2 text-[12px] mt-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={scopeOf(activeCompanyId).enabled || profile.isAdmin}
                  disabled={profile.isAdmin}
                  onChange={(e) =>
                    patchScope(activeCompanyId, { enabled: e.target.checked })
                  }
                />
                Bu firmaya yetkili
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
