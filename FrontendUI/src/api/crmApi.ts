import { API_BASE, ApiError, apiJson } from '../config/api';
import { getCurrentUserId } from '../data/permissions';

/* ═══════════════════════════════════════════════════════════════════════════
   CRM / Teklif Yönetimi API  (BackendAPI/Controllers/CrmController.cs)
   Fırsat → Aksiyon → Teklif · Görüşmeler · Mailler (Outlook entegrasyonu)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CrmOpportunity {
  opportunityID: number;
  customerCardID?: number | null;
  customerCode?: string | null;
  customerTitle?: string | null;
  customerContactID?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  title: string;
  description?: string | null;
  oppType?: string | null;
  source?: string | null;
  priority: number;
  status: number;
  probability?: number | null;
  expectedAmount?: number | null;
  currencyID?: number | null;
  currencyCode?: string | null;
  expectedCloseDate?: string | null;
  reminderDate?: string | null;
  closeDate?: string | null;
  closeNote?: string | null;
  ownerUserID?: number | null;
  ownerName?: string | null;
  createUserName?: string | null;
  createDate?: string;
  updateDate?: string | null;
  actionCount?: number;
  openActionCount?: number;
  offerCount?: number;
  meetingCount?: number;
  mailCount?: number;
  lastOfferTotal?: number | null;
  nextDueDate?: string | null;
}

export interface CrmOfferLine {
  offerLineID?: number;
  offerID?: number;
  lineNr?: number;
  productCardID?: number | null;
  productCode?: string | null;
  description?: string | null;
  quantity: number;
  unitName?: string | null;
  price: number;
  discountRate: number;
  discountAmount: number;
  vatRate: number;
  netTotal?: number;
}

export interface CrmOffer {
  /** Tekliften oluşturulan satış siparişi (SqlUpdates/72) */
  orderVoucherID?: number | null;
  offerID: number;
  opportunityID: number;
  actionID?: number | null;
  docNum: number;
  revisionNo: number;
  parentOfferID?: number | null;
  offerDate: string;
  validityDate?: string | null;
  description?: string | null;
  currencyID?: number | null;
  currencyCode?: string | null;
  generalDiscount: number;
  subTotal: number;
  vatTotal: number;
  grandTotal: number;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  notes?: string | null;
  status: number;
  createUserName?: string | null;
  createDate?: string;
  mailCount?: number;
  lines: CrmOfferLine[];
}

export interface CrmAction {
  actionID: number;
  opportunityID?: number | null;
  opportunityTitle?: string | null;
  actionTypeID?: number | null;
  actionTypeTitle?: string | null;
  actionTypeIcon?: string | null;
  closeKind?: number;
  actionDate: string;
  dueDate?: string | null;
  title?: string | null;
  description?: string | null;
  customerContactID?: number | null;
  contactName?: string | null;
  assignedUserID?: number | null;
  assignedUserName?: string | null;
  isDone: boolean;
  doneDate?: string | null;
  createUserName?: string | null;
  createDate?: string;
  offerCount?: number;
  sourceTable?: string | null;
  sourceID?: number | null;
  sourceDocNo?: string | null;
  customerCardID?: number | null;
  customerTitle?: string | null;
  outlookItemId?: string | null;
  newOffer?: Partial<CrmOffer> | null;
}

export interface CrmMeeting {
  meetingID: number;
  opportunityID: number;
  actionID?: number | null;
  meetingDate: string;
  channel: string;
  direction: number;
  contactName?: string | null;
  subject?: string | null;
  notes?: string | null;
  durationMin?: number | null;
  nextStep?: string | null;
  nextStepDate?: string | null;
  createUserName?: string | null;
}

