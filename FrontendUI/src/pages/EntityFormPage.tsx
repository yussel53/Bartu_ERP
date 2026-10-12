import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { DocumentFormEngine } from '../components/DocumentFormEngine';
import { DynamicFormEngine } from '../components/DynamicFormEngine';
import { AccountLinkFormEngine } from '../components/AccountLinkFormEngine';
import { getFormSchema } from '../data/formSchemas';
import {
  computeFormulaValues,
  extraFieldsToFormFields,
  lineTableFor,
  loadExtraFields,
} from '../data/extraFields';
import { FormSchemaDto, DynamicFormDataDto } from '../types/formTypes';
import { auxilModuleNrForTable } from '../data/auxilCodes';
import { getRecord, saveRecord } from '../api/recordsApi';
import { clearLookupCache, enrichSchemaLookups } from '../api/lookupApi';
import { getCurrentProfile } from '../data/permissions';
import { resolveOrgDefaults } from '../data/orgUnits';
import { useOpenDocumentsOptional } from '../contexts/OpenDocumentsContext';
import {
  CARD_DEFAULT_TABLES,
  CARD_DEFAULT_TEMPLATE_ID,
  stripTemplateMeta,
} from '../data/cardDefaults';

interface EntityFormPageProps {
  formCode: string;
  onBack: () => void;
  mode?: 'view' | 'edit' | 'create';
  recordId?: string;
  /** Açık fiş tray oturumu */
  draftId?: string;
  screenPath?: string;
  screenTitle?: string;
  /** Lookup «Yeni ekle» modalında: geri linki gizle, kayıttan sonra onSaved */
  embedded?: boolean;
  onSaved?: (info: { recordId: number; label?: string }) => void;
}

function draftLabel(
  screenTitle: string,
  mode: string,
  data: DynamicFormDataDto | undefined,
  recordId?: string,
): string {
  const sf = data?.standardFields || {};
  const no = String(
    sf.DocumentNumber ?? sf.OrderSlipNo ?? sf.VoucherNo ?? sf.Code ?? '',
  ).trim();
  if (no) return `${screenTitle} · ${no}`;
  if (mode === 'create') return `${screenTitle} · yeni`;
  if (recordId) return `${screenTitle} · #${recordId}`;
  return screenTitle;
}

function withCustomFields(schema: FormSchemaDto): FormSchemaDto {
  if (schema.tableName === 'SYS_TypeDef') {
    return { ...schema, enableCustomFieldsTab: false, customFields: [] };
  }

  // Satır tablosunun (ProductTrans vb.) ek alanları kalem gridine kolon olarak eklenir
  const lineTable = schema.lineFields?.length ? lineTableFor(schema.tableName) : undefined;
  const lineExtras = lineTable ? extraFieldsToFormFields(lineTable) : [];

  return {
    ...schema,
    enableCustomFieldsTab: true,
    customFields: extraFieldsToFormFields(schema.tableName),
    lineFields: lineExtras.length
      ? [
          ...schema.lineFields!,
          ...lineExtras.map((f, i) => ({ ...f, orderIndex: 9000 + i, colSpan: f.colSpan || 4 })),
        ]
      : schema.lineFields,
  };
}

/** API DateTime → HTML input type=date (yyyy-MM-dd); 1900-01-01 boş sayılır */
function toDateInputValue(v: unknown): string {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (!s || s.startsWith('1900-01-01')) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Yeni fişte otomatik bugün gelecek belge/fiş tarih alanları (vade vb. hariç) */
const AUTO_TODAY_DATE_FIELDS = new Set([
  'VoucherDate',
  'OrderDate',
  'InvoiceDate',
  'TransDate',
  'ProcessDate',
  'DocumentDate',
  'Date_',
  'CreditDate',
  'SourceSlipDate',
]);

function defaultDocDatesForCreate(schema: FormSchemaDto): Record<string, unknown> {
  const today = todayLocalYmd();
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.fieldType !== 'date') continue;
    if (!AUTO_TODAY_DATE_FIELDS.has(f.fieldName)) continue;
    out[f.fieldName] = today;
  }
  return out;
}

