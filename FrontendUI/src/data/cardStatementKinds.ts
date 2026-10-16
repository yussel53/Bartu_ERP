import type { CardStatementKind } from '../api/cardStatementApi';

/** Sağ tık menüsünde kart türüne göre gösterilen bölüm (key = backend section key, 'ekstre' = ekstre sekmesi). */
export interface CardStatementMenuItem {
  key: string;
  label: string;
}

interface CardStatementKindDef {
  kind: CardStatementKind;
  title: string;
  items: CardStatementMenuItem[];
}

const EKSTRE: CardStatementMenuItem = { key: 'ekstre', label: 'Ekstre' };
const HAREKETLER: CardStatementMenuItem = { key: 'hareketler', label: 'Hareketler' };
const AYLIK: CardStatementMenuItem = { key: 'aylik', label: 'Aylık Özet' };

/** Kart tablosu → ekstre türü ve menü bölümleri */
const BY_TABLE: Record<string, CardStatementKindDef> = {
  CustomerCard: {
    kind: 'customer',
    title: 'Cari',
    items: [
      { ...EKSTRE, label: 'Cari Hesap Ekstresi' },
      HAREKETLER,
      { key: 'siparisler', label: 'Siparişler' },
      { key: 'malzeme', label: 'Malzeme Hareketleri' },
      { key: 'odeme', label: 'Ödeme / Tahsilat Planı' },
      { key: 'ceksenet', label: 'Çek / Senet' },
      AYLIK,
    ],
  },
  ProductCard: {
    kind: 'product',
    title: 'Malzeme',
    items: [
      { ...EKSTRE, label: 'Malzeme Ekstresi' },
      HAREKETLER,
      { key: 'ambar', label: 'Ambar Durumu' },
      { key: 'siparisler', label: 'Siparişler' },
      { key: 'cariler', label: 'Cari Bazında' },
      AYLIK,
    ],
  },
  BankCard: {
    kind: 'bank',
    title: 'Banka',
    items: [
      { ...EKSTRE, label: 'Banka Ekstresi' },
      HAREKETLER,
      { key: 'hesaplar', label: 'Hesaplar' },
      { key: 'cariler', label: 'Cari Bazında' },
      AYLIK,
    ],
  },
  BankAccountCard: {
    kind: 'bankAccount',
    title: 'Banka Hesabı',
    items: [
      { ...EKSTRE, label: 'Banka Hesap Ekstresi' },
      HAREKETLER,
      { key: 'cariler', label: 'Cari Bazında' },
      { key: 'odeme', label: 'Ödeme / Tahsilat Planı' },
      AYLIK,
    ],
  },
  SafeCard: {
    kind: 'safe',
    title: 'Kasa',
    items: [{ ...EKSTRE, label: 'Kasa Ekstresi' }, HAREKETLER],
  },
  AccountCard: {
    kind: 'account',
    title: 'Hesap',
    items: [
      { ...EKSTRE, label: 'Muavin Defter (Ekstre)' },
      HAREKETLER,
      { key: 'althesaplar', label: 'Alt Hesaplar' },
      AYLIK,
    ],
  },
  BoundCard: {
    kind: 'bound',
    title: 'Çek / Senet',
    items: [HAREKETLER],
  },
};

export function getCardStatementDef(tableName: string | null | undefined): CardStatementKindDef | null {
  if (!tableName) return null;
  return BY_TABLE[tableName] ?? null;
}
