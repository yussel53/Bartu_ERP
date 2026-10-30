using System.Data;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class ImportFieldDef
{
    public string Key { get; init; } = "";
    public string Label { get; init; } = "";
    public bool Required { get; init; }
    /** text | bool | int | decimal | enum */
    public string Type { get; init; } = "text";
    public Dictionary<string, string>? Options { get; init; }
    public string[] Aliases { get; init; } = Array.Empty<string>();
    public string? Hint { get; init; }
    public string? Sample { get; init; }
    /** U_ kolonuna yazılır. JSON alanı kullanılmaz. */
    public bool Additional { get; init; }
    /** Kolon değil — import mantığı ayrıca işler (üst hesap kodu, barkod, adres) */
    public bool Special { get; init; }
    /** Şablon seçicisinde baştan işaretli. Zorunlu alanlar her zaman gelir. */
    public bool DefaultOn { get; init; } = true;
}

public sealed class ImportTargetDef
{
    public string Kind { get; init; } = "";
    public string Title { get; init; } = "";
    public string TableName { get; init; } = "";
    public string PrimaryKey { get; init; } = "";
    public List<string> Notes { get; init; } = new();
    public List<ImportFieldDef> Fields { get; init; } = new();
}

public sealed class ImportApplyRequest
{
    public List<Dictionary<string, string?>> Rows { get; set; } = new();
    /** upsert | insert | update */
    public string Mode { get; set; } = "upsert";
    public bool DryRun { get; set; }
    /** Malzeme: 1 Malzeme, 2 Verilen hizmet, 3 Alınan hizmet */
    public int? ProductType { get; set; }
    /** Hesap: noktasız kodda üst hesap = en uzun önek kod (1 ← 10 ← 100) */
    public bool AccountPrefixParent { get; set; } = true;
    /** Fiş aktarımı: bulunamayan cari, malzeme, hesap ve banka hesabını aç */
    public bool CreateMissingCards { get; set; }
    public string? FileName { get; set; }
    public string? ImportedBy { get; set; }
    /** Başarılı kayıttan sonra kaynakta çalışacak UPDATE */
    public string? AfterSql { get; set; }
    public ProcessSourceRequest? Source { get; set; }
    /** Kaynak kolon değerleri. __row ile aktarım satırına bağlanır. */
    public List<Dictionary<string, string?>>? SourceRows { get; set; }
    /** false ise SYS_ImportLog yazılmaz. */
    public bool WriteLog { get; set; } = true;
    public int? ProfileId { get; set; }
}

public sealed class ImportRowResult
{
    public int RowNo { get; set; }
    public string Code { get; set; } = "";
    /** insert | update | skip | error */
    public string Action { get; set; } = "";
    public string? Message { get; set; }
    public int? RecordId { get; set; }
    /** Fişte birleşen kaynak satırları. Boşsa yalnız RowNo. */
    public List<int>? LineNos { get; set; }
}

public sealed class ImportApplyResult
{
    public bool DryRun { get; set; }
    public int Total { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public int Failed { get; set; }
    /** Ayrıntı listesi kısaltıldı; sayılar tamdır */
    public bool RowsTruncated { get; set; }
    public int AfterUpdated { get; set; }
    public int AfterFailed { get; set; }
    public string? AfterError { get; set; }
    public List<ImportRowResult> Rows { get; set; } = new();
}

public sealed partial class ImportRepository
{
    private const string RowNoKey = "__row";
    private static readonly System.Text.RegularExpressions.Regex ExtraKey =
        new(@"^[A-Za-z_][A-Za-z0-9_]{0,80}$", System.Text.RegularExpressions.RegexOptions.Compiled);

    private readonly IDbConnection _db;
    private readonly RecordsRepository _records;

    public ImportRepository(IDbConnection db, RecordsRepository records)
    {
        _db = db;
        _records = records;
    }

    // ── Hedef tanımları ─────────────────────────────────────────────────────

    private static readonly Dictionary<string, string> BoolOptions = new()
    {
        ["Evet"] = "1",
        ["Hayır"] = "0",
    };

    private static readonly Dictionary<string, string> UnitOptions = new()
    {
        ["Adet"] = "1", ["Koli"] = "2", ["Paket"] = "3", ["Kg"] = "4",
        ["Litre"] = "5", ["Metre"] = "6", ["Saat"] = "7", ["Gün"] = "8",
    };