/** Yeni kayıt: kullanıcı öndeğeri veya yetkiye göre ilk firma/işyeri/ambar/bölüm */
function defaultOrgFieldsForCreate(schema: FormSchemaDto): Record<string, unknown> {
  const names = new Set(schema.fields.map((f) => f.fieldName));
  if (!names.has('CompanyID') && !names.has('DepartmentID') && !names.has('WhouseID')) {
    return {};
  }
  const profile = getCurrentProfile();
  const resolved = resolveOrgDefaults(profile.orgAuth, profile.orgDefaults);
  const out: Record<string, unknown> = {};
  if (names.has('CompanyID') && resolved.companyId) out.CompanyID = resolved.companyId;
  if (names.has('DepartmentID') && resolved.workplaceId) out.DepartmentID = resolved.workplaceId;
  if (names.has('WorkplaceID') && resolved.workplaceId) out.WorkplaceID = resolved.workplaceId;
  if (names.has('WhouseID') && resolved.whouseId) out.WhouseID = resolved.whouseId;
  if (names.has('OrgUnitID') && resolved.orgUnitId) out.OrgUnitID = resolved.orgUnitId;
  return out;
}

function normalizeDateFieldsForForm(
  schema: FormSchemaDto,
  standard: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...standard };
  for (const f of headerFields(schema)) {
    if (f.fieldType !== 'date') continue;
    if (f.fieldName in next) next[f.fieldName] = toDateInputValue(next[f.fieldName]);
  }
  return next;
}

/** Başlık kolonları: ana alanlar + e-Defter sekmesi */
function headerFields(schema: FormSchemaDto) {
  return [...schema.fields, ...(schema.eLedgerFields || [])];
}

/** Kayda giderken boş tarih = null (SQL 1900-01-01 yazmasın) */
function normalizeDateFieldsForSave(
  schema: FormSchemaDto,
  standard: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...standard };
  for (const f of headerFields(schema)) {
    if (f.fieldType !== 'date') continue;
    const v = next[f.fieldName];
    if (v == null || v === '' || String(v).startsWith('1900-01-01')) {
      next[f.fieldName] = null;
      continue;
    }
    const d = toDateInputValue(v);
    next[f.fieldName] = d || null;
  }
  return next;
}

