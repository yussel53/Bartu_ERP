import { apiJson } from '../config/api';

/** STK_KDV_* öndeğer oranından TaxCardID (kart öndeğeri). */
export async function resolveTaxCardForSetting(
  settingCode = 'STK_KDV_SAL',
): Promise<{ taxCardId: number | null; rate: string | null }> {
  const r = await apiJson<{ taxCardId?: number | null; rate?: string | null }>(
    `/api/module-params/tax-card/${encodeURIComponent(settingCode)}`,
  );
  const id = r.taxCardId != null && Number(r.taxCardId) > 0 ? Number(r.taxCardId) : null;
  return { taxCardId: id, rate: r.rate ?? null };
}
