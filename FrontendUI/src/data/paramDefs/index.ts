import type { ParamDef } from './types';
import { KASA_PARAM_DEFS } from './kasa';
import { FATURA_PARAM_DEFS } from './fatura';
import { STOK_PARAM_DEFS } from './stok';
import { CARI_PARAM_DEFS } from './cari';

export type ModuleParamKey = 'kasa' | 'fatura' | 'stok' | 'cari';

export const MODULE_PARAM_DEFS: Record<ModuleParamKey, ParamDef[]> = {
  kasa: KASA_PARAM_DEFS,
  fatura: FATURA_PARAM_DEFS,
  stok: STOK_PARAM_DEFS,
  cari: CARI_PARAM_DEFS,
};

export const MODULE_PARAM_TITLES: Record<ModuleParamKey, string> = {
  kasa: 'Kasa',
  fatura: 'Fatura',
  stok: 'Stok',
  cari: 'Cari',
};

export * from './types';
export { KASA_PARAM_DEFS, FATURA_PARAM_DEFS, STOK_PARAM_DEFS, CARI_PARAM_DEFS };
