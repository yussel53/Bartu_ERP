import { apiJson } from '../config/api';

export type PriceSuggestion = {
  key: string;
  label: string;
  group: string;
  price: number | null;
  docDate?: string | null;
  source?: string | null;
  vatIncluded?: boolean;
  isPreferred?: boolean;
};

export type ProductPriceSuggestions = {
  productCardId: number;
  customerId?: number | null;
  direction: 'sales' | 'purchase' | string;
  suggestions: PriceSuggestion[];
};

export async function fetchPriceSuggestions(opts: {
  productCardId: number;
  customerId?: number | null;
  direction?: 'sales' | 'purchase';
}): Promise<ProductPriceSuggestions> {
  const q = new URLSearchParams();
  q.set('productCardId', String(opts.productCardId));
  if (opts.customerId != null && opts.customerId > 0) {
    q.set('customerId', String(opts.customerId));
  }
  if (opts.direction) q.set('direction', opts.direction);
  return apiJson<ProductPriceSuggestions>(`/api/product-prices/suggestions?${q}`);
}
