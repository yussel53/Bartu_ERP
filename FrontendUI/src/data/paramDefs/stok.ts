import type { ParamDef } from './types';
import { YESNO, ACT, CUR_LINE } from './types';

const STATUS_DEF = {
  kind: 'select' as const,
  options: [
    { value: '0', label: 'Gerçek' },
    { value: '1', label: 'Öneri' },
  ],
};

const FX_DATE = {
  kind: 'select' as const,
  options: [
    { value: 'update', label: 'Kuru Güncellenecek' },
    { value: 'keep', label: 'Kuru Güncellenmeyecek' },
  ],
};

/** ModuleKey = stok — STK_KDV_* kart öndeğeri (malzeme TaxCardID / fiş satır oranı) */
export const STOK_PARAM_DEFS: ParamDef[] = [
  { code: 'STK_KDV_PUR', title: 'Satınalma KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  { code: 'STK_KDV_SAL', title: 'Satış KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  { code: 'STK_KDV_RET', title: 'İade KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  { code: 'STK_KDV_RETAIL_SAL', title: 'Perakende Satış KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  { code: 'STK_KDV_RETAIL_RET', title: 'Perakende İade KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  { code: 'STK_KDV_EXPENSE', title: 'Masraf KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  { code: 'STK_KDV_FX', title: 'Kur Farkı KDV Oranı (%)', defaultValue: '20', editor: { kind: 'number' }, kind: 'ondeger', section: 'Kart Öndeğer · KDV' },
  {
    code: 'STK_NEG_CTRL',
    title: 'Negatif Stok Seviyesi Kontrolü',
    defaultValue: '0',
    editor: {
      kind: 'select',
      options: [
        { value: '0', label: 'İzin ver (İşleme Devam)' },
        { value: '1', label: 'Kullanıcı Uyarılacak' },
        { value: '2', label: 'İşlem Durdurulacak' },
      ],
    },
    section: 'Seviye',
  },
  { code: 'STK_MIN_CTRL', title: 'Asgari Stok Seviyesi Kontrolü', defaultValue: 'continue', editor: ACT, section: 'Seviye', upcoming: true },
  { code: 'STK_MAX_CTRL', title: 'Azami Stok Seviyesi Kontrolü', defaultValue: 'continue', editor: ACT, section: 'Seviye', upcoming: true },
  { code: 'STK_SAFE_CTRL', title: 'Güvenlik Stok Seviyesi Kontrolü', defaultValue: 'continue', editor: ACT, section: 'Seviye', upcoming: true },
  { code: 'STK_IN_CTRL', title: 'Giriş Kontrolü', defaultValue: 'continue', editor: ACT, section: 'Seviye', upcoming: true },
  { code: 'STK_OUT_CTRL', title: 'Çıkış Kontrolü', defaultValue: 'continue', editor: ACT, section: 'Seviye', upcoming: true },
  {
    code: 'STK_COST_METHOD',
    title: 'Stok Maliyet Türü',
    defaultValue: 'fifo',
    editor: {
      kind: 'select',
      options: [
        { value: 'fifo', label: 'FIFO' },
        { value: 'avg', label: 'Ağırlıklı Ortalama' },
        { value: 'lifo', label: 'LIFO' },
      ],
    },
    kind: 'ondeger',
    section: 'Maliyet',
    upcoming: true,
  },
  { code: 'STK_FILL_ACC', title: 'Malzeme Fişlerindeki Boş Muhasebe Kodlarını Otomatik Doldur', defaultValue: '0', editor: YESNO, section: 'Muhasebe' },
  { code: 'STK_HDR_CUR', title: 'Kullanılacak Para Birimi - Malzeme (Genel)', defaultValue: 'doc', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  { code: 'STK_LINE_CUR', title: 'Kullanılacak Para Birimi - Malzeme (Satır)', defaultValue: 'local', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  { code: 'STK_VOUCH_OUT_STATUS', title: 'Malzeme Fişleri Durumu (Ambar Çıkış)', defaultValue: '0', editor: STATUS_DEF, kind: 'ondeger', section: 'Öndeğer' },
  { code: 'STK_VOUCH_IN_STATUS', title: 'Malzeme Fişleri Durumu (Ambar Giriş)', defaultValue: '0', editor: STATUS_DEF, kind: 'ondeger', section: 'Öndeğer' },
  { code: 'STK_WHOUSE_EDIT', title: 'Fiş Satırları Ambar Bilgisi Değiştirilebilsin', defaultValue: '0', editor: YESNO, section: 'Ambar', upcoming: true },
  { code: 'STK_WHOUSE_WARN', title: 'Fiş Satırları Ambar Bilgisi Güncellenirken Uyar', defaultValue: '1', editor: YESNO, section: 'Ambar', upcoming: true },
  { code: 'STK_SERIAL_POPUP', title: 'Seri/Lot Miktar Değişince Otomatik Pencere', defaultValue: '1', editor: YESNO, section: 'Seri/Lot', upcoming: true },
  { code: 'STK_FX_DATE_REP', title: 'Tarih Değişikliğinde Raporlama Dövizi Kuru', defaultValue: 'update', editor: FX_DATE, section: 'Kur', upcoming: true },
  { code: 'STK_AUTO_PRINT', title: 'Otomatik Fiş Basımı', defaultValue: '0', editor: YESNO, section: 'Basım', upcoming: true },
  {
    code: 'STK_LEVEL_BASE',
    title: 'Stok Seviye Kontrolleri',
    defaultValue: 'actual',
    editor: {
      kind: 'select',
      options: [
        { value: 'actual', label: 'Fiili Stok Üzerinden Yapılsın' },
        { value: 'available', label: 'Kullanılabilir Stok Üzerinden' },
      ],
    },
    section: 'Seviye',
    upcoming: true,
  },
  {
    code: 'STK_WP_CTRL',
    title: 'İşyeri / Fabrika / Ambar Kontrolü',
    defaultValue: '1',
    editor: YESNO,
    section: 'Ambar',
  },
  {
    code: 'STK_SERIAL_QTY',
    title: 'Fişlerde Seri/Lot Ve Stok Yeri Takibinde Miktar Kontrolü',
    defaultValue: 'continue',
    editor: ACT,
    section: 'Seri/Lot',
    upcoming: true,
  },
  {
    code: 'STK_CUST_PROD',
    title: 'Fişlerde Cari Hesap / Malzeme Uygunluk Kontrolü',
    defaultValue: 'continue',
    editor: ACT,
    section: 'Kontrol',
  },
  {
    code: 'STK_UNIT_DIV',
    title: 'Birim - Bölünebilir',
    defaultValue: '0',
    editor: YESNO,
    kind: 'ondeger',
    section: 'Kart Öndeğer',
    upcoming: true,
  },
  {
    code: 'STK_LOC_TRACK',
    title: 'Stok Yeri Takibi',
    defaultValue: '0',
    editor: {
      kind: 'select',
      options: [
        { value: '0', label: 'Yapılmayacak' },
        { value: '1', label: 'Yapılacak' },
      ],
    },
    kind: 'ondeger',
    section: 'Kart Öndeğer',
    upcoming: true,
  },
];
