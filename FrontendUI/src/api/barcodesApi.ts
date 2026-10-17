import { apiJson } from '../config/api';

export interface BarcodeConflict {
  barcode: string;
  productCardID?: number | null;
  productCode?: string | null;
  productTitle?: string | null;
  reason: string;
}

export interface BarcodeResolve {
  found: boolean;
  productCardID: number;
  productCode?: string | null;
  productTitle?: string | null;
  unitID?: number | null;
  type?: number | null;
  /** Birim barkodundan okunan miktar (bölen uygulanmış) */
  quantity?: number | null;
}

/** Karttaki barkodların benzersizlik kontrolü (kaydetmeden) */
export function checkBarcodes(productId: number, barcodes: Record<string, unknown>[]): Promise<BarcodeConflict[]> {
  return apiJson<BarcodeConflict[]>('/api/barcodes/check', {
    method: 'POST',
    body: JSON.stringify({ productId, barcodes }),
  });
}

/** Okutulan barkod → malzeme (+ birim barkodunda miktar) */
export function resolveBarcode(code: string): Promise<BarcodeResolve> {
  return apiJson<BarcodeResolve>(`/api/barcodes/resolve?code=${encodeURIComponent(code.trim())}`);
}