    public static IReadOnlyList<ImportTargetDef> Targets { get; } = new List<ImportTargetDef>
    {
        new()
        {
            Kind = "product",
            Title = "Malzeme / Hizmet Kartları",
            TableName = "ProductCard",
            PrimaryKey = "ProductCardID",
            Notes =
            {
                "Kod eşleşirse kart güncellenir, yoksa yeni kart açılır.",
                "Kart tipi (ProductType) kaynak kolondan gelir: 1 Malzeme, 2 Verilen Hizmet, 3 Alınan Hizmet. Logo CARDTYPE bağlanabilir.",
                "Barkod yalnızca kartta hiç barkod yoksa eklenir.",
            },
            Fields =
            {
                new() { Key = "Code", Label = "Kod", Required = true, Sample = "MLZ-0001",
                        Aliases = new[] { "malzeme kodu", "hizmet kodu", "stok kodu", "kod", "code" } },
                new() { Key = "Title", Label = "Ad", Required = true, Sample = "Örnek Malzeme",
                        Aliases = new[] { "malzeme adi", "hizmet adi", "stok adi", "aciklama", "description", "ad", "adi", "title", "name" } },
                new() { Key = "ProductType", Label = "Kart Tipi", Type = "enum", Sample = "1",
                        Options = new()
                        {
                            ["1"] = "1", ["Malzeme"] = "1", ["Ticari Mal"] = "1", ["Stok"] = "1",
                            ["2"] = "2", ["Verilen Hizmet"] = "2", ["Satış Hizmet"] = "2", ["Satis Hizmet"] = "2",
                            ["3"] = "3", ["Alınan Hizmet"] = "3", ["Alim Hizmet"] = "3", ["Alış Hizmet"] = "3",
                        },
                        Aliases = new[] { "cardtype", "card type", "kart tipi", "producttype", "product type", "tip", "malzeme tipi" },
                        Hint = "1 Malzeme · 2 Verilen Hizmet · 3 Alınan Hizmet. Boşsa varsayılan tip kullanılır." },
                new() { Key = "DefaultUnitID", Label = "Ana Birim", Type = "enum", Options = UnitOptions, Sample = "Adet",
                        Aliases = new[] { "birim", "ana birim", "unit" }, Hint = "Birim kartındaki kod, ad veya global kod. UnitID olarak bağlanır. Boşsa Adet" },
                new() { Key = "U_MaterialKind", Label = "Malzeme Sınıfı", Type = "enum", Additional = true, Sample = "Ticari Mal",
                        Options = new() { ["Ticari Mal"] = "ticari", ["Ticari"] = "ticari", ["Hammadde"] = "hammadde", ["Yarı Mamul"] = "yari" },
                        Aliases = new[] { "malzeme sinifi", "sinif", "tur" } },
                new() { Key = "U_UnitPrice", Label = "Birim Fiyat", Type = "decimal", Additional = true, Sample = "125,50",
                        Aliases = new[] { "birim fiyat", "fiyat", "price" } },
                new() { Key = "U_Description", Label = "Açıklama", Additional = true,
                        Aliases = new[] { "not", "aciklama 2", "description" } },
                new() { Key = "Barcode", Label = "Barkod", Special = true, Sample = "8690000000001",
                        Aliases = new[] { "barkod", "barcode", "ean" } },
                new() { Key = "IsActive", Label = "Aktif", Type = "bool", Options = BoolOptions, Sample = "Evet",
                        Aliases = new[] { "aktif", "durum", "active" }, Hint = "Boşsa Evet" },
                new() { Key = "UseInMaterial", Label = "Malzeme Yönetimi", Type = "bool", Options = BoolOptions,
                        Aliases = new[] { "malzeme yonetimi" } },
                new() { Key = "UseInSales", Label = "Satış", Type = "bool", Options = BoolOptions,
                        Aliases = new[] { "satis", "satis ve dagitim" } },
                new() { Key = "UseInPurchase", Label = "Satınalma", Type = "bool", Options = BoolOptions,
                        Aliases = new[] { "satinalma", "satin alma" } },
            },
        },
        new()
        {
            Kind = "customer",
            Title = "Cari Kartlar",
            TableName = "CustomerCard",
            PrimaryKey = "CustomerCardID",
            Notes =
            {
                "Kod eşleşirse cari güncellenir, yoksa yeni cari + Merkez adres açılır.",
                "Vergi tipi boşsa VKN 10 hane → Tüzel, TCKN 11 hane → Gerçek.",
                "Mevcut caride adres ve yetkili yalnızca hiç yoksa eklenir.",
                "Şablon alanlarından istediğiniz kolonları seçin. Zorunlu kolonlar her şablonda durur.",
            },
            Fields =
            {
                new() { Key = "Code", Label = "Cari Kodu", Required = true, Sample = "120.01.001",
                        Aliases = new[] { "cari kodu", "cari kod", "kod", "code" } },
                new() { Key = "Title", Label = "Ünvan", Required = true, Sample = "Örnek Ticaret Ltd. Şti.",
                        Aliases = new[] { "unvan", "cari unvani", "cari adi", "firma adi", "description", "aciklama", "ad", "adi", "title", "name" } },
                new() { Key = "Type_", Label = "Cari Tür", Type = "enum", Sample = "Alıcı / Satıcı",
                        Options = new() { ["Alıcı"] = "1", ["Müşteri"] = "1", ["Satıcı"] = "2", ["Tedarikçi"] = "2",
                                          ["Alıcı / Satıcı"] = "3", ["Alıcı Satıcı"] = "3", ["Her İkisi"] = "3" },
                        Aliases = new[] { "cari tur", "cari tipi", "tur", "tip" }, Hint = "Boşsa Alıcı / Satıcı" },
                new() { Key = "TaxNr", Label = "Vergi No / TCKN", Sample = "1234567890",
                        Aliases = new[] { "vergi no", "vkn", "tckn", "vergi numarasi", "vergi tckn", "tax nr" } },
                new() { Key = "TaxOffice", Label = "Vergi Dairesi", Sample = "Kadıköy",
                        Aliases = new[] { "vergi dairesi", "vd" } },
                new() { Key = "TaxType", Label = "Vergi Tipi", Type = "enum",
                        Options = new() { ["Tüzel"] = "1", ["Gerçek"] = "2", ["Şahıs"] = "2" },
                        Aliases = new[] { "vergi tipi", "mukellef tipi" } },
                new() { Key = "EinvoiceType", Label = "e-Fatura Tipi", Type = "enum",
                        Options = new() { ["Yok"] = "0", ["e-Fatura"] = "1", ["e-Arşiv"] = "2" },
                        Aliases = new[] { "e fatura tipi", "efatura", "e fatura" } },
                new() { Key = "DefaultCurrency", Label = "Döviz (ID)", Type = "int",
                        Aliases = new[] { "doviz", "para birimi", "currency" } },
                new() { Key = "U_Phone", Label = "Telefon", Additional = true, Sample = "0216 000 00 00",
                        Aliases = new[] { "telefon", "tel", "gsm", "phone" } },
                new() { Key = "U_Email", Label = "E-posta", Additional = true,
                        Aliases = new[] { "e posta", "eposta", "email", "mail" } },
                new() { Key = "Addr_Country", Label = "Ülke", Special = true, Aliases = new[] { "ulke", "country" }, Hint = "Boşsa Türkiye" },
                new() { Key = "Addr_City", Label = "İl", Special = true, Sample = "İstanbul", Aliases = new[] { "il", "sehir", "city" } },
                new() { Key = "Addr_Town", Label = "İlçe", Special = true, Sample = "Kadıköy", Aliases = new[] { "ilce", "town" } },
                new() { Key = "Addr_District", Label = "Mahalle", Special = true, Aliases = new[] { "mahalle", "semt" } },
                new() { Key = "Addr_Address", Label = "Adres", Special = true, Aliases = new[] { "adres", "acik adres", "address" } },
                new() { Key = "Addr_Type", Label = "Adres Tipi", Type = "enum", Special = true, DefaultOn = false, Sample = "Merkez",
                        Options = new() { ["Merkez"] = "1", ["Sevkiyat"] = "2", ["Sevkiyat Adresi"] = "2", ["Fatura"] = "3", ["Fatura Adresi"] = "3", ["Diğer"] = "4" },
                        Aliases = new[] { "adres tipi", "adres turu" }, Hint = "Boşsa Merkez" },
                new() { Key = "Addr_Name", Label = "Adres Adı", Special = true, DefaultOn = false, Sample = "Merkez", Aliases = new[] { "adres adi" } },
                new() { Key = "Addr_Code", Label = "Adres Kodu", Special = true, DefaultOn = false, Aliases = new[] { "adres kodu" } },
                new() { Key = "Addr_PostLabel", Label = "e-Fatura Gelen (PK)", Special = true, DefaultOn = false, Aliases = new[] { "pk", "posta kutusu" } },
                new() { Key = "Addr_SenderLabel", Label = "e-Fatura Giden (GB)", Special = true, DefaultOn = false, Aliases = new[] { "gb", "gonderici birim" } },
                new() { Key = "Addr_EinvoiceEmail", Label = "e-Fatura E-posta", Special = true, DefaultOn = false },
                new() { Key = "Addr_TaxOffice", Label = "Adres Vergi Dairesi", Special = true, DefaultOn = false },
                new() { Key = "Contact_Name", Label = "Yetkili Ad Soyad", Special = true, DefaultOn = false, Sample = "Ayşe Yılmaz" },
                new() { Key = "Contact_Title", Label = "Yetkili Ünvan", Special = true, DefaultOn = false, Sample = "Muhasebe" },
                new() { Key = "Contact_Phone", Label = "Yetkili Telefon", Special = true, DefaultOn = false },
                new() { Key = "Contact_Email", Label = "Yetkili E-posta", Special = true, DefaultOn = false },
                new() { Key = "RiskLimit", Label = "Risk Limiti", Type = "decimal", DefaultOn = false, Sample = "100000" },
                new() { Key = "Active", Label = "Aktif", Type = "bool", Options = BoolOptions,
                        Aliases = new[] { "aktif", "durum", "active" }, Hint = "Boşsa Evet" },
                new() { Key = "SalesModuleCheck", Label = "Satış", Type = "bool", Options = BoolOptions, Aliases = new[] { "satis" } },
                new() { Key = "PurchaseModuleCheck", Label = "Satınalma", Type = "bool", Options = BoolOptions, Aliases = new[] { "satinalma" } },
                new() { Key = "FinanceModuleCheck", Label = "Finans", Type = "bool", Options = BoolOptions, Aliases = new[] { "finans" } },
            },
        },
        new()
        {
            Kind = "account",
            Title = "Muhasebe Hesap Kodları",
            TableName = "AccountCard",
            PrimaryKey = "AccountCardID",
            Notes =
            {
                "Satırlar koddaki seviyeye göre sıralanır; önce üst hesaplar kaydedilir.",
                "Kodda nokta varsa üst hesap zorunlu (120.01 → 120); üst yoksa satır hata alır.",
                "Noktasız kodlarda Üst Hesap Kodu kolonu veya önek kuralı kullanılır (1 ← 10 ← 100).",
                "Hesap tipi boşsa: altı olan hesap Ana, diğerleri Detay.",
            },
            Fields =
            {
                new() { Key = "Code", Label = "Hesap Kodu", Required = true, Sample = "100.01",
                        Aliases = new[] { "hesap kodu", "kod", "code" } },
                new() { Key = "Title", Label = "Hesap Adı", Required = true, Sample = "Merkez Kasa",
                        Aliases = new[] { "hesap adi", "aciklama", "description", "ad", "adi", "title", "name" } },
                new() { Key = "MainAccountCode", Label = "Üst Hesap Kodu", Special = true,
                        Aliases = new[] { "ust hesap kodu", "ust hesap", "ana hesap kodu", "parent" },
                        Hint = "Noktalı kodlarda dikkate alınmaz" },
                new() { Key = "Type_", Label = "Hesap Tipi", Type = "enum",
                        Options = new() { ["Ana Hesap"] = "1", ["Ana"] = "1", ["Detay Hesap"] = "2", ["Detay"] = "2", ["Muavin"] = "2" },
                        Aliases = new[] { "hesap tipi", "tip", "tur" } },
                new() { Key = "IsActive", Label = "Aktif", Type = "bool", Options = BoolOptions,
                        Aliases = new[] { "aktif", "durum", "active" }, Hint = "Boşsa Evet" },
                new() { Key = "DefaultCurrency", Label = "Döviz (ID)", Type = "int",
                        Aliases = new[] { "doviz", "para birimi", "currency" } },
                new() { Key = "DefaultRate", Label = "Kur", Type = "int", Aliases = new[] { "kur", "rate" } },
            },
        },
        InvoiceTarget(),
        CustomerVoucherTarget(),
        BankVoucherTarget(),
        AccountVoucherTarget(),
    };

