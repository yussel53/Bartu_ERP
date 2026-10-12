/**
 * Sistem Yönetimi → Tür tanımları (fiş / malzeme / cari)
 * localStorage ile tutulur; API bağlanınca aynı şekil kullanılır.
 */

export type TypeDefKind = 'voucher' | 'product' | 'customer';

export interface TypeDefinition {
  id: number;
  kind: TypeDefKind;
  code: string;
  title: string;
  /** APP_MODULES.id: satis | satinalma | finans | malzeme | muhasebe | ... */
  moduleKey: string;
  /** Create_DB tablo: Invoice | BankVoucher | ProductCard | CustomerCard | ... */
  targetTable: string;
  isActive: boolean;
  sortOrder: number;
}

export const TYPE_DEF_KIND_LABELS: Record<TypeDefKind, string> = {
  voucher: 'Fiş Türü',
  product: 'Malzeme Türü',
  customer: 'Cari Tür',
};

export const TYPE_DEF_KIND_CODE: Record<TypeDefKind, number> = {
  voucher: 1,
  product: 2,
  customer: 3,
};

export const MODULE_KEY_OPTIONS = [
  { label: 'Malzeme Yönetimi', value: 'malzeme' },
  { label: 'Finans', value: 'finans' },
  { label: 'Satış', value: 'satis' },
  { label: 'Satınalma', value: 'satinalma' },
  { label: 'Genel Muhasebe', value: 'muhasebe' },
  { label: 'Personel', value: 'personel' },
] as const;

/** Fiş türünün bağlanacağı belge tablosu */
export const VOUCHER_TARGET_OPTIONS = [
  { label: 'Fatura (Invoice)', value: 'Invoice' },
  { label: 'Sipariş (OrderVoucher)', value: 'OrderVoucher' },
  { label: 'İrsaliye / Malzeme Fişi (ProductVoucher)', value: 'ProductVoucher' },
  { label: 'Banka Fişi (BankVoucher)', value: 'BankVoucher' },
  { label: 'Cari Fiş (CustomerVoucher)', value: 'CustomerVoucher' },
  { label: 'Ödeme Hareketi (PaymentTrans)', value: 'PaymentTrans' },
  { label: 'Çek / Senet Fişi (BoundTrans)', value: 'BoundTrans' },
  { label: 'Muhasebe Fişi (AccountVoucher)', value: 'AccountVoucher' },
] as const;

export const PRODUCT_TARGET_OPTIONS = [
  { label: 'Malzeme Kartı (ProductCard)', value: 'ProductCard' },
] as const;

export const CUSTOMER_TARGET_OPTIONS = [
  { label: 'Cari Kart (CustomerCard)', value: 'CustomerCard' },
] as const;

const STORAGE_KEY = 'bartu_sys_type_def_v6';

