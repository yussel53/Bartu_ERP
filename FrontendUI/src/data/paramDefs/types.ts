/** Mikro tarzı parametre satırı — Setting.Code / Title / Value */

export type ParamEditor =
  | { kind: 'yesno' }
  | { kind: 'number'; step?: string }
  | { kind: 'select'; options: { value: string; label: string }[] };

export type ParamKind = 'param' | 'ondeger';

export interface ParamDef {
  code: string;
  title: string;
  defaultValue: string;
  editor: ParamEditor;
  /** param = davranış · ondeger = varsayılan değer (aynı grid’de gösterilebilir) */
  kind?: ParamKind;
  /** Bölüm başlığı (Satış / Satınalma / Genel) */
  section?: string;
  /** Henüz kayda bağlanmadı — UI’da «yakında» */
  upcoming?: boolean;
}

export const YESNO: ParamEditor = { kind: 'yesno' };

export const ACT: ParamEditor = {
  kind: 'select',
  options: [
    { value: 'continue', label: 'İşleme Devam Edilecek' },
    { value: 'warn', label: 'Kullanıcı Uyarılacak' },
    { value: 'block', label: 'İşlem Durdurulacak' },
  ],
};

export const CUR_LINE: ParamEditor = {
  kind: 'select',
  options: [
    { value: 'local', label: 'Yerel Para Birimi' },
    { value: 'doc', label: 'İşlem / Belge Dövizi' },
    { value: 'line', label: 'Satır Para Birimi' },
  ],
};
