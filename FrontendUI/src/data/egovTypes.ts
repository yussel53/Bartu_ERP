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