const SEED: TypeDefinition[] = [
  // Satış faturaları
  { id: 1, kind: 'voucher', code: 'TSF', title: 'Toptan Satış Faturası', moduleKey: 'satis', targetTable: 'Invoice', isActive: true, sortOrder: 10 },
  { id: 2, kind: 'voucher', code: 'PSF', title: 'Perakende Satış Faturası', moduleKey: 'satis', targetTable: 'Invoice', isActive: true, sortOrder: 20 },
  { id: 3, kind: 'voucher', code: 'SIF', title: 'Satış İade Faturası', moduleKey: 'satis', targetTable: 'Invoice', isActive: true, sortOrder: 30 },
  // Satınalma faturaları
  { id: 4, kind: 'voucher', code: 'AF', title: 'Alış Faturası', moduleKey: 'satinalma', targetTable: 'Invoice', isActive: true, sortOrder: 10 },
  { id: 5, kind: 'voucher', code: 'AIF', title: 'Alış İade Faturası', moduleKey: 'satinalma', targetTable: 'Invoice', isActive: true, sortOrder: 20 },
  // Banka
  { id: 10, kind: 'voucher', code: '1', title: 'Banka İşlem Fişi', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 10 },
  { id: 11, kind: 'voucher', code: '2', title: 'Banka Virman Fişi', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 20 },
  { id: 12, kind: 'voucher', code: '3', title: 'Gelen Havale/EFT', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 30 },
  { id: 13, kind: 'voucher', code: '4', title: 'Gönderilen Havale/EFT', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 40 },
  { id: 14, kind: 'voucher', code: '5', title: 'Banka Açılış Fişi', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 50 },
  { id: 15, kind: 'voucher', code: '6', title: 'Banka Kur Farkı Fişi', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 60 },
  { id: 16, kind: 'voucher', code: '7', title: 'Banka Alınan Hizmet Faturası', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 70 },
  { id: 17, kind: 'voucher', code: '8', title: 'Banka Verilen Hizmet Faturası', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 80 },
  { id: 18, kind: 'voucher', code: '9', title: 'Bankadan Çek Ödemesi', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 90 },
  { id: 19, kind: 'voucher', code: '10', title: 'Bankadan Senet Ödemesi', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 100 },
  { id: 55, kind: 'voucher', code: '11', title: 'Bankadan Gider Pusulası', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 110 },
  { id: 56, kind: 'voucher', code: '12', title: 'Bankadan Müstahsil Makbuzu', moduleKey: 'finans', targetTable: 'BankVoucher', isActive: true, sortOrder: 120 },
  // Sipariş / irsaliye
  { id: 20, kind: 'voucher', code: 'SS', title: 'Satış Siparişi', moduleKey: 'satis', targetTable: 'OrderVoucher', isActive: true, sortOrder: 10 },
  { id: 21, kind: 'voucher', code: 'SI', title: 'Satış İrsaliyesi', moduleKey: 'satis', targetTable: 'ProductVoucher', isActive: true, sortOrder: 10 },
  { id: 22, kind: 'voucher', code: 'AS', title: 'Alış Siparişi', moduleKey: 'satinalma', targetTable: 'OrderVoucher', isActive: true, sortOrder: 10 },
  { id: 23, kind: 'voucher', code: 'AI', title: 'Alış İrsaliyesi', moduleKey: 'satinalma', targetTable: 'ProductVoucher', isActive: true, sortOrder: 10 },
  { id: 24, kind: 'voucher', code: 'AT', title: 'Alış Talebi', moduleKey: 'satinalma', targetTable: 'OrderVoucher', isActive: true, sortOrder: 5 },
  { id: 25, kind: 'voucher', code: 'ST', title: 'Satış Talebi', moduleKey: 'satis', targetTable: 'OrderVoucher', isActive: true, sortOrder: 5 },
  // Malzeme fişleri (hareketler) + maliyet dağıtım (ayrı hareket) + sayım (işlemler)
  { id: 30, kind: 'voucher', code: '1', title: 'Devir', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 10 },
  { id: 31, kind: 'voucher', code: '6', title: 'Ambar Transfer', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 20 },
  { id: 33, kind: 'voucher', code: '8', title: 'Sarf', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 30 },
  { id: 34, kind: 'voucher', code: '9', title: 'Üretimden Giriş', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 40 },
  { id: 35, kind: 'voucher', code: '10', title: 'Fire', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 50 },
  { id: 36, kind: 'voucher', code: '11', title: 'Maliyet Dağıtım', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 60 },
  { id: 32, kind: 'voucher', code: '7', title: 'Sayım Fişi', moduleKey: 'malzeme', targetTable: 'ProductVoucher', isActive: true, sortOrder: 70 },
  // Cari fiş türleri (CustomerVoucher.Type)
  { id: 40, kind: 'voucher', code: '1', title: 'Nakit Ödeme', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 10 },
  { id: 41, kind: 'voucher', code: '2', title: 'Nakit Tahsilat', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 20 },
  { id: 42, kind: 'voucher', code: '3', title: 'Borç Dekontu', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 30 },
  { id: 43, kind: 'voucher', code: '4', title: 'Alacak Dekontu', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 40 },
  { id: 44, kind: 'voucher', code: '5', title: 'Virman Fişi', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 50 },
  { id: 45, kind: 'voucher', code: '6', title: 'Kur Farkı Fişi', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 60 },
  { id: 46, kind: 'voucher', code: '7', title: 'Özel Fiş', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 70 },
  { id: 47, kind: 'voucher', code: '8', title: 'Açılış Fişi', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 80 },
  { id: 50, kind: 'voucher', code: '11', title: 'Kredi Kartı Fişi', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 110 },
  { id: 51, kind: 'voucher', code: '12', title: 'Kredi Kartı İade', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 120 },
  { id: 52, kind: 'voucher', code: '13', title: 'Firma Kredi Kartı', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 130 },
  { id: 53, kind: 'voucher', code: '14', title: 'Firma Kredi Kartı İade', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 140 },
  { id: 54, kind: 'voucher', code: '15', title: 'Mutabakat Fişi', moduleKey: 'finans', targetTable: 'CustomerVoucher', isActive: true, sortOrder: 150 },
  // Çek / senet fişleri
  { id: 60, kind: 'voucher', code: '1', title: 'Çek Girişi', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 10 },
  { id: 61, kind: 'voucher', code: '2', title: 'Senet Girişi', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 20 },
  { id: 62, kind: 'voucher', code: '3', title: 'Çek Çıkış (Cari Hesaba)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 30 },
  { id: 63, kind: 'voucher', code: '4', title: 'Senet Çıkış (Cari Hesaba)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 40 },
  { id: 64, kind: 'voucher', code: '5', title: 'Çek Çıkış (Banka Tahsil)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 50 },
  { id: 65, kind: 'voucher', code: '6', title: 'Senet Çıkış (Banka Tahsil)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 60 },
  { id: 66, kind: 'voucher', code: '7', title: 'Çek Çıkış (Banka Teminat)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 70 },
  { id: 67, kind: 'voucher', code: '8', title: 'Senet Çıkış (Banka Teminat)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 80 },
  { id: 68, kind: 'voucher', code: '9', title: 'İşlem Bordrosu (Müşteri Çeki)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 90 },
  { id: 69, kind: 'voucher', code: '10', title: 'İşlem Bordrosu (Müşteri Senedi)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 100 },
  { id: 70, kind: 'voucher', code: '11', title: 'İşlem Bordrosu (Kendi Çekimiz)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 110 },
  { id: 71, kind: 'voucher', code: '12', title: 'İşlem Bordrosu (Borç Senedimiz)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 120 },
  { id: 72, kind: 'voucher', code: '13', title: 'İşyerleri Arası İ. Bord. (Müşteri Çeki)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 130 },
  { id: 73, kind: 'voucher', code: '14', title: 'İşyerleri Arası İ. Bord. (Müşteri Senedi)', moduleKey: 'finans', targetTable: 'BoundTrans', isActive: true, sortOrder: 140 },
  // Malzeme türleri
  { id: 100, kind: 'product', code: '1', title: 'Malzeme', moduleKey: 'malzeme', targetTable: 'ProductCard', isActive: true, sortOrder: 10 },
  { id: 101, kind: 'product', code: '2', title: 'Verilen Hizmet', moduleKey: 'satis', targetTable: 'ProductCard', isActive: true, sortOrder: 20 },
  { id: 102, kind: 'product', code: '3', title: 'Alınan Hizmet', moduleKey: 'satinalma', targetTable: 'ProductCard', isActive: true, sortOrder: 30 },
  // Cari türleri
  { id: 200, kind: 'customer', code: '1', title: 'Alıcı', moduleKey: 'finans', targetTable: 'CustomerCard', isActive: true, sortOrder: 10 },
  { id: 201, kind: 'customer', code: '2', title: 'Satıcı', moduleKey: 'finans', targetTable: 'CustomerCard', isActive: true, sortOrder: 20 },
  { id: 202, kind: 'customer', code: '3', title: 'Alıcı / Satıcı', moduleKey: 'finans', targetTable: 'CustomerCard', isActive: true, sortOrder: 30 },
];

function readAll(): TypeDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const parsed = JSON.parse(raw) as TypeDefinition[];
    return Array.isArray(parsed) ? parsed : [...SEED];
  } catch {
    return [...SEED];
  }
}

function writeAll(rows: TypeDefinition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listTypeDefs(kind?: TypeDefKind): TypeDefinition[] {
  const all = readAll();
  const filtered = kind ? all.filter((r) => r.kind === kind) : all;
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export function getTypeDef(id: number): TypeDefinition | undefined {
  return readAll().find((r) => r.id === id);
}

export function upsertTypeDef(
  data: Omit<TypeDefinition, 'id'> & { id?: number },
): TypeDefinition {
  const all = readAll();
  if (data.id != null && all.some((r) => r.id === data.id)) {
    const next = all.map((r) =>
      r.id === data.id
        ? {
            ...r,
            kind: data.kind,
            code: data.code,
            title: data.title,
            moduleKey: data.moduleKey,
            targetTable: data.targetTable,
            isActive: data.isActive,
            sortOrder: data.sortOrder,
          }
        : r,
    );
    writeAll(next);
    return next.find((r) => r.id === data.id)!;
  }
  const id = all.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const row: TypeDefinition = {
    id,
    kind: data.kind,
    code: data.code,
    title: data.title,
    moduleKey: data.moduleKey,
    targetTable: data.targetTable,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  };
  writeAll([...all, row]);
  return row;
}

export function deleteTypeDef(id: number) {
  writeAll(readAll().filter((r) => r.id !== id));
}

/** Belge formlarındaki select için aktif tür seçenekleri */
export function getTypeOptionsForTarget(opts: {
  targetTable: string;
  moduleKey?: string;
  kind?: TypeDefKind;
}): { label: string; value: string }[] {
  return listTypeDefs(opts.kind)
    .filter((r) => r.isActive && r.targetTable === opts.targetTable)
    .filter((r) => !opts.moduleKey || r.moduleKey === opts.moduleKey)
    .map((r) => ({ label: `${r.code} — ${r.title}`, value: r.code }));
}

export function typeDefsToListRows(kind: TypeDefKind): Record<string, string | number>[] {
  const modLabel = (k: string) => MODULE_KEY_OPTIONS.find((m) => m.value === k)?.label ?? k;
  return listTypeDefs(kind).map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    module: modLabel(r.moduleKey),
    target: r.targetTable,
    status: r.isActive ? 'Aktif' : 'Pasif',
  }));
}

export function resetTypeDefsToSeed() {
  writeAll([...SEED]);
}
