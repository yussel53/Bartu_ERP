/** ProductCard.ProductType — aynı tablo, tip ile ayrım */
export const ProductCardType = {
  Malzeme: '1',
  VerilenHizmet: '2',
  AlinanHizmet: '3',
} as const;

export type ProductCardTypeValue = (typeof ProductCardType)[keyof typeof ProductCardType];

export const ProductCardTypeLabels: Record<ProductCardTypeValue, string> = {
  [ProductCardType.Malzeme]: 'Malzeme',
  [ProductCardType.VerilenHizmet]: 'Verilen Hizmet',
  [ProductCardType.AlinanHizmet]: 'Alınan Hizmet',
};
