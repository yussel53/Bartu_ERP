import React from 'react';
import {
  UseFormSetValue,
  UseFormWatch,
  FieldValues,
} from 'react-hook-form';
import { FormFieldDto, FormSchemaDto } from '../types/formTypes';
import { getCurrentProfile } from '../data/permissions';
import {
  companyOptions,
  workplaceOptions,
  whouseOptions,
  orgUnitOptions,
  resolveOrgChildrenForCompany,
  resolveOrgDefaults,
} from '../data/orgUnits';

const ORG_SELECT_FIELDS = new Set([
  'CompanyID',
  'DepartmentID',
  'WorkplaceID',
  'WhouseID',
  'AimWhouseID',
  'OrgUnitID',
  'UnitID',
  'DefaultCompanyID',
  'DefaultWorkplaceID',
  'DefaultWhouseID',
  'DefaultOrgUnitID',
]);

function optJson(opts: { label: string; value: string }[]): string {
  return JSON.stringify([{ label: '— Seçiniz —', value: '' }, ...opts]);
}

function hasField(schema: FormSchemaDto, name: string): boolean {
  return schema.fields.some((f) => f.fieldName === name);
}

/**
 * Firma → İşyeri → Ambar → Bölüm/Birim seçeneklerini yetkiye göre daraltır;
 * firma/işyeri değişince alt değerleri düzeltir.
 */
