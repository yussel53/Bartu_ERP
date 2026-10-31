import { listRecords } from '../api/recordsApi';
import type { FormFieldDto, FormSchemaDto } from '../types/formTypes';

export interface CostDimRow {
  costDimID: number;
  dimNo: number;
  code?: string;
  title: string;
  linkedDimNo?: number | null;
  selectableOnOtherCards?: boolean;
  isActive?: boolean;
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k];
    const hit = Object.keys(row).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && row[hit] != null && row[hit] !== '') return row[hit];
  }
  return undefined;
}

/** Aktif masraf boyutları (1–5) */
export async function fetchCostDims(): Promise<CostDimRow[]> {
  try {
    const res = await listRecords('CostDim', { pk: 'CostDimID', take: 20 });
    return (res.rows || [])
      .map((raw) => {
        const r = raw as Record<string, unknown>;
        const dimNo = Number(pick(r, 'DimNo', 'dimNo') ?? 0);
        const id = Number(pick(r, 'CostDimID', 'costDimID', 'id') ?? 0);
        const active = pick(r, 'IsActive', 'isActive');
        const isActive = active === false || active === 0 || active === '0' ? false : true;
        return {
          costDimID: id,
          dimNo,
          code: String(pick(r, 'Code', 'code') ?? '') || undefined,
          title: String(pick(r, 'Title', 'title') ?? `Boyut ${dimNo}`),
          linkedDimNo: (() => {
            const v = pick(r, 'LinkedDimNo', 'linkedDimNo');
            if (v == null || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
          selectableOnOtherCards: Boolean(
            pick(r, 'SelectableOnOtherCards', 'selectableOnOtherCards') === true ||
              pick(r, 'SelectableOnOtherCards', 'selectableOnOtherCards') === 1 ||
              pick(r, 'SelectableOnOtherCards', 'selectableOnOtherCards') === '1',
          ),
          isActive,
        } satisfies CostDimRow;
      })
      .filter((d) => d.dimNo >= 1 && d.dimNo <= 5 && d.isActive !== false)
      .sort((a, b) => a.dimNo - b.dimNo);
  } catch {
    return [];
  }
}

/** Muhasebe fişi dağıtım alanlarını 5 boyuta göre güncelle */
export function applyCostDimsToDistribution(
  schema: FormSchemaDto,
  dims: CostDimRow[],
): FormSchemaDto {
  if (!schema.lineDistributionFields?.length) return schema;
  if ((schema.tableName || '').toLowerCase() !== 'accountvoucher') return schema;

  const active = dims.length
    ? dims
    : ([1, 2, 3, 4, 5] as const).map((n) => ({
        costDimID: n,
        dimNo: n,
        title: n === 1 ? 'İşyeri' : n === 2 ? 'Kişiler' : n === 3 ? 'Araçlar' : n === 4 ? 'Proje' : 'Boyut 5',
        linkedDimNo: n === 2 ? 1 : null,
        isActive: true,
      }));

  const dimFields: FormFieldDto[] = active.map((d, i) => {
    const fieldName = `CostDimCardID${d.dimNo}` as const;
    const dep =
      d.linkedDimNo != null && d.linkedDimNo >= 1 && d.linkedDimNo <= 5
        ? {
            parentField: `CostDimCardID${d.linkedDimNo}`,
            filterColumn: 'LinkedCostDimCardID',
            emptyText: `Önce boyut ${d.linkedDimNo} seçin`,
          }
        : undefined;
    return {
      fieldId: 2700 + i,
      fieldName,
      label: d.title || `Boyut ${d.dimNo}`,
      fieldType: 'lookup',
      isRequired: false,
      colSpan: 2,
      orderIndex: i + 1,
      useLookup: true,
      dependentLookup: dep,
    };
  });

  const rest: FormFieldDto[] = [
    {
      fieldId: 2790,
      fieldName: 'RatePercent',
      label: 'Oran %',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 90,
    },
    {
      fieldId: 2791,
      fieldName: 'Amount',
      label: 'Tutar',
      fieldType: 'number',
      isRequired: false,
      colSpan: 2,
      orderIndex: 91,
    },
    {
      fieldId: 2792,
      fieldName: 'Description',
      label: 'Açıklama',
      fieldType: 'text',
      isRequired: false,
      colSpan: 3,
      orderIndex: 92,
    },
  ];

  return {
    ...schema,
    lineDistributionFields: [...dimFields, ...rest],
  };
}
