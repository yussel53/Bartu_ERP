/** E-Devlet belge türleri — EGovDocument.DocKind / Direction / IsArchived */

export const EGovDocKind = {
  EFatura: 1,
  EArsiv: 2,
  EIrsaliye: 3,
} as const;

export const EGovDirection = {
  Gelen: 1,
  Giden: 2,
} as const;

export const EGovDocKindLabels: Record<number, string> = {
  [EGovDocKind.EFatura]: 'e-Fatura',
  [EGovDocKind.EArsiv]: 'e-Arşiv',
  [EGovDocKind.EIrsaliye]: 'e-İrsaliye',
};

/** Tasarım şablonu belge türleri — EGovDesignRule.DocType (SqlUpdates/75_egov_design_templates.sql) */
export const EGovDesignDocTypes: { value: number; label: string }[] = [
  { value: 1, label: 'e-Fatura' },
  { value: 2, label: 'e-Fatura İade' },
  { value: 3, label: 'e-Arşiv' },
  { value: 4, label: 'e-Arşiv İnternet' },
  { value: 5, label: 'e-İrsaliye' },
  { value: 6, label: 'e-İrsaliye Yanıtı' },
  { value: 7, label: 'e-Müstahsil Makbuzu' },
  { value: 8, label: 'e-Serbest Meslek Makbuzu' },
  { value: 9, label: 'e-Fatura İhracat' },
  { value: 10, label: 'e-İrsaliye Ambar' },
  { value: 11, label: 'e-Fatura İhraç Kayıtlı' },
  { value: 12, label: 'e-Arşiv İhraç Kayıtlı' },
  { value: 13, label: 'e-Arşiv İade' },
  { value: 14, label: 'İlaç ve Tıbbi Cihaz' },
];

/** Tasarım şablonu tipleri — EGovDesignRule.RuleType. 1 Öndeğer değersizdir. */
export const EGovDesignRuleTypes: { value: number; label: string }[] = [
  { value: 1, label: 'Öndeğer' },
  { value: 2, label: 'Alıcı Cari Vkn/Tckn' },
  { value: 3, label: 'Fatura Özel Kodu' },
  { value: 4, label: 'Parametre' },
  { value: 5, label: 'Cari Hesap Kodu' },
  { value: 6, label: 'İş Yeri Kodu' },
  { value: 7, label: 'Organizasyonel Birimler' },
  { value: 8, label: 'Ambar Kodu' },
];

export const EGovDesignRuleDefault = 1;

/** Önizleme örneği: irsaliye türleri DespatchAdvice, e-Arşiv türleri EARSIVFATURA, diğerleri Invoice */
export function egovDesignSampleKind(docType: number): 'invoice' | 'earsiv' | 'despatch' {
  if ([5, 6, 10].includes(docType)) return 'despatch';
  if ([3, 4, 12, 13].includes(docType)) return 'earsiv';
  return 'invoice';
}