    public static ImportTargetDef? GetTarget(string kind) =>
        Targets.FirstOrDefault(t => t.Kind.Equals(kind, StringComparison.OrdinalIgnoreCase));

    private static string? LineTable(string kind) => kind switch
    {
        "invoice" => "ProductTrans",
        "customer-voucher" => "CustomerTrans",
        "bank-voucher" => "BankTrans",
        "account-voucher" => "AccountTrans",
        _ => null,
    };

    /// <summary>Şablon alanları + hedefin yazılabilir kolonları + ek alanlar (U_).</summary>
    public async Task<List<ImportFieldDef>> CatalogAsync(string kind, CancellationToken ct = default)
    {
        var def = GetTarget(kind) ?? throw new InvalidOperationException($"Bilinmeyen içe aktarım türü: {kind}");
        if (_db.State != ConnectionState.Open) _db.Open();
        var list = def.Fields.ToList();
        var used = new HashSet<string>(list.Select(f => f.Key), StringComparer.OrdinalIgnoreCase);
        var labels = await ExtraLabelsAsync(ct);
        foreach (var col in await WritableColumnsAsync(def.TableName, ct))
            AddColumn(list, used, labels, def.TableName, col, line: false);
        var line = LineTable(def.Kind);
        if (line != null)
        {
            foreach (var col in await WritableColumnsAsync(line, ct))
                AddColumn(list, used, labels, line, col, line: true);
        }
        return list;
    }

    private async Task<Dictionary<string, string>> ExtraLabelsAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var exists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.SYS_ExtraFields', N'U')", cancellationToken: ct));
        if (exists is null) return map;
        var rows = await _db.QueryAsync<(string TableName, string FieldName, string Label)>(new CommandDefinition(
            "SELECT TableName, FieldName, Label FROM dbo.SYS_ExtraFields WHERE IsActive = 1",
            cancellationToken: ct));
        foreach (var r in rows)
        {
            if (string.IsNullOrWhiteSpace(r.FieldName) || string.IsNullOrWhiteSpace(r.Label)) continue;
            map[$"{r.TableName}.{r.FieldName}"] = r.Label.Trim();
        }
        return map;
    }

    private async Task<List<(string Name, string TypeName)>> WritableColumnsAsync(string table, CancellationToken ct)
    {
        var exists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(@t, N'U')", new { t = $"dbo.{table}" }, cancellationToken: ct));
        if (exists is null) return new();
        var rows = await _db.QueryAsync<(string Name, string TypeName)>(new CommandDefinition(
            @"SELECT c.name, ty.name
              FROM sys.columns c
              JOIN sys.types ty ON c.user_type_id = ty.user_type_id
              WHERE c.object_id = OBJECT_ID(@t)
                AND c.is_identity = 0
                AND c.is_computed = 0
                AND ty.name NOT IN (N'varbinary', N'image', N'xml', N'timestamp', N'rowversion', N'geography', N'hierarchyid', N'sql_variant')
              ORDER BY c.column_id",
            new { t = $"dbo.{table}" }, cancellationToken: ct));
        return rows.ToList();
    }

