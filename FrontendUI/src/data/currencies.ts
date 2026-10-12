/**
 * Döviz kartları — SYS_Currency / ISO 4217
 * Yerel: TRY (TL), kur = 1
 * Sık kullanılanlar (USD, EUR, GBP) üstte; diğerleri kod sırasına göre
 */

export interface CurrencyDef {
  id: string;
  code: string;
  title: string;
  symbol: string;
  /** Yerel para birimi (TL) */
  isLocal: boolean;
  /** Güncel kur (yerel=1) — örnek/seed değer */
  rate: number;
  isActive: boolean;
}

/** Sık kullanılan yabancı dövizler — seçim listesinde üstte */
export const FREQUENT_CURRENCY_CODES = ['USD', 'EUR', 'GBP'] as const;

type Seed = { code: string; title: string; symbol: string; rate?: number };

/** ISO 4217 — aktif / yaygın para birimleri */
const WORLD_CURRENCIES: Seed[] = [
  { code: 'AED', title: 'BAE Dirhemi', symbol: 'د.إ', rate: 9.4 },
  { code: 'AFN', title: 'Afganistan Afganisi', symbol: '؋' },
  { code: 'ALL', title: 'Arnavut Leki', symbol: 'L' },
  { code: 'AMD', title: 'Ermeni Dramı', symbol: '֏' },
  { code: 'ANG', title: 'Hollanda Antilleri Guldeni', symbol: 'ƒ' },
  { code: 'AOA', title: 'Angola Kvanzası', symbol: 'Kz' },
  { code: 'ARS', title: 'Arjantin Pesosu', symbol: '$' },
  { code: 'AUD', title: 'Avustralya Doları', symbol: 'A$', rate: 22.5 },
  { code: 'AWG', title: 'Aruba Florini', symbol: 'ƒ' },
  { code: 'AZN', title: 'Azerbaycan Manatı', symbol: '₼', rate: 20.3 },
  { code: 'BAM', title: 'Bosna-Hersek Markı', symbol: 'KM' },
  { code: 'BBD', title: 'Barbados Doları', symbol: '$' },
  { code: 'BDT', title: 'Bangladeş Takası', symbol: '৳' },
  { code: 'BGN', title: 'Bulgar Levası', symbol: 'лв', rate: 19.0 },
  { code: 'BHD', title: 'Bahreyn Dinarı', symbol: '.د.ب', rate: 91.5 },
  { code: 'BIF', title: 'Burundi Frangı', symbol: 'FBu' },
  { code: 'BMD', title: 'Bermuda Doları', symbol: '$' },
  { code: 'BND', title: 'Brunei Doları', symbol: '$' },
  { code: 'BOB', title: 'Bolivya Bolivyanosu', symbol: 'Bs.' },
  { code: 'BRL', title: 'Brezilya Reali', symbol: 'R$', rate: 6.2 },
  { code: 'BSD', title: 'Bahama Doları', symbol: '$' },
  { code: 'BTN', title: 'Bhutan Ngultrumu', symbol: 'Nu.' },
  { code: 'BWP', title: 'Botsvana Pulası', symbol: 'P' },
  { code: 'BYN', title: 'Belarus Rublesi', symbol: 'Br' },
  { code: 'BZD', title: 'Belize Doları', symbol: '$' },
  { code: 'CAD', title: 'Kanada Doları', symbol: 'C$', rate: 25.0 },
  { code: 'CDF', title: 'Kongo Frangı', symbol: 'FC' },
  { code: 'CHF', title: 'İsviçre Frangı', symbol: 'CHF', rate: 39.5 },
  { code: 'CLP', title: 'Şili Pesosu', symbol: '$' },
  { code: 'CNY', title: 'Çin Yuanı', symbol: '¥', rate: 4.8 },
  { code: 'COP', title: 'Kolombiya Pesosu', symbol: '$' },
  { code: 'CRC', title: 'Kosta Rika Kolonu', symbol: '₡' },
  { code: 'CUP', title: 'Küba Pesosu', symbol: '$' },
  { code: 'CVE', title: 'Yeşil Burun Eskudosu', symbol: '$' },
  { code: 'CZK', title: 'Çek Korunası', symbol: 'Kč', rate: 1.48 },
  { code: 'DJF', title: 'Cibuti Frangı', symbol: 'Fdj' },
  { code: 'DKK', title: 'Danimarka Kronu', symbol: 'kr', rate: 5.0 },
  { code: 'DOP', title: 'Dominik Pesosu', symbol: '$' },
  { code: 'DZD', title: 'Cezayir Dinarı', symbol: 'د.ج' },
  { code: 'EGP', title: 'Mısır Lirası', symbol: 'E£', rate: 0.7 },
  { code: 'ERN', title: 'Eritre Nakfası', symbol: 'Nfk' },
  { code: 'ETB', title: 'Etiyopya Birri', symbol: 'Br' },
  { code: 'EUR', title: 'Euro', symbol: '€', rate: 37.2 },
  { code: 'FJD', title: 'Fiji Doları', symbol: '$' },
  { code: 'FKP', title: 'Falkland Adaları Sterlini', symbol: '£' },
  { code: 'GBP', title: 'İngiliz Sterlini', symbol: '£', rate: 44.0 },
  { code: 'GEL', title: 'Gürcistan Larisi', symbol: '₾', rate: 12.5 },
  { code: 'GHS', title: 'Gana Sedisi', symbol: '₵' },
  { code: 'GIP', title: 'Cebelitarık Sterlini', symbol: '£' },
  { code: 'GMD', title: 'Gambiya Dalasisi', symbol: 'D' },
  { code: 'GNF', title: 'Gine Frangı', symbol: 'FG' },
  { code: 'GTQ', title: 'Guatemala Ketzalı', symbol: 'Q' },
  { code: 'GYD', title: 'Guyana Doları', symbol: '$' },
  { code: 'HKD', title: 'Hong Kong Doları', symbol: 'HK$', rate: 4.4 },
  { code: 'HNL', title: 'Honduras Lempirası', symbol: 'L' },
  { code: 'HRK', title: 'Hırvat Kunası', symbol: 'kn' },
  { code: 'HTG', title: 'Haiti Gurdu', symbol: 'G' },
  { code: 'HUF', title: 'Macar Forinti', symbol: 'Ft', rate: 0.094 },
  { code: 'IDR', title: 'Endonezya Rupiahi', symbol: 'Rp' },
  { code: 'ILS', title: 'İsrail Şekeli', symbol: '₪', rate: 9.5 },
  { code: 'INR', title: 'Hint Rupisi', symbol: '₹', rate: 0.41 },
  { code: 'IQD', title: 'Irak Dinarı', symbol: 'ع.د' },
  { code: 'IRR', title: 'İran Riyali', symbol: '﷼' },
  { code: 'ISK', title: 'İzlanda Kronu', symbol: 'kr' },
  { code: 'JMD', title: 'Jamaika Doları', symbol: '$' },
  { code: 'JOD', title: 'Ürdün Dinarı', symbol: 'د.ا', rate: 48.6 },
  { code: 'JPY', title: 'Japon Yeni', symbol: '¥', rate: 0.23 },
  { code: 'KES', title: 'Kenya Şilini', symbol: 'KSh' },
  { code: 'KGS', title: 'Kırgızistan Somu', symbol: 'с' },
  { code: 'KHR', title: 'Kamboçya Rieli', symbol: '៛' },
  { code: 'KMF', title: 'Komor Frangı', symbol: 'CF' },
  { code: 'KPW', title: 'Kuzey Kore Wonu', symbol: '₩' },
  { code: 'KRW', title: 'Güney Kore Wonu', symbol: '₩', rate: 0.025 },
  { code: 'KWD', title: 'Kuveyt Dinarı', symbol: 'د.ك', rate: 112 },
  { code: 'KYD', title: 'Cayman Adaları Doları', symbol: '$' },
  { code: 'KZT', title: 'Kazakistan Tengesi', symbol: '₸' },
  { code: 'LAK', title: 'Laos Kipi', symbol: '₭' },
  { code: 'LBP', title: 'Lübnan Lirası', symbol: 'ل.ل' },
  { code: 'LKR', title: 'Sri Lanka Rupisi', symbol: 'Rs' },
  { code: 'LRD', title: 'Liberya Doları', symbol: '$' },
  { code: 'LSL', title: 'Lesotho Lotisi', symbol: 'L' },
  { code: 'LYD', title: 'Libya Dinarı', symbol: 'ل.د' },
  { code: 'MAD', title: 'Fas Dirhemi', symbol: 'د.م.', rate: 3.5 },
  { code: 'MDL', title: 'Moldova Leyi', symbol: 'L' },
  { code: 'MGA', title: 'Madagaskar Ariarisi', symbol: 'Ar' },
  { code: 'MKD', title: 'Makedonya Dinarı', symbol: 'ден' },
  { code: 'MMK', title: 'Myanmar Kyatı', symbol: 'K' },
  { code: 'MNT', title: 'Moğolistan Tugriki', symbol: '₮' },
  { code: 'MOP', title: 'Makao Patakası', symbol: 'MOP$' },
  { code: 'MRU', title: 'Moritanya Ouguiyası', symbol: 'UM' },
  { code: 'MUR', title: 'Mauritius Rupisi', symbol: '₨' },
  { code: 'MVR', title: 'Maldiv Rufiyaası', symbol: 'Rf' },
  { code: 'MWK', title: 'Malavi Kvaçası', symbol: 'MK' },
  { code: 'MXN', title: 'Meksika Pesosu', symbol: '$', rate: 1.7 },
  { code: 'MYR', title: 'Malezya Ringgiti', symbol: 'RM', rate: 7.8 },
  { code: 'MZN', title: 'Mozambik Metikali', symbol: 'MT' },
  { code: 'NAD', title: 'Namibya Doları', symbol: '$' },
  { code: 'NGN', title: 'Nijerya Nairası', symbol: '₦' },
  { code: 'NIO', title: 'Nikaragua Kordobası', symbol: 'C$' },
  { code: 'NOK', title: 'Norveç Kronu', symbol: 'kr', rate: 3.2 },
  { code: 'NPR', title: 'Nepal Rupisi', symbol: '₨' },
  { code: 'NZD', title: 'Yeni Zelanda Doları', symbol: 'NZ$', rate: 20.5 },
  { code: 'OMR', title: 'Umman Riyali', symbol: 'ر.ع.', rate: 89.5 },
  { code: 'PAB', title: 'Panama Balboası', symbol: 'B/.' },
  { code: 'PEN', title: 'Peru Solü', symbol: 'S/' },
  { code: 'PGK', title: 'Papua Yeni Gine Kinası', symbol: 'K' },
  { code: 'PHP', title: 'Filipin Pesosu', symbol: '₱' },
  { code: 'PKR', title: 'Pakistan Rupisi', symbol: '₨' },
  { code: 'PLN', title: 'Polonya Zlotisi', symbol: 'zł', rate: 8.6 },
  { code: 'PYG', title: 'Paraguay Guaranisi', symbol: '₲' },
  { code: 'QAR', title: 'Katar Riyali', symbol: 'ر.ق', rate: 9.5 },
  { code: 'RON', title: 'Romanya Leyi', symbol: 'lei', rate: 7.5 },
  { code: 'RSD', title: 'Sırp Dinarı', symbol: 'дин.' },
  { code: 'RUB', title: 'Rus Rublesi', symbol: '₽', rate: 0.36 },
  { code: 'RWF', title: 'Ruanda Frangı', symbol: 'FRw' },
  { code: 'SAR', title: 'Suudi Riyali', symbol: 'ر.س', rate: 9.2 },
  { code: 'SBD', title: 'Solomon Adaları Doları', symbol: '$' },
  { code: 'SCR', title: 'Seyşeller Rupisi', symbol: '₨' },
  { code: 'SDG', title: 'Sudan Sterlini', symbol: '£' },
  { code: 'SEK', title: 'İsveç Kronu', symbol: 'kr', rate: 3.3 },
  { code: 'SGD', title: 'Singapur Doları', symbol: 'S$', rate: 26.0 },
  { code: 'SHP', title: 'Saint Helena Sterlini', symbol: '£' },
  { code: 'SLE', title: 'Sierra Leone Leonesi', symbol: 'Le' },
  { code: 'SOS', title: 'Somali Şilini', symbol: 'Sh' },
  { code: 'SRD', title: 'Surinam Doları', symbol: '$' },
  { code: 'SSP', title: 'Güney Sudan Sterlini', symbol: '£' },
  { code: 'STN', title: 'Sao Tome ve Principe Dobrası', symbol: 'Db' },
  { code: 'SYP', title: 'Suriye Lirası', symbol: '£' },
  { code: 'SZL', title: 'Esvatini Lilangenisi', symbol: 'L' },
  { code: 'THB', title: 'Tayland Bahtı', symbol: '฿', rate: 1.0 },
  { code: 'TJS', title: 'Tacikistan Somonisi', symbol: 'ЅМ' },
  { code: 'TMT', title: 'Türkmenistan Manatı', symbol: 'm' },
  { code: 'TND', title: 'Tunus Dinarı', symbol: 'د.ت' },
  { code: 'TOP', title: 'Tonga Paʻangası', symbol: 'T$' },
  { code: 'TRY', title: 'Türk Lirası', symbol: '₺', rate: 1 },
  { code: 'TTD', title: 'Trinidad ve Tobago Doları', symbol: '$' },
  { code: 'TWD', title: 'Yeni Tayvan Doları', symbol: 'NT$', rate: 1.07 },
  { code: 'TZS', title: 'Tanzanya Şilini', symbol: 'TSh' },
  { code: 'UAH', title: 'Ukrayna Grivnası', symbol: '₴' },
  { code: 'UGX', title: 'Uganda Şilini', symbol: 'USh' },
  { code: 'USD', title: 'ABD Doları', symbol: '$', rate: 34.5 },
  { code: 'UYU', title: 'Uruguay Pesosu', symbol: '$' },
  { code: 'UZS', title: 'Özbekistan Somu', symbol: 'soʻm' },
  { code: 'VES', title: 'Venezuela Bolivarı', symbol: 'Bs.' },
  { code: 'VND', title: 'Vietnam Dongu', symbol: '₫' },
  { code: 'VUV', title: 'Vanuatu Vatusu', symbol: 'VT' },
  { code: 'WST', title: 'Samoa Talası', symbol: 'T' },
  { code: 'XAF', title: 'Orta Afrika CFA Frangı', symbol: 'FCFA' },
  { code: 'XCD', title: 'Doğu Karayip Doları', symbol: '$' },
  { code: 'XOF', title: 'Batı Afrika CFA Frangı', symbol: 'CFA' },
  { code: 'XPF', title: 'CFP Frangı', symbol: '₣' },
  { code: 'YER', title: 'Yemen Riyali', symbol: '﷼' },
  { code: 'ZAR', title: 'Güney Afrika Randı', symbol: 'R', rate: 1.9 },
  { code: 'ZMW', title: 'Zambiya Kvaçası', symbol: 'ZK' },
  { code: 'ZWL', title: 'Zimbabve Doları', symbol: '$' },
];