export const EntityFormPage: React.FC<EntityFormPageProps> = ({
  formCode,
  onBack,
  mode = 'create',
  recordId,
  draftId,
  screenPath,
  screenTitle,
  embedded = false,
  onSaved,
}) => {
  const openDocs = useOpenDocumentsOptional();
  const openDocsRef = useRef(openDocs);
  openDocsRef.current = openDocs;
  const trackDraft = Boolean(!embedded && draftId && screenPath && openDocs && mode !== 'view');
  const [schema, setSchema] = useState<FormSchemaDto | null>(null);
  const [initialData, setInitialData] = useState<DynamicFormDataDto | undefined>();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const readOnly = mode === 'view';
  const titleForTray = screenTitle || formCode;

  useEffect(() => {
    if (!trackDraft || !draftId || !screenPath) return;
    const docs = openDocsRef.current;
    if (!docs) return;
    docs.openOrFocus({
      id: draftId,
      formCode,
      screenPath,
      screenTitle: titleForTray,
      mode,
      recordId,
      label: draftLabel(titleForTray, mode, docs.getDocument(draftId)?.data, recordId),
    });
  }, [trackDraft, draftId, formCode, screenPath, titleForTray, mode, recordId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const mock = getFormSchema(formCode);
        if (!mock) {
          setSchema(null);
          return;
        }
        await loadExtraFields();
        const withCustom = withCustomFields(mock);
        const enriched = await enrichSchemaLookups(withCustom);
        setSchema(enriched);

        const parked =
          trackDraft && draftId
            ? openDocsRef.current?.getDocument(draftId)?.data
            : undefined;
        if (parked) {
          setInitialData(parked);
          return;
        }

        const seedDraft = (data: DynamicFormDataDto | undefined) => {
          if (!trackDraft || !draftId || !data) return;
          openDocsRef.current?.updateDraft(draftId, {
            data,
            label: draftLabel(titleForTray, mode, data, recordId),
          });
        };

        if (recordId && mode !== 'create') {
          try {
            const rec = await getRecord(
              enriched.tableName,
              Number(recordId),
              enriched.primaryKeyColumn,
            );
            const standard: Record<string, unknown> = normalizeDateFieldsForForm(
              enriched,
              { ...rec.standardFields },
            );
            const additional: Record<string, unknown> = { ...rec.additionalFields };
            for (const [k, v] of Object.entries(rec.standardFields)) {
              if (k.startsWith('U_')) additional[k] = v;
            }
            const data: DynamicFormDataDto = {
              recordId: rec.recordId,
              standardFields: standard,
              additionalFields: additional,
              addresses: rec.addresses,
              contacts: rec.contacts,
              accounts: rec.accounts,
              barcodes: rec.barcodes,
              unitConvs: rec.unitConvs,
              productSubs: rec.productSubs,
              customerAliases: rec.customerAliases,
              variants: rec.variants,
              accountLinks: rec.accountLinks,
              lines: rec.lines,
              workplaces: rec.workplaces,
              whouses: rec.whouses,
              paymentPlans: rec.paymentPlans,
              distributions: rec.distributions,
              auxilCodes: rec.auxilCodes,
              auxilValues: rec.auxilValues,
            };
            setInitialData(data);
            seedDraft(data);
          } catch (e) {
            setLoadError(e instanceof Error ? e.message : 'Kayıt okunamadı');
            setInitialData(undefined);
          }
        } else {
          const dates = defaultDocDatesForCreate(enriched);
          const org = defaultOrgFieldsForCreate(enriched);
          let standardFields: Record<string, unknown> = { ...dates, ...org };
          let additionalFields: Record<string, unknown> = {};

          // Kart öndeğeri: ID=-1 şablondan alanları kopyala
          if (CARD_DEFAULT_TABLES.has(enriched.tableName)) {
            try {
              const tpl = await getRecord(
                enriched.tableName,
                CARD_DEFAULT_TEMPLATE_ID,
                enriched.primaryKeyColumn,
              );
              const fromTpl = stripTemplateMeta(
                normalizeDateFieldsForForm(enriched, { ...tpl.standardFields }),
                enriched.primaryKeyColumn,
              );
              standardFields = { ...fromTpl, ...standardFields };
              const add: Record<string, unknown> = { ...tpl.additionalFields };
              for (const [k, v] of Object.entries(tpl.standardFields)) {
                if (k.startsWith('U_')) add[k] = v;
              }
              additionalFields = add;
            } catch {
              /* şablon yoksa boş form */
            }
          }

          const data: DynamicFormDataDto = {
            recordId: 0,
            standardFields,
            additionalFields,
          };
          setInitialData(data);
          seedDraft(data);
        }
      } catch (error) {
        console.error('Failed to load schema', error);
        setSchema(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [formCode, recordId, mode, draftId, trackDraft, titleForTray]);

  const handleLiveChange = useCallback(
    (data: DynamicFormDataDto) => {
      if (!trackDraft || !draftId) return;
      openDocsRef.current?.updateDraft(draftId, {
        data,
        label: draftLabel(titleForTray, mode, data, recordId),
      });
    },
    [trackDraft, draftId, titleForTray, mode, recordId],
  );

  const handleParkBack = () => {
    if (trackDraft && draftId) {
      openDocsRef.current?.setActiveId(null);
    }
    onBack();
  };

  const handleCancelDraft = () => {
    if (
      !window.confirm(
        'Bu fiş iptal edilsin mi?\nKaydedilmemiş değişiklikler kaybolur.',
      )
    ) {
      return;
    }
    if (trackDraft && draftId) {
      openDocsRef.current?.closeDocument(draftId);
    }
    onBack();
  };

  const handleSubmit = async (data: DynamicFormDataDto) => {
    if (readOnly || !schema) return;
    setIsSubmitting(true);
    const merged: DynamicFormDataDto = {
      ...data,
      recordId:
        mode === 'edit' && recordId
          ? Number(recordId) || data.recordId
          : mode === 'create'
            ? 0
            : data.recordId,
      standardFields: {
        ...data.standardFields,
        ...(schema.fixedStandardFields || {}),
      },
    };

    try {
      const standardRaw: Record<string, unknown> = {};
      const additional: Record<string, unknown> = { ...(merged.additionalFields || {}) };
      for (const [k, v] of Object.entries(merged.standardFields || {})) {
        if (k.startsWith('U_')) additional[k] = v;
        else standardRaw[k] = v;
      }
      if (schema.tableName === 'SYS_TypeDef' && standardRaw.Kind != null) {
        const kindMap: Record<string, number> = { voucher: 1, product: 2, customer: 3 };
        const k = standardRaw.Kind;
        if (typeof k === 'string' && kindMap[k] != null) standardRaw.Kind = kindMap[k];
        else standardRaw.Kind = Number(k);
      }
      if (schema.tableName === 'AuxilCodes' && standardRaw.TargetTable != null) {
        const mod = auxilModuleNrForTable(String(standardRaw.TargetTable));
        if (mod > 0 && (standardRaw.ModuleNr == null || standardRaw.ModuleNr === '')) {
          standardRaw.ModuleNr = mod;
        }
      }
      const standard = normalizeDateFieldsForSave(schema, standardRaw);

      // Formüllü ek alanlar kaydetmeden önce hesaplanır
      Object.assign(additional, computeFormulaValues(schema.tableName, { ...standard, ...additional }));
      const lineTable = merged.lines?.length ? lineTableFor(schema.tableName) : undefined;
      const lines = lineTable
        ? merged.lines!.map((row) => ({ ...row, ...computeFormulaValues(lineTable, row) }))
        : merged.lines;

      const result = await saveRecord(
        schema.tableName,
        { ...merged, lines, standardFields: standard, additionalFields: additional },
        {
          pk: schema.primaryKeyColumn,
          formCode: schema.formCode,
          postSave: schema.postSave,
        },
      );
      clearLookupCache();

      const code = String(standard.Code ?? standard.WhouseCode ?? standard.CompanyCode ?? standard.DocumentNumber ?? standard.VoucherNo ?? '').trim();
      const title = String(standard.Title ?? standard.Name ?? '').trim();
      const label = [code, title].filter(Boolean).join(' — ') || undefined;

      if (embedded && onSaved) {
        onSaved({ recordId: result.recordId, label });
        return;
      }

      if (trackDraft && draftId) openDocsRef.current?.closeDocument(draftId);

      const idNote = `ID=${result.recordId}${code ? ` · Kod=${code}` : ''}`;
      const postNote =
        result.postSave && result.postSave.length
          ? `\nPostSave: ${result.postSave.map((p) => `${p.title || p.type}: ${p.message}`).join('; ')}`
          : '';
      alert(
        (result.message || (mode === 'edit' ? 'Güncellendi' : 'Kaydedildi')) +
          `\n${idNote}` +
          postNote,
      );
      onBack();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[30vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-slate-500">Form / kayıt yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="max-w-xl mx-auto text-center py-10">
        <p className="text-[13px] text-slate-600">Şema bulunamadı: {formCode}</p>
        <button type="button" onClick={onBack} className="mt-2 text-[12px] text-blue-600 font-semibold">
          Geri dön
        </button>
      </div>
    );
  }

  const useAccountLinkEngine = formCode === 'AccountLinkForm';
  const useDocumentEngine =
    !useAccountLinkEngine &&
    (schema.documentLayout === 'trade' || Boolean(schema.lineFields?.length));
  const modeLabel = mode === 'view' ? 'İncele' : mode === 'edit' ? 'Değiştir' : 'Yeni';

  return (
    <div className="relative">
      {!embedded && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleParkBack}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
            title={
              trackDraft
                ? 'Listeye dön — fiş sağ üstte açık kalır (Kaydet veya İptal ile kapanır)'
                : undefined
            }
          >
            <ArrowLeft className="w-3 h-3" />
            Listeye dön
            {trackDraft ? (
              <span className="text-[10px] font-normal text-slate-400">(fiş açık kalır)</span>
            ) : null}
          </button>
          {trackDraft && (
            <button
              type="button"
              onClick={handleCancelDraft}
              className="inline-flex items-center gap-1 px-2 h-7 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md"
            >
              <X className="w-3 h-3" />
              İptal
            </button>
          )}
        </div>
      )}
      {!embedded && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {modeLabel}
          {recordId ? ` · #${recordId}` : ''}
          {` · ${schema.tableName}`}
        </p>
      )}
      {loadError && (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          DB kayıt okunamadı: {loadError}
        </div>
      )}

      {useAccountLinkEngine ? (
        <AccountLinkFormEngine
          schema={schema}
          initialData={initialData}
          onSubmit={handleSubmit}
          onLiveChange={trackDraft ? handleLiveChange : undefined}
          isLoading={isSubmitting}
          readOnly={readOnly}
        />
      ) : useDocumentEngine ? (
        <DocumentFormEngine
          schema={schema}
          initialData={initialData}
          onSubmit={handleSubmit}
          onLiveChange={trackDraft ? handleLiveChange : undefined}
          isLoading={isSubmitting}
          readOnly={readOnly}
        />
      ) : (
        <DynamicFormEngine
          schema={schema}
          initialData={initialData}
          onSubmit={handleSubmit}
          onLiveChange={trackDraft ? handleLiveChange : undefined}
          isLoading={isSubmitting}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};
