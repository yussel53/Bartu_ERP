import { apiJson } from '../config/api';

export interface CurrencyRateRow {
  currencyID: number;
  code: string;
  title: string;
  autoRate: boolean;
  rateDate: string;
  unit?: number | null;
  buyRate: number;
  sellRate: number;
  banknoteBuyRate?: number | null;
  banknoteSellRate?: number | null;
  bulletinNo?: string | null;
  source?: string | null;
  downloadedAt?: string | null;
}

export interface CurrencyRateLog {
  runAt: string;
  requestDate?: string | null;
  rateDate?: string | null;
  bulletinNo?: string | null;
  triggerName: string;
  success: boolean;
  rateCount: number;
  message?: string | null;
}

export interface CurrencyRatesDay {
  ready: boolean;
  message?: string;
  date?: string | null;
  rates?: CurrencyRateRow[];
  days?: string[];
  logs?: CurrencyRateLog[];
}

export interface TcmbCurrency {
  code: string;
  name: string;
  unit: number;
  hasRate: boolean;
  inSystem: boolean;
  autoRate: boolean;
}

export interface DownloadResult {
  success: boolean;
  rateDate?: string | null;
  bulletinNo?: string | null;
  rateCount: number;
  message: string;
}

export function getCurrencyRates(date?: string | null): Promise<CurrencyRatesDay> {
  return apiJson<CurrencyRatesDay>(`/api/currency-rates${date ? `?date=${encodeURIComponent(date)}` : ''}`);
}

export function downloadTcmbRates(date?: string | null, codes?: string[]): Promise<DownloadResult> {
  return apiJson<DownloadResult>(`/api/currency-rates/download${date ? `?date=${encodeURIComponent(date)}` : ''}`, {
    method: 'POST',
    body: JSON.stringify({ codes: codes ?? [] }),
  });
}

export function getTcmbCurrencies(): Promise<{
  ready: boolean;
  bulletinDate?: string | null;
  bulletinNo?: string | null;
  currencies: TcmbCurrency[];
}> {
  return apiJson('/api/currency-rates/tcmb-currencies');
}

export function setAutoCurrencies(codes: string[]): Promise<{ ok: boolean; count: number }> {
  return apiJson('/api/currency-rates/auto', { method: 'POST', body: JSON.stringify({ codes }) });
}