function buildCurrencies(): CurrencyDef[] {
  const byCode = new Map(WORLD_CURRENCIES.map((c) => [c.code, c]));
  const orderedCodes: string[] = [
    'TRY',
    ...FREQUENT_CURRENCY_CODES,
    ...WORLD_CURRENCIES.map((c) => c.code)
      .filter((code) => code !== 'TRY' && !(FREQUENT_CURRENCY_CODES as readonly string[]).includes(code))
      .sort((a, b) => a.localeCompare(b)),
  ];

  // Tekrarları temizle (TRY / frequent zaten listede)
  const seen = new Set<string>();
  const unique = orderedCodes.filter((code) => {
    if (seen.has(code) || !byCode.has(code)) return false;
    seen.add(code);
    return true;
  });

  return unique.map((code, index) => {
    const s = byCode.get(code)!;
    return {
      id: String(index + 1),
      code: s.code,
      title: s.title,
      symbol: s.symbol,
      isLocal: s.code === 'TRY',
      rate: s.rate ?? 1,
      isActive: true,
    };
  });
}

export const CURRENCIES: CurrencyDef[] = buildCurrencies();

export const LOCAL_CURRENCY_ID =
  CURRENCIES.find((c) => c.isLocal)?.id ?? '1';

export function getCurrency(id: string | number | null | undefined): CurrencyDef | undefined {
  if (id == null || id === '') return undefined;
  const key = String(id);
  return CURRENCIES.find((c) => c.id === key || c.code === key);
}

export function getCurrencyRate(id: string | number | null | undefined): number {
  const c = getCurrency(id);
  if (!c) return 1;
  return c.isLocal ? 1 : c.rate;
}

/** Seçim listesi: TRY → USD/EUR/GBP → diğerleri (A–Z) */
export function currencyOptions() {
  return CURRENCIES.filter((c) => c.isActive).map((c) => ({
    label: `${c.code} — ${c.title}`,
    value: c.id,
  }));
}

export function currencyOptionsJson(): string {
  return JSON.stringify(
    currencyOptions().map((o) => ({ label: o.label, value: String(o.value) })),
  );
}
