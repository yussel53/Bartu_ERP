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
    /** AdditionalFields (U_) içine yazılır */
    public bool Additional { get; init; }
    /** Kolon değil — import mantığı ayrıca işler (üst hesap kodu, barkod, adres) */
    public bool Special { get; init; }
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
}

public sealed class ImportRowResult
{
    public int RowNo { get; set; }
    public string Code { get; set; } = "";
    /** insert | update | skip | error */
    public string Action { get; set; } = "";
    public string? Message { get; set; }
    public int? RecordId { get; set; }
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
    public List<ImportRowResult> Rows { get; set; } = new();
}

public sealed partial class ImportRepository
{
    private const string RowNoKey = "__row";

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
                "Barkod yalnızca kartta hiç barkod yoksa eklenir.",
            },
            Fields =
            {
                new() { Key = "Code", Label = "Kod", Required = true, Sample = "MLZ-0001",
                        Aliases = new[] { "malzeme kodu", "hizmet kodu", "stok kodu", "kod", "code" } },
                new() { Key = "Title", Label = "Ad", Required = true, Sample = "Örnek Malzeme",
                        Aliases = new[] { "malzeme adi", "hizmet adi", "stok adi", "aciklama", "ad", "adi", "title", "name" } },
                new() { Key = "DefaultUnitID", Label = "Ana Birim", Type = "enum", Options = UnitOptions, Sample = "Adet",
                        Aliases = new[] { "birim", "ana birim", "unit" }, Hint = "Boşsa Adet" },
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
                "Mevcut caride adres yalnızca hiç adres yoksa eklenir.",
            },
            Fields =
            {
                new() { Key = "Code", Label = "Cari Kodu", Required = true, Sample = "120.01.001",
                        Aliases = new[] { "cari kodu", "cari kod", "kod", "code" } },
                new() { Key = "Title", Label = "Ünvan", Required = true, Sample = "Örnek Ticaret Ltd. Şti.",
                        Aliases = new[] { "unvan", "cari unvani", "cari adi", "firma adi", "ad", "title", "name" } },
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
                "Kodda nokta varsa üst hesap noktadan önceki koddur (100.01 → 100).",
                "Noktasız kodlarda Üst Hesap Kodu kolonu veya önek kuralı kullanılır (1 ← 10 ← 100).",
                "Hesap tipi boşsa: altı olan hesap Ana, diğerleri Detay.",
            },
            Fields =
            {
                new() { Key = "Code", Label = "Hesap Kodu", Required = true, Sample = "100.01",
                        Aliases = new[] { "hesap kodu", "kod", "code" } },
                new() { Key = "Title", Label = "Hesap Adı", Required = true, Sample = "Merkez Kasa",
                        Aliases = new[] { "hesap adi", "aciklama", "ad", "title", "name" } },
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

    // ── Uygula / ön izleme ──────────────────────────────────────────────────

    private sealed class ParsedRow
    {
        public int RowNo;
        public string Code = "";
        public Dictionary<string, object?> Values = new(StringComparer.OrdinalIgnoreCase);
        public List<string> Errors = new();
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
        var productType = req.ProductType is >= 1 and <= 3 ? req.ProductType.Value : 1;
        var result = new ImportApplyResult { DryRun = req.DryRun, Total = req.Rows.Count };

        var existing = await LoadExistingAsync(def, ct);
        var parsed = ParseRows(def, req.Rows);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in parsed)
        {
            if (r.Code.Length == 0) continue;
            if (!seen.Add(r.Code)) r.Errors.Add("Dosyada tekrar eden kod");
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

            var found = existing.TryGetValue(row.Code, out var ex);
            if (row.Errors.Count == 0 && !found && !row.Values.ContainsKey("Title"))
                row.Errors.Add("Ad / ünvan zorunlu (yeni kayıt)");
            if (row.Errors.Count == 0 && found && def.Kind == "product" && ex!.ProductType is { } pt && pt != productType)
                row.Errors.Add($"Bu kod başka kart tipinde kayıtlı (ProductType={pt})");

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
            var save = await BuildSaveRequestAsync(def, row, found ? ex!.Id : 0, productType,
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
                if (!found) existing[row.Code] = new ExistingRow { Id = id, ProductType = def.Kind == "product" ? productType : null };
            }
            else if (!found)
            {
                existing[row.Code] = new ExistingRow { Id = 0, ProductType = def.Kind == "product" ? productType : null };
            }

            if (warnings.Count > 0) res.Message = string.Join("; ", warnings);
            if (found) result.Updated++; else result.Inserted++;
        }

        result.Rows = result.Rows.OrderBy(r => r.RowNo).ToList();

        if (!req.DryRun) await WriteLogAsync(def, req, result, ct);
        return result;
    }

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
                else row.Errors.Add(err!);
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
                std["ProductType"] = productType;
                if (isNew)
                {
                    std.TryAdd("IsActive", true);
                    std.TryAdd("DefaultUnitID", 1);
                    std.TryAdd("UseInMaterial", true);
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
                    string? V(string k) => row.Values.TryGetValue(k, out var o) ? o?.ToString() : null;
                    save.Addresses = new List<Dictionary<string, object?>>
                    {
                        new()
                        {
                            ["AdressType"] = 1,
                            ["IsDefault"] = true,
                            ["Active"] = true,
                            ["Title"] = "Merkez",
                            ["Country"] = V("Addr_Country") ?? "Türkiye",
                            ["City"] = V("Addr_City"),
                            ["Town"] = V("Addr_Town"),
                            ["Dictrict"] = V("Addr_District"),
                            ["Adress"] = V("Addr_Address"),
                            ["TaxNr"] = std.TryGetValue("TaxNr", out var t) ? t : null,
                        },
                    };
                }
                else if (hasAddr)
                {
                    warnings.Add("Caride adres var — adres güncellenmedi");
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
                    var exists = existing.ContainsKey(parentCode);
                    if (!exists)
                        warnings.Add($"Üst hesap {parentCode} bulunamadı — bağlantısız kaydedilir");
                    else if (!row.Code.Contains('.'))
                    {
                        var pid = existing[parentCode].Id;
                        if (pid > 0) std["MainAccountID"] = pid;
                        else if (!dryRun) warnings.Add($"Üst hesap {parentCode} bağlanamadı");
                    }
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
        if (exists is null) return;

        var errors = res.Rows.Where(r => r.Action == "error").Take(500)
            .Select(r => new { r.RowNo, r.Code, r.Message });
        await _db.ExecuteAsync(new CommandDefinition(
            @"INSERT INTO dbo.SYS_ImportLog
                (Kind, TableName, FileName, Mode, TotalRows, Inserted, Updated, Skipped, Failed, ErrorsJson, ImportedBy, ImportedAt)
              VALUES (@Kind, @TableName, @FileName, @Mode, @Total, @Inserted, @Updated, @Skipped, @Failed, @ErrorsJson, @ImportedBy, SYSUTCDATETIME())",
            new
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
            },
            cancellationToken: ct));
    }

    private static string? Trunc(string? s, int max) =>
        s is null ? null : s.Length <= max ? s : s[..max];

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