    private static void AddColumn(
        List<ImportFieldDef> list, HashSet<string> used, Dictionary<string, string> labels,
        string table, (string Name, string TypeName) col, bool line)
    {
        if (string.IsNullOrWhiteSpace(col.Name)) return;
        if (col.Name.Equals("AdditionalFields", StringComparison.OrdinalIgnoreCase)) return;
        var key = line ? "L_" + col.Name : col.Name;
        if (!used.Add(key)) return;
        if (line && used.Contains(col.Name)) return;
        labels.TryGetValue($"{table}.{col.Name}", out var extraLabel);
        var additional = col.Name.StartsWith("U_", StringComparison.OrdinalIgnoreCase);
        list.Add(new ImportFieldDef
        {
            Key = key,
            Label = line
                ? "Satır · " + (extraLabel ?? col.Name)
                : (extraLabel ?? col.Name),
            Type = col.TypeName.ToLowerInvariant() switch
            {
                "bit" => "bool",
                "tinyint" or "smallint" or "int" or "bigint" => "int",
                "decimal" or "numeric" or "float" or "real" or "money" or "smallmoney" => "decimal",
                "date" or "datetime" or "datetime2" or "smalldatetime" => "date",
                _ => "text",
            },
            Additional = additional,
            DefaultOn = false,
            Hint = line ? "Satır kolonu" : additional ? "Ek alan" : "Tablo kolonu",
        });
    }

    // ── Uygula / ön izleme ──────────────────────────────────────────────────

    private sealed class ParsedRow
    {
        public int RowNo;
        public string Code = "";
        public Dictionary<string, object?> Values = new(StringComparer.OrdinalIgnoreCase);
        public List<string> Errors = new();
        public List<string> Warnings = new();
    }

    private sealed class ExistingRow
    {
        public int Id;
        public int? ProductType;
    }

    public async Task<ImportApplyResult> ApplyAsync(string kind, ImportApplyRequest req, CancellationToken ct = default)
    {
        var def = GetTarget(kind) ?? throw new InvalidOperationException($"Bilinmeyen içe aktarım türü: {kind}");
        if (_db.State != ConnectionState.Open) _db.Open();

        if (def.Kind is "invoice" or "customer-voucher" or "bank-voucher" or "account-voucher")
        {
            var voucher = await ApplyVouchersAsync(def, req, ct);
            if (!req.DryRun) await WriteLogAsync(def, req, voucher, ct);
            return voucher;
        }

        var mode = (req.Mode ?? "upsert").Trim().ToLowerInvariant();
        var defaultProductType = req.ProductType is >= 1 and <= 3 ? req.ProductType.Value : 1;
        var result = new ImportApplyResult { DryRun = req.DryRun, Total = req.Rows.Count };

        var existing = await LoadExistingAsync(def, ct);
        var parsed = ParseRows(def, req.Rows);

        // Ad / ünvan / hesap adı boşsa açıklama, yetkili adı veya kod kullanılır.
        // Malzeme, cari ve hesap aktarımında aynı kural geçerlidir.
        foreach (var r in parsed)
        {
            if (HasText(r, "Title")) continue;
            foreach (var key in new[] { "U_Description", "Description", "Contact_Name" })
            {
                if (!HasText(r, key)) continue;
                r.Values["Title"] = r.Values[key]?.ToString()?.Trim();
                break;
            }
            if (!HasText(r, "Title") && r.Code.Length > 0)
                r.Values["Title"] = r.Code;
        }

        if (def.Kind == "product")
            await ResolveProductUnitsAsync(parsed, req.DryRun, ct);

        // Aynı kod kaynakta birden çok kez gelirse (ör. JOIN çoğaltması) ilk satır aktarılır, diğerleri atlanır
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var duplicates = new HashSet<ParsedRow>();
        foreach (var r in parsed)
        {
            if (r.Code.Length == 0) continue;
            if (!seen.Add(r.Code)) duplicates.Add(r);
        }

        if (def.Kind == "account")
            parsed = parsed.OrderBy(r => r.Code.Count(c => c == '.'))
                           .ThenBy(r => r.Code.Length)
                           .ThenBy(r => r.Code, StringComparer.Ordinal)
                           .ThenBy(r => r.RowNo)
                           .ToList();

        var allCodes = new HashSet<string>(existing.Keys, StringComparer.OrdinalIgnoreCase);
        foreach (var r in parsed) if (r.Errors.Count == 0 && r.Code.Length > 0) allCodes.Add(r.Code);
        var accountParents = def.Kind == "account"
            ? ComputeAccountParents(parsed, allCodes, req.AccountPrefixParent)
            : new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var hasChildren = new HashSet<string>(
            accountParents.Values.Where(v => !string.IsNullOrEmpty(v))!, StringComparer.OrdinalIgnoreCase);

        foreach (var row in parsed)
        {
            var res = new ImportRowResult { RowNo = row.RowNo, Code = row.Code };
            result.Rows.Add(res);

            if (duplicates.Contains(row))
            {
                res.Action = "skip";
                res.Message = "Kaynakta tekrar eden kod — ilk satır aktarıldı, bu satır atlandı";
                result.Skipped++;
                continue;
            }

            var found = existing.TryGetValue(row.Code, out var ex);
            if (row.Errors.Count == 0 && !found && !row.Values.ContainsKey("Title"))
                row.Errors.Add("Ad / ünvan zorunlu (yeni kayıt)");

            // Hesap: üst hesap yoksa alt hesap eklenmez (120.01 → 120 zorunlu)
            if (row.Errors.Count == 0
                && def.Kind == "account"
                && accountParents.TryGetValue(row.Code, out var needParent)
                && !string.IsNullOrEmpty(needParent)
                && !existing.ContainsKey(needParent!))
            {
                row.Errors.Add($"Üst hesap «{needParent}» yok — önce ana hesabı ekleyin");
            }

            if (row.Errors.Count > 0)
            {
                res.Action = "error";
                res.Message = string.Join("; ", row.Errors);
                result.Failed++;
                continue;
            }

            if (found && mode == "insert")
            {
                res.Action = "skip";
                res.Message = "Kod mevcut — atlandı";
                res.RecordId = ex!.Id;
                result.Skipped++;
                continue;
            }
            if (!found && mode == "update")
            {
                res.Action = "skip";
                res.Message = "Kod bulunamadı — atlandı";
                result.Skipped++;
                continue;
            }

            var warnings = new List<string>();
            warnings.AddRange(row.Warnings);
            var rowProductType = ResolveProductType(row, found ? ex : null, defaultProductType);
            var save = await BuildSaveRequestAsync(def, row, found ? ex!.Id : 0, rowProductType,
                accountParents, hasChildren, existing, warnings, req.DryRun, ct);

            res.Action = found ? "update" : "insert";
            res.RecordId = found ? ex!.Id : null;

            if (!req.DryRun)
            {
                var (ok, id, msg) = await _records.SaveAsync(def.TableName, def.PrimaryKey, save, ct);
                if (!ok)
                {
                    res.Action = "error";
                    res.Message = msg;
                    result.Failed++;
                    continue;
                }
                res.RecordId = id;
                if (!found) existing[row.Code] = new ExistingRow { Id = id, ProductType = def.Kind == "product" ? rowProductType : null };
                else if (def.Kind == "product" && existing.TryGetValue(row.Code, out var upd))
                    upd.ProductType = rowProductType;
                if (def.Kind == "product" && id > 0
                    && row.Values.TryGetValue("DefaultUnitID", out var linked)
                    && linked is int unitId)
                    await EnsureMainProductUnitAsync(id, unitId, ct);
            }
            else if (!found)
            {
                existing[row.Code] = new ExistingRow { Id = 0, ProductType = def.Kind == "product" ? rowProductType : null };
            }

            if (warnings.Count > 0) res.Message = string.Join("; ", warnings);
            if (found) result.Updated++; else result.Inserted++;
        }

        result.Rows = result.Rows.OrderBy(r => r.RowNo).ToList();

        if (!req.DryRun) await WriteLogAsync(def, req, result, ct);
        return result;
    }