export interface CrmMail {
  mailLogID: number;
  opportunityID?: number | null;
  actionID?: number | null;
  offerID?: number | null;
  offerDocNum?: number | null;
  direction: number;
  status: number;
  channel: string;
  tagCode?: string | null;
  subject?: string | null;
  mailFrom?: string | null;
  mailTo?: string | null;
  mailCc?: string | null;
  body?: string | null;
  isHtml: boolean;
  attachmentNames?: string | null;
  errorMessage?: string | null;
  mailDate?: string | null;
  createDate: string;
  source?: string | null;
  hasRaw: boolean;
  rawFileName?: string | null;
}

export interface CrmActionType {
  actionTypeID: number;
  title: string;
  icon?: string | null;
  closeKind: number;
  sortOrder: number;
  isActive: boolean;
}

export interface CrmUser {
  systemUserID: number;
  nickName?: string | null;
  fullName?: string | null;
  email?: string | null;
}

export interface CrmLookupItem {
  id: number;
  code?: string | null;
  title?: string | null;
  extra?: string | null;
}

export interface CrmContact {
  customerContactID: number;
  customerCardID?: number | null;
  name?: string | null;
  contactTitle?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  isDefault?: boolean | null;
}

export interface CrmProduct {
  productCardID: number;
  code?: string | null;
  title?: string | null;
  unitName?: string | null;
  vatRate: number;
  price: number;
  priceCurrencyID?: number | null;
}

export interface CrmLookups {
  actionTypes: CrmActionType[];
  users: CrmUser[];
  currencies: CrmLookupItem[];
  tagPrefix: string;
  smtpReady: boolean;
  mailProfileSource?: string | null;
}

/** 0 Genel · 1 Firma · 2 Bölüm · 3 Birim · 4 Kullanıcı */
export const MAIL_SCOPES = ['Genel', 'Firma', 'Bölüm', 'Birim', 'Kullanıcı'] as const;

export interface CrmMailProfile {
  mailProfileID: number;
  scopeType: number;
  scopeID?: number | null;
  scopeName?: string | null;
  title?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSsl: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  fromAddress?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  bccAddress?: string | null;
  signature?: string | null;
  isActive: boolean;
  updateDate?: string | null;
}

export interface CrmOrgItem {
  id: number;
  code?: string | null;
  title?: string | null;
  unitKind?: number | null;
  companyID?: number | null;
}

export interface CrmResolvedProfile {
  source: string;
  chain: string[];
  smtpReady: boolean;
  profile?: CrmMailProfile | null;
}

export interface CrmStats {
  openCount: number;
  wonCount: number;
  lostCount: number;
  openAmount: number;
  wonAmount: number;
  overdueActions: number;
  openOffers: number;
}

export interface CrmMailDraft {
  offerId: number;
  actionId?: number | null;
  opportunityId: number;
  docNumber: string;
  customerName: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  includeOfferTable: boolean;
  attachOfferHtml: boolean;
  copyToMe: boolean;
  senderName: string;
  senderEmail: string;
  tag: string;
  suggestedAddresses: string[];
  profileSource?: string | null;
  smtpReady?: boolean;
}

