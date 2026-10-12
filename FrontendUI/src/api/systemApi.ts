import { apiJson } from '../config/api';
import { applySystemDateFormat } from '../utils/dateFormat';

export interface SystemInfoDto {
  dateFormat: string;
  culture: string;
  dateFormatSource: string;
}

let loaded = false;

/** Uygulama açılışında bir kez çağrılır (DbConnectionGate). */
export async function loadSystemInfo(): Promise<SystemInfoDto | null> {
  try {
    const info = await apiJson<SystemInfoDto>('/api/system/info');
    if (info?.dateFormat) {
      applySystemDateFormat(info.dateFormat);
    }
    loaded = true;
    return info;
  } catch {
    applySystemDateFormat('dd.MM.yyyy');
    loaded = true;
    return null;
  }
}

export function isSystemInfoLoaded(): boolean {
  return loaded;
}
