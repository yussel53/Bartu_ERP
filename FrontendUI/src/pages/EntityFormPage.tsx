import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookCheck, LayoutTemplate, Loader2, X } from 'lucide-react';
import { apiJson } from '../config/api';
import { FormLayoutDesigner } from '../components/FormLayoutDesigner';
import { FormLayoutRow, resolveFormLayouts } from '../api/formLayoutsApi';
import {
  applyFormLayout,
  FormLayoutDef,
  mergeLayoutWithSchema,
  parseLayoutJson,
  storedLayoutChoice,
  storeLayoutChoice,
} from '../data/formLayout';
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
import { resetUnitCatalog } from '../data/productLineUnits';
import { clearLookupCache, enrichSchemaLookups } from '../api/lookupApi';
import { getCurrentProfile } from '../data/permissions';
import { resolveOrgDefaults } from '../data/orgUnits';
import { useOpenDocumentsOptional } from '../contexts/OpenDocumentsContext';
import { findDefaultTemplate, stripTemplateMeta } from '../data/cardDefaults';
import { resolveTaxCardForSetting } from '../api/moduleParamsApi';
import { appConfirm } from '../utils/appConfirm';
import { appToast } from '../utils/appToast';
import { RelatedDocumentsBar } from '../components/RelatedDocumentsBar';
import { DocumentActionsPanel } from '../components/DocumentActionsPanel';
import { DocumentFilesPanel } from '../components/DocumentFilesPanel';
import { DocumentCollectionActions } from '../components/DocumentCollectionActions';
import { PaymentLinkPanel } from '../components/PaymentLinkPanel';
import { takeCreatePrefill } from '../utils/createPrefill';
import { applyCostDimsToDistribution, fetchCostDims } from '../data/costDims';

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
  /**
   * Öndeğer şablonu düzenleniyor (ID < 0): zorunlu alan yok; fişte yalnız başlık
   * (satır / ödeme planı / özel kod sekmesi gizli, kayda gitmez).
   */
  templateMode?: boolean;
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
  templateMode = false,
}) => {
  const openDocs = useOpenDocumentsOptional();
  const openDocsRef = useRef(openDocs);
  openDocsRef.current = openDocs;
  const trackDraft = Boolean(!embedded && draftId && screenPath && openDocs && mode !== 'view');
  const [schema, setSchema] = useState<FormSchemaDto | null>(null);
  const [initialData, setInitialData] = useState<DynamicFormDataDto | undefined>();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postingAcc, setPostingAcc] = useState(false);
  const [unpostingAcc, setUnpostingAcc] = useState(false);
  const [accPosted, setAccPosted] = useState(false);
  const [accJournalNumbered, setAccJournalNumbered] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Ödeme linki paneli — form state’e yazılamayan alanları kayda birleştir */
  const [paymentLinkPatch, setPaymentLinkPatch] = useState<Record<string, unknown>>({});

  const accountingSource = (table?: string): 'invoice' | 'safevoucher' | null => {
    const t = (table || '').toLowerCase();
    if (t === 'invoice') return 'invoice';
    if (t === 'safevoucher') return 'safevoucher';
    return null;
  };

  const refreshAccStatus = useCallback(async (table: string, id: number) => {
    const source = accountingSource(table);
    if (!source || !(id > 0)) {
      setAccPosted(false);
      setAccJournalNumbered(false);
      return;
    }
    try {
      const st = await apiJson<{
        posted?: boolean;
        journalNumbered?: boolean;
      }>(`/api/accounting/status/${source}/${id}`);
      setAccPosted(!!st.posted);
      setAccJournalNumbered(!!st.journalNumbered);
    } catch {
      setAccPosted(false);
      setAccJournalNumbered(false);
    }
  }, []);

  const postAccounting = async (table: string, id: number): Promise<string | null> => {
    const source = accountingSource(table);
    if (!source || !(id > 0)) return null;
    const res = await apiJson<{ message?: string; Message?: string }>(
      `/api/accounting/post/${source}/${id}`,
      { method: 'POST' },
    );
    return res.message || res.Message || 'Muhasebeleştirildi';
  };

  // ── Ekran tasarımları (kullanıcı / rol bazında) ────────────────────
  const layoutUser = useMemo(() => getCurrentProfile(), []);
  const [layouts, setLayouts] = useState<FormLayoutRow[]>([]);
  const [layoutsReady, setLayoutsReady] = useState(true);
  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [designDef, setDesignDef] = useState<FormLayoutDef | null>(null);
  const [designLayout, setDesignLayout] = useState<FormLayoutRow | null>(null);

  const loadLayouts = useCallback(
    async (prefer?: number | null) => {
      try {
        const r = await resolveFormLayouts(formCode, {
          userId: layoutUser.userId,
          roleIds: layoutUser.roleIds,
          isAdmin: layoutUser.isAdmin,
        });
        setLayoutsReady(r.ready);
        setLayouts(r.layouts);
        const ids = new Set(r.layouts.map((l) => l.layoutID));
        const stored = storedLayoutChoice(formCode, layoutUser.userId);
        let pick: number | null =
          prefer !== undefined ? prefer : stored !== undefined ? stored : (r.preferredId ?? null);
        if (pick != null && !ids.has(pick)) pick = r.preferredId ?? null;
        setActiveLayoutId(pick);
      } catch {
        setLayouts([]);
        setLayoutsReady(false);
        setActiveLayoutId(null);
      }
    },
    [formCode, layoutUser],
  );

  useEffect(() => {
    void loadLayouts();
  }, [loadLayouts]);

  const activeLayout = layouts.find((l) => l.layoutID === activeLayoutId) || null;
  /** Ekranda kullanılan şema: tasarım modu → çalışma kopyası; değilse seçili tasarım; yoksa standart */
  const viewSchema = useMemo(() => {
    if (!schema) return null;
    if (designOpen && designDef) return applyFormLayout(schema, designDef);
    return activeLayout ? applyFormLayout(schema, parseLayoutJson(activeLayout.layoutJson)) : schema;
  }, [schema, designOpen, designDef, activeLayout]);

  const openDesigner = async () => {
    if (!schema) return;
    if (!layoutsReady) {
      await appConfirm(
        'Ekran tasarımı tabloları veritabanında yok.\nSistem → Veritabanı Güncelleme ekranından 73_form_layouts.sql uygulayın.',
        { title: 'Ekran tasarımı', okLabel: 'Tamam', cancelLabel: 'Kapat', danger: false },
      );
      return;
    }
    setDesignLayout(activeLayout);
    setDesignDef(mergeLayoutWithSchema(schema, parseLayoutJson(activeLayout?.layoutJson)));
    setDesignOpen(true);
  };
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
        const enrichedRaw = await enrichSchemaLookups(withCustom);
        let enrichedBase = enrichedRaw;
        if (
          !templateMode &&
          (enrichedRaw.tableName || '').toLowerCase() === 'accountvoucher' &&
          enrichedRaw.lineDistributionFields?.length
        ) {
          const dims = await fetchCostDims();
          enrichedBase = applyCostDimsToDistribution(enrichedRaw, dims);
        }
        const enriched: FormSchemaDto = templateMode
          ? {
              ...enrichedBase,
              fields: enrichedBase.fields.map((f) => ({ ...f, isRequired: false })),
              customFields: enrichedBase.customFields?.map((f) => ({ ...f, isRequired: false })),
              ...(enrichedBase.documentLayout === 'trade' || enrichedBase.lineFields?.length
                ? {
                    lineFields: [],
                    lineDistributionFields: undefined,
                    hidePaymentPlan: true,
                    enableAuxilCodesTab: false,
                  }
                : {}),
            }
          : enrichedBase;
        setSchema(enriched);

        const parked =
          trackDraft && draftId
            ? openDocsRef.current?.getDocument(draftId)?.data
            : undefined;
        if (parked) {
          setInitialData(parked);
          return;
        }

        const fromPrefill = mode === 'create' ? takeCreatePrefill(formCode) : undefined;
        if (fromPrefill) {
          setInitialData(fromPrefill);
          if (trackDraft && draftId) {
            openDocsRef.current?.updateDraft(draftId, {
              data: fromPrefill,
              label: draftLabel(titleForTray, mode, fromPrefill, recordId),
            });
          }
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
              serialGroups: rec.serialGroups,
              serials: rec.serials,
              lots: rec.lots,
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
            void refreshAccStatus(enriched.tableName, Number(recordId));
          } catch (e) {
            setLoadError(e instanceof Error ? e.message : 'Kayıt okunamadı');
            setInitialData(undefined);
            setAccPosted(false);
          }
        } else {
          const dates = defaultDocDatesForCreate(enriched);
          const org = defaultOrgFieldsForCreate(enriched);
          let standardFields: Record<string, unknown> = { ...dates, ...org };
          let additionalFields: Record<string, unknown> = {};

          // Öndeğer: kartta ID=-1, fişte türüne göre -1 / -2 … şablondan alanları kopyala
          const tplKind = findDefaultTemplate(enriched.formCode || formCode, enriched.tableName);
          if (tplKind) {
            try {
              const tpl = await getRecord(
                enriched.tableName,
                tplKind.templateId,
                enriched.primaryKeyColumn,
              );
              const fromTpl = stripTemplateMeta(
                normalizeDateFieldsForForm(enriched, { ...tpl.standardFields }),
                enriched.primaryKeyColumn,
                tplKind.group,
              );
              standardFields = { ...fromTpl, ...standardFields };
              const add: Record<string, unknown> = { ...tpl.additionalFields };
              for (const [k, v] of Object.entries(tpl.standardFields)) {
                if (k.startsWith('U_')) add[k] = v;
              }
              additionalFields =
                tplKind.group === 'voucher'
                  ? stripTemplateMeta(add, undefined, 'voucher')
                  : add;
            } catch {
              /* şablon yoksa boş form */
            }
          }

          // Malzeme kartı: STK_KDV_SAL öndeğerinden Vergi Kartı (TaxCardID)
          if (
            enriched.tableName === 'ProductCard' &&
            !templateMode &&
            (standardFields.TaxCardID == null ||
              standardFields.TaxCardID === '' ||
              standardFields.TaxCardID === 0)
          ) {
            try {
              const { taxCardId } = await resolveTaxCardForSetting('STK_KDV_SAL');
              if (taxCardId) standardFields.TaxCardID = taxCardId;
            } catch {
              /* vergi kartı eşleşmezse boş kalsın */
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
  }, [formCode, recordId, mode, draftId, trackDraft, titleForTray, templateMode]);

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

  const handleCancelDraft = async () => {
    if (
      !await appConfirm(
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
        ...paymentLinkPatch,
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
      if (schema.tableName === 'UnitCard') {
        const g = String(standard.GlobalCode ?? '').trim().toUpperCase();
        if (g) standard.GlobalCode = g;
      }

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
      if (schema.tableName === 'UnitCard') resetUnitCatalog();

      const code = String(standard.Code ?? standard.WhouseCode ?? standard.CompanyCode ?? standard.DocumentNumber ?? standard.VoucherNo ?? '').trim();
      const title = String(standard.Title ?? standard.Name ?? '').trim();
      const label = [code, title].filter(Boolean).join(' — ') || undefined;

      if (embedded && onSaved) {
        onSaved({ recordId: result.recordId, label });
        return;
      }

      if (trackDraft && draftId) openDocsRef.current?.closeDocument(draftId);

      const failedPost = (result.postSave || []).filter((p) => !p.success);
      appToast(mode === 'edit' ? 'Güncellendi' : 'Kaydedildi');
      if (failedPost.length > 0) {
        appToast(
          failedPost.map((p) => `${p.title || p.type}: ${p.message}`).join('\n'),
          { kind: 'error' },
        );
      }
      // Sunucu kayıt sonrası havuza yazar / parametreye göre muhasebeleştirir — mesajı göster
      const saveMsg = result.message || '';
      if (/Havuza alındı|Muhasebe fişi oluşturuldu|eksik bağlantı|Muhasebe havuzu/i.test(saveMsg)) {
        const accPart = saveMsg
          .split(' · ')
          .filter((p) => /Havuza|Muhasebe|eksik bağlantı/i.test(p))
          .join(' · ');
        if (accPart) {
          const err = /eksik|hatası|Muhasebeleştirilmedi/i.test(accPart);
          appToast(accPart, { kind: err ? 'error' : 'info', durationMs: err ? 5000 : 3200 });
        }
      }
      onBack();
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Kayıt başarısız', { kind: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostAccountingClick = async () => {
    if (!schema || postingAcc) return;
    const id = Number(recordId);
    if (!(id > 0) || !accountingSource(schema.tableName)) return;
    setPostingAcc(true);
    try {
      const msg = await postAccounting(schema.tableName, id);
      appToast(msg || 'Muhasebeleştirildi');
      await refreshAccStatus(schema.tableName, id);
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Muhasebeleştirilemedi', { kind: 'error', durationMs: 5000 });
    } finally {
      setPostingAcc(false);
    }
  };

  const handleUnpostAccountingClick = async () => {
    if (!schema || unpostingAcc) return;
    const id = Number(recordId);
    const source = accountingSource(schema.tableName);
    if (!(id > 0) || !source) return;
    if (accJournalNumbered) {
      appToast('Yevmiye numarası alınmış — muhasebe fişi geri alınamaz', { kind: 'error' });
      return;
    }
    const ok = await appConfirm(
      'Muhasebe fişi silinip belge düzenlemeye açılacak. Devam?',
      { okLabel: 'Geri al', danger: true },
    );
    if (!ok) return;
    setUnpostingAcc(true);
    try {
      const res = await apiJson<{ message?: string }>(`/api/accounting/unpost/${source}/${id}`, {
        method: 'POST',
      });
      appToast(res.message || 'Muhasebe fişi geri alındı');
      await refreshAccStatus(schema.tableName, id);
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Geri alınamadı', { kind: 'error', durationMs: 5000 });
    } finally {
      setUnpostingAcc(false);
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
    <div className={`relative ${designOpen ? 'sm:pr-[420px]' : ''}`}>
      {designOpen && designDef && (
        <FormLayoutDesigner
          baseSchema={schema}
          layout={designLayout}
          def={designDef}
          onDefChange={setDesignDef}
          onSaved={(id) => {
            setDesignOpen(false);
            storeLayoutChoice(formCode, layoutUser.userId, id);
            void loadLayouts(id);
          }}
          onClose={() => setDesignOpen(false)}
        />
      )}
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
          <div className="flex items-center gap-1.5 ml-auto">
            {layouts.length > 0 && !designOpen && (
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                Tasarım
                <select
                  value={activeLayoutId ?? 'std'}
                  onChange={(e) => {
                    const v = e.target.value === 'std' ? null : Number(e.target.value);
                    setActiveLayoutId(v);
                    storeLayoutChoice(formCode, layoutUser.userId, v);
                  }}
                  className="h-7 px-1.5 text-[11px] rounded-sm border border-slate-300 bg-white text-slate-700"
                >
                  <option value="std">Standart</option>
                  {layouts.map((l) => (
                    <option key={l.layoutID} value={l.layoutID}>
                      {l.name}
                      {l.isDefault ? ' (varsayılan)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {layoutUser.isAdmin && !designOpen && (
              <button
                type="button"
                onClick={() => void openDesigner()}
                title="Bu ekranın tasarımını düzenle (alan sırası, görünürlük, etiket, kullanıcı / rol ataması)"
                className="inline-flex items-center gap-1 px-2 h-7 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                Tasarla
              </button>
            )}
          {schema && Number(recordId) > 0 && mode !== 'create' && (
            <DocumentCollectionActions
              tableName={schema.tableName}
              recordId={Number(recordId)}
              customerId={
                Number(initialData?.standardFields?.CustomerID) > 0
                  ? Number(initialData?.standardFields?.CustomerID)
                  : null
              }
              documentNumber={
                String(
                  initialData?.standardFields?.DocumentNumber ??
                    initialData?.standardFields?.OrderSlipNo ??
                    '',
                ) || null
              }
              amount={
                Number(initialData?.standardFields?.NetTotal) > 0
                  ? Number(initialData?.standardFields?.NetTotal)
                  : Number(initialData?.standardFields?.Amount) > 0
                    ? Number(initialData?.standardFields?.Amount)
                    : null
              }
              description={String(initialData?.standardFields?.Description ?? '') || null}
            />
          )}
          {schema &&
            accountingSource(schema.tableName) &&
            Number(recordId) > 0 &&
            mode !== 'create' &&
            !accPosted && (
              <button
                type="button"
                disabled={postingAcc}
                onClick={() => void handlePostAccountingClick()}
                title="Bu belge için muhasebe fişi oluştur"
                className="inline-flex items-center gap-1 px-2 h-7 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-sm disabled:opacity-50"
              >
                {postingAcc ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookCheck className="w-3.5 h-3.5" />
                )}
                Muhasebeleştir
              </button>
            )}
          {schema &&
            accountingSource(schema.tableName) &&
            Number(recordId) > 0 &&
            mode !== 'create' &&
            accPosted && (
              <button
                type="button"
                disabled={unpostingAcc || accJournalNumbered || mode === 'view'}
                onClick={() => void handleUnpostAccountingClick()}
                title={
                  accJournalNumbered
                    ? 'Yevmiye numarası alınmış — geri alınamaz'
                    : 'Muhasebe fişini sil, belgeyi düzenlemeye aç'
                }
                className="inline-flex items-center gap-1 px-2 h-7 text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-sm disabled:opacity-50"
              >
                {unpostingAcc ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookCheck className="w-3.5 h-3.5" />
                )}
                Muhasebe geri al
              </button>
            )}
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
      {!embedded && Number(recordId) > 0 && mode !== 'create' && (
        <RelatedDocumentsBar tableName={schema.tableName} recordId={Number(recordId)} />
      )}
      {!embedded && schema.tableName === 'CustomerVoucher' && mode !== 'view' && (
        <PaymentLinkPanel
          recordId={Number(recordId) || Number(initialData?.recordId) || 0}
          voucherType={
            paymentLinkPatch.Type ??
            initialData?.standardFields?.Type ??
            initialData?.standardFields?.Type_
          }
          paymentLinkUrl={
            (paymentLinkPatch.PaymentLinkUrl as string | undefined) ??
            (initialData?.standardFields?.PaymentLinkUrl as string | undefined)
          }
          paymentProvider={
            (paymentLinkPatch.PaymentProvider as string | undefined) ??
            (initialData?.standardFields?.PaymentProvider as string | undefined)
          }
          paymentLinkStatus={
            (paymentLinkPatch.PaymentLinkStatus as number | string | undefined) ??
            (initialData?.standardFields?.PaymentLinkStatus as number | string | undefined)
          }
          readOnly={readOnly}
          onUrlChange={(url, meta) => {
            setPaymentLinkPatch((p) => ({
              ...p,
              PaymentLinkUrl: url,
              ...(meta.provider ? { PaymentProvider: meta.provider } : {}),
              ...(meta.status != null ? { PaymentLinkStatus: meta.status } : {}),
            }));
            setInitialData((prev) =>
              prev
                ? {
                    ...prev,
                    standardFields: {
                      ...prev.standardFields,
                      PaymentLinkUrl: url,
                      ...(meta.provider ? { PaymentProvider: meta.provider } : {}),
                      ...(meta.status != null ? { PaymentLinkStatus: meta.status } : {}),
                    },
                  }
                : prev,
            );
          }}
        />
      )}
      {!embedded && Number(recordId) > 0 && mode !== 'create' && (
        <DocumentActionsPanel
          tableName={schema.tableName}
          recordId={Number(recordId)}
          documentNumber={
            String(
              initialData?.standardFields?.DocumentNumber ??
                initialData?.standardFields?.OrderSlipNo ??
                initialData?.standardFields?.VoucherNo ??
                '',
            ) || null
          }
          customerCardID={
            Number(initialData?.standardFields?.CustomerID) > 0
              ? Number(initialData?.standardFields?.CustomerID)
              : null
          }
          readOnly={readOnly}
        />
      )}
      {!embedded && Number(recordId) > 0 && mode !== 'create' && (
        <DocumentFilesPanel
          tableName={schema.tableName}
          recordId={Number(recordId)}
          readOnly={readOnly}
        />
      )}
      {!embedded && accPosted && mode !== 'view' && accountingSource(schema.tableName) && (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
          Muhasebeleşmiş — başlık ve satırlar kilitli; ödeme planı düzenlenebilir.
          {accJournalNumbered
            ? ' Yevmiye numarası alınmış; muhasebe geri alınamaz.'
            : ' Kapsamlı değişiklik için «Muhasebe geri al».'}
        </div>
      )}

      {useAccountLinkEngine ? (
        <AccountLinkFormEngine
          schema={viewSchema ?? schema}
          initialData={initialData}
          onSubmit={handleSubmit}
          onLiveChange={trackDraft ? handleLiveChange : undefined}
          isLoading={isSubmitting}
          readOnly={readOnly}
        />
      ) : useDocumentEngine ? (
        <DocumentFormEngine
          schema={viewSchema ?? schema}
          initialData={initialData}
          onSubmit={handleSubmit}
          onLiveChange={trackDraft ? handleLiveChange : undefined}
          isLoading={isSubmitting}
          readOnly={readOnly}
          postedLock={accPosted && mode !== 'view'}
        />
      ) : (
        <DynamicFormEngine
          schema={viewSchema ?? schema}
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
