using System.Globalization;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed partial class ImportRepository
{
    private static ImportTargetDef InvoiceTarget() => new()
    {
        Kind = "invoice",
        Title = "Fatura Aktarımı",
        TableName = "Invoice",
        PrimaryKey = "InvoiceID",
        Notes =
        {
            "Aynı fatura no + fatura türü satırları tek faturada birleşir.",
            "Cari kodu ve malzeme/hizmet kodu kartlarda yoksa «Kartı yoksa oluştur» ile açılır.",
            "Birim fiyat boşsa tutar ÷ miktar kullanılır. Aktarılan fatura onaylı kaydedilir.",
            "Kontrol ve kayıt fiş bazındadır.",
        },
        Fields =
        [
            Text("DocumentNumber", "Fatura No", true, "FTR-0001"),
            Date("InvoiceDate", "Fatura Tarihi", true),
            Enum("InvoiceType", "Fatura Türü", true, InvoiceTypes(), "Alınan Hizmet"),
            Text("Description", "Açıklama", false),
            CodeField("CustomerCode", "Cari Kodu", true, "320.01.001"),
            CodeField("WhouseCode", "Depo Kodu", false, "MRK"),
            CodeField("ProductCode", "Malzeme / Hizmet Kodu", true, "HZM-001"),
            Dec("Quantity", "Miktar", false, "1"),
            Dec("Price", "Birim Fiyat", false, "1000"),
            Dec("LineAmount", "Tutar", false, "1000"),
            Dec("Discount", "İskonto", false, "0"),
            Dec("TaxRate", "KDV Oranı", false, "20"),
            Text("LineDescription", "Satır Açıklama", false),
        ],
    };

    private static ImportTargetDef CustomerVoucherTarget() => new()
    {
        Kind = "customer-voucher",
        Title = "Cari Fiş Aktarımı",
        TableName = "CustomerVoucher",
        PrimaryKey = "CustomerVoucherID",
        Notes =
        {
            "Virman, borç/alacak dekontu, nakit tahsilat ve ödeme bu türdedir.",
            "Aynı belge no + fiş tipi tek fişte birleşir. Borç ve alacak doluysa tutar = borç − alacak.",
            "Pozitif tutar cari borç, negatif tutar cari alacaktır. Olmayan cari, seçenek açıksa kart olarak açılır.",
        },
        Fields =
        [
            Text("DocumentNumber", "Belge No", true, "CF-0001"),
            Date("VoucherDate", "Tarih", true),
            Enum("Type", "Fiş Tipi", true, CustomerTypes(), "Virman Fişi"),
            Text("Description", "Açıklama", false),
            CodeField("CustomerCode", "Cari Kodu", true, "120.01.001"),
            Dec("Debit", "Borç", false, "0"),
            Dec("Credit", "Alacak", false, "1500"),
            Dec("LineAmount", "Tutar", false, "1500"),
            Date("DueDate", "Vade", false),
            Text("LineDescription", "Satır Açıklama", false),
        ],
    };

    private static ImportTargetDef BankVoucherTarget() => new()
    {
        Kind = "bank-voucher",
        Title = "Banka Fişi Aktarımı",
        TableName = "BankVoucher",
        PrimaryKey = "BankVoucherID",
        Notes =
        {
            "Gelen havale, gönderilen havale ve banka virmanı bu türdedir.",
            "Virmanda karşı hesap, diğer banka hesabının kodudur. Olmayan hesap ve cari, seçenek açıksa açılır.",
        },
        Fields = new List<ImportFieldDef>
        {
            Text("DocumentNumber", "Belge No", true, "HVL-0001"),
            Date("VoucherDate", "Tarih", true),
            Enum("Type_", "Fiş Tipi", true, BankTypes(), "Gelen Havale/EFT"),
            CodeField("BankAccountCode", "Banka Hesabı", true, "TL-01"),
            Text("Description", "Açıklama", false),
            CodeField("CustomerCode", "Cari Kodu", false, "120.01.001"),
            CodeField("CounterAccountCode", "Karşı Hesap", false, "TL-02"),
            Dec("Debit", "Borç", false, "0"),
            Dec("Credit", "Alacak", false, "1500"),
            Dec("LineAmount", "Tutar", false, "1500"),
            Text("LineDescription", "Satır Açıklama", false),
        },
    };

    private static ImportTargetDef AccountVoucherTarget() => new()
    {
        Kind = "account-voucher",
        Title = "Muhasebe Fişi Aktarımı",
        TableName = "AccountVoucher",
        PrimaryKey = "AccountVoucherID",
        Notes =
        {
            "Aynı fiş no tek mahsupta birleşir. Borç toplamı alacak toplamına eşit olmalıdır.",
            "e-Defter yevmiye XML veya yevmiye zip dosyası da bu şablona çevrilir.",
            "Hesap kodu planda yoksa «Kartı yoksa oluştur» ile detay hesap açılır. Noktalı kodun üst hesabı da yoksa o da açılır.",
        },
        Fields =
        [
            Text("DocumentNumber", "Fiş No", true, "MHS-0001"),
            Date("VoucherDate", "Fiş Tarihi", true),
            Enum("Type", "Fiş Tipi", false, new Dictionary<string, string>
            {
                ["Mahsup"] = "1", ["Mahsup Fişi"] = "1", ["Tahsil"] = "2", ["Tahsil Fişi"] = "2", ["Tediye"] = "3", ["Tediye Fişi"] = "3",
            }, "Mahsup"),
            Text("journalNO", "Yevmiye No", false, "1"),
            Text("Description", "Açıklama", false),
            Enum("EDocumentType", "Belge Türü", false, new Dictionary<string, string>
            {
                ["Fatura"] = "invoice", ["Çek"] = "check", ["Senet"] = "voucher", ["Makbuz"] = "receipt",
                ["İrsaliye / Sevk"] = "shipment", ["Müşteri Siparişi"] = "order-customer",
                ["Satıcı Siparişi"] = "order-vendor", ["Diğer"] = "other",
            }, "Fatura"),
            Text("EDocumentNumber", "Belge No", false),
            Date("EDocumentDate", "Belge Tarihi", false),
            Enum("EPaymentMethod", "Ödeme Şekli", false, new Dictionary<string, string>
            {
                ["Nakit"] = "NAKIT", ["Banka / EFT / Havale"] = "BANKA", ["Kredi Kartı"] = "KREDIKARTI",
                ["Çek"] = "CEK", ["Senet"] = "SENET", ["Açık Hesap"] = "ACIKHESAP", ["Diğer"] = "DIGER",
            }, "Açık Hesap"),
            CodeField("AccountCode", "Hesap Kodu", true, "100.01"),
            Dec("Debit", "Borç", false, "1000"),
            Dec("Credit", "Alacak", false, "1000"),
            Text("LineDescription", "Satır Açıklama", false),
        ],
    };

    private async Task<ImportApplyResult> ApplyVouchersAsync(ImportTargetDef def, ImportApplyRequest req, CancellationToken ct)
    {
        var mode = (req.Mode ?? "upsert").Trim().ToLowerInvariant();
        var parsed = ParseRows(def, req.Rows);
        var result = new ImportApplyResult { DryRun = req.DryRun, Total = 0 };
        var customers = await LoadCodeMapAsync("CustomerCard", "CustomerCardID", "Code", ct);
        var products = def.Kind == "invoice" ? await LoadCodeMapAsync("ProductCard", "ProductCardID", "Code", ct) : new();
        var accounts = def.Kind == "account-voucher" ? await LoadCodeMapAsync("AccountCard", "AccountCardID", "Code", ct) : new();
        var banks = def.Kind == "bank-voucher" ? await LoadCodeMapAsync("BankAccountCard", "BankAccountCardID", "Code", ct) : new();
        var whouses = def.Kind == "invoice" ? await LoadCodeMapAsync("SYS_Whouse", "WhouseId", "WhouseCode", ct) : new();
        var existing = await LoadVoucherKeysAsync(def, ct);

        var groups = new Dictionary<string, List<ParsedRow>>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in parsed)
        {
            var no = Str(row, "DocumentNumber");
            if (no.Length == 0)
            {
                Fail(result, row.RowNo, "", string.Join("; ", row.Errors.DefaultIfEmpty("Belge no boş")));
                continue;
            }
            var type = TypeOf(def, row);
            var gkey = no + "|" + type;
            if (!groups.TryGetValue(gkey, out var bucket))
            {
                bucket = new List<ParsedRow>();
                groups[gkey] = bucket;
            }
            bucket.Add(row);
        }

        foreach (var (key, lines) in groups)
        {
            result.Total++;
            var first = lines[0];
            var no = Str(first, "DocumentNumber");
            var errors = lines.SelectMany(l => l.Errors).ToList();
            if (errors.Count > 0)
            {
                Fail(result, first.RowNo, no, string.Join("; ", errors.Distinct()));
                continue;
            }
            var found = existing.TryGetValue(key, out var id);
            if (found && mode == "insert")
            {
                result.Skipped++;
                result.Rows.Add(new ImportRowResult { RowNo = first.RowNo, Code = no, Action = "skip", Message = "Fiş mevcut — atlandı", RecordId = id });
                continue;
            }
            if (!found && mode == "update")
            {
                result.Skipped++;
                result.Rows.Add(new ImportRowResult { RowNo = first.RowNo, Code = no, Action = "skip", Message = "Fiş bulunamadı — atlandı" });
                continue;
            }

            var saveLines = new List<Dictionary<string, object?>>();
            int? headerCustomer = null;
            int? headerBank = null;
            int? headerWhouse = null;

            var opened = new List<string>();
            var cards = new CardMaker
            {
                Create = req.CreateMissingCards,
                Dry = req.DryRun,
                Customers = customers,
                Products = products,
                Accounts = accounts,
                Banks = banks,
            };
            foreach (var line in lines)
            {
                if (line.Errors.Count > 0) continue;
                try
                {
                    saveLines.Add(def.Kind switch
                    {
                        "invoice" => await InvoiceLineAsync(line, cards, whouses, opened, ct),
                        "customer-voucher" => await CustomerLineAsync(line, cards, opened, ct),
                        "bank-voucher" => await BankLineAsync(line, cards, opened, ct),
                        _ => await AccountLineAsync(line, cards, opened, ct),
                    });
                    headerCustomer ??= cards.LastCustomer;
                    headerWhouse ??= cards.LastWhouse;
                    headerBank ??= cards.LastBank;
                }
                catch (InvalidOperationException ex)
                {
                    errors.Add($"{line.RowNo}. satır: {ex.Message}");
                }
            }

            if (errors.Count > 0)
            {
                Fail(result, first.RowNo, no, string.Join("; ", errors.Distinct()));
                continue;
            }
            if (saveLines.Count == 0)
            {
                Fail(result, first.RowNo, no, "Fişte satır yok");
                continue;
            }

            var cardNote = opened.Count == 0 ? null : (req.DryRun ? "Oluşturulacak kartlar: " : "Açılan kartlar: ") + string.Join(", ", opened.Distinct());
            var header = HeaderOf(def, first, headerCustomer, headerBank, headerWhouse, saveLines);
            var res = new ImportRowResult { RowNo = first.RowNo, Code = no, Action = found ? "update" : "insert", RecordId = found ? id : null, Message = cardNote };
            if (!req.DryRun)
            {
                var (ok, saved, msg) = await _records.SaveAsync(def.TableName, def.PrimaryKey, new RecordSaveRequest
                {
                    RecordId = found ? id : 0,
                    StandardFields = header,
                    Lines = saveLines,
                }, ct);
                if (!ok)
                {
                    Fail(result, first.RowNo, no, msg);
                    continue;
                }
                res.RecordId = saved;
                existing[key] = saved;
            }
            result.Rows.Add(res);
            if (found) result.Updated++; else result.Inserted++;
        }

        result.Rows = result.Rows.OrderBy(r => r.RowNo).ToList();
        return result;
    }

    private static Dictionary<string, object?> HeaderOf(
        ImportTargetDef def, ParsedRow row, int? customer, int? bank, int? whouse, List<Dictionary<string, object?>> lines)
    {
        var header = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["DocumentNumber"] = Str(row, "DocumentNumber"),
            ["Description"] = Str(row, "Description"),
        };
        switch (def.Kind)
        {
            case "invoice":
                header["InvoiceDate"] = Str(row, "InvoiceDate");
                header["InvoiceType"] = TypeOf(def, row);
                header["CustomerID"] = customer;
                header["WhouseID"] = whouse;
                header["Status_"] = 1;
                break;
            case "customer-voucher":
                header["VoucherDate"] = Str(row, "VoucherDate");
                header["Type"] = TypeOf(def, row);
                header["Status"] = 0;
                header["Amount"] = lines.Sum(l => DecOf(l, "Amount"));
                break;
            case "bank-voucher":
                header["VoucherDate"] = Str(row, "VoucherDate");
                header["Type_"] = TypeOf(def, row);
                header["BankAccountCardID"] = bank;
                header["Status_"] = 0;
                break;
            default:
                header["VoucherDate"] = Str(row, "VoucherDate");
                header["Type"] = TypeOf(def, row);
                header["Status"] = 1;
                header["journalNO"] = Str(row, "journalNO");
                header["EDocumentType"] = Str(row, "EDocumentType");
                header["EDocumentNumber"] = Str(row, "EDocumentNumber");
                header["EDocumentDate"] = Str(row, "EDocumentDate");
                header["EPaymentMethod"] = Str(row, "EPaymentMethod");
                header["EEntryComment"] = Str(row, "Description");
                break;
        }
        return header;
    }

    private async Task<Dictionary<string, object?>> InvoiceLineAsync(
        ParsedRow row, CardMaker cards, Dictionary<string, int> whouses, List<string> opened, CancellationToken ct)
    {
        cards.LastCustomer ??= await EnsureCustomerAsync(cards, Str(row, "CustomerCode"), TitleOf(row, Str(row, "CustomerCode")), opened, ct);
        var wh = Str(row, "WhouseCode");
        if (wh.Length > 0) cards.LastWhouse ??= Need(whouses, wh, "Depo kodu");
        var qty = DecOf(row, "Quantity");
        if (qty == 0) qty = 1;
        var price = DecOf(row, "Price");
        var amount = DecOf(row, "LineAmount");
        if (price == 0 && amount != 0) price = amount / qty;
        var discount = DecOf(row, "Discount");
        var rate = DecOf(row, "TaxRate");
        var net = qty * price - discount;
        var tax = rate == 0 ? 0 : Math.Round(net * rate / 100m, 2, MidpointRounding.AwayFromZero);
        var productType = Str(row, "InvoiceType") == "5" ? 3 : 1;
        return new Dictionary<string, object?>
        {
            ["ProductCardID"] = await EnsureProductAsync(cards, Str(row, "ProductCode"), TitleOf(row, Str(row, "ProductCode")), productType, opened, ct),
            ["Quantity"] = qty,
            ["Price"] = price,
            ["TotalDiscount"] = discount,
            ["TaxRate"] = rate,
            ["TotalTax"] = tax,
            ["TotalPrice"] = net,
            ["NetTotal"] = net + tax,
            ["Description1"] = Str(row, "LineDescription"),
        };
    }

    private async Task<Dictionary<string, object?>> CustomerLineAsync(ParsedRow row, CardMaker cards, List<string> opened, CancellationToken ct) =>
        new()
        {
            ["CustomerID"] = await EnsureCustomerAsync(cards, Str(row, "CustomerCode"), TitleOf(row, Str(row, "CustomerCode")), opened, ct),
            ["Amount"] = MoneyOf(row),
            ["Description"] = Str(row, "LineDescription"),
            ["DueDate"] = NullIfEmpty(Str(row, "DueDate")),
        };

    private async Task<Dictionary<string, object?>> BankLineAsync(ParsedRow row, CardMaker cards, List<string> opened, CancellationToken ct)
    {
        cards.LastBank ??= await EnsureBankAccountAsync(cards, Str(row, "BankAccountCode"), opened, ct);
        var line = new Dictionary<string, object?>
        {
            ["Amount"] = MoneyOf(row),
            ["Description"] = Str(row, "LineDescription"),
        };
        var cari = Str(row, "CustomerCode");
        if (cari.Length > 0) line["CustomerID"] = await EnsureCustomerAsync(cards, cari, TitleOf(row, cari), opened, ct);
        var counter = Str(row, "CounterAccountCode");
        if (counter.Length > 0) line["BankAccountCardID"] = await EnsureBankAccountAsync(cards, counter, opened, ct);
        return line;
    }

    private async Task<Dictionary<string, object?>> AccountLineAsync(ParsedRow row, CardMaker cards, List<string> opened, CancellationToken ct)
    {
        var debit = DecOf(row, "Debit");
        var credit = DecOf(row, "Credit");
        return new Dictionary<string, object?>
        {
            ["AccountCardID"] = await EnsureAccountAsync(cards, Str(row, "AccountCode"), leaf: true, opened, ct),
            ["Debit"] = debit,
            ["Credit"] = credit,
            ["Description"] = Str(row, "LineDescription"),
        };
    }

    private async Task<int> EnsureCustomerAsync(CardMaker cards, string code, string title, List<string> opened, CancellationToken ct) =>
        await EnsureCardAsync(cards, cards.Customers, code, "Cari", opened, async () =>
        {
            var (ok, id, msg) = await _records.SaveAsync("CustomerCard", "CustomerCardID", new RecordSaveRequest
            {
                StandardFields = new Dictionary<string, object?>
                {
                    ["Code"] = code,
                    ["Title"] = title,
                    ["Active"] = true,
                    ["Type_"] = 3,
                    ["CardKind"] = 2,
                    ["SalesModuleCheck"] = true,
                    ["PurchaseModuleCheck"] = true,
                    ["FinanceModuleCheck"] = true,
                },
            }, ct);
            if (!ok) throw new InvalidOperationException(msg);
            return id;
        });

    private async Task<int> EnsureProductAsync(CardMaker cards, string code, string title, int productType, List<string> opened, CancellationToken ct) =>
        await EnsureCardAsync(cards, cards.Products, code, productType == 3 ? "Hizmet" : "Malzeme", opened, async () =>
        {
            var (ok, id, msg) = await _records.SaveAsync("ProductCard", "ProductCardID", new RecordSaveRequest
            {
                StandardFields = new Dictionary<string, object?>
                {
                    ["Code"] = code,
                    ["Title"] = title,
                    ["ProductType"] = productType,
                    ["IsActive"] = true,
                    ["DefaultUnitID"] = 1,
                    ["UseInMaterial"] = productType == 1,
                    ["UseInSales"] = true,
                    ["UseInPurchase"] = true,
                },
            }, ct);
            if (!ok) throw new InvalidOperationException(msg);
            return id;
        });

    private async Task<int> EnsureAccountAsync(CardMaker cards, string code, bool leaf, List<string> opened, CancellationToken ct)
    {
        if (cards.Accounts.TryGetValue(code, out var have)) return have;
        if (!cards.Create) throw new InvalidOperationException($"Hesap yok: {code}");
        int? parent = null;
        var dot = code.LastIndexOf('.');
        if (dot > 0) parent = await EnsureAccountAsync(cards, code[..dot], leaf: false, opened, ct);
        return await EnsureCardAsync(cards, cards.Accounts, code, "Hesap", opened, async () =>
        {
            var (ok, id, msg) = await _records.SaveAsync("AccountCard", "AccountCardID", new RecordSaveRequest
            {
                StandardFields = new Dictionary<string, object?>
                {
                    ["Code"] = code,
                    ["Title"] = code,
                    ["IsActive"] = true,
                    ["Type_"] = leaf ? 2 : 1,
                    ["MainAccount"] = !leaf,
                    ["MainAccountID"] = parent,
                },
            }, ct);
            if (!ok) throw new InvalidOperationException(msg);
            return id;
        });
    }

    private async Task<int> EnsureBankAccountAsync(CardMaker cards, string code, List<string> opened, CancellationToken ct)
    {
        var bankId = await TransferBankIdAsync(cards, opened, ct);
        return await EnsureCardAsync(cards, cards.Banks, code, "Banka hesabı", opened, async () =>
        {
            var (ok, id, msg) = await _records.SaveAsync("BankAccountCard", "BankAccountCardID", new RecordSaveRequest
            {
                StandardFields = new Dictionary<string, object?>
                {
                    ["BankCardID"] = bankId,
                    ["Code"] = code,
                    ["Title"] = code,
                    ["IsActive"] = true,
                },
            }, ct);
            if (!ok) throw new InvalidOperationException(msg);
            return id;
        });
    }

    private async Task<int> TransferBankIdAsync(CardMaker cards, List<string> opened, CancellationToken ct)
    {
        if (cards.TransferBankId is int known) return known;
        var id = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT TOP 1 BankCardID FROM dbo.BankCard WHERE Code = N'AKTARIM'", cancellationToken: ct));
        if (id is > 0)
        {
            cards.TransferBankId = id;
            return id.Value;
        }
        if (!cards.Create) throw new InvalidOperationException("Banka kartı yok");
        opened.Add("Banka AKTARIM");
        if (cards.Dry)
        {
            cards.TransferBankId = --cards.Fake;
            return cards.TransferBankId.Value;
        }
        var (ok, saved, msg) = await _records.SaveAsync("BankCard", "BankCardID", new RecordSaveRequest
        {
            StandardFields = new Dictionary<string, object?>
            {
                ["Code"] = "AKTARIM",
                ["Title"] = "Aktarım",
                ["IsActive"] = true,
            },
        }, ct);
        if (!ok) throw new InvalidOperationException(msg);
        cards.TransferBankId = saved;
        return saved;
    }

    private static async Task<int> EnsureCardAsync(
        CardMaker cards, Dictionary<string, int> map, string code, string label, List<string> opened, Func<Task<int>> insert)
    {
        if (code.Length == 0) throw new InvalidOperationException($"{label} boş");
        if (map.TryGetValue(code, out var id)) return id;
        if (!cards.Create) throw new InvalidOperationException($"{label} yok: {code}");
        opened.Add($"{label} {code}");
        if (cards.Dry)
        {
            id = --cards.Fake;
            map[code] = id;
            return id;
        }
        id = await insert();
        map[code] = id;
        return id;
    }

    private static string TitleOf(ParsedRow row, string code)
    {
        var title = Str(row, "LineDescription");
        if (title.Length == 0) title = Str(row, "Description");
        if (title.Length == 0) title = code;
        return title.Length > 200 ? title[..200] : title;
    }

    private sealed class CardMaker
    {
        public bool Create;
        public bool Dry;
        public int Fake = 0;
        public int? LastCustomer;
        public int? LastWhouse;
        public int? LastBank;
        public int? TransferBankId;
        public Dictionary<string, int> Customers = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, int> Products = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, int> Accounts = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, int> Banks = new(StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, int>> LoadVoucherKeysAsync(ImportTargetDef def, CancellationToken ct)
    {
        var sql = def.Kind switch
        {
            "invoice" => "SELECT InvoiceID AS Id, DocumentNumber AS No, CONVERT(nvarchar(20), InvoiceType) AS TypeKey FROM dbo.Invoice WHERE DocumentNumber IS NOT NULL",
            "customer-voucher" => "SELECT CustomerVoucherID AS Id, DocumentNumber AS No, CONVERT(nvarchar(20), Type) AS TypeKey FROM dbo.CustomerVoucher WHERE DocumentNumber IS NOT NULL",
            "bank-voucher" => "SELECT BankVoucherID AS Id, DocumentNumber AS No, CONVERT(nvarchar(20), Type_) AS TypeKey FROM dbo.BankVoucher WHERE DocumentNumber IS NOT NULL",
            _ => "SELECT AccountVoucherID AS Id, DocumentNumber AS No, CONVERT(nvarchar(20), Type) AS TypeKey FROM dbo.AccountVoucher WHERE DocumentNumber IS NOT NULL",
        };
        var rows = await _db.QueryAsync<(int Id, string No, string TypeKey)>(new CommandDefinition(sql, cancellationToken: ct));
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
            map[r.No.Trim() + "|" + (r.TypeKey ?? "").Trim()] = r.Id;
        return map;
    }

    private async Task<Dictionary<string, int>> LoadCodeMapAsync(string table, string idCol, string codeCol, CancellationToken ct)
    {
        var rows = await _db.QueryAsync<(int Id, string Code)>(new CommandDefinition(
            $"SELECT [{idCol}] AS Id, [{codeCol}] AS Code FROM dbo.[{table}] WHERE [{codeCol}] IS NOT NULL",
            cancellationToken: ct));
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
            if (!string.IsNullOrWhiteSpace(r.Code))
                map[r.Code.Trim()] = r.Id;
        return map;
    }

    private static int Need(Dictionary<string, int> map, string code, string label)
    {
        if (code.Length == 0) throw new InvalidOperationException($"{label} boş");
        if (!map.TryGetValue(code, out var id)) throw new InvalidOperationException($"{label} yok: {code}");
        return id;
    }

    private static decimal MoneyOf(ParsedRow row)
    {
        var debit = DecOf(row, "Debit");
        var credit = DecOf(row, "Credit");
        if (debit != 0 || credit != 0) return debit - credit;
        return DecOf(row, "LineAmount");
    }

    private static string TypeOf(ImportTargetDef def, ParsedRow row)
    {
        var key = def.Kind switch
        {
            "invoice" => "InvoiceType",
            "bank-voucher" => "Type_",
            _ => "Type",
        };
        var v = Str(row, key);
        if (v.Length > 0) return v;
        return def.Kind == "account-voucher" ? "1" : "";
    }

    private static void Fail(ImportApplyResult result, int rowNo, string code, string message)
    {
        result.Failed++;
        result.Rows.Add(new ImportRowResult { RowNo = rowNo, Code = code, Action = "error", Message = message });
    }

    private static string Str(ParsedRow row, string key) =>
        row.Values.TryGetValue(key, out var v) ? v?.ToString()?.Trim() ?? "" : "";

    private static decimal DecOf(ParsedRow row, string key) =>
        row.Values.TryGetValue(key, out var v) && v != null
            ? Convert.ToDecimal(v, CultureInfo.InvariantCulture)
            : 0m;

    private static decimal DecOf(Dictionary<string, object?> row, string key) =>
        row.TryGetValue(key, out var v) && v != null ? Convert.ToDecimal(v, CultureInfo.InvariantCulture) : 0m;

    private static string? NullIfEmpty(string s) => s.Length == 0 ? null : s;

    private static ImportFieldDef Text(string key, string label, bool required, string? sample = null) =>
        new() { Key = key, Label = label, Required = required, Sample = sample, Special = key is "Description" or "LineDescription" or "journalNO" or "EDocumentNumber" };

    private static ImportFieldDef Date(string key, string label, bool required) =>
        new() { Key = key, Label = label, Required = required, Type = "date", Sample = "2026-01-15", Special = true };

    private static ImportFieldDef Dec(string key, string label, bool required, string sample) =>
        new() { Key = key, Label = label, Required = required, Type = "decimal", Sample = sample, Special = true };

    private static ImportFieldDef CodeField(string key, string label, bool required, string sample) =>
        new() { Key = key, Label = label, Required = required, Sample = sample, Special = true };

    private static ImportFieldDef Enum(string key, string label, bool required, Dictionary<string, string> options, string sample) =>
        new() { Key = key, Label = label, Required = required, Type = "enum", Options = options, Sample = sample };

    private static Dictionary<string, string> InvoiceTypes() => new()
    {
        ["Satış"] = "1", ["Satış Faturası"] = "1", ["Alış"] = "2", ["Alış Faturası"] = "2", ["Satınalma Faturası"] = "2",
        ["Satış İade"] = "3", ["Satış İade Faturası"] = "3", ["Alış İade"] = "4", ["Alış İade Faturası"] = "4",
        ["Alınan Hizmet"] = "5", ["Alınan Hizmet Faturası"] = "5", ["Hizmet Faturası"] = "5",
        ["Satınalma Fiyat Farkı"] = "6", ["Satış Fiyat Farkı"] = "7",
    };

    private static Dictionary<string, string> CustomerTypes() => new()
    {
        ["Nakit Ödeme"] = "1", ["Tediye"] = "1", ["Nakit Tahsilat"] = "2", ["Tahsilat"] = "2",
        ["Borç Dekontu"] = "3", ["Borç Dekont"] = "3", ["Alacak Dekontu"] = "4", ["Alacak Dekont"] = "4",
        ["Virman Fişi"] = "5", ["Virman"] = "5", ["Cari Virman"] = "5",
        ["Kur Farkı Fişi"] = "6", ["Özel Fiş"] = "7", ["Açılış Fişi"] = "8",
        ["Kredi Kartı Fişi"] = "11", ["Kredi Kartı İade"] = "12", ["Firma Kredi Kartı"] = "13",
        ["Firma Kredi Kartı İade"] = "14", ["Mutabakat Fişi"] = "15",
    };

    private static Dictionary<string, string> BankTypes() => new()
    {
        ["Banka İşlem Fişi"] = "1", ["Banka Virman Fişi"] = "2", ["Banka Virman"] = "2",
        ["Gelen Havale/EFT"] = "3", ["Gelen Havale"] = "3",
        ["Gönderilen Havale/EFT"] = "4", ["Gönderilen Havale"] = "4", ["Giden Havale"] = "4",
        ["Banka Açılış Fişi"] = "5", ["Banka Kur Farkı Fişi"] = "6",
    };
}
