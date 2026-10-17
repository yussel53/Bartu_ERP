/** Fiyat — ProductPrice.Type_ (malzeme + hizmet aynı şablon) */
export const PriceType = {
  Satis: '1',
  Alis: '2',
} as const;

export const PriceTypeLabels: Record<string, string> = {
  [PriceType.Satis]: 'Satış',
  [PriceType.Alis]: 'Alış',
};

/** Sipariş / talep — OrderVoucher.Type_ */
export const OrderType = {
  Satis: '1',
  Alis: '2',
  SatisIade: '3',
  AlisIade: '4',
  /** Alış talep (siparişe aktarılır) */
  AlisTalep: '5',
  /** Satış talep (siparişe aktarılır) */
  SatisTalep: '6',
} as const;

export const OrderTypeLabels: Record<string, string> = {
  [OrderType.Satis]: 'Satış',
  [OrderType.Alis]: 'Alış',
  [OrderType.SatisIade]: 'Satış İade',
  [OrderType.AlisIade]: 'Alış İade',
  [OrderType.AlisTalep]: 'Alış Talep',
  [OrderType.SatisTalep]: 'Satış Talep',
};

/** İrsaliye / malzeme fişi — ProductVoucher.VoucherType (Create_DB: 1 Devir, 2 Alım, 3…) */
export const DispatchType = {
  Devir: '1',
  Alis: '2',
  Satis: '3',
  AlisIade: '4',
  SatisIade: '5',
  Transfer: '6',
  Sayim: '7',
  Sarf: '8',
  UretimdenGiris: '9',
  Fire: '10',
  MaliyetDagitim: '11',
} as const;

export const DispatchTypeLabels: Record<string, string> = {
  [DispatchType.Devir]: 'Devir',
  [DispatchType.Alis]: 'Alış',
  [DispatchType.Satis]: 'Satış',
  [DispatchType.AlisIade]: 'Alış İade',
  [DispatchType.SatisIade]: 'Satış İade',
  [DispatchType.Transfer]: 'Ambar Transfer',
  [DispatchType.Sayim]: 'Sayım',
  [DispatchType.Sarf]: 'Sarf',
  [DispatchType.UretimdenGiris]: 'Üretimden Giriş',
  [DispatchType.Fire]: 'Fire',
  [DispatchType.MaliyetDagitim]: 'Maliyet Dağıtım',
};

/** Malzeme hareketleri — Malzeme Fişi türleri (sayım işlemlerde; maliyet dağıtım ayrı hareket) */
export const MATERIAL_VOUCHER_TYPES = [
  DispatchType.Devir,
  DispatchType.Transfer,
  DispatchType.Sarf,
  DispatchType.UretimdenGiris,
  DispatchType.Fire,
] as const;

export const MATERIAL_VOUCHER_TYPE_OPTIONS = MATERIAL_VOUCHER_TYPES.map((value) => ({
  label: DispatchTypeLabels[value],
  value,
}));

/** Fatura — Invoice.InvoiceType */
export const InvoiceType = {
  Satis: '1',
  Alis: '2',
  SatisIade: '3',
  AlisIade: '4',
  /** Alınan hizmet faturası — satırlar Alınan Hizmet kartları (ProductType 3) */
  AlinanHizmet: '5',
  /** Satınalma fiyat farkı (tedarikçiden gelen) */
  AlisFiyatFarki: '6',
  /** Satış fiyat farkı (müşteriden gelen; satışı azaltır) */
  SatisFiyatFarki: '7',
} as const;

export const InvoiceTypeLabels: Record<string, string> = {
  [InvoiceType.Satis]: 'Satış',
  [InvoiceType.Alis]: 'Alış',
  [InvoiceType.SatisIade]: 'Satış İade',
  [InvoiceType.AlisIade]: 'Alış İade',
  [InvoiceType.AlinanHizmet]: 'Alınan Hizmet',
  [InvoiceType.AlisFiyatFarki]: 'Satınalma Fiyat Farkı',
  [InvoiceType.SatisFiyatFarki]: 'Satış Fiyat Farkı',
};

/**
 * Banka fişi — BankVoucher.Type_
 * (işlem / virman / havale + hizmet / çek-senet / gider / müstahsil)
 */
export const BankVoucherType = {
  Islem: '1',
  Virman: '2',
  GelenHavale: '3',
  GidenHavale: '4',
  Acilis: '5',
  KurFarki: '6',
  AlinanHizmet: '7',
  VerilenHizmet: '8',
  CekOdeme: '9',
  SenetOdeme: '10',
  GiderPusulasi: '11',
  MustahsilMakbuzu: '12',
} as const;

export const BankVoucherTypeLabels: Record<string, string> = {
  [BankVoucherType.Islem]: 'Banka İşlem Fişi',
  [BankVoucherType.Virman]: 'Banka Virman Fişi',
  [BankVoucherType.GelenHavale]: 'Gelen Havale/EFT',
  [BankVoucherType.GidenHavale]: 'Gönderilen Havale/EFT',
  [BankVoucherType.Acilis]: 'Banka Açılış Fişi',
  [BankVoucherType.KurFarki]: 'Banka Kur Farkı Fişi',
  [BankVoucherType.AlinanHizmet]: 'Banka Alınan Hizmet Faturası',
  [BankVoucherType.VerilenHizmet]: 'Banka Verilen Hizmet Faturası',
  [BankVoucherType.CekOdeme]: 'Bankadan Çek Ödemesi',
  [BankVoucherType.SenetOdeme]: 'Bankadan Senet Ödemesi',
  [BankVoucherType.GiderPusulasi]: 'Bankadan Gider Pusulası',
  [BankVoucherType.MustahsilMakbuzu]: 'Bankadan Müstahsil Makbuzu',
};