export function useOrgFieldCascade(opts: {
  schema: FormSchemaDto;
  watch: UseFormWatch<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  readOnly?: boolean;
  /** true: yeni kayıt — boşsa öndeğer / ilk yetkili değerleri yazar */
  applyDefaultsIfEmpty?: boolean;
}) {
  const { schema, watch, setValue, readOnly = false, applyDefaultsIfEmpty = false } = opts;
  const profile = React.useMemo(() => getCurrentProfile(), []);
  const org = profile.orgAuth;
  const defaults = profile.orgDefaults;

  const companyId = String(
    watch('standardFields.CompanyID') ?? watch('standardFields.DefaultCompanyID') ?? '',
  ).trim();
  const workplaceId = String(
    watch('standardFields.DepartmentID') ??
      watch('standardFields.WorkplaceID') ??
      watch('standardFields.DefaultWorkplaceID') ??
      '',
  ).trim();

  const optionsByField = React.useMemo(() => {
    const map: Record<string, string> = {};
    const coOpts = optJson(companyOptions(org));
    const wpOpts = optJson(workplaceOptions(companyId || null, org));
    const whOpts = optJson(whouseOptions(workplaceId || null, companyId || null, org));
    const ouOpts = optJson(orgUnitOptions(companyId || null, 1));
    const unitOpts = optJson(orgUnitOptions(companyId || null, 2));

    if (hasField(schema, 'CompanyID')) map.CompanyID = coOpts;
    if (hasField(schema, 'DefaultCompanyID')) map.DefaultCompanyID = coOpts;
    if (hasField(schema, 'DepartmentID')) map.DepartmentID = wpOpts;
    if (hasField(schema, 'WorkplaceID')) map.WorkplaceID = wpOpts;
    if (hasField(schema, 'DefaultWorkplaceID')) map.DefaultWorkplaceID = wpOpts;
    if (hasField(schema, 'WhouseID')) map.WhouseID = whOpts;
    if (hasField(schema, 'DefaultWhouseID')) map.DefaultWhouseID = whOpts;
    if (hasField(schema, 'AimWhouseID')) {
      map.AimWhouseID = optJson(whouseOptions(null, companyId || null, org));
    }
    if (hasField(schema, 'OrgUnitID')) map.OrgUnitID = ouOpts;
    if (hasField(schema, 'UnitID')) map.UnitID = unitOpts;
    if (hasField(schema, 'DefaultOrgUnitID')) map.DefaultOrgUnitID = ouOpts;
    return map;
  }, [schema, org, companyId, workplaceId]);

  const patchField = React.useCallback(
    (field: FormFieldDto): FormFieldDto => {
      if (!ORG_SELECT_FIELDS.has(field.fieldName)) return field;
      const optionsJson = optionsByField[field.fieldName];
      if (!optionsJson) return field;
      return { ...field, fieldType: 'select', useLookup: false, optionsJson };
    },
    [optionsByField],
  );

  const companyFieldName = hasField(schema, 'CompanyID')
    ? 'CompanyID'
    : hasField(schema, 'DefaultCompanyID')
      ? 'DefaultCompanyID'
      : null;
  const workplaceFieldName = hasField(schema, 'DepartmentID')
    ? 'DepartmentID'
    : hasField(schema, 'WorkplaceID')
      ? 'WorkplaceID'
      : hasField(schema, 'DefaultWorkplaceID')
        ? 'DefaultWorkplaceID'
        : null;
  const whouseFieldName = hasField(schema, 'WhouseID')
    ? 'WhouseID'
    : hasField(schema, 'DefaultWhouseID')
      ? 'DefaultWhouseID'
      : null;
  const orgUnitFieldName = hasField(schema, 'OrgUnitID')
    ? 'OrgUnitID'
    : hasField(schema, 'DefaultOrgUnitID')
      ? 'DefaultOrgUnitID'
      : null;

  const defaultsApplied = React.useRef(false);
  React.useEffect(() => {
    if (readOnly || !applyDefaultsIfEmpty || defaultsApplied.current) return;
    if (!companyFieldName) {
      defaultsApplied.current = true;
      return;
    }
    const cur = String(watch(`standardFields.${companyFieldName}`) ?? '').trim();
    if (cur) {
      defaultsApplied.current = true;
      return;
    }
    const resolved = resolveOrgDefaults(org, defaults);
    if (resolved.companyId) {
      setValue(`standardFields.${companyFieldName}`, resolved.companyId, { shouldDirty: false });
    }
    if (workplaceFieldName && resolved.workplaceId) {
      setValue(`standardFields.${workplaceFieldName}`, resolved.workplaceId, { shouldDirty: false });
    }
    if (whouseFieldName && resolved.whouseId) {
      setValue(`standardFields.${whouseFieldName}`, resolved.whouseId, { shouldDirty: false });
    }
    if (orgUnitFieldName && resolved.orgUnitId) {
      setValue(`standardFields.${orgUnitFieldName}`, resolved.orgUnitId, { shouldDirty: false });
    }
    defaultsApplied.current = true;
  }, [
    applyDefaultsIfEmpty,
    companyFieldName,
    defaults,
    org,
    orgUnitFieldName,
    readOnly,
    setValue,
    watch,
    whouseFieldName,
    workplaceFieldName,
  ]);

  const prevCompany = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (readOnly || !companyFieldName) return;
    if (prevCompany.current === undefined) {
      prevCompany.current = companyId;
      return;
    }
    if (prevCompany.current === companyId) return;
    prevCompany.current = companyId;

    if (!companyId) {
      if (workplaceFieldName) {
        setValue(`standardFields.${workplaceFieldName}`, '', { shouldDirty: true });
      }
      if (whouseFieldName) {
        setValue(`standardFields.${whouseFieldName}`, '', { shouldDirty: true });
      }
      if (hasField(schema, 'AimWhouseID')) {
        setValue('standardFields.AimWhouseID', '', { shouldDirty: true });
      }
      if (orgUnitFieldName) {
        setValue(`standardFields.${orgUnitFieldName}`, '', { shouldDirty: true });
      }
      return;
    }

    const children = resolveOrgChildrenForCompany(companyId, org, defaults);
    if (workplaceFieldName) {
      setValue(`standardFields.${workplaceFieldName}`, children.workplaceId, { shouldDirty: true });
    }
    if (whouseFieldName) {
      setValue(`standardFields.${whouseFieldName}`, children.whouseId, { shouldDirty: true });
    }
    if (hasField(schema, 'AimWhouseID')) {
      const aim = String(watch('standardFields.AimWhouseID') ?? '').trim();
      const aimOpts = whouseOptions(null, companyId, org);
      if (aim && !aimOpts.some((o) => o.value === aim)) {
        setValue('standardFields.AimWhouseID', '', { shouldDirty: true });
      }
    }
    if (orgUnitFieldName) {
      setValue(`standardFields.${orgUnitFieldName}`, children.orgUnitId, { shouldDirty: true });
    }
  }, [
    companyFieldName,
    companyId,
    defaults,
    org,
    orgUnitFieldName,
    readOnly,
    schema,
    setValue,
    watch,
    whouseFieldName,
    workplaceFieldName,
  ]);

  const prevWorkplace = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (readOnly || !whouseFieldName || !companyId) return;
    if (prevWorkplace.current === undefined) {
      prevWorkplace.current = workplaceId;
      return;
    }
    if (prevWorkplace.current === workplaceId) return;
    prevWorkplace.current = workplaceId;

    const whouses = whouseOptions(workplaceId || null, companyId, org);
    const curWh = String(watch(`standardFields.${whouseFieldName}`) ?? '').trim();
    if (curWh && whouses.some((o) => o.value === curWh)) return;
    const prefer =
      defaults?.defaultWhouseId && whouses.some((o) => o.value === defaults.defaultWhouseId)
        ? defaults.defaultWhouseId
        : whouses[0]?.value || '';
    setValue(`standardFields.${whouseFieldName}`, prefer, { shouldDirty: true });
  }, [
    companyId,
    defaults,
    org,
    readOnly,
    setValue,
    watch,
    whouseFieldName,
    workplaceId,
  ]);

  return { patchField, optionsByField };
}
