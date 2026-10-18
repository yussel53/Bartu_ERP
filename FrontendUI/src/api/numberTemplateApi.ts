import { apiJson } from '../config/api';

export interface NumberAllocateRequest {
  formCode?: string;
  tableName?: string;
  companyId?: string;
  workplaceId?: string;
  whouseId?: string;
  userId?: string;
  companyCode?: string;
  workplaceCode?: string;
  whouseCode?: string;
  userName?: string;
  /** Fiş tarihi (geçerlilik aralığı) */
  documentDate?: string;
  /** Yalnız önizleme — sayaç artırılmaz (numara kayıtta verilir) */
  peek?: boolean;
}

export interface NumberAllocateResult {
  success: boolean;
  number?: string;
  templateId?: number;
  templateCode?: string;
  pattern?: string;
  message?: string;
}

export async function allocateDocumentNumber(
  body: NumberAllocateRequest,
): Promise<NumberAllocateResult> {
  return apiJson<NumberAllocateResult>('/api/number-templates/allocate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
