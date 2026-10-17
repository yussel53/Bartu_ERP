import { useEffect, useState } from 'react';
import { listELogoCompanies } from '../api/elogoApi';
import type { IntegratorCredentials } from '../components/EinvoiceMukellefCheck';
import { getCurrentProfile } from '../data/permissions';

/**
 * Cari kart mükellef kontrolü için firma entegratörü (e-Logo).
 * Kullanıcının varsayılan firmasında entegratör tanımlıysa o, değilse entegratörü tanımlı ilk firma.
 * Şifre tarayıcıya gelmez (passwordSet + companyId → backend kayıtlı şifreyi kullanır);
 * WS URL backend'de PostBox adresine çevrilir. Firma yoksa undefined → yerel / GİB listesi.
 */
export function useEInvoiceIntegrator(enabled: boolean): IntegratorCredentials | undefined {
  const [integrator, setIntegrator] = useState<IntegratorCredentials | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let off = false;
    listELogoCompanies()
      .then((rows) => {
        if (off) return;
        const usable = rows.filter((c) => c.integratorName && c.integratorUser && c.hasPassword);
        const preferred = Number(getCurrentProfile().orgDefaults?.defaultCompanyId) || 0;
        const c = usable.find((x) => x.companyId === preferred) ?? usable[0];
        setIntegrator(
          c
            ? {
                name: c.integratorName ?? '',
                wsUrl: c.integratorWsUrl ?? '',
                user: c.integratorUser ?? '',
                vkn: c.integratorVkN ?? '',
                passwordSet: true,
                companyId: c.companyId,
              }
            : undefined,
        );
      })
      .catch(() => {
        if (!off) setIntegrator(undefined);
      });
    return () => {
      off = true;
    };
  }, [enabled]);

  return integrator;
}
