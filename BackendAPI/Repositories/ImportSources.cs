namespace BartuERP.Backend.Repositories;

/// <summary>Logo, Mikro, Netsis ve Eta Excel dışa aktarım başlıklarına göre hazır şablon.</summary>
public sealed class ImportSourceDef
{
    public string Id { get; init; } = "";
    public string Title { get; init; } = "";
    public string Note { get; init; } = "";
    /// <summary>kind → alan anahtarı → Excel kolon adı. Boşsa alanın kendi etiketi kullanılır.</summary>
    public Dictionary<string, Dictionary<string, string>> Headers { get; init; } = new(StringComparer.OrdinalIgnoreCase);
}

public static class ImportSources
{
    public static IReadOnlyList<ImportSourceDef> All { get; } = new List<ImportSourceDef>
    {
        new()
        {
            Id = "bartu",
            Title = "Kavi Soft",
            Note = "Kavi Soft kolon adları. Şablonu indirip aynı başlıklarla doldurun.",
        },
        new()
        {
            Id = "logo",
            Title = "Logo",
            Note = "Logo Tiger / Go Excel kolon adları. Fiş ve fatura tipi hücresine Kavi Soft adını da yazabilirsiniz (Alınan Hizmet, Virman Fişi, Gelen Havale).",
            Headers = new(StringComparer.OrdinalIgnoreCase)
            {
                ["product"] = Map(
                    ("Code", "Malzeme Kodu"), ("Title", "Malzeme Açıklaması"), ("ProductType", "CARDTYPE"),
                    ("DefaultUnitID", "Birim"),
                    ("U_MaterialKind", "Malzeme Türü"), ("U_UnitPrice", "Alış Fiyatı"), ("U_Description", "Açıklama"),
                    ("IsActive", "Durum"), ("UseInMaterial", "Malzeme"), ("UseInSales", "Satış ve Dağıtım"), ("UseInPurchase", "Satınalma")),
                ["customer"] = Map(
                    ("Code", "Cari Hesap Kodu"), ("Title", "Cari Hesap Unvanı"), ("Type_", "Cari Hesap Türü"),
                    ("TaxNr", "Vergi No"), ("TaxType", "Mükellef Tipi"), ("EinvoiceType", "e-Fatura"),
                    ("DefaultCurrency", "Döviz"), ("U_Phone", "Telefon 1"), ("U_Email", "E-posta Adresi"),
                    ("Addr_City", "Şehir"), ("Active", "Durum")),
                ["account"] = Map(
                    ("Title", "Hesap Açıklaması"), ("MainAccountCode", "Ana Hesap Kodu"), ("Type_", "Hesap Türü"),
                    ("IsActive", "Durum"), ("DefaultCurrency", "Döviz")),
                ["invoice"] = Map(
                    ("DocumentNumber", "Fatura Numarası"), ("InvoiceDate", "Tarih"), ("InvoiceType", "Fatura Tipi"),
                    ("CustomerCode", "Cari Hesap Kodu"), ("CustomerTitle", "Cari Hesap Unvanı"),
                    ("WhouseCode", "Ambar"), ("WorkplaceCode", "İşyeri"),
                    ("ProductCode", "Malzeme Kodu"), ("ProductTitle", "Malzeme Açıklaması"),
                    ("Discount", "İndirim"), ("TaxRate", "KDV"), ("TaxAmount", "KDV Tutarı"),
                    ("NetTotal", "Net Tutar"), ("LineDescription", "Satır Açıklaması")),
                ["customer-voucher"] = Map(
                    ("DocumentNumber", "Fiş No"), ("Type", "Fiş Türü"), ("CustomerCode", "Cari Hesap Kodu"),
                    ("LineDescription", "Satır Açıklaması")),
                ["bank-voucher"] = Map(
                    ("DocumentNumber", "Fiş No"), ("Type_", "Fiş Türü"), ("BankAccountCode", "Banka Hesap Kodu"),
                    ("CustomerCode", "Cari Hesap Kodu"), ("CounterAccountCode", "Karşı Hesap Kodu"),
                    ("LineDescription", "Satır Açıklaması")),
                ["account-voucher"] = Map(
                    ("VoucherDate", "Tarih"), ("Type", "Fiş Türü"), ("journalNO", "Yevmiye Madde No"),
                    ("AccountCode", "Muhasebe Kodu"), ("LineDescription", "Satır Açıklaması")),
            },
        },
        new()
        {
            Id = "mikro",
            Title = "Mikro",
            Note = "Mikro Jump / Fly Excel kolon adları. Evrak tipi hücresine Satış Faturası, Alış Faturası, Virman, Gelen Havale yazılabilir.",
            Headers = new(StringComparer.OrdinalIgnoreCase)
            {
                ["product"] = Map(
                    ("Code", "Stok Kodu"), ("Title", "Stok İsmi"), ("DefaultUnitID", "Birim"),
                    ("U_MaterialKind", "Stok Cinsi"), ("U_UnitPrice", "Fiyat"), ("IsActive", "Durum")),
                ["customer"] = Map(
                    ("Code", "Cari Kodu"), ("Title", "Cari Ünvanı"), ("Type_", "Cari Tipi"),
                    ("TaxNr", "Vergi No"), ("U_Phone", "Telefon 1"), ("U_Email", "E-posta Adresi"),
                    ("Active", "Durum")),
                ["account"] = Map(
                    ("Title", "Hesap İsmi"), ("MainAccountCode", "Ana Hesap"), ("Type_", "Hesap Tipi"),
                    ("IsActive", "Durum")),
                ["invoice"] = Map(
                    ("DocumentNumber", "Evrak No"), ("InvoiceDate", "Tarih"), ("InvoiceType", "Evrak Tipi"),
                    ("Description", "Evrak Açıklaması"), ("CustomerTitle", "Cari Ünvanı"),
                    ("WhouseCode", "Depo"), ("WorkplaceCode", "İşyeri"),
                    ("ProductCode", "Stok Kodu"), ("ProductTitle", "Stok İsmi"),
                    ("TaxRate", "Vergi Yüzdesi"), ("TaxAmount", "Vergi Tutarı"),
                    ("NetTotal", "Net Tutar"), ("LineDescription", "Satır Açıklaması")),
                ["customer-voucher"] = Map(
                    ("DocumentNumber", "Evrak No"), ("Type", "Evrak Tipi"), ("Description", "Evrak Açıklaması"),
                    ("LineDescription", "Satır Açıklaması")),
                ["bank-voucher"] = Map(
                    ("DocumentNumber", "Evrak No"), ("Type_", "Evrak Tipi"), ("BankAccountCode", "Banka Kodu"),
                    ("Description", "Evrak Açıklaması"), ("CounterAccountCode", "Karşı Banka"),
                    ("LineDescription", "Satır Açıklaması")),
                ["account-voucher"] = Map(
                    ("DocumentNumber", "Evrak No"), ("VoucherDate", "Tarih"), ("Type", "Evrak Tipi"),
                    ("Description", "Evrak Açıklaması"), ("LineDescription", "Satır Açıklaması")),
            },
        },
        new()
        {
            Id = "netsis",
            Title = "Netsis",
            Note = "Netsis Excel kolon adları. Fatura tipi: Satış Faturası, Alış Faturası, Alınan Hizmet Faturası.",
            Headers = new(StringComparer.OrdinalIgnoreCase)
            {
                ["product"] = Map(
                    ("Code", "Stok Kodu"), ("Title", "Stok Adı"), ("DefaultUnitID", "Ölçü Birimi"),
                    ("U_UnitPrice", "Satış Fiyatı"), ("IsActive", "Durum")),
                ["customer"] = Map(
                    ("Title", "Cari İsim"), ("Type_", "Cari Tip"), ("TaxNr", "Vergi Numarası"),
                    ("U_Phone", "Telefon"), ("Active", "Durum")),
                ["account"] = Map(
                    ("Title", "Hesap Adı"), ("MainAccountCode", "Üst Hesap"), ("Type_", "Hesap Tipi")),
                ["invoice"] = Map(
                    ("InvoiceDate", "Tarih"), ("InvoiceType", "Fatura Tipi"),
                    ("WhouseCode", "Depo Kodu"), ("WorkplaceCode", "İşyeri"),
                    ("CustomerTitle", "Cari İsim"), ("ProductTitle", "Stok Adı"),
                    ("ProductCode", "Stok Kodu"), ("Price", "Fiyat"), ("TaxRate", "KDV Oranı"),
                    ("NetTotal", "Net Tutar")),
                ["customer-voucher"] = Map(
                    ("DocumentNumber", "Belge No"), ("Type", "Fiş Tipi"), ("Description", "Açıklama")),
                ["bank-voucher"] = Map(
                    ("DocumentNumber", "Belge No"), ("Type_", "Fiş Tipi"), ("BankAccountCode", "Banka Kodu"),
                    ("CounterAccountCode", "Karşı Banka Kodu")),
                ["account-voucher"] = Map(
                    ("DocumentNumber", "Fiş No"), ("VoucherDate", "Tarih"), ("Type", "Fiş Tipi"),
                    ("AccountCode", "Muhasebe Kodu")),
            },
        },
        new()
        {
            Id = "eta",
            Title = "Eta",
            Note = "Eta Excel kolon adları. Fiş tipi hücresi Mahsup, Tahsil, Tediye, Virman veya Gelen Havale olabilir.",
            Headers = new(StringComparer.OrdinalIgnoreCase)
            {
                ["product"] = Map(
                    ("Code", "Stok Kodu"), ("Title", "Stok Adı"), ("DefaultUnitID", "Birim"),
                    ("U_UnitPrice", "Fiyat"), ("IsActive", "Durum")),
                ["customer"] = Map(
                    ("Title", "Cari Adı"), ("Type_", "Cari Tipi"), ("TaxNr", "Vergi No"),
                    ("U_Phone", "Telefon"), ("Active", "Durum")),
                ["account"] = Map(
                    ("Title", "Hesap Adı"), ("Type_", "Hesap Tipi"), ("MainAccountCode", "Üst Hesap Kodu")),
                ["invoice"] = Map(
                    ("InvoiceDate", "Tarih"), ("InvoiceType", "Fatura Tipi"),
                    ("WhouseCode", "Depo"), ("WorkplaceCode", "İşyeri"),
                    ("CustomerTitle", "Cari Adı"), ("ProductTitle", "Stok Adı"),
                    ("ProductCode", "Stok Kodu"), ("Price", "Fiyat"), ("TaxRate", "KDV Oranı"),
                    ("NetTotal", "Net Tutar")),
                ["customer-voucher"] = Map(
                    ("DocumentNumber", "Fiş No"), ("VoucherDate", "Tarih"), ("Type", "Fiş Tipi")),
                ["bank-voucher"] = Map(
                    ("DocumentNumber", "Fiş No"), ("Type_", "Fiş Tipi"), ("BankAccountCode", "Banka Hesabı"),
                    ("CounterAccountCode", "Karşı Hesap")),
                ["account-voucher"] = Map(
                    ("DocumentNumber", "Fiş No"), ("VoucherDate", "Tarih"), ("Type", "Fiş Tipi"),
                    ("journalNO", "Yevmiye No")),
            },
        },
    };

    public static ImportSourceDef? Find(string? id) =>
        string.IsNullOrWhiteSpace(id)
            ? All[0]
            : All.FirstOrDefault(s => s.Id.Equals(id.Trim(), StringComparison.OrdinalIgnoreCase));

    public static string Header(ImportSourceDef? source, string kind, ImportFieldDef field)
    {
        if (source != null
            && source.Headers.TryGetValue(kind, out var map)
            && map.TryGetValue(field.Key, out var header)
            && !string.IsNullOrWhiteSpace(header))
            return header;
        return field.Label;
    }

    private static Dictionary<string, string> Map(params (string Key, string Header)[] pairs)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, header) in pairs) map[key] = header;
        return map;
    }
}