export const OPP_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Açık', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  1: { label: 'Kazanıldı', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  2: { label: 'Kaybedildi', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  3: { label: 'İptal', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const OFFER_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Taslak', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  1: { label: 'Gönderildi', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  2: { label: 'Onaylandı', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  3: { label: 'Reddedildi', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  4: { label: 'Revize edildi', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const MAIL_STATUS: Record<number, string> = { 0: 'Taslak', 1: 'Gönderildi', 2: 'Hata', 3: 'Alındı' };

export const PRIORITY: Record<number, { label: string; cls: string }> = {
  1: { label: 'Yüksek', cls: 'text-rose-600' },
  2: { label: 'Normal', cls: 'text-slate-500' },
  3: { label: 'Düşük', cls: 'text-slate-400' },
};

function uid(): string {
  return getCurrentUserId() || '1';
}

function crm<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(`/api/crm${path}`, {
    ...init,
    headers: { 'X-User-Id': uid(), ...(init?.headers || {}) },
  });
}

const post = <T>(path: string, body?: unknown) =>
  crm<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => crm<T>(path, { method: 'DELETE' });

export function isNeedsUpdate(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409;
}

export const crmApi = {
  lookups: () => crm<CrmLookups>('/lookups'),
  stats: (ownerId?: number) => crm<CrmStats>(`/stats${ownerId ? `?ownerId=${ownerId}` : ''}`),
  customers: (q: string) => crm<CrmLookupItem[]>(`/customers?q=${encodeURIComponent(q)}`),
  contacts: (customerId: number) => crm<CrmContact[]>(`/customers/${customerId}/contacts`),
  products: (q: string, customerId?: number | null) =>
    crm<CrmProduct[]>(`/products?q=${encodeURIComponent(q)}${customerId ? `&customerId=${customerId}` : ''}`),

  listOpportunities: (p: { status?: number | null; q?: string; ownerId?: number | null; page?: number; pageSize?: number }) => {
    const sp = new URLSearchParams();
    if (p.status != null) sp.set('status', String(p.status));
    if (p.q) sp.set('q', p.q);
    if (p.ownerId) sp.set('ownerId', String(p.ownerId));
    sp.set('page', String(p.page || 1));
    sp.set('pageSize', String(p.pageSize || 30));
    return crm<{ items: CrmOpportunity[]; total: number }>(`/opportunities?${sp}`);
  },
  getOpportunity: (id: number) => crm<{ opportunity: CrmOpportunity; tag: string }>(`/opportunities/${id}`),
  saveOpportunity: (o: Partial<CrmOpportunity>) => post<{ id: number }>('/opportunities', o),
  setOpportunityStatus: (id: number, status: number, note?: string) =>
    post<{ ok: boolean }>(`/opportunities/${id}/status`, { status, note }),
  deleteOpportunity: (id: number) => del<{ ok: boolean }>(`/opportunities/${id}`),

  listActions: (oppId: number) => crm<CrmAction[]>(`/opportunities/${oppId}/actions`),
  listActionsBySource: (table: string, id: number) =>
    crm<CrmAction[]>(`/actions/by-source?table=${encodeURIComponent(table)}&id=${id}`),
  listAllActions: (opts?: { q?: string; openOnly?: boolean; take?: number }) => {
    const q = new URLSearchParams();
    if (opts?.q) q.set('q', opts.q);
    if (opts?.openOnly) q.set('openOnly', 'true');
    if (opts?.take) q.set('take', String(opts.take));
    const s = q.toString();
    return crm<CrmAction[]>(`/actions${s ? `?${s}` : ''}`);
  },
  saveAction: (a: Partial<CrmAction>) => post<{ id: number; offerId?: number | null; closed?: string | null }>('/actions', a),
  saveActionFromOutlook: (a: Partial<CrmAction>) => post<{ id: number }>('/actions/from-outlook', a),
  setActionDone: (id: number, done: boolean) => post<{ ok: boolean }>(`/actions/${id}/done?done=${done}`),
  deleteAction: (id: number) => del<{ ok: boolean }>(`/actions/${id}`),

  listOffers: (oppId: number) => crm<CrmOffer[]>(`/opportunities/${oppId}/offers`),
  getOffer: (id: number) => crm<CrmOffer>(`/offers/${id}`),
  saveOffer: (o: Partial<CrmOffer>) => post<{ id: number }>('/offers', o),
  reviseOffer: (id: number) => post<{ id: number }>(`/offers/${id}/revise`),
  copyOffer: (id: number) => post<{ id: number }>(`/offers/${id}/copy`),
  setOfferStatus: (id: number, status: number) => post<{ ok: boolean }>(`/offers/${id}/status`, { status }),
  /** Teklif → satış siparişi (OrderVoucher); fırsat kazanıldı, müşteri cariye döner */
  offerToOrder: (id: number) =>
    post<{ orderVoucherId: number; orderNo: string; lineCount: number; customerPromoted: boolean; message: string }>(
      `/offers/${id}/to-order`,
      {},
    ),
  deleteOffer: (id: number) => del<{ ok: boolean }>(`/offers/${id}`),
  offerPrintUrl: (id: number) => `${API_BASE}/api/crm/offers/${id}/print`,

  listMeetings: (oppId: number) => crm<CrmMeeting[]>(`/opportunities/${oppId}/meetings`),
  saveMeeting: (m: Partial<CrmMeeting>) => post<{ id: number }>('/meetings', m),
  deleteMeeting: (id: number) => del<{ ok: boolean }>(`/meetings/${id}`),

  listMails: (oppId: number) => crm<CrmMail[]>(`/opportunities/${oppId}/mails`),
  getMail: (id: number) => crm<CrmMail>(`/mails/${id}`),
  mailFileUrl: (id: number) => `${API_BASE}/api/crm/mails/${id}/file`,
  mailDraft: (offerId: number) => crm<CrmMailDraft>(`/offers/${offerId}/mail-draft`),
  sendMail: (d: CrmMailDraft) => post<{ ok: boolean; id: number }>('/mail/send', d),
  /** .eml indirir (Outlook'ta yeni mail penceresi olarak açılır) */
  async outlookDraft(d: CrmMailDraft): Promise<void> {
    const res = await fetch(`${API_BASE}/api/crm/mail/outlook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': uid() },
      body: JSON.stringify(d),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError((data as { message?: string }).message || 'Taslak oluşturulamadı', res.status, data);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : `Teklif_${d.docNumber}.eml`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  mailProfiles: () =>
    crm<{ profiles: CrmMailProfile[]; companies: CrmOrgItem[]; orgUnits: CrmOrgItem[]; users: CrmUser[] }>('/mail-profiles'),
  saveMailProfile: (p: Partial<CrmMailProfile>) => post<{ id: number }>('/mail-profiles', p),
  deleteMailProfile: (id: number) => del<{ ok: boolean }>(`/mail-profiles/${id}`),
  resolveMailProfile: (forUserId: number) => crm<CrmResolvedProfile>(`/mail-profiles/resolve?forUserId=${forUserId}`),
  testMailProfile: (id: number, to: string) => post<{ ok: boolean }>(`/mail-profiles/${id}/test`, { to }),

  getSettings: () =>
    crm<{ settings: Record<string, string | null>; actionTypes: CrmActionType[]; users: CrmUser[]; apiUrl: string }>('/settings'),
  saveSettings: (p: {
    settings: Record<string, string | null>;
    actionTypes?: CrmActionType[];
    userEmails?: Record<number, string | null>;
  }) => post<{ ok: boolean }>('/settings', p),
};

/* ─── biçim yardımcıları ─────────────────────────────────────────────────── */
export const fmtMoney = (v?: number | null, cur?: string | null) =>
  `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0))}${cur ? ` ${cur}` : ''}`;

export const fmtDate = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('tr-TR');
};

export const fmtDateTime = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '-'
    : `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** yyyy-MM-dd (input[type=date]) */
export const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : '');
export const todayInput = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const addDaysInput = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const nowLocalInput = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function calcLine(l: CrmOfferLine): number {
  const gross = Math.round(l.quantity * l.price * 100) / 100;
  const disc = l.discountRate > 0 ? Math.round(gross * l.discountRate) / 100 : l.discountAmount || 0;
  return gross - disc;
}

export function calcOffer(lines: CrmOfferLine[], generalDiscount: number) {
  const sub = lines.reduce((s, l) => s + calcLine(l), 0);
  const ratio = sub === 0 ? 0 : (sub - generalDiscount) / sub;
  const vat = lines.reduce((s, l) => s + Math.round(calcLine(l) * ratio * l.vatRate) / 100, 0);
  return { sub, vat, grand: sub - generalDiscount + vat };
}
