import { apiJson } from '../config/api';

export interface PaymentLinkGenerateResult {
  success: boolean;
  message?: string;
  url?: string;
  token?: string;
  provider?: string;
  status?: number;
}

export function generatePaymentLink(customerVoucherId: number) {
  return apiJson<PaymentLinkGenerateResult>(`/api/payment-link/generate/${customerVoucherId}`, {
    method: 'POST',
  });
}