    private static bool HasText(ParsedRow row, string key) =>
        row.Values.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v?.ToString());

    private static List<ParsedRow> ParseRows(ImportTargetDef def, List<Dictionary<string, string?>> rows)
    {
        var list = new List<ParsedRow>();
        var idx = 0;
        foreach (var raw in rows)
        {
            idx++;
            var row = new ParsedRow { RowNo = idx + 1 };
            if (raw.TryGetValue(RowNoKey, out var rn) && int.TryParse(rn, out var n)) row.RowNo = n;

            foreach (var f in def.Fields)
            {
                var text = raw.FirstOrDefault(kv => kv.Key.Equals(f.Key, StringComparison.OrdinalIgnoreCase)).Value?.Trim();
                if (string.IsNullOrEmpty(text))
                {
                    if (f.Required && f.Key != "Title") row.Errors.Add($"{f.Label} boş");
                    continue;
                }
                if (TryParseValue(f, text, out var value, out var err)) row.Values[f.Key] = value;
                else if (f.Key.Equals("DefaultUnitID", StringComparison.OrdinalIgnoreCase))
                    row.Values[f.Key] = text;
                else row.Errors.Add(err!);
            }

            var known = new HashSet<string>(def.Fields.Select(f => f.Key), StringComparer.OrdinalIgnoreCase) { RowNoKey };
            foreach (var kv in raw)
            {
                if (known.Contains(kv.Key) || string.IsNullOrWhiteSpace(kv.Value)) continue;
                if (!ExtraKey.IsMatch(kv.Key)) continue;
                row.Values[kv.Key] = kv.Value.Trim();
            }

            row.Code = row.Values.TryGetValue("Code", out var c) ? c?.ToString()?.Trim() ?? "" : "";
            if (row.Code.Length > 50) row.Errors.Add("Kod 50 karakterden uzun");
            list.Add(row);
        }
        return list;
    }

    private static Dictionary<string, string?> ComputeAccountParents(
        List<ParsedRow> rows, HashSet<string> allCodes, bool prefixRule)
    {
        var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
        {
            if (r.Errors.Count > 0 || r.Code.Length == 0) continue;
            var dot = r.Code.LastIndexOf('.');
            if (dot > 0)
            {
                map[r.Code] = r.Code[..dot];
                continue;
            }
            if (r.Values.TryGetValue("MainAccountCode", out var mc) && !string.IsNullOrWhiteSpace(mc?.ToString()))
            {
                map[r.Code] = mc!.ToString()!.Trim();
                continue;
            }
            if (prefixRule)
            {
                string? best = null;
                for (var len = r.Code.Length - 1; len >= 1; len--)
                {
                    var p = r.Code[..len];
                    if (allCodes.Contains(p)) { best = p; break; }
                }
                map[r.Code] = best;
            }
        }
        return map;
    }

    private async Task<RecordSaveRequest> BuildSaveRequestAsync(
        ImportTargetDef def,
        ParsedRow row,
        int recordId,
        int productType,
        Dictionary<string, string?> accountParents,
        HashSet<string> hasChildren,
        Dictionary<string, ExistingRow> existing,
        List<string> warnings,
        bool dryRun,
        CancellationToken ct)
    {
        var isNew = recordId == 0;
        var std = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var add = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        foreach (var f in def.Fields)
        {
            if (f.Special || !row.Values.TryGetValue(f.Key, out var v)) continue;
            if (f.Additional) add[f.Key] = v;
            else std[f.Key] = v;
        }
        var known = new HashSet<string>(def.Fields.Select(f => f.Key), StringComparer.OrdinalIgnoreCase);
        foreach (var kv in row.Values)
        {
            if (known.Contains(kv.Key) || kv.Key.StartsWith("L_", StringComparison.OrdinalIgnoreCase)) continue;
            if (kv.Key.StartsWith("U_", StringComparison.OrdinalIgnoreCase)) add[kv.Key] = kv.Value;
            else std[kv.Key] = kv.Value;
        }

        var save = new RecordSaveRequest { RecordId = recordId, StandardFields = std };

        if (!isNew)
        {
            var current = await LoadAdditionalAsync(def, recordId, ct);
            foreach (var kv in add) current[kv.Key] = kv.Value;
            add = current;
        }
        save.AdditionalFields = add;

        switch (def.Kind)
        {
            case "product":
                // Kaynakta Kart Tipi / CARDTYPE varsa o yazılır; yoksa yeni kartta varsayılan, güncellemede mevcut tip korunur
                if (row.Values.ContainsKey("ProductType"))
                    std["ProductType"] = productType;
                else if (isNew)
                    std["ProductType"] = productType;
                if (isNew)
                {
                    std.TryAdd("IsActive", true);
                    std.TryAdd("DefaultUnitID", 1);
                    var material = productType == 1;
                    std.TryAdd("UseInMaterial", material);
                    std.TryAdd("UseInSales", true);
                    std.TryAdd("UseInPurchase", true);
                }
                if (row.Values.TryGetValue("Barcode", out var bc) && bc?.ToString() is { Length: > 0 } barcode)
                {
                    var owner = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                        "SELECT TOP 1 ProductCardID FROM dbo.ProductBarcode WHERE Barcode = @barcode",
                        new { barcode }, cancellationToken: ct));
                    var ownCount = isNew ? 0 : await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                        "SELECT COUNT(1) FROM dbo.ProductBarcode WHERE ProductCardID = @id",
                        new { id = recordId }, cancellationToken: ct));
                    if (owner is > 0 && owner != recordId)
                        warnings.Add($"Barkod {barcode} başka kartta kayıtlı — eklenmedi");
                    else if (owner is null && ownCount == 0)
                        save.Barcodes = new List<Dictionary<string, object?>>
                        {
                            new()
                            {
                                ["Barcode"] = barcode,
                                ["LineNr"] = 1,
                                ["Type"] = 1,
                                ["UnitID"] = std.TryGetValue("DefaultUnitID", out var u) ? u : null,
                            },
                        };
                }
                break;

            case "customer":
                if (isNew)
                {
                    std.TryAdd("Active", true);
                    std.TryAdd("Type_", 3);
                    std.TryAdd("SalesModuleCheck", true);
                    std.TryAdd("PurchaseModuleCheck", true);
                    std.TryAdd("FinanceModuleCheck", true);
                }
                if (!std.ContainsKey("TaxType") && std.TryGetValue("TaxNr", out var tn))
                {
                    var digits = new string((tn?.ToString() ?? "").Where(char.IsDigit).ToArray());
                    if (digits.Length == 10) std["TaxType"] = 1;
                    else if (digits.Length == 11) std["TaxType"] = 2;
                }

                var hasAddr = def.Fields.Any(f => f.Key.StartsWith("Addr_") && row.Values.ContainsKey(f.Key));
                var addrCount = isNew ? 0 : await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                    "SELECT COUNT(1) FROM dbo.CustomerAdress WHERE CustomerCardID = @id",
                    new { id = recordId }, cancellationToken: ct));
                if (isNew || (hasAddr && addrCount == 0))
                {
                    string? V(string k) => row.Values.TryGetValue(k, out var o) && o != null && o.ToString()!.Length > 0 ? o.ToString() : null;
                    var addr = new Dictionary<string, object?>
                    {
                        ["AdressType"] = row.Values.TryGetValue("Addr_Type", out var at) && at != null ? at : 1,
                        ["IsDefault"] = true,
                        ["Active"] = true,
                        ["Title"] = V("Addr_Name") ?? "Merkez",
                        ["Country"] = V("Addr_Country") ?? "Türkiye",
                        ["City"] = V("Addr_City"),
                        ["Town"] = V("Addr_Town"),
                        ["Dictrict"] = V("Addr_District"),
                        ["Adress"] = V("Addr_Address"),
                        ["TaxNr"] = std.TryGetValue("TaxNr", out var t) ? t : null,
                    };
                    if (V("Addr_Code") is string ac) addr["AdressCode"] = ac;
                    if (V("Addr_PostLabel") is string pk) addr["PostLabel"] = pk;
                    if (V("Addr_SenderLabel") is string gb) addr["SenderLabel"] = gb;
                    if (V("Addr_EinvoiceEmail") is string em) addr["EinvoiceEmailAdress"] = em;
                    if (V("Addr_TaxOffice") is string vo) addr["TaxOffice"] = vo;
                    save.Addresses = new List<Dictionary<string, object?>> { addr };
                }
                else if (hasAddr)
                {
                    warnings.Add("Caride adres var — adres güncellenmedi");
                }

                var contactName = row.Values.TryGetValue("Contact_Name", out var cn) ? cn?.ToString()?.Trim() : null;
                if (!string.IsNullOrWhiteSpace(contactName))
                {
                    var contactCount = isNew ? 0 : await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                        "SELECT COUNT(1) FROM dbo.CustomerContact WHERE CustomerCardID = @id",
                        new { id = recordId }, cancellationToken: ct));
                    if (isNew || contactCount == 0)
                    {
                        string? C(string k) => row.Values.TryGetValue(k, out var o) && o != null && o.ToString()!.Length > 0 ? o.ToString() : null;
                        save.Contacts = new List<Dictionary<string, object?>>
                        {
                            new()
                            {
                                ["Name"] = contactName,
                                ["ContactTitle"] = C("Contact_Title"),
                                ["Phone"] = C("Contact_Phone"),
                                ["Email"] = C("Contact_Email"),
                                ["IsDefault"] = true,
                            },
                        };
                    }
                    else warnings.Add("Caride yetkili var — yetkili güncellenmedi");
                }
                break;

            case "account":
                if (isNew)
                {
                    std.TryAdd("IsActive", true);
                    if (!std.ContainsKey("Type_"))
                    {
                        var isParent = hasChildren.Contains(row.Code);
                        std["Type_"] = isParent ? 1 : 2;
                        std["MainAccount"] = isParent;
                    }
                }
                else if (hasChildren.Contains(row.Code) && !std.ContainsKey("Type_"))
                {
                    std["MainAccount"] = true;
                }

                if (accountParents.TryGetValue(row.Code, out var parentCode) && !string.IsNullOrEmpty(parentCode))
                {
                    // Üst yoksa satır zaten hata; burada yalnızca MainAccountID bağla
                    if (existing.TryGetValue(parentCode!, out var parentRow) && parentRow.Id > 0)
                        std["MainAccountID"] = parentRow.Id;
                    else if (!row.Code.Contains('.') && dryRun && existing.ContainsKey(parentCode!))
                        std["MainAccount"] = false; // dry-run: üst aynı dosyada, ID sonra gelir
                }
                break;
        }

        return save;
    }

    private async Task<Dictionary<string, ExistingRow>> LoadExistingAsync(ImportTargetDef def, CancellationToken ct)
    {
        var typeCol = def.Kind == "product" ? ", ProductType" : ", CAST(NULL AS INT) AS ProductType";
        var rows = await _db.QueryAsync<(int Id, string? Code, int? ProductType)>(new CommandDefinition(
            $"SELECT [{def.PrimaryKey}] AS Id, LTRIM(RTRIM(Code)) AS Code{typeCol} FROM dbo.[{def.TableName}] WHERE Code IS NOT NULL",
            cancellationToken: ct));
        var map = new Dictionary<string, ExistingRow>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
        {
            if (string.IsNullOrWhiteSpace(r.Code) || map.ContainsKey(r.Code)) continue;
            map[r.Code] = new ExistingRow { Id = r.Id, ProductType = r.ProductType };
        }
        return map;
    }

    private async Task<Dictionary<string, object?>> LoadAdditionalAsync(ImportTargetDef def, int id, CancellationToken ct)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var hasCol = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, 'AdditionalFields') IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + def.TableName }, cancellationToken: ct));
        if (hasCol == 0) return dict;

        var json = await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            $"SELECT AdditionalFields FROM dbo.[{def.TableName}] WHERE [{def.PrimaryKey}] = @id",
            new { id }, cancellationToken: ct));
        if (string.IsNullOrWhiteSpace(json)) return dict;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return dict;
            foreach (var p in doc.RootElement.EnumerateObject())
            {
                dict[p.Name] = p.Value.ValueKind switch
                {
                    JsonValueKind.String => p.Value.GetString(),
                    JsonValueKind.Number => p.Value.TryGetInt64(out var l) ? l : p.Value.GetDouble(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    _ => p.Value.GetRawText(),
                };
            }
        }
        catch (JsonException) { /* bozuk JSON — üzerine yaz */ }
        return dict;
    }

    private async Task WriteLogAsync(ImportTargetDef def, ImportApplyRequest req, ImportApplyResult res, CancellationToken ct)
    {
        var exists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.SYS_ImportLog', N'U')", cancellationToken: ct));
        if (exists is null || !req.WriteLog) return;

        var errors = res.Rows.Where(r => r.Action == "error").Take(500)
            .Select(r => new { r.RowNo, r.Code, r.Message });
        var hasProfile = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT COL_LENGTH(N'dbo.SYS_ImportLog', N'ImportProfileID')", cancellationToken: ct));
        var sql = hasProfile is > 0
            ? @"INSERT INTO dbo.SYS_ImportLog
                (Kind, TableName, FileName, Mode, TotalRows, Inserted, Updated, Skipped, Failed, ErrorsJson, ImportedBy, ImportedAt, ImportProfileID)
              VALUES (@Kind, @TableName, @FileName, @Mode, @Total, @Inserted, @Updated, @Skipped, @Failed, @ErrorsJson, @ImportedBy, SYSUTCDATETIME(), @ProfileId)"
            : @"INSERT INTO dbo.SYS_ImportLog
                (Kind, TableName, FileName, Mode, TotalRows, Inserted, Updated, Skipped, Failed, ErrorsJson, ImportedBy, ImportedAt)
              VALUES (@Kind, @TableName, @FileName, @Mode, @Total, @Inserted, @Updated, @Skipped, @Failed, @ErrorsJson, @ImportedBy, SYSUTCDATETIME())";
        await _db.ExecuteAsync(new CommandDefinition(sql, new
            {
                def.Kind,
                def.TableName,
                FileName = Trunc(req.FileName, 260),
                Mode = Trunc(req.Mode, 20),
                res.Total,
                res.Inserted,
                res.Updated,
                res.Skipped,
                res.Failed,
                ErrorsJson = JsonSerializer.Serialize(errors),
                ImportedBy = Trunc(req.ImportedBy, 100),
                req.ProfileId,
            },
            cancellationToken: ct));
    }

    private static string? Trunc(string? s, int max) =>
        s is null ? null : s.Length <= max ? s : s[..max];

    private static int ResolveProductType(ParsedRow row, ExistingRow? existing, int defaultType)
    {
        if (row.Values.TryGetValue("ProductType", out var raw) && raw != null)
        {
            if (raw is int i && i is >= 1 and <= 3) return i;
            if (int.TryParse(raw.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) && n is >= 1 and <= 3)
                return n;
        }
        if (existing?.ProductType is >= 1 and <= 3) return existing.ProductType.Value;
        return defaultType is >= 1 and <= 3 ? defaultType : 1;
    }

    // ── Birim: metin → UnitCard.UnitID ──────────────────────────────────────

    private static readonly Dictionary<string, string[]> UnitAliases = new(StringComparer.Ordinal)
    {
        ["adet"] = ["adet", "adt", "ea", "c62"],
        ["ad"] = ["adet", "adt", "ea"],
        ["ea"] = ["adet", "adt", "ea"],
        ["c62"] = ["adet", "adt", "ea"],
        ["koli"] = ["koli", "bx"],
        ["bx"] = ["koli", "bx"],
        ["paket"] = ["paket", "pkt", "pa"],
        ["pkt"] = ["paket", "pkt", "pa"],
        ["pa"] = ["paket", "pkt", "pa"],
        ["kg"] = ["kg", "kgm"],
        ["kilo"] = ["kg", "kgm"],
        ["kilogram"] = ["kg", "kgm"],
        ["kgm"] = ["kg", "kgm"],
        ["lt"] = ["lt", "litre", "ltr"],
        ["l"] = ["lt", "litre", "ltr"],
        ["litre"] = ["litre", "lt", "ltr"],
        ["ltr"] = ["litre", "lt", "ltr"],
        ["mt"] = ["mt", "metre", "mtr"],
        ["m"] = ["mt", "metre", "mtr"],
        ["metre"] = ["metre", "mt", "mtr"],
        ["mtr"] = ["metre", "mt", "mtr"],
        ["saat"] = ["saat", "hur"],
        ["hur"] = ["saat", "hur"],
        ["gun"] = ["gun", "day"],
        ["day"] = ["gun", "day"],
    };

    private sealed class UnitLookup
    {
        public Dictionary<string, int> ByKey { get; } = new(StringComparer.Ordinal);
        public Dictionary<int, string> TitleById { get; } = new();
        public bool TableExists { get; set; }

        public void Add(int id, string? code, string? title, string? globalCode)
        {
            if (id <= 0) return;
            if (!string.IsNullOrWhiteSpace(title)) TitleById[id] = title.Trim();
            void Put(string? raw)
            {
                if (string.IsNullOrWhiteSpace(raw)) return;
                var key = ImportRepository.Normalize(raw);
                if (key.Length > 0) ByKey.TryAdd(key, id);
            }
            Put(code);
            Put(title);
            Put(globalCode);
            Put(id.ToString(CultureInfo.InvariantCulture));
        }

        public int? Find(string raw)
        {
            var key = ImportRepository.Normalize(raw);
            if (key.Length == 0) return null;
            if (ByKey.TryGetValue(key, out var id)) return id;
            if (UnitAliases.TryGetValue(key, out var alts))
            {
                foreach (var alt in alts)
                    if (ByKey.TryGetValue(alt, out id)) return id;
            }
            return null;
        }
    }

    private async Task<UnitLookup> LoadUnitLookupAsync(CancellationToken ct)
    {
        var lookup = new UnitLookup();
        var exists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.UnitCard', N'U')", cancellationToken: ct));
        lookup.TableExists = exists is not null;
        if (!lookup.TableExists) return lookup;
        var rows = await _db.QueryAsync<(int UnitID, string? Code, string? Title, string? GlobalCode)>(new CommandDefinition(
            "SELECT UnitID, Code, Title, GlobalCode FROM dbo.UnitCard", cancellationToken: ct));
        foreach (var r in rows)
            lookup.Add(r.UnitID, r.Code, r.Title, r.GlobalCode);
        return lookup;
    }

    private async Task ResolveProductUnitsAsync(List<ParsedRow> rows, bool dryRun, CancellationToken ct)
    {
        var lookup = await LoadUnitLookupAsync(ct);
        foreach (var row in rows)
        {
            if (row.Errors.Count > 0) continue;
            string? text = null;
            int? id = null;
            if (row.Values.TryGetValue("DefaultUnitID", out var current) && current != null)
            {
                if (current is int n) id = n;
                else if (int.TryParse(current.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
                         && lookup.TitleById.ContainsKey(parsed))
                    id = parsed;
                else text = current.ToString()?.Trim();
            }
            if (id is null && row.Values.TryGetValue("MainUnitName", out var name) && name != null)
                text ??= name.ToString()?.Trim();
            if (id is > 0 && !lookup.TitleById.ContainsKey(id.Value))
                id = null;

            if (id is null && !string.IsNullOrWhiteSpace(text))
            {
                id = lookup.Find(text);
                if (id is null && lookup.TableExists)
                {
                    if (dryRun)
                        row.Warnings.Add($"Birim kartında yok — aktarımda açılacak: {text}");
                    else
                    {
                        id = await CreateUnitAsync(text, lookup, ct);
                        var title = lookup.TitleById.TryGetValue(id.Value, out var t) ? t : text;
                        row.Warnings.Add($"Birim kartı açıldı: {title}");
                    }
                }
                else if (id is null)
                {
                    row.Errors.Add($"Birim bulunamadı: {text}");
                    continue;
                }
            }

            if (id is > 0)
            {
                row.Values["DefaultUnitID"] = id.Value;
                if (lookup.TitleById.TryGetValue(id.Value, out var title))
                    row.Values["MainUnitName"] = title;
            }
        }
    }

    private async Task<int> CreateUnitAsync(string raw, UnitLookup lookup, CancellationToken ct)
    {
        var title = raw.Trim();
        if (title.Length > 80) title = title[..80];
        var code = new string(title.Where(char.IsLetterOrDigit).ToArray()).ToUpper(new CultureInfo("tr-TR"));
        if (code.Length == 0) code = "BIRIM";
        if (code.Length > 20) code = code[..20];
        var baseCode = code;
        for (var n = 2; n < 50; n++)
        {
            var taken = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.UnitCard WHERE Code = @c", new { c = code }, cancellationToken: ct));
            if (taken == 0) break;
            var suffix = n.ToString(CultureInfo.InvariantCulture);
            var room = Math.Max(1, 20 - suffix.Length);
            code = (baseCode.Length > room ? baseCode[..room] : baseCode) + suffix;
        }
        var id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.UnitCard (Code, Title, IsActive) VALUES (@c, @t, 1);
              SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new { c = code, t = title }, cancellationToken: ct));
        lookup.Add(id, code, title, null);
        return id;
    }

    private async Task EnsureMainProductUnitAsync(int productId, int unitId, CancellationToken ct)
    {
        if (productId <= 0 || unitId <= 0) return;
        var exists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.ProductUnit', N'U')", cancellationToken: ct));
        if (exists is null) return;
        var has = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.ProductUnit WHERE ProductCardID = @p AND UnitID = @u",
            new { p = productId, u = unitId }, cancellationToken: ct));
        if (has == 0)
        {
            var hasRatio = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductUnit', N'MainQty') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct));
            var sql = hasRatio == 1
                ? @"INSERT INTO dbo.ProductUnit (ProductCardID, UnitID, IsMain, LineNr, MainQty, UnitQty)
                    VALUES (@p, @u, 1, 1, 1, 1)"
                : @"INSERT INTO dbo.ProductUnit (ProductCardID, UnitID, IsMain, LineNr)
                    VALUES (@p, @u, 1, 1)";
            await _db.ExecuteAsync(new CommandDefinition(sql, new { p = productId, u = unitId }, cancellationToken: ct));
        }
        else
        {
            await _db.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.ProductUnit SET IsMain = 1 WHERE ProductCardID = @p AND UnitID = @u",
                new { p = productId, u = unitId }, cancellationToken: ct));
        }
        await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.ProductUnit SET IsMain = 0
              WHERE ProductCardID = @p AND UnitID <> @u AND ISNULL(IsMain, 0) = 1",
            new { p = productId, u = unitId }, cancellationToken: ct));
    }

    // ── Değer çevirme ───────────────────────────────────────────────────────

    public static string Normalize(string s)
    {
        var lower = s.Trim().ToLower(new CultureInfo("tr-TR"));
        var sb = new StringBuilder(lower.Length);
        foreach (var ch in lower)
        {
            var c = ch switch
            {
                'ı' => 'i', 'ş' => 's', 'ğ' => 'g', 'ü' => 'u', 'ö' => 'o', 'ç' => 'c', 'â' => 'a', 'î' => 'i', 'û' => 'u',
                _ => ch,
            };
            if (char.IsLetterOrDigit(c)) sb.Append(c);
        }
        return sb.ToString();
    }

    private static readonly HashSet<string> TrueWords = new() { "1", "true", "evet", "e", "x", "aktif", "yes", "y", "var" };
    private static readonly HashSet<string> FalseWords = new() { "0", "false", "hayir", "h", "pasif", "no", "n", "yok" };

    private static bool TryParseValue(ImportFieldDef f, string text, out object? value, out string? error)
    {
        value = null;
        error = null;
        switch (f.Type)
        {
            case "bool":
            {
                var n = Normalize(text);
                if (TrueWords.Contains(n)) { value = true; return true; }
                if (FalseWords.Contains(n)) { value = false; return true; }
                error = $"{f.Label}: '{text}' evet/hayır değil";
                return false;
            }
            case "int":
            {
                if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i)) { value = i; return true; }
                if (TryParseDecimal(text, out var d) && d == Math.Truncate(d)) { value = (int)d; return true; }
                error = $"{f.Label}: '{text}' sayı değil";
                return false;
            }
            case "decimal":
            {
                if (TryParseDecimal(text, out var d)) { value = d; return true; }
                error = $"{f.Label}: '{text}' sayı değil";
                return false;
            }
            case "date":
            {
                if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.None, out var tr)
                    || DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out tr))
                {
                    value = tr.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                    return true;
                }
                error = $"{f.Label}: '{text}' tarih değil";
                return false;
            }
            case "enum":
            {
                var opts = f.Options ?? new Dictionary<string, string>();
                var n = Normalize(text);
                foreach (var kv in opts)
                {
                    if (Normalize(kv.Key) == n || Normalize(kv.Value) == n)
                    {
                        value = int.TryParse(kv.Value, out var iv) ? iv : kv.Value;
                        return true;
                    }
                }
                var lead = new string(text.TakeWhile(char.IsDigit).ToArray());
                if (lead.Length > 0 && opts.Values.Contains(lead))
                {
                    value = int.Parse(lead, CultureInfo.InvariantCulture);
                    return true;
                }
                error = $"{f.Label}: '{text}' geçersiz ({string.Join(", ", opts.Keys)})";
                return false;
            }
            default:
                value = text;
                return true;
        }
    }

    private static bool TryParseDecimal(string text, out decimal value)
    {
        var s = text.Trim().Replace(" ", "").Replace("\u00A0", "");
        var lastComma = s.LastIndexOf(',');
        var lastDot = s.LastIndexOf('.');
        if (lastComma >= 0 && lastDot >= 0)
        {
            s = lastComma > lastDot ? s.Replace(".", "").Replace(',', '.') : s.Replace(",", "");
        }
        else if (lastComma >= 0)
        {
            s = s.Replace(',', '.');
        }
        else if (s.Count(c => c == '.') > 1)
        {
            s = s.Replace(".", "");
        }
        return decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out value);
    }
}