export const BANK_VOUCHER_TYPE_OPTIONS = Object.entries(BankVoucherTypeLabels).map(
  ([value, label]) => ({ label, value }),
);

/**
 * Çek / senet fişi — BoundTrans.Type_
 * (giriş / çıkış / işlem bordrosu / işyerleri arası)
 */
export const BoundTransType = {
  CekGiris: '1',
  SenetGiris: '2',
  CekCikisCari: '3',
  SenetCikisCari: '4',
  CekCikisBankaTahsil: '5',
  SenetCikisBankaTahsil: '6',
  CekCikisBankaTeminat: '7',
  SenetCikisBankaTeminat: '8',
  BordroMusteriCeki: '9',
  BordroMusteriSenedi: '10',
  BordroKendiCekim: '11',
  BordroBorcSenedimiz: '12',
  BordroIsyeriMusteriCeki: '13',
  BordroIsyeriMusteriSenedi: '14',
} as const;

export const BoundTransTypeLabels: Record<string, string> = {
  [BoundTransType.CekGiris]: 'Çek Girişi',
  [BoundTransType.SenetGiris]: 'Senet Girişi',
  [BoundTransType.CekCikisCari]: 'Çek Çıkış (Cari Hesaba)',
  [BoundTransType.SenetCikisCari]: 'Senet Çıkış (Cari Hesaba)',
  [BoundTransType.CekCikisBankaTahsil]: 'Çek Çıkış (Banka Tahsil)',
  [BoundTransType.SenetCikisBankaTahsil]: 'Senet Çıkış (Banka Tahsil)',
  [BoundTransType.CekCikisBankaTeminat]: 'Çek Çıkış (Banka Teminat)',
  [BoundTransType.SenetCikisBankaTeminat]: 'Senet Çıkış (Banka Teminat)',
  [BoundTransType.BordroMusteriCeki]: 'İşlem Bordrosu (Müşteri Çeki)',
  [BoundTransType.BordroMusteriSenedi]: 'İşlem Bordrosu (Müşteri Senedi)',
  [BoundTransType.BordroKendiCekim]: 'İşlem Bordrosu (Kendi Çekimiz)',
  [BoundTransType.BordroBorcSenedimiz]: 'İşlem Bordrosu (Borç Senedimiz)',
  [BoundTransType.BordroIsyeriMusteriCeki]: 'İşyerleri Arası İ. Bord. (Müşteri Çeki)',
  [BoundTransType.BordroIsyeriMusteriSenedi]: 'İşyerleri Arası İ. Bord. (Müşteri Senedi)',
};

export const BOUND_TRANS_TYPE_OPTIONS = Object.entries(BoundTransTypeLabels).map(
  ([value, label]) => ({ label, value }),
);

/** Ödeme / tahsilat hareketi — PaymentTrans.Type_ */
export const PaymentType = {
  Tahsilat: '1',
  Odeme: '2',
} as const;

export const PaymentTypeLabels: Record<string, string> = {
  [PaymentType.Tahsilat]: 'Tahsilat',
  [PaymentType.Odeme]: 'Ödeme',
};

/**
 * Cari fiş tipi — CustomerVoucher.Type
 * (Logo tarzı nakit / dekont / virman + kredi kartı / mutabakat)
 */
export const CustomerVoucherType = {
  NakitOdeme: '1',
  NakitTahsilat: '2',
  BorcDekontu: '3',
  AlacakDekontu: '4',
  Virman: '5',
  KurFarki: '6',
  OzelFis: '7',
  Acilis: '8',
  KrediKarti: '11',
  KrediKartiIade: '12',
  FirmaKrediKarti: '13',
  FirmaKrediKartiIade: '14',
  Mutabakat: '15',
} as const;

export const CustomerVoucherTypeLabels: Record<string, string> = {
  [CustomerVoucherType.NakitOdeme]: 'Nakit Ödeme',
  [CustomerVoucherType.NakitTahsilat]: 'Nakit Tahsilat',
  [CustomerVoucherType.BorcDekontu]: 'Borç Dekontu',
  [CustomerVoucherType.AlacakDekontu]: 'Alacak Dekontu',
  [CustomerVoucherType.Virman]: 'Virman Fişi',
  [CustomerVoucherType.KurFarki]: 'Kur Farkı Fişi',
  [CustomerVoucherType.OzelFis]: 'Özel Fiş',
  [CustomerVoucherType.Acilis]: 'Açılış Fişi',
  [CustomerVoucherType.KrediKarti]: 'Kredi Kartı Fişi',
  [CustomerVoucherType.KrediKartiIade]: 'Kredi Kartı İade',
  [CustomerVoucherType.FirmaKrediKarti]: 'Firma Kredi Kartı',
  [CustomerVoucherType.FirmaKrediKartiIade]: 'Firma Kredi Kartı İade',
  [CustomerVoucherType.Mutabakat]: 'Mutabakat Fişi',
};

export const CUSTOMER_VOUCHER_TYPE_OPTIONS = Object.entries(CustomerVoucherTypeLabels).map(
  ([value, label]) => ({ label, value }),
);
