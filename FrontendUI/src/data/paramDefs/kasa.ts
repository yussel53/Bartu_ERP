import type { ParamDef } from './types';
import { YESNO, CUR_LINE } from './types';

/** ModuleKey = kasa */
export const KASA_PARAM_DEFS: ParamDef[] = [
  { code: 'KASA_WORKDAY_CTRL', title: 'Kasa Çalışma Günü Kontrolü', defaultValue: '0', editor: YESNO, section: 'Genel' },
  {
    code: 'KASA_LINES_PRINT',
    title: 'Kasa Satırları',
    defaultValue: 'separate',
    editor: {
      kind: 'select',
      options: [
        { value: 'separate', label: 'Ayrı Ayrı Basılacak' },
        { value: 'merged', label: 'Birleştirilerek Basılacak' },
      ],
    },
    section: 'Basım',
    upcoming: true,
  },
  { code: 'KASA_AUTO_PRINT', title: 'Otomatik Kasa İşlemleri Basımı', defaultValue: '0', editor: YESNO, section: 'Basım', upcoming: true },
  { code: 'KASA_STOPAJ_MAL', title: 'Stopaj Oranı(Mal)', defaultValue: '0', editor: { kind: 'number' }, kind: 'ondeger', section: 'Oranlar', upcoming: true },
  { code: 'KASA_STOPAJ_HIZMET', title: 'Stopaj Oranı(Hizmet)', defaultValue: '0', editor: { kind: 'number' }, kind: 'ondeger', section: 'Oranlar', upcoming: true },
  { code: 'KASA_FON_ORAN', title: 'Fon Payı Oranı', defaultValue: '0', editor: { kind: 'number' }, kind: 'ondeger', section: 'Oranlar', upcoming: true },
  { code: 'KASA_NEG_CTRL', title: 'Kasa Negatif Seviye Kontrolü', defaultValue: '0', editor: YESNO, section: 'Kontrol' },
  {
    code: 'KASA_NEG_CUR',
    title: 'Kasa Negatif Seviye — Para Birimi',
    defaultValue: 'local',
    editor: {
      kind: 'select',
      options: [
        { value: 'local', label: "Yerel Para Birimi'ne göre yapılacak" },
        { value: 'doc', label: 'Belge para birimine göre yapılacak' },
      ],
    },
    section: 'Kontrol',
  },
  {
    code: 'KASA_FX_LOCK',
    title: 'Kasa Kur Farkı İşlemlerinde Lock Kontrolü',
    defaultValue: '1',
    editor: {
      kind: 'select',
      options: [
        { value: '1', label: 'Yapılacak' },
        { value: '0', label: 'Yapılmayacak' },
      ],
    },
    section: 'Kontrol',
    upcoming: true,
  },
  { code: 'KASA_FILL_ACC', title: 'Kasa Fişlerindeki Boş Muhasebe Kodlarını Otomatik Doldur', defaultValue: '0', editor: YESNO, section: 'Muhasebe' },
  { code: 'KASA_SALESMAN_CTRL', title: 'Satış Elemanı Kontrolü', defaultValue: '0', editor: YESNO, section: 'Satış Elemanı', upcoming: true },
  { code: 'KASA_SALESMAN_CUST', title: 'Satış Elemanı Cari Hesap Bağlantı Kontrolü', defaultValue: '0', editor: YESNO, section: 'Satış Elemanı', upcoming: true },
  { code: 'KASA_SALESMAN_EDIT', title: 'Fiş/Fiş Satırları Satış Elemanı Bilgisi Değiştirilebilsin', defaultValue: '0', editor: YESNO, section: 'Satış Elemanı', upcoming: true },
  { code: 'KASA_SKONSOL_PRINT', title: 'Skonsol Uygulaması Otomatik Kasa İşlemleri Basımı', defaultValue: '0', editor: YESNO, section: 'Basım', upcoming: true },
  { code: 'KASA_HDR_CUR', title: 'Kullanılacak Para Birimi - Kasa (Genel)', defaultValue: 'local', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  { code: 'KASA_LINE_CUR', title: 'Kullanılacak Para Birimi - Kasa (Satır)', defaultValue: 'local', editor: CUR_LINE, kind: 'ondeger', section: 'Para Birimi' },
  { code: 'KASA_SYNC_EDIT_DATE', title: 'Fiş Tarihi Değişince Düzenleme Tarihi de Güncellensin', defaultValue: '0', editor: YESNO, section: 'Genel', upcoming: true },
  { code: 'KASA_PRINT_MERGE_INST', title: 'Yazdırırken Aynı Vadeli Taksit Hareketleri Birleştirilsin', defaultValue: '0', editor: YESNO, section: 'Basım', upcoming: true },
  { code: 'KASA_VIRMAN_CUR_LOCK', title: 'Virman İşleminde Döviz Türü Değiştirilemeyecek İşareti Dikkate Alınsın', defaultValue: '1', editor: YESNO, section: 'Kontrol' },
  { code: 'KASA_SALESMAN_FILTER', title: 'Satış Elemanı Seçiminde Yalnız Cariye Bağlı Elemanlar', defaultValue: '0', editor: YESNO, section: 'Satış Elemanı', upcoming: true },
];
