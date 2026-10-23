/** Onay Tanımları — tetikleyiciler ve parça (node) paleti */

export interface TriggerOption {
  value: number;
  label: string;
  hint: string;
  /** Varsayılan SourceTable */
  defaultSource?: string;
  needsDocKind?: boolean;
  needsDirection?: boolean;
  needsTypeFilter?: boolean;
  /** Tetik için SELECT alanı */
  needsSql?: boolean;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: 1, label: 'Manuel', hint: 'Kullanıcı / ekrandan başlatılır' },
  {
    value: 2,
    label: 'Fiş kaydedilince',
    hint: 'OrderVoucher, ProductVoucher, Invoice… kaydı sonrası',
    defaultSource: 'OrderVoucher',
    needsTypeFilter: true,
  },
  {
    value: 3,
    label: 'e-Belge gelince',
    hint: 'e-Fatura / e-İrsaliye / e-Arşiv (EGovDocument)',
    defaultSource: 'EGovDocument',
    needsDocKind: true,
    needsDirection: true,
  },
  { value: 4, label: 'Aktarım', hint: 'Talep→sipariş vb. aktarım sonrası', defaultSource: 'OrderVoucher' },
  {
    value: 5,
    label: 'Kart eklenince / kaydedilince',
    hint: 'CustomerCard, ProductCard…',
    defaultSource: 'CustomerCard',
  },
  { value: 6, label: 'Yinelemeli / zamanlanmış', hint: 'Zamanlayıcı ile periyodik' },
  { value: 7, label: 'E-posta kontrol', hint: 'Gelen kutusu tarama tetikleyicisi' },
  { value: 8, label: 'DB tarama', hint: 'Veritabanı koşulu sağlandığında', needsSql: true },
];

export const DOC_KIND_OPTIONS = [
  { value: 1, label: 'e-Fatura' },
  { value: 2, label: 'e-Arşiv' },
  { value: 3, label: 'e-İrsaliye' },
];

export const DIRECTION_OPTIONS = [
  { value: 1, label: 'Gelen' },
  { value: 2, label: 'Giden' },
];

export type NodeTone = 'green' | 'blue' | 'purple' | 'gold' | 'red';

export interface WorkflowNodeDef {
  nodeType: string;
  label: string;
  actionType: string;
  tone: NodeTone;
  /** Yeşil / kırmızı çıkış (karar, e-posta, servis…) */
  dualOut?: boolean;
  /** Onaycı rol gerektirir */
  needsApprover?: boolean;
  group: 'tetik' | 'akis' | 'gorev' | 'veri' | 'entegrasyon';
}

/** Palet — referans BPM düğümleri (parça parça süreç) */
export const WORKFLOW_NODES: WorkflowNodeDef[] = [
  { nodeType: 'Manual', label: 'Manuel', actionType: 'Approve', tone: 'green', group: 'tetik' },
  { nodeType: 'Scheduled', label: 'Yinelemeli', actionType: 'Approve', tone: 'green', group: 'tetik' },
  { nodeType: 'EmailCheck', label: 'E-Posta Kontrol', actionType: 'Approve', tone: 'green', group: 'tetik' },
  { nodeType: 'DbScan', label: 'DB Tarama', actionType: 'Approve', tone: 'blue', group: 'veri' },
  { nodeType: 'DbScanLoop', label: 'Yinelemeli DB Tarama', actionType: 'Approve', tone: 'blue', group: 'veri' },
  { nodeType: 'EInvoiceCheck', label: 'E-Fatura Kontrol', actionType: 'Review', tone: 'blue', group: 'veri', needsApprover: true },
  { nodeType: 'Terminate', label: 'Sonlandır', actionType: 'Approve', tone: 'red', group: 'akis' },
  { nodeType: 'SubProcess', label: 'Alt Süreç', actionType: 'Approve', tone: 'purple', group: 'akis' },
  { nodeType: 'WebApi', label: 'Web Api', actionType: 'Approve', tone: 'gold', group: 'entegrasyon', dualOut: true },
  { nodeType: 'WebService', label: 'Web Servis', actionType: 'Approve', tone: 'gold', group: 'entegrasyon', dualOut: true },
  { nodeType: 'RestService', label: 'Rest Servis', actionType: 'Approve', tone: 'gold', group: 'entegrasyon', dualOut: true },
  { nodeType: 'List', label: 'Liste', actionType: 'Approve', tone: 'blue', group: 'veri' },
  { nodeType: 'Calculate', label: 'Hesapla', actionType: 'Approve', tone: 'blue', group: 'veri' },
  { nodeType: 'EmailSend', label: 'E-Posta Gönder', actionType: 'Approve', tone: 'blue', group: 'entegrasyon', dualOut: true },
  { nodeType: 'ListUpdate', label: 'Liste Güncelle', actionType: 'Approve', tone: 'blue', group: 'veri', dualOut: true },
  { nodeType: 'DbUpdate', label: 'DB Güncelle', actionType: 'Approve', tone: 'blue', group: 'veri', dualOut: true },
  { nodeType: 'DbBrowse', label: "DB'ye Gözat", actionType: 'Approve', tone: 'blue', group: 'veri', dualOut: true },
  { nodeType: 'Integration', label: 'Entegrasyon', actionType: 'Approve', tone: 'blue', group: 'entegrasyon', dualOut: true },
  { nodeType: 'TaskForm', label: 'Görev Formu', actionType: 'Approve', tone: 'purple', group: 'gorev', dualOut: true, needsApprover: true },
  { nodeType: 'Decision', label: 'Karar', actionType: 'Approve', tone: 'purple', group: 'akis', dualOut: true },
  { nodeType: 'Wait', label: 'Beklet', actionType: 'Approve', tone: 'purple', group: 'akis' },
  { nodeType: 'Review', label: 'İnceleme', actionType: 'Review', tone: 'purple', group: 'gorev', needsApprover: true },
  { nodeType: 'Link', label: 'Belge Bağla', actionType: 'Link', tone: 'blue', group: 'gorev', needsApprover: true },
  { nodeType: 'Transfer', label: 'Aktarım', actionType: 'Transfer', tone: 'blue', group: 'gorev', needsApprover: true },
];

export const NODE_TONE_CLASS: Record<NodeTone, string> = {
  green: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  blue: 'border-sky-300 bg-sky-50 text-sky-900',
  purple: 'border-violet-300 bg-violet-50 text-violet-900',
  gold: 'border-amber-300 bg-amber-50 text-amber-950',
  red: 'border-rose-300 bg-rose-50 text-rose-900',
};

export function triggerLabel(t: number): string {
  return TRIGGER_OPTIONS.find((x) => x.value === t)?.label || `Tetik ${t}`;
}

export function nodeMeta(nodeType: string): WorkflowNodeDef | undefined {
  return WORKFLOW_NODES.find((n) => n.nodeType === nodeType);
}
