/** Logo fatura sağ tık — çalışan / stub ayrımı */
export type TradeCtxAction =
  | 'discount'
  | 'priceUpdate'
  | 'kdvSummary'
  | 'detailInfo'
  | 'lineCount'
  | 'find'
  | 'resetCols'
  | 'accountCodes'
  | 'withholding'
  | 'stub';

export interface TradeCtxMenuDef {
  key: string;
  label: string;
  action: TradeCtxAction;
  separatorBefore?: boolean;
}

export const TRADE_DOCUMENT_CONTEXT_MENU: TradeCtxMenuDef[] = [
  { key: 'params', label: 'Fatura Parametreleri', action: 'stub' },
  { key: 'acc', label: 'Muhasebe Kodları', action: 'accountCodes' },
  { key: 'smm', label: 'SMM Muhasebe Kodları', action: 'stub' },
  { key: 'smm-tfrs', label: 'SMM Muhasebe Kodları (TFRS)', action: 'stub' },
  { key: 'smm-enf', label: 'SMM Muhasebe Kodları (ENFLASYON)', action: 'stub' },
  { key: 'price', label: 'Birim Fiyat Güncelleme', action: 'priceUpdate' },
  { key: 'pay', label: 'Ödeme Hareketleri (Parçalı/Ortalama)', action: 'stub' },
  { key: 'cond', label: 'Satış Koşullarını Uygula', action: 'stub' },
  { key: 'cond-clear', label: 'Satış Koşullarını Temizle', action: 'stub' },
  { key: 'discount', label: 'İndirim Uygula', action: 'discount', separatorBefore: true },
  { key: 'extra', label: 'Ek Bilgi Formları', action: 'stub' },
  { key: 'kefil', label: 'Kefil Bilgileri', action: 'stub' },
  { key: 'istihbarat', label: 'İstihbarat Bilgileri', action: 'stub' },
  { key: 'earsiv', label: 'e-Arşiv Bilgileri', action: 'stub' },
  { key: 'eirs', label: 'e-İrsaliye Bilgileri', action: 'stub' },
  { key: 'edefter', label: 'e-Defter Belge Detayı', action: 'stub' },
  { key: 'ebat', label: 'Fiş Ebat Bilgileri', action: 'stub', separatorBefore: true },
  { key: 'kayit', label: 'Kayıt Bilgisi', action: 'stub' },
  { key: 'tevk', label: 'Tevkifat Uygula', action: 'withholding', separatorBefore: true },
  { key: 'detay', label: 'Detaylı Bilgi', action: 'detailInfo', separatorBefore: true },
  { key: 'kdv', label: 'KDV Özet Bilgileri', action: 'kdvSummary' },
  { key: 'tevk-info', label: 'Tevkifat Bilgileri', action: 'stub' },
  { key: 'maliyet', label: 'Maliyetler', action: 'stub', separatorBefore: true },
  { key: 'bul', label: 'Bul', action: 'find' },
  { key: 'satir', label: 'Satır Sayısı', action: 'lineCount', separatorBefore: true },
  { key: 'baglanti', label: 'Fatura Bağlantıları', action: 'stub' },
  { key: 'reset', label: 'Öndeğerlere Dön', action: 'resetCols' },
  { key: 'birim-top', label: 'Birime Göre Toplam Miktar', action: 'stub' },
];
