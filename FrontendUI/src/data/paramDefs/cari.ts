import type { ParamDef } from './types';
import { YESNO, ACT, CUR_LINE } from './types';

/** ModuleKey = cari */
export const CARI_PARAM_DEFS: ParamDef[] = [
  { code: 'CAR_PRICE_DEC', title: 'Birim Fiyat Kuruş Hanesi', defaultValue: '6', editor: { kind: 'number', step: '1' }, kind: 'ondeger', section: 'Yuvarlama' },
  { code: 'CAR_FX_DEC', title: 'Günlük Döviz Kuruş Hanesi', defaultValue: '2', editor: { kind: 'number', step: '1' }, kind: 'ondeger', section: 'Yuvarlama' },
  { code: 'CAR_BSMV', title: 'BSMV Oranı (%)', defaultValue: '5', editor: { kind: 'number' }, kind: 'ondeger', section: 'Oranlar' },
  { code: 'CAR_DAMGA', title: 'Damga Vergisi Oranı (%)', defaultValue: '0.75', editor: { kind: 'number' }, kind: 'ondeger', section: 'Oranlar' },
  { code: 'CAR_HDR_CUR', title: 'Kullanılacak Para Birimi - Cari Hesap (Genel)', defaultValue: 'doc', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  {
    code: 'CAR_BANK_STATUS',
    title: 'Banka Fişleri Durumu',
    defaultValue: '0',
    editor: {
      kind: 'select',
      options: [
        { value: '0', label: 'Gerçek' },
        { value: '1', label: 'Öneri' },
      ],
    },
    kind: 'ondeger',
    section: 'Öndeğer',
  },
  {
    code: 'CAR_CHEQUE_STATUS',
    title: 'Çek / Senet Bordro Durumu',
    defaultValue: '0',
    editor: {
      kind: 'select',
      options: [
        { value: '0', label: 'Gerçek' },
        { value: '1', label: 'Öneri' },
      ],
    },
    kind: 'ondeger',
    section: 'Öndeğer',
  },
  {
    code: 'CAR_ACC_STATUS',
    title: 'Muhasebe Fiş Durumu',
    defaultValue: '0',
    editor: {
      kind: 'select',
      options: [
        { value: '0', label: 'Gerçek' },
        { value: '1', label: 'Öneri' },
      ],
    },
    kind: 'ondeger',
    section: 'Öndeğer',
  },
  { code: 'CAR_ACC_HDR_CUR', title: 'Kullanılacak Para Birimi - Muhasebe (Genel)', defaultValue: 'doc', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  { code: 'CAR_ACC_LINE_CUR', title: 'Kullanılacak Para Birimi - Muhasebe (Satır)', defaultValue: 'local', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  {
    code: 'CAR_EFT_FEE',
    title: 'Gelen Havale / EFT İşleminde Masraf Tutarı',
    defaultValue: 'add',
    editor: {
      kind: 'select',
      options: [
        { value: 'add', label: 'Fiş Tutarına Eklenmeli' },
        { value: 'deduct', label: 'Fiş Tutarından Düşülmeli' },
        { value: 'ignore', label: 'Dikkate Alınmasın' },
      ],
    },
    kind: 'ondeger',
    section: 'Banka',
    upcoming: true,
  },
  {
    code: 'CAR_BANK_HDR_CUR',
    title: 'Kullanılacak Para Birimi - Banka Fişi (Genel)',
    defaultValue: 'doc',
    editor: CUR_LINE,
    kind: 'ondeger',
    section: 'Para Birimi',
  },
  {
    code: 'CAR_BANK_LINE_CUR',
    title: 'Kullanılacak Para Birimi - Banka Fişi (Satır)',
    defaultValue: 'local',
    editor: CUR_LINE,
    kind: 'ondeger',
    section: 'Para Birimi',
  },
  {
    code: 'CAR_VAT_ROUND',
    title: 'KDV Hesaplamasında Yuvarlama Şekli',
    defaultValue: 'amount',
    editor: {
      kind: 'select',
      options: [
        { value: 'amount', label: 'Tutar Üzerinden' },
        { value: 'line', label: 'Satır Üzerinden' },
      ],
    },
    section: 'Yuvarlama',
    upcoming: true,
  },
  { code: 'CAR_RISK_ORDER', title: 'Siparişte Risk Limiti Aşıldığında', defaultValue: 'continue', editor: ACT, section: 'Risk' },
  { code: 'CAR_RISK_DESP', title: 'İrsaliyede Risk Limiti Aşıldığında', defaultValue: 'block', editor: ACT, section: 'Risk' },
  { code: 'CAR_RISK_OPEN', title: 'Açık Hesaplarda Risk Limiti Aşıldığında', defaultValue: 'continue', editor: ACT, section: 'Risk' },
  { code: 'CAR_FILL_ACC', title: 'Cari Hesap Fişlerindeki Boş Muhasebe Kodlarını Otomatik Doldur', defaultValue: '0', editor: YESNO, section: 'Muhasebe' },
  { code: 'CAR_BLACK_ORDER', title: 'Kara Listedeki Cariye Sipariş Kesildiğinde', defaultValue: 'continue', editor: ACT, section: 'Kara Liste', upcoming: true },
  { code: 'CAR_BLACK_DESP', title: 'Kara Listedeki Cariye İrsaliye Kesildiğinde', defaultValue: 'continue', editor: ACT, section: 'Kara Liste', upcoming: true },
  { code: 'CAR_DUE_DAYS', title: 'Vade Takibi Yapılacak Gün Sayısı', defaultValue: '30', editor: { kind: 'number', step: '1' }, kind: 'ondeger', section: 'Vade', upcoming: true },
  { code: 'CAR_DUE_ACT', title: 'Vade Takibi Yapıldığında', defaultValue: 'continue', editor: ACT, section: 'Vade', upcoming: true },
  { code: 'CAR_DOCNO_INV', title: 'Faturalarda Cari Bazında Belge No Tekrarlandığında', defaultValue: 'continue', editor: ACT, section: 'Belge No' },
  { code: 'CAR_LINE_CUR', title: 'Kullanılacak Para Birimi - Cari Hesap (Satır)', defaultValue: 'local', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  { code: 'CAR_SALESMAN_CTRL', title: 'Satış Elemanı Kontrolü', defaultValue: '0', editor: YESNO, section: 'Satış Elemanı', upcoming: true },
  { code: 'CAR_TAXNR_CTRL', title: 'Cari Hesap Vergi Numarası Kontrolü', defaultValue: 'continue', editor: ACT, section: 'Kimlik', upcoming: true },
];
