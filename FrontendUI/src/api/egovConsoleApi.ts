import { apiJson } from '../config/api';

/** e-Belge konsolu — api/egov/console */

export interface EGovConsoleKindTotal {
  /** 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye */
  docKind: number;
  /** 1 Gelen · 2 Giden */
  direction: number;
  count: number;
  /** TL belgelerin tutarı (döviz belgeler foreignCount'ta) */
  amountTry: number;
  foreignCount: number;
}

export interface EGovConsoleAttention {
  eGovDocumentID: number;
  docKind: number;
  direction: number;
  documentNo?: string | null;
  customerTitle?: string | null;
  amount?: number | null;
  currencyCode?: string | null;
  docDate?: string | null;
  /** new · pending · approved · rejected · error */
  stage: string;
  status?: string | null;
  pendingRoleName?: string | null;
  comment?: string | null;
  ageDays: number;
}

export interface EGovConsoleSummary {
  from: string;
  to: string;
  approvalReady: boolean;
  kinds: EGovConsoleKindTotal[];
  /** new · pending · approved · saved · rejected (gelen e-Fatura / e-Arşiv) */
  stages: Record<string, number>;
  statusErrors: number;
  daily: { day: string; incoming: number; outgoing: number }[];
  attention: EGovConsoleAttention[];
}

export function getEGovConsole(from: string, to: string, docKind?: number | null): Promise<EGovConsoleSummary> {
  const q = new URLSearchParams({ from, to });
  if (docKind) q.set('docKind', String(docKind));
  return apiJson(`/api/egov/console?${q}`);
}
