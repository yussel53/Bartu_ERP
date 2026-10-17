import { apiJson } from '../config/api';
import { applySystemDateFormat } from '../utils/dateFormat';

export interface AppVersionInfo {
  version: string;
  commit?: string | null;
  buildTime?: string | null;
}

export interface SystemInfoDto {
  dateFormat: string;
  culture: string;
  dateFormatSource: string;
  version?: AppVersionInfo | null;
}

let loaded = false;
let lastInfo: SystemInfoDto | null = null;

/** Son okunan sistem bilgisi (sürüm satırı) */
export function getLoadedSystemInfo(): SystemInfoDto | null {
  return lastInfo;
}

export function fetchSystemInfo(): Promise<SystemInfoDto> {
  return apiJson<SystemInfoDto>('/api/system/info');
}

export interface SystemNotices {
  updateAvailable: boolean;
  canApply: boolean;
  updateMessage?: string | null;
  stagingBuildTime?: string | null;
  pendingSql: number;
}

/** Yönetici bandı: yeni sürüm / bekleyen SQL */
export function getSystemNotices(): Promise<SystemNotices> {
  return apiJson<SystemNotices>('/api/system/notices');
}

export function applyAppUpdate(): Promise<{ success: boolean; message: string }> {
  return apiJson('/api/system/update/apply', { method: 'POST' });
}

export interface DbBackupFile {
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}

export function listDbBackups(): Promise<{ folder: string; files: DbBackupFile[] }> {
  return apiJson('/api/system/backup');
}

export function runDbBackup(): Promise<{ ok: boolean; message: string; filePath?: string }> {
  return apiJson('/api/system/backup', { method: 'POST' });
}

/** Uygulama açılışında bir kez çağrılır (DbConnectionGate). */
export async function loadSystemInfo(): Promise<SystemInfoDto | null> {
  try {
    const info = await apiJson<SystemInfoDto>('/api/system/info');
    lastInfo = info;
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
