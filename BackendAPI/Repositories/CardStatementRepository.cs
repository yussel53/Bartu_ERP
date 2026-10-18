using System.Data;
using System.Globalization;
using Dapper;

namespace BartuERP.Backend.Repositories;

/// <summary>Ekstre satırı (borç/alacak veya giriş/çıkış + yürüyen bakiye).</summary>
public sealed class CardStatementRow
{
    public DateTime? Date { get; set; }
    public string? DocNo { get; set; }
    public string Source { get; set; } = "";
    public string? TypeLabel { get; set; }
    public string? Description { get; set; }
    public string? Party { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal Balance { get; set; }
    public decimal? Price { get; set; }
    public decimal? Amount { get; set; }
    public DateTime? DueDate { get; set; }
    public string? SourceTable { get; set; }
    public int? SourceId { get; set; }
}

public sealed class CardSectionColumn
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    /// <summary>text | date | money | qty</summary>
    public string Format { get; set; } = "text";
}

public sealed class CardSection
{
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public List<CardSectionColumn> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public string? Note { get; set; }
}

public sealed class CardStatementResult
{
    public string Kind { get; set; } = "";
    public int CardId { get; set; }
    public string? CardCode { get; set; }
    public string? CardTitle { get; set; }
    /// <summary>money | qty</summary>
    public string Unit { get; set; } = "money";
    public string DebitLabel { get; set; } = "Borç";
    public string CreditLabel { get; set; } = "Alacak";
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public decimal Opening { get; set; }
    public decimal TotalDebit { get; set; }
    public decimal TotalCredit { get; set; }
    public decimal Closing { get; set; }
    public List<CardStatementRow> Statement { get; set; } = new();
    public string? StatementNote { get; set; }
    public List<CardSection> Sections { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

/// <summary>Cari listesi özet satırı (bakiye ve önemli bilgiler)</summary>
public sealed class AgingMove
{
    public int CustId { get; set; }
    public DateTime? Dt { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string? Source { get; set; }
    public int? SourceId { get; set; }
    public string? DocNo { get; set; }
}

public sealed class CustomerListSummary
{
    public int CustomerCardID { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    /// <summary>Borç − Alacak (pozitif: borçlu / B · negatif: alacaklı / A)</summary>
    public decimal Balance { get; set; }
    public DateTime? LastMoveDate { get; set; }
    public int MoveCount { get; set; }
    public int OpenOrders { get; set; }
    public string? City { get; set; }
    public string? Town { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? RiskGroup { get; set; }
    /// <summary>Vadesi geçmiş açık borç (Y-10, FIFO kapama sonrası)</summary>
    public decimal Overdue { get; set; }
    public int OverdueDays { get; set; }
}

/// <summary>
/// Kart ekstre / hareket / ek bölümler — Cari, Malzeme, Banka, Banka Hesabı, Kasa, Hesap Planı, Çek/Senet.
/// Kolon varlığı her sorguda kontrol edilir (eski Create_DB + SqlUpdates farklarına dayanıklı).
/// </summary>
public sealed class CardStatementRepository
{
    public static readonly string[] Kinds =
        { "customer", "product", "bank", "bankAccount", "safe", "account", "bound" };

    private readonly IDbConnection _db;
    private readonly Dictionary<string, HashSet<string>> _cols = new(StringComparer.OrdinalIgnoreCase);

    public CardStatementRepository(IDbConnection db)
    {
        _db = db;
    }

    // ── Etiketler (FrontendUI/src/data/documentTypes.ts ile aynı) ─────────

    private static readonly Dictionary<int, string> CustomerVoucherTypes = new()
    {
        [1] = "Nakit Ödeme", [2] = "Nakit Tahsilat", [3] = "Borç Dekontu", [4] = "Alacak Dekontu",
        [5] = "Virman Fişi", [6] = "Kur Farkı Fişi", [7] = "Özel Fiş", [8] = "Açılış Fişi",
        [11] = "Kredi Kartı Fişi", [12] = "Kredi Kartı İade", [13] = "Firma Kredi Kartı",
        [14] = "Firma Kredi Kartı İade", [15] = "Mutabakat Fişi",
    };

    private static readonly Dictionary<int, string> InvoiceTypes = new()
    {
        [1] = "Satış Faturası", [2] = "Alış Faturası", [3] = "Satış İade Faturası", [4] = "Alış İade Faturası",
        [5] = "Alınan Hizmet Faturası", [6] = "Satınalma Fiyat Farkı Faturası", [7] = "Satış Fiyat Farkı Faturası",
    };

    private static readonly Dictionary<int, string> OrderTypes = new()
    {
        [1] = "Satış Siparişi", [2] = "Alış Siparişi", [3] = "Satış İade", [4] = "Alış İade",
        [5] = "Alış Talep", [6] = "Satış Talep",
    };

    private static readonly Dictionary<int, string> DispatchTypes = new()
    {
        [1] = "Devir", [2] = "Alış", [3] = "Satış", [4] = "Alış İade", [5] = "Satış İade",
        [6] = "Ambar Transfer", [7] = "Sayım", [8] = "Sarf", [9] = "Üretimden Giriş", [10] = "Fire",
        [11] = "Maliyet Dağıtım",
    };

    private static readonly Dictionary<int, string> BankVoucherTypes = new()
    {
        [1] = "Banka İşlem Fişi", [2] = "Banka Virman Fişi", [3] = "Gelen Havale/EFT",
        [4] = "Gönderilen Havale/EFT", [5] = "Banka Açılış Fişi", [6] = "Banka Kur Farkı Fişi",
        [7] = "Banka Alınan Hizmet Faturası", [8] = "Banka Verilen Hizmet Faturası",
        [9] = "Bankadan Çek Ödemesi", [10] = "Bankadan Senet Ödemesi", [11] = "Bankadan Gider Pusulası",
        [12] = "Bankadan Müstahsil Makbuzu",
    };

    private static readonly Dictionary<int, string> BoundTransTypes = new()
    {
        // Y-11 bordro türleri (BoundRoll.Type_ = BoundTrans.Type_)
        [1] = "Müşteriden giriş", [2] = "Cariye ciro", [3] = "Bankaya tahsile", [4] = "Bankaya teminata", [5] = "Bankadan tahsil",
        [6] = "Elden / kasaya tahsil", [7] = "Karşılıksız", [8] = "Müşteriye iade", [9] = "Borç çeki / senedi çıkışı",
        [10] = "Borç çeki / senedi ödemesi", [11] = "Portföye geri alma",
    };

    private static readonly Dictionary<int, string> AccountVoucherTypes = new()
    {
        [1] = "Mahsup", [2] = "Tahsil", [3] = "Tediye",
    };

    private static readonly Dictionary<int, string> PaymentTypes = new() { [1] = "Tahsilat", [2] = "Ödeme" };
    private static readonly Dictionary<int, string> BoundCardTypes = new() { [1] = "Çek", [2] = "Senet" };

    private static readonly Dictionary<string, string> SourceLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CustomerVoucher"] = "Cari Fiş",
        ["Invoice"] = "Fatura",
        ["OrderVoucher"] = "Sipariş",
        ["ProductVoucher"] = "İrsaliye / Malzeme Fişi",
        ["BankVoucher"] = "Banka Fişi",
        ["BoundCard"] = "Çek / Senet",
        ["BoundTrans"] = "Çek / Senet Bordrosu",
        ["AccountVoucher"] = "Muhasebe Fişi",
        ["PaymentTrans"] = "Ödeme / Tahsilat Planı",
        ["SafeVoucher"] = "Kasa Fişi",
        ["BoundRoll"] = "Çek / Senet Bordrosu",
    };

    /// <summary>Kasa fişi tipleri (SqlUpdates/82)</summary>
    private static readonly Dictionary<int, string> SafeVoucherTypes = new()
    {
        [1] = "Tahsilat", [2] = "Tediye", [3] = "Kasadan Bankaya", [4] = "Bankadan Kasaya", [5] = "Masraf", [6] = "Kasa Virman",
    };

    private static string? TypeLabel(string source, int? code)
    {
        if (code is null) return null;
        var dict = source switch
        {
            "CustomerVoucher" => CustomerVoucherTypes,
            "Invoice" => InvoiceTypes,
            "OrderVoucher" => OrderTypes,
            "ProductVoucher" => DispatchTypes,
            "BankVoucher" => BankVoucherTypes,
            "BoundTrans" or "BoundRoll" => BoundTransTypes,
            "BoundCard" => BoundCardTypes,
            "AccountVoucher" => AccountVoucherTypes,
            "PaymentTrans" => PaymentTypes,
            "SafeVoucher" => SafeVoucherTypes,
            _ => null,
        };
        return dict != null && dict.TryGetValue(code.Value, out var l) ? l : $"Tip {code}";
    }

    private static string SourceLabel(string? source) =>
        source != null && SourceLabels.TryGetValue(source, out var l) ? l : source ?? "";

    // ── Şema yardımcıları ───────────────────────────────────────────────

    private async Task<HashSet<string>> ColsAsync(string table, CancellationToken ct)
    {
        if (_cols.TryGetValue(table, out var cached)) return cached;
        var rows = await _db.QueryAsync<string>(new CommandDefinition(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t",
            new { t = table }, cancellationToken: ct));
        var set = new HashSet<string>(rows, StringComparer.OrdinalIgnoreCase);
        _cols[table] = set;
        return set;
    }

    private async Task<bool> HasAsync(string table, CancellationToken ct) =>
        (await ColsAsync(table, ct)).Count > 0;

    private async Task<bool> HasColAsync(string table, string col, CancellationToken ct) =>
        (await ColsAsync(table, ct)).Contains(col);

    /// <summary>Invoice belge no kolonu bazı veritabanlarında bozuk karakterle (DocumentNımber) oluşmuş.</summary>
    private async Task<string?> InvoiceDocColAsync(CancellationToken ct)
    {
        var cols = await ColsAsync("Invoice", ct);
        if (cols.Contains("DocumentNumber")) return "DocumentNumber";
        return cols.FirstOrDefault(c =>
            c.StartsWith("DocumentN", StringComparison.OrdinalIgnoreCase)
            && c.EndsWith("mber", StringComparison.OrdinalIgnoreCase));
    }

    private sealed class RawRow
    {
        public DateTime? Dt { get; set; }
        public string? DocNo { get; set; }
        public string? Source { get; set; }
        public int? TypeCode { get; set; }
        public string? Description { get; set; }
        public string? Party { get; set; }
        public double? Debit { get; set; }
        public double? Credit { get; set; }
        public double? Price { get; set; }
        public double? Amount { get; set; }
        public DateTime? DueDate { get; set; }
        public int? SourceId { get; set; }
    }

    private async Task<List<RawRow>> RawAsync(string sql, object param, CancellationToken ct) =>
        (await _db.QueryAsync<RawRow>(new CommandDefinition(sql, param, cancellationToken: ct))).ToList();

    private async Task<List<Dictionary<string, object?>>> RowsAsync(string sql, object param, CancellationToken ct)
    {
        var list = new List<Dictionary<string, object?>>();
        foreach (var r in await _db.QueryAsync(new CommandDefinition(sql, param, cancellationToken: ct)))
        {
            var d = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in (IDictionary<string, object>)r)
                d[kv.Key] = kv.Value is DBNull ? null : kv.Value;
            list.Add(d);
        }
        return list;
    }

    private static CardSectionColumn Col(string key, string label, string format = "text") =>
        new() { Key = key, Label = label, Format = format };

    /// <summary>Source + TypeCode kolonlarından "Kaynak" / "Tür" metinlerini üretir.</summary>
    private static void LabelRows(List<Dictionary<string, object?>> rows)
    {
        foreach (var r in rows)
        {
            var src = r.TryGetValue("Source", out var s) ? s?.ToString() ?? "" : "";
            int? code = r.TryGetValue("TypeCode", out var c) && c != null
                ? Convert.ToInt32(c, CultureInfo.InvariantCulture)
                : null;
            r["SourceLabel"] = SourceLabel(src);
            r["TypeLabel"] = TypeLabel(src, code);
        }
    }

    // ── Giriş ───────────────────────────────────────────────────────────

    public async Task<CardStatementResult> GetAsync(
        string kind, int id, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        if (!Kinds.Contains(kind)) throw new ArgumentException($"Desteklenmeyen kart türü: {kind}");
        if (_db.State != ConnectionState.Open) _db.Open();

        var res = new CardStatementResult { Kind = kind, CardId = id, From = from, To = to };
        List<RawRow> raw;

        switch (kind)
        {
            case "customer":
                await LoadHeaderAsync(res, "CustomerCard", "CustomerCardID", "Code", "Title", ct);
                raw = await CustomerStatementAsync(id, res, ct);
                await Section(res, () => CustomerDocumentsAsync(id, ct), "Hareketler");
                await Section(res, () => CustomerOrdersAsync(id, ct), "Siparişler");
                await Section(res, () => CustomerProductLinesAsync(id, ct), "Malzeme Hareketleri");
                await Section(res, () => PaymentPlanAsync("CustomerID", id, ct), "Ödeme / Tahsilat Planı");
                await Section(res, () => CustomerBoundsAsync(id, ct), "Çek / Senet");
                // Müşteri 360°: CRM (fırsat / teklif / aksiyon-görüşme / Outlook yazışmaları)
                await Section(res, () => CrmOpportunitiesAsync(id, ct), "Fırsatlar");
                await Section(res, () => CrmOffersAsync(id, ct), "Teklifler");
                await Section(res, () => CrmActivitiesAsync(id, ct), "Aksiyon / Görüşme");
                await Section(res, () => CrmMailsAsync(id, ct), "Yazışmalar");
                break;

            case "product":
                await LoadHeaderAsync(res, "ProductCard", "ProductCardID", "Code", "Title", ct);
                res.Unit = "qty";
                res.DebitLabel = "Giriş";
                res.CreditLabel = "Çıkış";
                raw = await ProductStatementAsync(id, res, ct);
                await Section(res, () => ProductMovementsAsync(id, ct), "Hareketler");
                await Section(res, () => ProductWarehousesAsync(id, ct), "Ambar Durumu");
                await Section(res, () => ProductOrdersAsync(id, ct), "Siparişler");
                await Section(res, () => ProductCustomersAsync(id, ct), "Cari Bazında");
                break;

            case "bank":
            case "bankAccount":
                if (kind == "bank")
                    await LoadHeaderAsync(res, "BankCard", "BankCardID", "Code", "Title", ct);
                else
                    await LoadHeaderAsync(res, "BankAccountCard", "BankAccountCardID", "Code", "Title", ct);
                res.DebitLabel = "Giriş";
                res.CreditLabel = "Çıkış";
                raw = await BankStatementAsync(kind, id, res, ct);
                await Section(res, () => BankVouchersAsync(kind, id, ct), "Hareketler");
                if (kind == "bank")
                    await Section(res, () => BankAccountsAsync(id, ct), "Hesaplar");
                await Section(res, () => BankCustomersAsync(kind, id, ct), "Cari Bazında");
                if (kind == "bankAccount")
                    await Section(res, () => PaymentPlanAsync("BankAccountID", id, ct), "Ödeme / Tahsilat Planı");
                break;

            case "safe":
                await LoadHeaderAsync(res, "SafeCard", "SafeCardID", "Code", "Defintion", ct);
                res.DebitLabel = "Giriş";
                res.CreditLabel = "Çıkış";
                raw = await SafeStatementAsync(id, ct);
                raw.AddRange(await BoundRollMovesAsync("safe", id, ct));
                res.StatementNote = "Kasa fişleri: tahsilat, bankadan kasaya ve gelen virman giriş; tediye, kasadan bankaya, masraf ve giden virman çıkış.";
                break;

            case "account":
                await LoadHeaderAsync(res, "AccountCard", "AccountCardID", "Code", "Title", ct);
                var accIds = await AccountIdsAsync(id, res.CardCode, ct);
                raw = await AccountStatementAsync(accIds, id, res, ct);
                await Section(res, () => AccountVouchersAsync(accIds, ct), "Hareketler");
                if (accIds.Count > 1)
                    await Section(res, () => AccountChildrenAsync(id, accIds, ct), "Alt Hesaplar");
                break;

            case "bound":
                await LoadHeaderAsync(res, "BoundCard", "BoundCardID", "DocumentNr", null, ct);
                raw = new List<RawRow>();
                res.StatementNote = "Çek / senet için tutar ekstresi yerine bordro hareketleri listelenir (Hareketler).";
                await Section(res, () => BoundMovementsAsync(id, ct), "Hareketler");
                break;

            default:
                raw = new List<RawRow>();
                break;
        }

        BuildStatement(res, raw);
        if (raw.Count > 0)
            res.Sections.Add(MonthlySection(res, raw));
        return res;
    }

    private static async Task Section(CardStatementResult res, Func<Task<CardSection?>> load, string title)
    {
        try
        {
            var s = await load();
            if (s != null) res.Sections.Add(s);
        }
        catch (Exception ex)
        {
            res.Warnings.Add($"{title}: {ex.Message}");
        }
    }

    private async Task LoadHeaderAsync(
        CardStatementResult res, string table, string pk, string codeCol, string? titleCol, CancellationToken ct)
    {
        var cols = await ColsAsync(table, ct);
        if (cols.Count == 0)
        {
            res.Warnings.Add($"{table} tablosu yok");
            return;
        }
        var code = cols.Contains(codeCol) ? $"CAST([{codeCol}] AS nvarchar(200))" : "NULL";
        var title = titleCol != null && cols.Contains(titleCol) ? $"CAST([{titleCol}] AS nvarchar(500))" : "NULL";
        var row = await _db.QueryFirstOrDefaultAsync<(string? Code, string? Title)>(new CommandDefinition(
            $"SELECT TOP 1 {code} AS Code, {title} AS Title FROM dbo.[{table}] WHERE [{pk}] = @id",
            new { id = res.CardId }, cancellationToken: ct));
        res.CardCode = row.Code;
        res.CardTitle = row.Title;
    }

    // ── Ekstre hesaplama (devir + yürüyen bakiye) ─────────────────────

    private static decimal D(double? v) => v is null ? 0m : Math.Round((decimal)v.Value, 4);

    private static void BuildStatement(CardStatementResult res, List<RawRow> raw)
    {
        var ordered = raw
            .OrderBy(r => r.Dt ?? DateTime.MinValue)
            .ThenBy(r => r.SourceId ?? 0)
            .ToList();

        decimal opening = 0, balance, td = 0, tc = 0;
        var toEnd = res.To?.Date.AddDays(1);

        foreach (var r in ordered.Where(r => res.From != null && r.Dt != null && r.Dt < res.From))
            opening += D(r.Debit) - D(r.Credit);

        balance = opening;
        foreach (var r in ordered)
        {
            if (res.From != null && r.Dt != null && r.Dt < res.From) continue;
            if (toEnd != null && r.Dt != null && r.Dt >= toEnd) continue;
            var debit = D(r.Debit);
            var credit = D(r.Credit);
            balance += debit - credit;
            td += debit;
            tc += credit;
            var src = r.Source ?? "";
            res.Statement.Add(new CardStatementRow
            {
                Date = r.Dt,
                DocNo = r.DocNo,
                Source = SourceLabel(src),
                TypeLabel = TypeLabel(src, r.TypeCode),
                Description = r.Description,
                Party = string.IsNullOrWhiteSpace(r.Party?.Trim(' ', '·')) ? null : r.Party.Trim(' ', '·'),
                Debit = debit,
                Credit = credit,
                Balance = balance,
                Price = r.Price is null ? null : D(r.Price),
                Amount = r.Amount is null ? null : D(r.Amount),
                DueDate = r.DueDate,
                SourceTable = src,
                SourceId = r.SourceId,
            });
        }

        res.Opening = opening;
        res.TotalDebit = td;
        res.TotalCredit = tc;
        res.Closing = balance;
    }

    private static CardSection MonthlySection(CardStatementResult res, List<RawRow> raw)
    {
        var fmt = res.Unit == "qty" ? "qty" : "money";
        var section = new CardSection
        {
            Key = "aylik",
            Title = "Aylık Özet",
            Columns = new()
            {
                Col("Period", "Dönem"),
                Col("Debit", res.DebitLabel, fmt),
                Col("Credit", res.CreditLabel, fmt),
                Col("Net", "Net", fmt),
                Col("Balance", "Kümülatif Bakiye", fmt),
                Col("Count", "Hareket Sayısı", "qty"),
            },
            Note = "Tüm dönemler (tarih filtresinden bağımsız).",
        };
        decimal cum = 0;
        foreach (var g in raw
                     .GroupBy(r => r.Dt == null ? (DateTime?)null : new DateTime(r.Dt.Value.Year, r.Dt.Value.Month, 1))
                     .OrderBy(g => g.Key ?? DateTime.MinValue))
        {
            var d = g.Sum(r => D(r.Debit));
            var c = g.Sum(r => D(r.Credit));
            cum += d - c;
            section.Rows.Add(new Dictionary<string, object?>
            {
                ["Period"] = g.Key?.ToString("yyyy / MM", CultureInfo.InvariantCulture) ?? "Tarihsiz",
                ["Debit"] = d,
                ["Credit"] = c,
                ["Net"] = d - c,
                ["Balance"] = cum,
                ["Count"] = g.Count(),
            });
        }
        return section;
    }

    // ── CARİ ────────────────────────────────────────────────────────────

    private const string CustDebitTypes = "(1,3,8,11,13)";
    private const string CustCreditTypes = "(2,4,12,14)";
    private const string BankInTypes = "(3,5,8)";
    private const string BankOutTypes = "(4,7,9,10,11,12)";

    private async Task<string> InvoiceTotalsJoinAsync(CancellationToken ct)
    {
        var pt = await ColsAsync("ProductTrans", ct);
        if (!pt.Contains("InvoiceID"))
            return "LEFT JOIN (SELECT CAST(NULL AS int) AS InvoiceID, CAST(0 AS float) AS Tot) s ON 1 = 0";
        var tot = pt.Contains("NetTotal")
            ? "COALESCE(NetTotal, ISNULL(TotalPrice, 0) + ISNULL(TotalTax, 0))"
            : "ISNULL(TotalPrice, 0) + ISNULL(TotalTax, 0)";
        return $@"LEFT JOIN (
  SELECT InvoiceID, SUM({tot}) AS Tot FROM dbo.ProductTrans WHERE InvoiceID IS NOT NULL GROUP BY InvoiceID
) s ON s.InvoiceID = i.InvoiceID";
    }

    private async Task<string?> InvoiceTypeColAsync(CancellationToken ct)
    {
        var cols = await ColsAsync("Invoice", ct);
        return cols.Contains("InvoiceType") ? "InvoiceType" : cols.Contains("Type_") ? "Type_" : null;
    }

    private async Task<List<RawRow>> CustomerStatementAsync(int id, CardStatementResult res, CancellationToken ct)
    {
        var all = new List<RawRow>();
        foreach (var sql in await CustomerMovementSqlAsync(single: true, ct))
            all.AddRange(await RawAsync(sql, new { id }, ct));
        return all;
    }

    /// <summary>
    /// Cari hareket kaynakları (cari fişleri, faturalar, banka satırları); her biri CustId kolonu taşır.
    /// single: yalnız @id carisi (ekstre) · değilse tüm cariler (liste özeti).
    /// </summary>
    private async Task<List<string>> CustomerMovementSqlAsync(bool single, CancellationToken ct)
    {
        var parts = new List<string>();
        string Where(string custExpr) => single ? $"WHERE {custExpr} = @id" : $"WHERE {custExpr} IS NOT NULL";

        // 1) Cari fiş satırları
        if (await HasAsync("CustomerTrans", ct))
        {
            var t = await ColsAsync("CustomerTrans", ct);
            var join = t.Contains("CustomerVoucherID") && await HasAsync("CustomerVoucher", ct);
            var amt = t.Contains("Amount") ? "COALESCE(t.Amount, t.LocalAmount, 0)" : "ISNULL(t.LocalAmount, 0)";
            var type = join ? "COALESCE(v.[Type], t.[Type])" : "t.[Type]";
            var desc = t.Contains("Description")
                ? (join ? "COALESCE(t.Description, v.Description)" : "t.Description")
                : (join ? "v.Description" : "NULL");
            var due = t.Contains("DueDate") ? "t.DueDate" : "NULL";
            var cust = join ? "COALESCE(t.CustomerID, v.CustomerID)" : "t.CustomerID";
            parts.Add($@"
SELECT
  {(join ? "COALESCE(t.TransDate, v.VoucherDate)" : "t.TransDate")} AS Dt,
  {(join ? "v.DocumentNumber" : "NULL")} AS DocNo,
  'CustomerVoucher' AS Source,
  CAST({type} AS int) AS TypeCode,
  CAST({desc} AS nvarchar(max)) AS Description,
  CAST(NULL AS nvarchar(200)) AS Party,
  CASE WHEN {type} IN {CustDebitTypes} THEN ABS({amt}) WHEN {type} IN {CustCreditTypes} THEN 0
       WHEN {amt} >= 0 THEN {amt} ELSE 0 END AS Debit,
  CASE WHEN {type} IN {CustCreditTypes} THEN ABS({amt}) WHEN {type} IN {CustDebitTypes} THEN 0
       WHEN {amt} < 0 THEN -{amt} ELSE 0 END AS Credit,
  {amt} AS Amount,
  {due} AS DueDate,
  {(join ? "t.CustomerVoucherID" : "t.CustomerTransID")} AS SourceId,
  {cust} AS CustId
FROM dbo.CustomerTrans t
{(join ? "LEFT JOIN dbo.CustomerVoucher v ON v.CustomerVoucherID = t.CustomerVoucherID" : "")}
{Where(cust)}");
        }

        // 2) Faturalar (tutar = satır toplamı)
        var invType = await InvoiceTypeColAsync(ct);
        if (invType != null && await HasColAsync("Invoice", "CustomerID", ct))
        {
            var doc = await InvoiceDocColAsync(ct);
            parts.Add($@"
SELECT
  i.InvoiceDate AS Dt,
  {(doc != null ? $"i.[{doc}]" : "NULL")} AS DocNo,
  'Invoice' AS Source,
  CAST(i.[{invType}] AS int) AS TypeCode,
  CAST(i.Description AS nvarchar(max)) AS Description,
  CASE WHEN i.[{invType}] IN (1,4) THEN ISNULL(s.Tot, 0) ELSE 0 END AS Debit,
  CASE WHEN i.[{invType}] IN (2,3,5,6,7) THEN ISNULL(s.Tot, 0) ELSE 0 END AS Credit,
  s.Tot AS Amount,
  CAST(NULL AS datetime) AS DueDate,
  i.InvoiceID AS SourceId,
  i.CustomerID AS CustId
FROM dbo.Invoice i
{await InvoiceTotalsJoinAsync(ct)}
{Where("i.CustomerID")}");
        }

        // 3) Banka satırları (havale / EFT)
        if (await HasColAsync("BankTrans", "CustomerID", ct))
        {
            var join = await HasColAsync("BankTrans", "BankVoucherID", ct) && await HasAsync("BankVoucher", ct);
            var type = join ? "COALESCE(bv.Type_, bt.Type_)" : "bt.Type_";
            var desc = await HasColAsync("BankTrans", "Description", ct) ? "bt.Description" : "NULL";
            parts.Add($@"
SELECT
  COALESCE(bt.TransDate{(join ? ", bv.VoucherDate" : "")}) AS Dt,
  {(join && await HasColAsync("BankVoucher", "DocumentNumber", ct) ? "bv.DocumentNumber" : "NULL")} AS DocNo,
  'BankVoucher' AS Source,
  CAST({type} AS int) AS TypeCode,
  CAST({desc} AS nvarchar(max)) AS Description,
  CAST(ba.Title AS nvarchar(200)) AS Party,
  CASE WHEN {type} IN {BankOutTypes} THEN ABS(ISNULL(bt.Amount, 0)) ELSE 0 END AS Debit,
  CASE WHEN {type} IN {BankOutTypes} THEN 0
       WHEN {type} IN {BankInTypes} OR ISNULL(bt.Amount, 0) >= 0 THEN ABS(ISNULL(bt.Amount, 0)) ELSE 0 END AS Credit,
  bt.Amount AS Amount,
  CAST(NULL AS datetime) AS DueDate,
  {(join ? "bt.BankVoucherID" : "bt.BankTtansID")} AS SourceId,
  bt.CustomerID AS CustId
FROM dbo.BankTrans bt
{(join ? "LEFT JOIN dbo.BankVoucher bv ON bv.BankVoucherID = bt.BankVoucherID" : "")}
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = bt.BankAccountCardID
{Where("bt.CustomerID")}");
        }

        // 4) Kasa fişleri (Y-08): tahsilat → alacak, tediye → borç
        if (await HasAsync("SafeTrans", ct) && await HasAsync("SafeVoucher", ct))
            parts.Add($@"
SELECT
  sv.VoucherDate AS Dt,
  sv.DocumentNumber AS DocNo,
  'SafeVoucher' AS Source,
  CAST(sv.Type_ AS int) AS TypeCode,
  CAST(COALESCE(st.Description, sv.Description) AS nvarchar(max)) AS Description,
  CAST(sc.Defintion AS nvarchar(200)) AS Party,
  CASE WHEN sv.Type_ = 2 THEN ABS(ISNULL(st.Amount, 0)) ELSE 0 END AS Debit,
  CASE WHEN sv.Type_ = 1 THEN ABS(ISNULL(st.Amount, 0)) ELSE 0 END AS Credit,
  st.Amount AS Amount,
  st.DueDate AS DueDate,
  sv.SafeVoucherID AS SourceId,
  st.CustomerID AS CustId
FROM dbo.SafeTrans st
JOIN dbo.SafeVoucher sv ON sv.SafeVoucherID = st.SafeVoucherID
LEFT JOIN dbo.SafeCard sc ON sc.SafeCardID = sv.SafeCardID
{Where("st.CustomerID")} AND sv.Type_ IN (1, 2) AND ISNULL(sv.Status_, 0) <> 2");

        // 5) Çek / senet bordroları (Y-11): müşteriden giriş → alacak · ciro, iade, borç çeki çıkışı → borç ·
        //    karşılıksız → belgeyi veren cariye borç; ciro edilmişse ciro edilen cari belgeyi geri verdiği için alacak
        if (await HasAsync("BoundRoll", ct) && await HasColAsync("BoundTrans", "BoundRollID", ct))
        {
            const string bound = @"
SELECT
  br.RollDate AS Dt,
  br.DocumentNumber AS DocNo,
  'BoundRoll' AS Source,
  CAST(br.Type_ AS int) AS TypeCode,
  CAST(CONCAT(CASE bc.Type_ WHEN 2 THEN N'Senet ' ELSE N'Çek ' END, bc.DocumentNr, N' vade ', CONVERT(nvarchar(10), bc.DueDate, 104),
    CASE WHEN br.Description IS NULL THEN N'' ELSE N' · ' + br.Description END) AS nvarchar(max)) AS Description,
  CAST(NULL AS nvarchar(200)) AS Party,
  {0} AS Debit,
  {1} AS Credit,
  t.Amount AS Amount,
  CAST(NULL AS datetime) AS DueDate,
  br.BoundRollID AS SourceId,
  {2} AS CustId
FROM dbo.BoundTrans t
JOIN dbo.BoundRoll br ON br.BoundRollID = t.BoundRollID
JOIN dbo.BoundCard bc ON bc.BoundCardID = t.CheckID
{3}
{4} AND ISNULL(br.Status_, 0) <> 2 AND {5}";
            var amt = "ABS(ISNULL(t.Amount, 0))";
            parts.Add(string.Format(bound,
                $"CASE WHEN br.Type_ IN (2, 8, 9) THEN {amt} ELSE 0 END", $"CASE WHEN br.Type_ = 1 THEN {amt} ELSE 0 END",
                "br.CustomerID", "", Where("br.CustomerID"), "br.Type_ IN (1, 2, 8, 9)"));
            parts.Add(string.Format(bound, amt, "0", "bc.CustomerID", "", Where("bc.CustomerID"), "br.Type_ = 7"));
            parts.Add(string.Format(bound, "0", amt, "ciro.CustomerID",
                @"CROSS APPLY (SELECT TOP 1 r2.CustomerID FROM dbo.BoundTrans t2 JOIN dbo.BoundRoll r2 ON r2.BoundRollID = t2.BoundRollID
             WHERE t2.CheckID = t.CheckID AND r2.Type_ = 2 AND t2.BoundTransID < t.BoundTransID ORDER BY t2.BoundTransID DESC) ciro",
                Where("ciro.CustomerID"), "br.Type_ = 7 AND t.PrevStatus = 2"));
        }

        return parts;
    }

    /// <summary>Kasa ekstresi (Y-08): giriş = tahsilat, bankadan kasaya, gelen virman · çıkış = tediye, kasadan bankaya, masraf, giden virman</summary>
    private async Task<List<RawRow>> SafeStatementAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("SafeTrans", ct) || !await HasAsync("SafeVoucher", ct)) return new();
        return await RawAsync(@"
SELECT
  sv.VoucherDate AS Dt, sv.DocumentNumber AS DocNo, 'SafeVoucher' AS Source, CAST(sv.Type_ AS int) AS TypeCode,
  CAST(COALESCE(st.Description, sv.Description) AS nvarchar(max)) AS Description,
  CAST(COALESCE(cc.Title, ba.Title, ac.Defintion) AS nvarchar(300)) AS Party,
  CASE WHEN (sv.SafeCardID = @id AND sv.Type_ IN (1, 4)) OR (sv.Type_ = 6 AND st.AimSafeCardID = @id) THEN ABS(ISNULL(st.Amount, 0)) ELSE 0 END AS Debit,
  CASE WHEN sv.SafeCardID = @id AND sv.Type_ IN (2, 3, 5, 6) THEN ABS(ISNULL(st.Amount, 0)) ELSE 0 END AS Credit,
  st.Amount AS Amount, st.DueDate AS DueDate, sv.SafeVoucherID AS SourceId
FROM dbo.SafeTrans st
JOIN dbo.SafeVoucher sv ON sv.SafeVoucherID = st.SafeVoucherID
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = st.CustomerID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = st.BankAccountCardID
LEFT JOIN dbo.SafeCard ac ON ac.SafeCardID = CASE WHEN sv.SafeCardID = @id THEN st.AimSafeCardID ELSE sv.SafeCardID END
WHERE ISNULL(sv.Status_, 0) <> 2 AND (sv.SafeCardID = @id OR (sv.Type_ = 6 AND st.AimSafeCardID = @id))", new { id }, ct);
    }

    /// <summary>Banka ekstresine kasa ↔ banka transferleri (Y-08): kasadan bankaya giriş, bankadan kasaya çıkış</summary>
    private async Task<List<RawRow>> SafeBankTransfersAsync(string kind, int id, CancellationToken ct)
    {
        if (!await HasAsync("SafeTrans", ct) || !await HasAsync("SafeVoucher", ct)) return new();
        var cond = kind == "bank" ? "ba.BankCardID = @id" : "st.BankAccountCardID = @id";
        return await RawAsync($@"
SELECT
  sv.VoucherDate AS Dt, sv.DocumentNumber AS DocNo, 'SafeVoucher' AS Source, CAST(sv.Type_ AS int) AS TypeCode,
  CAST(COALESCE(st.Description, sv.Description) AS nvarchar(max)) AS Description,
  CAST(sc.Defintion AS nvarchar(300)) AS Party,
  CASE WHEN sv.Type_ = 3 THEN ABS(ISNULL(st.Amount, 0)) ELSE 0 END AS Debit,
  CASE WHEN sv.Type_ = 4 THEN ABS(ISNULL(st.Amount, 0)) ELSE 0 END AS Credit,
  st.Amount AS Amount, sv.SafeVoucherID AS SourceId
FROM dbo.SafeTrans st
JOIN dbo.SafeVoucher sv ON sv.SafeVoucherID = st.SafeVoucherID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = st.BankAccountCardID
LEFT JOIN dbo.SafeCard sc ON sc.SafeCardID = sv.SafeCardID
WHERE sv.Type_ IN (3, 4) AND ISNULL(sv.Status_, 0) <> 2 AND {cond}", new { id }, ct);
    }

    /// <summary>Çek / senet bordroları (Y-11): banka — 5 bankadan tahsil giriş, 10 borç çeki ödemesi çıkış · kasa — 6 elden tahsil giriş</summary>
    private async Task<List<RawRow>> BoundRollMovesAsync(string kind, int id, CancellationToken ct)
    {
        if (!await HasAsync("BoundRoll", ct) || !await HasColAsync("BoundTrans", "BoundRollID", ct)) return new();
        var cond = kind switch
        {
            "bank" => "br.Type_ IN (5, 10) AND ba.BankCardID = @id",
            "bankAccount" => "br.Type_ IN (5, 10) AND br.BankAccountCardID = @id",
            "safe" => "br.Type_ = 6 AND br.SafeCardID = @id",
            _ => null,
        };
        if (cond == null) return new();
        return await RawAsync($@"
SELECT
  br.RollDate AS Dt, br.DocumentNumber AS DocNo, 'BoundRoll' AS Source, CAST(br.Type_ AS int) AS TypeCode,
  CAST(CONCAT(CASE bc.Type_ WHEN 2 THEN N'Senet ' ELSE N'Çek ' END, bc.DocumentNr, N' · ', COALESCE(br.Description, bc.Debtor)) AS nvarchar(max)) AS Description,
  CAST(cc.Title AS nvarchar(300)) AS Party,
  CASE WHEN br.Type_ IN (5, 6) THEN ABS(ISNULL(t.Amount, 0)) ELSE 0 END AS Debit,
  CASE WHEN br.Type_ = 10 THEN ABS(ISNULL(t.Amount, 0)) ELSE 0 END AS Credit,
  t.Amount AS Amount, bc.DueDate AS DueDate, br.BoundRollID AS SourceId
FROM dbo.BoundTrans t
JOIN dbo.BoundRoll br ON br.BoundRollID = t.BoundRollID
JOIN dbo.BoundCard bc ON bc.BoundCardID = t.CheckID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = br.BankAccountCardID
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = bc.CustomerID
WHERE ISNULL(br.Status_, 0) <> 2 AND {cond}", new { id }, ct);
    }

    /// <summary>Vade yaşlandırma (Y-10): carinin (id null → tüm cariler) borç / alacak hareketleri, vadesiyle.</summary>
    public async Task<List<AgingMove>> CustomerMovesAsync(int? id, CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var parts = await CustomerMovementSqlAsync(single: id != null, ct);
        if (parts.Count == 0) return new();
        var union = string.Join("\nUNION ALL\n", parts.Select(p => $"SELECT CustId, Dt, DueDate, Debit, Credit, Source, SourceId, DocNo FROM ({p}) p"));
        return (await _db.QueryAsync<AgingMove>(new CommandDefinition(
            $"SELECT CAST(m.CustId AS int) AS CustId, m.Dt, m.DueDate, CAST(ISNULL(m.Debit, 0) AS decimal(19,2)) AS Debit, CAST(ISNULL(m.Credit, 0) AS decimal(19,2)) AS Credit, m.Source, m.SourceId, m.DocNo FROM ({union}) m",
            new { id }, cancellationToken: ct))).ToList();
    }

    /// <summary>Tek carinin borç / alacak toplamı (ekstre ile aynı kaynaklar) — e-Belge kuralları «Cari.Bakiye»</summary>
    public async Task<(decimal Debit, decimal Credit)> CustomerBalanceAsync(int id, CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var parts = await CustomerMovementSqlAsync(single: true, ct);
        if (parts.Count == 0) return (0m, 0m);
        var union = string.Join("\nUNION ALL\n", parts.Select(p => $"SELECT Debit, Credit FROM ({p}) p"));
        var r = await _db.QueryFirstAsync(new CommandDefinition($@"
SELECT SUM(CAST(ISNULL(m.Debit, 0) AS decimal(19,2))) AS Debit, SUM(CAST(ISNULL(m.Credit, 0) AS decimal(19,2))) AS Credit
FROM ({union}) m", new { id }, cancellationToken: ct));
        return ((decimal)(r.Debit ?? 0m), (decimal)(r.Credit ?? 0m));
    }

    /// <summary>
    /// Cari listesi özeti: borç / alacak / bakiye (ekstre ile aynı kaynaklar), son hareket, açık sipariş,
    /// varsayılan adres il/ilçe, yetkili telefon / e-posta, risk grubu.
    /// </summary>
    public async Task<List<CustomerListSummary>> CustomerSummariesAsync(CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var map = new Dictionary<int, CustomerListSummary>();
        CustomerListSummary Get(int id) =>
            map.TryGetValue(id, out var x) ? x : map[id] = new CustomerListSummary { CustomerCardID = id };

        var parts = await CustomerMovementSqlAsync(single: false, ct);
        if (parts.Count > 0)
        {
            var union = string.Join("\nUNION ALL\n", parts.Select(p => $"SELECT CustId, Dt, Debit, Credit FROM ({p}) p"));
            var sql = $@"
SELECT CAST(m.CustId AS int) AS CustId,
       SUM(CAST(ISNULL(m.Debit, 0) AS decimal(19,2))) AS Debit,
       SUM(CAST(ISNULL(m.Credit, 0) AS decimal(19,2))) AS Credit,
       MAX(m.Dt) AS LastDt, COUNT(1) AS Cnt
FROM ({union}) m
GROUP BY m.CustId";
            foreach (var r in await _db.QueryAsync(new CommandDefinition(sql, cancellationToken: ct)))
            {
                var s = Get((int)r.CustId);
                s.Debit = (decimal)(r.Debit ?? 0m);
                s.Credit = (decimal)(r.Credit ?? 0m);
                s.Balance = s.Debit - s.Credit;
                s.LastMoveDate = (DateTime?)r.LastDt;
                s.MoveCount = (int)r.Cnt;
            }
        }

        if (await HasColAsync("CustomerAdress", "CustomerCardID", ct))
            foreach (var r in await _db.QueryAsync(new CommandDefinition(@"
SELECT CustomerCardID AS Id, City, Town FROM (
  SELECT a.CustomerCardID, a.City, a.Town,
         ROW_NUMBER() OVER (PARTITION BY a.CustomerCardID
                            ORDER BY CASE WHEN a.IsDefault = 1 THEN 0 ELSE 1 END, a.CustomerAdressID) AS rn
  FROM dbo.CustomerAdress a
  WHERE a.CustomerCardID IS NOT NULL AND ISNULL(a.Active, 1) = 1) x
WHERE rn = 1", cancellationToken: ct)))
            {
                var s = Get((int)r.Id);
                s.City = (string?)r.City;
                s.Town = (string?)r.Town;
            }

        if (await HasColAsync("CustomerContact", "CustomerCardID", ct))
            foreach (var r in await _db.QueryAsync(new CommandDefinition(@"
SELECT CustomerCardID AS Id, Phone, Email FROM (
  SELECT c.CustomerCardID, c.Phone, c.Email,
         ROW_NUMBER() OVER (PARTITION BY c.CustomerCardID
                            ORDER BY CASE WHEN c.IsDefault = 1 THEN 0 ELSE 1 END, c.CustomerContactID) AS rn
  FROM dbo.CustomerContact c
  WHERE c.CustomerCardID IS NOT NULL AND (NULLIF(c.Phone, '') IS NOT NULL OR NULLIF(c.Email, '') IS NOT NULL)) x
WHERE rn = 1", cancellationToken: ct)))
            {
                var s = Get((int)r.Id);
                s.Phone = (string?)r.Phone;
                s.Email = (string?)r.Email;
            }

        if (await HasColAsync("CustomerCard", "RiskGroupID", ct) && await HasAsync("RiskGroup", ct))
            foreach (var r in await _db.QueryAsync(new CommandDefinition(@"
SELECT c.CustomerCardID AS Id, g.Title FROM dbo.CustomerCard c
JOIN dbo.RiskGroup g ON g.RiskGroupID = c.RiskGroupID", cancellationToken: ct)))
                Get((int)r.Id).RiskGroup = (string?)r.Title;

        if (await HasColAsync("OrderVoucher", "CustomerID", ct) && await HasColAsync("OrderVoucher", "Status_", ct))
            foreach (var r in await _db.QueryAsync(new CommandDefinition(@"
SELECT CustomerID AS Id, COUNT(1) AS Cnt FROM dbo.OrderVoucher
WHERE CustomerID IS NOT NULL AND ISNULL(Status_, 1) IN (1, 2)
GROUP BY CustomerID", cancellationToken: ct)))
                Get((int)r.Id).OpenOrders = (int)r.Cnt;

        return map.Values.ToList();
    }

    private async Task<CardSection?> CustomerDocumentsAsync(int id, CancellationToken ct)
    {
        var parts = new List<string>();

        if (await HasColAsync("CustomerVoucher", "CustomerID", ct))
            parts.Add(@"
SELECT v.VoucherDate AS Dt, 'CustomerVoucher' AS Source, CAST(v.[Type] AS int) AS TypeCode,
  CAST(v.DocumentNumber AS nvarchar(100)) AS DocNo, CAST(v.Description AS nvarchar(500)) AS Description,
  CAST(COALESCE(v.Amount, (SELECT SUM(COALESCE(t.Amount, t.LocalAmount)) FROM dbo.CustomerTrans t
       WHERE t.CustomerVoucherID = v.CustomerVoucherID)) AS float) AS Amount,
  v.CustomerVoucherID AS SourceId
FROM dbo.CustomerVoucher v
WHERE v.CustomerID = @id
   OR EXISTS (SELECT 1 FROM dbo.CustomerTrans t WHERE t.CustomerVoucherID = v.CustomerVoucherID AND t.CustomerID = @id)");

        var invType = await InvoiceTypeColAsync(ct);
        if (invType != null && await HasColAsync("Invoice", "CustomerID", ct))
        {
            var doc = await InvoiceDocColAsync(ct);
            parts.Add($@"
SELECT i.InvoiceDate, 'Invoice', CAST(i.[{invType}] AS int),
  CAST({(doc != null ? $"i.[{doc}]" : "NULL")} AS nvarchar(100)), CAST(i.Description AS nvarchar(500)),
  CAST(s.Tot AS float), i.InvoiceID
FROM dbo.Invoice i
{await InvoiceTotalsJoinAsync(ct)}
WHERE i.CustomerID = @id");
        }

        if (await HasColAsync("OrderVoucher", "CustomerID", ct) && await HasAsync("OrderTrans", ct))
        {
            var fk = await HasColAsync("OrderTrans", "OrderVoucherID", ct)
                ? "COALESCE(t.OrderVoucherID, t.OrderSlipID)" : "t.OrderSlipID";
            parts.Add($@"
SELECT o.OrderDate, 'OrderVoucher', CAST(o.Type_ AS int), CAST(o.OrderSlipNo AS nvarchar(100)),
  CAST(o.Description AS nvarchar(500)),
  CAST((SELECT SUM(ISNULL(t.TotalPrice, 0)) FROM dbo.OrderTrans t WHERE {fk} = o.OrderVoucherID) AS float),
  o.OrderVoucherID
FROM dbo.OrderVoucher o
WHERE o.CustomerID = @id");
        }

        if (await HasColAsync("ProductVoucher", "CustomerID", ct))
            parts.Add(@"
SELECT p.VoucherDate, 'ProductVoucher', CAST(p.VoucherType AS int), CAST(p.DocumentNumber AS nvarchar(100)),
  CAST(p.Description AS nvarchar(500)),
  CAST((SELECT SUM(ISNULL(t.TotalPrice, 0)) FROM dbo.ProductTrans t WHERE t.ProductVoucherID = p.ProductVoucherID) AS float),
  p.ProductVoucherID
FROM dbo.ProductVoucher p
WHERE p.CustomerID = @id");

        if (await HasColAsync("BankTrans", "CustomerID", ct) && await HasColAsync("BankTrans", "BankVoucherID", ct)
            && await HasColAsync("BankVoucher", "DocumentNumber", ct))
            parts.Add(@"
SELECT bv.VoucherDate, 'BankVoucher', CAST(bv.Type_ AS int), CAST(bv.DocumentNumber AS nvarchar(100)),
  CAST(bv.Description AS nvarchar(500)), CAST(x.Tot AS float), bv.BankVoucherID
FROM dbo.BankVoucher bv
INNER JOIN (SELECT BankVoucherID, SUM(ISNULL(Amount, 0)) AS Tot FROM dbo.BankTrans
            WHERE CustomerID = @id GROUP BY BankVoucherID) x ON x.BankVoucherID = bv.BankVoucherID");

        if (await HasColAsync("BoundCard", "CustomerID", ct))
            parts.Add(@"
SELECT b.TransDate, 'BoundCard', CAST(b.Type_ AS int), CAST(b.DocumentNr AS nvarchar(100)),
  CAST(NULL AS nvarchar(500)), CAST(b.Amount AS float), b.BoundCardID
FROM dbo.BoundCard b
WHERE b.CustomerID = @id");

        if (parts.Count == 0) return null;
        var sql = $@"
SELECT TOP 2000 * FROM (
{string.Join("\nUNION ALL\n", parts)}
) d ORDER BY Dt DESC, SourceId DESC";
        // İlk parçadaki kolon adları UNION sonucuna isim verir
        var rows = await RowsAsync(sql, new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "hareketler",
            Title = "Hareketler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("SourceLabel", "Belge Türü"), Col("TypeLabel", "Tür"),
                Col("DocNo", "Belge No"), Col("Description", "Açıklama"), Col("Amount", "Tutar", "money"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> CustomerOrdersAsync(int id, CancellationToken ct)
    {
        if (!await HasColAsync("OrderVoucher", "CustomerID", ct) || !await HasAsync("OrderTrans", ct)) return null;
        var fk = await HasColAsync("OrderTrans", "OrderVoucherID", ct)
            ? "COALESCE(t.OrderVoucherID, t.OrderSlipID)" : "t.OrderSlipID";
        var rows = await RowsAsync($@"
SELECT TOP 1000
  o.OrderDate AS Dt, 'OrderVoucher' AS Source, CAST(o.Type_ AS int) AS TypeCode, o.OrderSlipNo AS DocNo,
  CASE WHEN ISNULL(o.Status_, 1) = 1 THEN N'Açık' ELSE N'Durum ' + CAST(o.Status_ AS nvarchar(10)) END AS StatusLabel,
  x.Lines, x.Qty, x.Total, o.Description
FROM dbo.OrderVoucher o
OUTER APPLY (SELECT COUNT(1) AS Lines, SUM(ISNULL(t.Quantity, 0)) AS Qty, SUM(ISNULL(t.TotalPrice, 0)) AS Total
             FROM dbo.OrderTrans t WHERE {fk} = o.OrderVoucherID) x
WHERE o.CustomerID = @id
ORDER BY o.OrderDate DESC, o.OrderVoucherID DESC", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "siparisler",
            Title = "Siparişler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DocNo", "Sipariş No"), Col("TypeLabel", "Tür"),
                Col("StatusLabel", "Durum"), Col("Lines", "Kalem", "qty"), Col("Qty", "Miktar", "qty"),
                Col("Total", "Tutar", "money"), Col("Description", "Açıklama"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> CustomerProductLinesAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("ProductTrans", ct) || !await HasAsync("ProductCard", ct)) return null;
        var parts = new List<string>();
        if (await HasColAsync("ProductVoucher", "CustomerID", ct))
            parts.Add(@"
SELECT COALESCE(t.TransDate, p.VoucherDate) AS Dt, 'ProductVoucher' AS Source,
  CAST(COALESCE(t.VoucherType, p.VoucherType) AS int) AS TypeCode, CAST(p.DocumentNumber AS nvarchar(100)) AS DocNo,
  t.ProductCardID, t.Quantity, t.Price, t.TotalPrice, t.ProductTransID
FROM dbo.ProductTrans t INNER JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
WHERE p.CustomerID = @id");
        var invType = await InvoiceTypeColAsync(ct);
        if (invType != null && await HasColAsync("ProductTrans", "InvoiceID", ct) && await HasColAsync("Invoice", "CustomerID", ct))
        {
            var doc = await InvoiceDocColAsync(ct);
            parts.Add($@"
SELECT COALESCE(t.TransDate, i.InvoiceDate), 'Invoice', CAST(i.[{invType}] AS int),
  CAST({(doc != null ? $"i.[{doc}]" : "NULL")} AS nvarchar(100)),
  t.ProductCardID, t.Quantity, t.Price, t.TotalPrice, t.ProductTransID
FROM dbo.ProductTrans t INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE i.CustomerID = @id AND t.ProductVoucherID IS NULL");
        }
        if (parts.Count == 0) return null;
        var rows = await RowsAsync($@"
SELECT TOP 2000 d.Dt, d.Source, d.TypeCode, d.DocNo, pc.Code AS ProductCode, pc.Title AS ProductTitle,
  d.Quantity, d.Price, d.TotalPrice
FROM ({string.Join("\nUNION ALL\n", parts)}) d
LEFT JOIN dbo.ProductCard pc ON pc.ProductCardID = d.ProductCardID
ORDER BY d.Dt DESC, d.ProductTransID DESC", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "malzeme",
            Title = "Malzeme Hareketleri",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("SourceLabel", "Belge Türü"), Col("TypeLabel", "Tür"),
                Col("DocNo", "Belge No"), Col("ProductCode", "Malzeme Kodu"), Col("ProductTitle", "Malzeme Adı"),
                Col("Quantity", "Miktar", "qty"), Col("Price", "Birim Fiyat", "money"), Col("TotalPrice", "Tutar", "money"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> PaymentPlanAsync(string filterCol, int id, CancellationToken ct)
    {
        var cols = await ColsAsync("PaymentTrans", ct);
        if (!cols.Contains(filterCol)) return null;
        var doc = cols.Contains("DocumentNumber") ? "p.DocumentNumber" : "NULL";
        var rows = await RowsAsync($@"
SELECT TOP 2000
  p.DueDate, p.SourceSlipDate AS Dt, 'PaymentTrans' AS Source, CAST(p.Type_ AS int) AS TypeCode, {doc} AS DocNo,
  COALESCE(p.LocationTotal, p.CurrencyTotal) AS Total,
  CASE WHEN ISNULL(p.Closed, 0) = 1 THEN N'Kapandı' ELSE N'Açık' END AS ClosedLabel,
  cc.Title AS CustomerTitle
FROM dbo.PaymentTrans p
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = p.CustomerID
WHERE p.[{filterCol}] = @id
ORDER BY p.DueDate, p.PaymentTransID", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "odeme",
            Title = "Ödeme / Tahsilat Planı",
            Columns = new()
            {
                Col("DueDate", "Vade", "date"), Col("Dt", "Belge Tarihi", "date"), Col("TypeLabel", "Tür"),
                Col("DocNo", "Belge No"), Col("CustomerTitle", "Cari"), Col("Total", "Tutar", "money"),
                Col("ClosedLabel", "Durum"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> CustomerBoundsAsync(int id, CancellationToken ct)
    {
        if (!await HasColAsync("BoundCard", "CustomerID", ct)) return null;
        var rows = await RowsAsync(@"
SELECT TOP 1000 b.TransDate AS Dt, b.DueDate, 'BoundCard' AS Source, CAST(b.Type_ AS int) AS TypeCode,
  b.DocumentNr AS DocNo, b.Amount
FROM dbo.BoundCard b
WHERE b.CustomerID = @id
ORDER BY b.DueDate, b.BoundCardID", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "ceksenet",
            Title = "Çek / Senet",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DueDate", "Vade", "date"), Col("TypeLabel", "Tip"),
                Col("DocNo", "Belge No"), Col("Amount", "Tutar", "money"),
            },
            Rows = rows,
        };
    }

    // ── CRM (Müşteri 360°) ──────────────────────────────────────────────

    private const string OppStatusCase =
        "CASE o.Status WHEN 0 THEN N'Açık' WHEN 1 THEN N'Kazanıldı' WHEN 2 THEN N'Kaybedildi' WHEN 3 THEN N'İptal' ELSE N'?' END";

    private async Task<CardSection?> CrmOpportunitiesAsync(int id, CancellationToken ct)
    {
        if (!await HasColAsync("CRM_Opportunity", "CustomerCardID", ct)) return null;
        var hasOffer = await HasAsync("CRM_Offer", ct);
        var rows = await RowsAsync($@"
SELECT TOP 500 o.OpportunityID AS Id, o.CreateDate AS Dt, o.Title, o.OppType, {OppStatusCase} AS StatusLabel,
  o.Probability, o.ExpectedAmount, o.CloseDate, o.ContactName,
  {(hasOffer ? "(SELECT COUNT(1) FROM dbo.CRM_Offer f WHERE f.OpportunityID = o.OpportunityID AND f.IsActive = 1)" : "0")} AS OfferCount,
  LTRIM(RTRIM(ISNULL(u.Name, '') + ' ' + ISNULL(u.Surname, ''))) AS OwnerName
FROM dbo.CRM_Opportunity o
LEFT JOIN dbo.SystemUser u ON u.SystemUserID = o.OwnerUserID
WHERE o.CustomerCardID = @id
ORDER BY CASE WHEN o.Status = 0 THEN 0 ELSE 1 END, o.CreateDate DESC", new { id }, ct);
        return new CardSection
        {
            Key = "firsatlar",
            Title = "Fırsatlar",
            Columns = new()
            {
                Col("Id", "No"), Col("Dt", "Tarih", "date"), Col("Title", "Başlık"), Col("OppType", "Tür"),
                Col("StatusLabel", "Durum"), Col("Probability", "Olasılık %", "qty"),
                Col("ExpectedAmount", "Beklenen Tutar", "money"), Col("OfferCount", "Teklif", "qty"),
                Col("ContactName", "Kişi"), Col("OwnerName", "Sorumlu"), Col("CloseDate", "Kapanış", "date"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> CrmOffersAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("CRM_Offer", ct) || !await HasColAsync("CRM_Opportunity", "CustomerCardID", ct)) return null;
        var hasOrder = await HasColAsync("CRM_Offer", "OrderVoucherID", ct);
        var rows = await RowsAsync($@"
SELECT TOP 500 f.OfferDate AS Dt, CONCAT(f.DocNum, CASE WHEN f.RevisionNo > 0 THEN CONCAT(N' / R', f.RevisionNo) ELSE N'' END) AS DocNo,
  o.Title AS OppTitle, f.Description, f.ValidityDate, f.GrandTotal,
  CASE f.Status WHEN 0 THEN N'Taslak' WHEN 1 THEN N'Gönderildi' WHEN 2 THEN N'Onaylandı' WHEN 3 THEN N'Reddedildi' WHEN 4 THEN N'Revize edildi' ELSE N'?' END AS StatusLabel,
  {(hasOrder ? "ov.OrderSlipNo" : "CAST(NULL AS nvarchar(50))")} AS OrderNo
FROM dbo.CRM_Offer f
INNER JOIN dbo.CRM_Opportunity o ON o.OpportunityID = f.OpportunityID
{(hasOrder ? "LEFT JOIN dbo.OrderVoucher ov ON ov.OrderVoucherID = f.OrderVoucherID" : "")}
WHERE o.CustomerCardID = @id AND f.IsActive = 1
ORDER BY f.OfferDate DESC, f.OfferID DESC", new { id }, ct);
        return new CardSection
        {
            Key = "teklifler",
            Title = "Teklifler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DocNo", "Teklif No"), Col("OppTitle", "Fırsat"),
                Col("Description", "Açıklama"), Col("ValidityDate", "Geçerlilik", "date"),
                Col("GrandTotal", "Genel Toplam", "money"), Col("StatusLabel", "Durum"), Col("OrderNo", "Sipariş"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> CrmActivitiesAsync(int id, CancellationToken ct)
    {
        if (!await HasColAsync("CRM_Opportunity", "CustomerCardID", ct)) return null;
        var parts = new List<string>();
        if (await HasAsync("CRM_Action", ct))
            parts.Add(@"
SELECT a.ActionDate AS Dt, N'Aksiyon' AS Kind, t.Title AS TypeLabel, o.Title AS OppTitle,
  CAST(a.Description AS nvarchar(1000)) AS Description, a.ContactName,
  CASE WHEN a.IsDone = 1 THEN N'Tamamlandı' ELSE N'Bekliyor' END AS StatusLabel, a.DueDate AS NextDate
FROM dbo.CRM_Action a
INNER JOIN dbo.CRM_Opportunity o ON o.OpportunityID = a.OpportunityID
LEFT JOIN dbo.CRM_ActionType t ON t.ActionTypeID = a.ActionTypeID
WHERE o.CustomerCardID = @id AND a.IsActive = 1");
        if (await HasAsync("CRM_Meeting", ct))
            parts.Add(@"
SELECT m.MeetingDate, N'Görüşme', m.Channel, o.Title,
  CAST(COALESCE(m.Subject + N' — ', N'') + ISNULL(m.Notes, N'') AS nvarchar(1000)), m.ContactName,
  CASE m.Direction WHEN 1 THEN N'Gelen' ELSE N'Giden' END, CAST(m.NextStepDate AS date)
FROM dbo.CRM_Meeting m
INNER JOIN dbo.CRM_Opportunity o ON o.OpportunityID = m.OpportunityID
WHERE o.CustomerCardID = @id");
        if (parts.Count == 0) return null;
        var rows = await RowsAsync($@"
SELECT TOP 1000 * FROM ({string.Join("\nUNION ALL\n", parts)}) x ORDER BY Dt DESC", new { id }, ct);
        return new CardSection
        {
            Key = "aksiyonlar",
            Title = "Aksiyon / Görüşme",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("Kind", "Kayıt"), Col("TypeLabel", "Tip / Kanal"),
                Col("OppTitle", "Fırsat"), Col("Description", "Açıklama"), Col("ContactName", "Kişi"),
                Col("StatusLabel", "Durum"), Col("NextDate", "Vade / Sonraki", "date"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> CrmMailsAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("CRM_MailLog", ct) || !await HasColAsync("CRM_Opportunity", "CustomerCardID", ct)) return null;
        var rows = await RowsAsync(@"
SELECT TOP 500 l.MailDate AS Dt, CASE l.Direction WHEN 1 THEN N'Giden' ELSE N'Gelen' END AS DirLabel,
  l.Channel, l.Subject, l.MailFrom, l.MailTo, l.AttachmentNames, l.TagCode,
  CASE l.Status WHEN 0 THEN N'Taslak' WHEN 1 THEN N'Gönderildi' WHEN 2 THEN N'Hata' WHEN 3 THEN N'Alındı' ELSE N'?' END AS StatusLabel
FROM dbo.CRM_MailLog l
INNER JOIN dbo.CRM_Opportunity o ON o.OpportunityID = l.OpportunityID
WHERE o.CustomerCardID = @id
ORDER BY l.MailDate DESC, l.MailLogID DESC", new { id }, ct);
        return new CardSection
        {
            Key = "mailler",
            Title = "Yazışmalar",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DirLabel", "Yön"), Col("Channel", "Kanal"), Col("Subject", "Konu"),
                Col("MailFrom", "Kimden"), Col("MailTo", "Kime"), Col("AttachmentNames", "Ekler"),
                Col("TagCode", "CRM Kodu"), Col("StatusLabel", "Durum"),
            },
            Rows = rows,
            Note = "Outlook eklentisinin CRM'e kaydettiği ve CRM'den gönderilen mailler (müşterinin tüm fırsatları).",
        };
    }

    // ── MALZEME ─────────────────────────────────────────────────────────

    // RecordsRepository.RefreshProductCardStatsAsync ile aynı stok yönü
    private const string StockSign = @"CASE {0}
      WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN -1 WHEN 4 THEN -1 WHEN 5 THEN 1
      WHEN 8 THEN -1 WHEN 9 THEN 1 WHEN 10 THEN -1 ELSE 0 END";

    private async Task<(string Qty, string Vt)> ProductExprAsync(CancellationToken ct)
    {
        var pt = await ColsAsync("ProductTrans", ct);
        var qty = pt.Contains("MainUnitQuantity")
            ? "CAST(ISNULL(NULLIF(t.MainUnitQuantity, 0), ISNULL(t.Quantity, 0)) AS float)"
            : "CAST(ISNULL(t.Quantity, 0) AS float)";
        var vt = pt.Contains("VoucherType") ? "COALESCE(t.VoucherType, p.VoucherType)" : "p.VoucherType";
        return (qty, vt);
    }

    private async Task<List<RawRow>> ProductStatementAsync(int id, CardStatementResult res, CancellationToken ct)
    {
        if (!await HasAsync("ProductTrans", ct) || !await HasAsync("ProductVoucher", ct)) return new();
        var (qty, vt) = await ProductExprAsync(ct);
        var sign = string.Format(StockSign, vt);
        var hasAim = await HasColAsync("ProductTrans", "AimWhouseID", ct);
        var hasWh = await HasAsync("SYS_Whouse", ct);
        var party = hasWh
            ? $"CAST(CONCAT(w.Name, CASE WHEN {vt} = 6 {(hasAim ? "AND aw.Name IS NOT NULL" : "AND 1 = 0")} THEN N' → ' + {(hasAim ? "aw.Name" : "''")} ELSE '' END, CASE WHEN cc.Title IS NOT NULL THEN N' · ' + cc.Title ELSE '' END) AS nvarchar(300))"
            : "CAST(cc.Title AS nvarchar(300))";
        res.StatementNote = "Ambar transferleri giriş ve çıkış olarak birlikte gösterilir (stoğa net etkisi yok); sayım ve maliyet dağıtım fişleri stok bakiyesini değiştirmez.";
        var sql = $@"
SELECT
  COALESCE(t.TransDate, p.VoucherDate) AS Dt,
  p.DocumentNumber AS DocNo,
  'ProductVoucher' AS Source,
  CAST({vt} AS int) AS TypeCode,
  CAST(COALESCE(t.Description1, p.Description) AS nvarchar(max)) AS Description,
  {party} AS Party,
  CASE WHEN {vt} = 6 OR ({sign}) > 0 THEN {qty} ELSE 0 END AS Debit,
  CASE WHEN {vt} = 6 OR ({sign}) < 0 THEN {qty} ELSE 0 END AS Credit,
  t.Price AS Price,
  t.TotalPrice AS Amount,
  p.ProductVoucherID AS SourceId
FROM dbo.ProductTrans t
INNER JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = p.CustomerID
{(hasWh ? "LEFT JOIN dbo.SYS_Whouse w ON w.WhouseId = COALESCE(t.WhouseID, p.WhouseID)" : "")}
{(hasWh && hasAim ? "LEFT JOIN dbo.SYS_Whouse aw ON aw.WhouseId = COALESCE(t.AimWhouseID, p.AimWhouseID)" : "")}
WHERE t.ProductCardID = @id AND ISNULL(p.Status_, 1) <> 3";
        if (!await HasColAsync("ProductTrans", "Description1", ct))
            sql = sql.Replace("COALESCE(t.Description1, p.Description)", "p.Description");
        if (hasAim && !await HasColAsync("ProductVoucher", "AimWhouseID", ct))
            sql = sql.Replace("COALESCE(t.AimWhouseID, p.AimWhouseID)", "t.AimWhouseID");
        return await RawAsync(sql, new { id }, ct);
    }

    private async Task<CardSection?> ProductMovementsAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("ProductTrans", ct)) return null;
        var (qty, vt) = await ProductExprAsync(ct);
        var hasWh = await HasAsync("SYS_Whouse", ct);
        var parts = new List<string>();
        if (await HasAsync("ProductVoucher", ct))
            parts.Add($@"
SELECT COALESCE(t.TransDate, p.VoucherDate) AS Dt, 'ProductVoucher' AS Source, CAST({vt} AS int) AS TypeCode,
  CAST(p.DocumentNumber AS nvarchar(100)) AS DocNo, p.CustomerID, COALESCE(t.WhouseID, p.WhouseID) AS WhouseID,
  {qty} AS Qty, CAST(t.Price AS float) AS Price, CAST(t.TotalPrice AS float) AS Total, t.ProductTransID AS LineId
FROM dbo.ProductTrans t INNER JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
WHERE t.ProductCardID = @id");
        var invType = await InvoiceTypeColAsync(ct);
        if (invType != null && await HasColAsync("ProductTrans", "InvoiceID", ct))
        {
            var doc = await InvoiceDocColAsync(ct);
            parts.Add($@"
SELECT COALESCE(t.TransDate, i.InvoiceDate), 'Invoice', CAST(i.[{invType}] AS int),
  CAST({(doc != null ? $"i.[{doc}]" : "NULL")} AS nvarchar(100)), i.CustomerID, COALESCE(t.WhouseID, i.WhouseID),
  {qty}, CAST(t.Price AS float), CAST(t.TotalPrice AS float), t.ProductTransID
FROM dbo.ProductTrans t INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE t.ProductCardID = @id AND t.ProductVoucherID IS NULL");
        }
        if (await HasAsync("OrderTrans", ct) && await HasAsync("OrderVoucher", ct))
        {
            var fk = await HasColAsync("OrderTrans", "OrderVoucherID", ct)
                ? "COALESCE(t.OrderVoucherID, t.OrderSlipID)" : "t.OrderSlipID";
            parts.Add($@"
SELECT o.OrderDate, 'OrderVoucher', CAST(o.Type_ AS int), CAST(o.OrderSlipNo AS nvarchar(100)), o.CustomerID,
  COALESCE(t.WhouseID, o.WhouseID), CAST(ISNULL(t.Quantity, 0) AS float), CAST(t.Price AS float),
  CAST(t.TotalPrice AS float), t.OrderTransID
FROM dbo.OrderTrans t INNER JOIN dbo.OrderVoucher o ON o.OrderVoucherID = {fk}
WHERE t.ItemsID = @id");
        }
        if (parts.Count == 0) return null;
        var rows = await RowsAsync($@"
SELECT TOP 2000 d.Dt, d.Source, d.TypeCode, d.DocNo, cc.Title AS CustomerTitle,
  {(hasWh ? "w.Name" : "CAST(d.WhouseID AS nvarchar(20))")} AS WhouseName, d.Qty, d.Price, d.Total
FROM ({string.Join("\nUNION ALL\n", parts)}) d
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = d.CustomerID
{(hasWh ? "LEFT JOIN dbo.SYS_Whouse w ON w.WhouseId = d.WhouseID" : "")}
ORDER BY d.Dt DESC, d.LineId DESC", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "hareketler",
            Title = "Hareketler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("SourceLabel", "Belge Türü"), Col("TypeLabel", "Tür"),
                Col("DocNo", "Belge No"), Col("CustomerTitle", "Cari"), Col("WhouseName", "Ambar"),
                Col("Qty", "Miktar", "qty"), Col("Price", "Birim Fiyat", "money"), Col("Total", "Tutar", "money"),
            },
            Rows = rows,
            Note = "İrsaliye / malzeme fişi, fatura ve sipariş satırları birlikte listelenir.",
        };
    }

    private async Task<CardSection?> ProductWarehousesAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("ProductTrans", ct) || !await HasAsync("ProductVoucher", ct)) return null;
        var (qty, vt) = await ProductExprAsync(ct);
        var sign = string.Format(StockSign, vt);
        var hasAim = await HasColAsync("ProductTrans", "AimWhouseID", ct);
        var aim = hasAim
            ? (await HasColAsync("ProductVoucher", "AimWhouseID", ct) ? "COALESCE(t.AimWhouseID, p.AimWhouseID)" : "t.AimWhouseID")
            : null;
        var transferIn = aim != null
            ? $@"
UNION ALL
SELECT {aim}, {qty}, 0
FROM dbo.ProductTrans t INNER JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
WHERE t.ProductCardID = @id AND ISNULL(p.Status_, 1) <> 3 AND {vt} = 6 AND {aim} IS NOT NULL"
            : "";
        var hasWh = await HasAsync("SYS_Whouse", ct);
        var rows = await RowsAsync($@"
SELECT COALESCE({(hasWh ? "w.WhouseCode, " : "")}N'#' + CAST(x.WhouseID AS nvarchar(20)), N'(Ambarsız)') AS WhouseCode,
  {(hasWh ? "w.Name" : "CAST(NULL AS nvarchar(100))")} AS WhouseName,
  SUM(x.InQty) AS InQty, SUM(x.OutQty) AS OutQty, SUM(x.InQty) - SUM(x.OutQty) AS Stock
FROM (
  SELECT COALESCE(t.WhouseID, p.WhouseID) AS WhouseID,
    CASE WHEN ({sign}) > 0 THEN {qty} ELSE 0 END AS InQty,
    CASE WHEN ({sign}) < 0 OR ({vt} = 6 {(aim != null ? $"AND {aim} IS NOT NULL" : "AND 1 = 0")}) THEN {qty} ELSE 0 END AS OutQty
  FROM dbo.ProductTrans t INNER JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
  WHERE t.ProductCardID = @id AND ISNULL(p.Status_, 1) <> 3
  {transferIn}
) x
{(hasWh ? "LEFT JOIN dbo.SYS_Whouse w ON w.WhouseId = x.WhouseID" : "")}
GROUP BY x.WhouseID{(hasWh ? ", w.WhouseCode, w.Name" : "")}
ORDER BY 1", new { id }, ct);
        return new CardSection
        {
            Key = "ambar",
            Title = "Ambar Durumu",
            Columns = new()
            {
                Col("WhouseCode", "Ambar Kodu"), Col("WhouseName", "Ambar Adı"), Col("InQty", "Giriş", "qty"),
                Col("OutQty", "Çıkış", "qty"), Col("Stock", "Mevcut", "qty"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> ProductOrdersAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("OrderTrans", ct) || !await HasAsync("OrderVoucher", ct)) return null;
        var fk = await HasColAsync("OrderTrans", "OrderVoucherID", ct)
            ? "COALESCE(t.OrderVoucherID, t.OrderSlipID)" : "t.OrderSlipID";
        var rows = await RowsAsync($@"
SELECT TOP 1000 o.OrderDate AS Dt, 'OrderVoucher' AS Source, CAST(o.Type_ AS int) AS TypeCode,
  o.OrderSlipNo AS DocNo, cc.Title AS CustomerTitle,
  CASE WHEN ISNULL(o.Status_, 1) = 1 THEN N'Açık' ELSE N'Durum ' + CAST(o.Status_ AS nvarchar(10)) END AS StatusLabel,
  t.Quantity AS Qty, t.Price, t.TotalPrice AS Total
FROM dbo.OrderTrans t
INNER JOIN dbo.OrderVoucher o ON o.OrderVoucherID = {fk}
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = o.CustomerID
WHERE t.ItemsID = @id
ORDER BY CASE WHEN ISNULL(o.Status_, 1) = 1 THEN 0 ELSE 1 END, o.OrderDate DESC", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "siparisler",
            Title = "Siparişler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DocNo", "Sipariş No"), Col("TypeLabel", "Tür"),
                Col("CustomerTitle", "Cari"), Col("StatusLabel", "Durum"), Col("Qty", "Miktar", "qty"),
                Col("Price", "Birim Fiyat", "money"), Col("Total", "Tutar", "money"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> ProductCustomersAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("ProductTrans", ct)) return null;
        var (qty, vt) = await ProductExprAsync(ct);
        var parts = new List<string>();
        if (await HasColAsync("ProductVoucher", "CustomerID", ct))
            parts.Add($@"
SELECT p.CustomerID, CASE WHEN {vt} IN (3, 4) THEN 1 ELSE 0 END AS IsSale,
  CASE WHEN {vt} = 2 THEN 1 ELSE 0 END AS IsPurchase, {qty} AS Qty, CAST(ISNULL(t.TotalPrice, 0) AS float) AS Total
FROM dbo.ProductTrans t INNER JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
WHERE t.ProductCardID = @id AND p.CustomerID IS NOT NULL AND ISNULL(p.Status_, 1) <> 3");
        var invType = await InvoiceTypeColAsync(ct);
        if (invType != null && await HasColAsync("ProductTrans", "InvoiceID", ct) && await HasColAsync("Invoice", "CustomerID", ct))
            parts.Add($@"
SELECT i.CustomerID, CASE WHEN i.[{invType}] = 1 THEN 1 ELSE 0 END, CASE WHEN i.[{invType}] IN (2, 5) THEN 1 ELSE 0 END,
  {qty}, CAST(ISNULL(t.TotalPrice, 0) AS float)
FROM dbo.ProductTrans t INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE t.ProductCardID = @id AND t.ProductVoucherID IS NULL AND i.CustomerID IS NOT NULL");
        if (parts.Count == 0) return null;
        var rows = await RowsAsync($@"
SELECT cc.Code AS CustomerCode, cc.Title AS CustomerTitle,
  SUM(CASE WHEN d.IsPurchase = 1 THEN d.Qty ELSE 0 END) AS PurchaseQty,
  SUM(CASE WHEN d.IsPurchase = 1 THEN d.Total ELSE 0 END) AS PurchaseTotal,
  SUM(CASE WHEN d.IsSale = 1 THEN d.Qty ELSE 0 END) AS SaleQty,
  SUM(CASE WHEN d.IsSale = 1 THEN d.Total ELSE 0 END) AS SaleTotal
FROM ({string.Join("\nUNION ALL\n", parts)}) d
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = d.CustomerID
GROUP BY cc.Code, cc.Title
ORDER BY cc.Code", new { id }, ct);
        return new CardSection
        {
            Key = "cariler",
            Title = "Cari Bazında",
            Columns = new()
            {
                Col("CustomerCode", "Cari Kodu"), Col("CustomerTitle", "Cari Unvanı"),
                Col("PurchaseQty", "Alış Miktarı", "qty"), Col("PurchaseTotal", "Alış Tutarı", "money"),
                Col("SaleQty", "Satış Miktarı", "qty"), Col("SaleTotal", "Satış Tutarı", "money"),
            },
            Rows = rows,
        };
    }

    // ── BANKA / BANKA HESABI ────────────────────────────────────────────

    private async Task<(string From, string Where, bool HasVoucher)> BankScopeAsync(string kind, CancellationToken ct)
    {
        var hasVoucher = await HasColAsync("BankTrans", "BankVoucherID", ct) && await HasAsync("BankVoucher", ct);
        var voucherAcc = hasVoucher && await HasColAsync("BankVoucher", "BankAccountCardID", ct);
        var acc = voucherAcc ? "COALESCE(bt.BankAccountCardID, bv.BankAccountCardID)" : "bt.BankAccountCardID";
        var from = $@"FROM dbo.BankTrans bt
{(hasVoucher ? "LEFT JOIN dbo.BankVoucher bv ON bv.BankVoucherID = bt.BankVoucherID" : "")}";
        var where = kind == "bank"
            ? $"(bt.BankCardID = @id OR {acc} IN (SELECT BankAccountCardID FROM dbo.BankAccountCard WHERE BankCardID = @id))"
            : $"{acc} = @id";
        return (from, where, hasVoucher);
    }

    /// <summary>Banka girişi mi? Fiş tipi (havale gelen/giden…) öncelikli, yoksa satır tipi / tutar işareti.</summary>
    private static string BankInCond(bool hasVoucher)
    {
        var lineRule = "(bt.Type_ IN (1, 3) OR (bt.Type_ NOT IN (2, 4) AND ISNULL(bt.Amount, 0) >= 0))";
        return hasVoucher
            ? $"(bv.Type_ IN {BankInTypes} OR (ISNULL(bv.Type_, 0) NOT IN {BankOutTypes} AND {lineRule}))"
            : lineRule;
    }

    private async Task<List<RawRow>> BankStatementAsync(string kind, int id, CardStatementResult res, CancellationToken ct)
    {
        if (!await HasAsync("BankTrans", ct)) return new();
        var (from, where, hv) = await BankScopeAsync(kind, ct);
        var inCond = BankInCond(hv);
        var cols = await ColsAsync("BankTrans", ct);
        var desc = cols.Contains("Description")
            ? (hv ? "COALESCE(bt.Description, bv.Description)" : "bt.Description")
            : (hv ? "bv.Description" : "NULL");
        var cust = cols.Contains("CustomerID");
        var party = kind == "bank"
            ? (cust ? "CONCAT(ba.Code, CASE WHEN cc.Title IS NOT NULL THEN N' · ' + cc.Title ELSE '' END)" : "ba.Code")
            : (cust ? "cc.Title" : "NULL");
        var expense = cols.Contains("Expense") ? " + ISNULL(bt.Expense, 0)" : "";
        var sql = $@"
SELECT
  {(hv ? "COALESCE(bt.TransDate, bv.VoucherDate)" : "bt.TransDate")} AS Dt,
  {(hv && await HasColAsync("BankVoucher", "DocumentNumber", ct) ? "bv.DocumentNumber" : "NULL")} AS DocNo,
  'BankVoucher' AS Source,
  CAST({(hv ? "COALESCE(bv.Type_, bt.Type_)" : "bt.Type_")} AS int) AS TypeCode,
  CAST({desc} AS nvarchar(max)) AS Description,
  CAST({party} AS nvarchar(300)) AS Party,
  CASE WHEN {inCond} THEN ABS(ISNULL(bt.Amount, 0)) ELSE 0 END AS Debit,
  CASE WHEN {inCond} THEN 0 ELSE ABS(ISNULL(bt.Amount, 0)) END{expense} AS Credit,
  bt.Amount AS Amount,
  {(hv ? "bt.BankVoucherID" : "bt.BankTtansID")} AS SourceId
{from}
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = bt.BankAccountCardID
{(cust ? "LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = bt.CustomerID" : "")}
WHERE {where}";
        if (expense.Length > 0)
            res.StatementNote = "Banka masrafları çıkış tutarına eklenmiştir.";
        var rows = await RawAsync(sql, new { id }, ct);
        rows.AddRange(await SafeBankTransfersAsync(kind, id, ct));
        rows.AddRange(await BoundRollMovesAsync(kind, id, ct));
        return rows;
    }

    private async Task<CardSection?> BankVouchersAsync(string kind, int id, CancellationToken ct)
    {
        if (!await HasAsync("BankTrans", ct)) return null;
        var (from, where, hv) = await BankScopeAsync(kind, ct);
        if (!hv) return null;
        var inCond = BankInCond(true);
        var rows = await RowsAsync($@"
SELECT TOP 2000 bv.VoucherDate AS Dt, 'BankVoucher' AS Source, CAST(bv.Type_ AS int) AS TypeCode,
  bv.DocumentNumber AS DocNo, bv.Description, x.Lines,
  x.InTotal, x.OutTotal
FROM dbo.BankVoucher bv
INNER JOIN (
  SELECT bt.BankVoucherID, COUNT(1) AS Lines,
    SUM(CASE WHEN {inCond} THEN ABS(ISNULL(bt.Amount, 0)) ELSE 0 END) AS InTotal,
    SUM(CASE WHEN {inCond} THEN 0 ELSE ABS(ISNULL(bt.Amount, 0)) END) AS OutTotal
  {from}
  WHERE {where}
  GROUP BY bt.BankVoucherID
) x ON x.BankVoucherID = bv.BankVoucherID
ORDER BY bv.VoucherDate DESC, bv.BankVoucherID DESC", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "hareketler",
            Title = "Hareketler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DocNo", "Fiş No"), Col("TypeLabel", "Fiş Türü"),
                Col("Description", "Açıklama"), Col("Lines", "Satır", "qty"),
                Col("InTotal", "Giriş", "money"), Col("OutTotal", "Çıkış", "money"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> BankAccountsAsync(int id, CancellationToken ct)
    {
        if (!await HasAsync("BankAccountCard", ct)) return null;
        var hasTrans = await HasAsync("BankTrans", ct);
        var (from, _, hv) = hasTrans ? await BankScopeAsync("bankAccount", ct) : ("", "", false);
        var acc = hv && await HasColAsync("BankVoucher", "BankAccountCardID", ct)
            ? "COALESCE(bt.BankAccountCardID, bv.BankAccountCardID)" : "bt.BankAccountCardID";
        var inCond = BankInCond(hv);
        var apply = hasTrans
            ? $@"OUTER APPLY (
  SELECT SUM(CASE WHEN {inCond} THEN ABS(ISNULL(bt.Amount, 0)) ELSE 0 END) AS InTotal,
         SUM(CASE WHEN {inCond} THEN 0 ELSE ABS(ISNULL(bt.Amount, 0)) END) AS OutTotal
  {from}
  WHERE {acc} = a.BankAccountCardID
) x"
            : "OUTER APPLY (SELECT CAST(0 AS float) AS InTotal, CAST(0 AS float) AS OutTotal) x";
        var rows = await RowsAsync($@"
SELECT a.Code, a.Title, a.IbanNO, CASE WHEN ISNULL(a.IsActive, 1) = 1 THEN N'Aktif' ELSE N'Pasif' END AS StatusLabel,
  ISNULL(x.InTotal, 0) AS InTotal, ISNULL(x.OutTotal, 0) AS OutTotal,
  ISNULL(x.InTotal, 0) - ISNULL(x.OutTotal, 0) AS Balance
FROM dbo.BankAccountCard a
{apply}
WHERE a.BankCardID = @id
ORDER BY a.Code", new { id }, ct);
        return new CardSection
        {
            Key = "hesaplar",
            Title = "Hesaplar",
            Columns = new()
            {
                Col("Code", "Hesap Kodu"), Col("Title", "Hesap Adı"), Col("IbanNO", "IBAN"), Col("StatusLabel", "Durum"),
                Col("InTotal", "Giriş", "money"), Col("OutTotal", "Çıkış", "money"), Col("Balance", "Bakiye", "money"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> BankCustomersAsync(string kind, int id, CancellationToken ct)
    {
        if (!await HasColAsync("BankTrans", "CustomerID", ct)) return null;
        var (from, where, hv) = await BankScopeAsync(kind, ct);
        var inCond = BankInCond(hv);
        var rows = await RowsAsync($@"
SELECT cc.Code AS CustomerCode, cc.Title AS CustomerTitle, COUNT(1) AS Lines,
  SUM(CASE WHEN {inCond} THEN ABS(ISNULL(bt.Amount, 0)) ELSE 0 END) AS InTotal,
  SUM(CASE WHEN {inCond} THEN 0 ELSE ABS(ISNULL(bt.Amount, 0)) END) AS OutTotal
{from}
INNER JOIN dbo.CustomerCard cc ON cc.CustomerCardID = bt.CustomerID
WHERE {where}
GROUP BY cc.Code, cc.Title
ORDER BY cc.Code", new { id }, ct);
        return new CardSection
        {
            Key = "cariler",
            Title = "Cari Bazında",
            Columns = new()
            {
                Col("CustomerCode", "Cari Kodu"), Col("CustomerTitle", "Cari Unvanı"), Col("Lines", "Satır", "qty"),
                Col("InTotal", "Giriş", "money"), Col("OutTotal", "Çıkış", "money"),
            },
            Rows = rows,
        };
    }

    // ── HESAP PLANI (muavin) ────────────────────────────────────────────

    /// <summary>Kartın kendisi + alt hesapları (MainAccountID veya kod öneki «100.» / «100-»).</summary>
    private async Task<List<int>> AccountIdsAsync(int id, string? code, CancellationToken ct)
    {
        var cols = await ColsAsync("AccountCard", ct);
        if (cols.Count == 0) return new() { id };
        var conds = new List<string> { "AccountCardID = @id" };
        if (cols.Contains("MainAccountID")) conds.Add("MainAccountID = @id");
        if (!string.IsNullOrWhiteSpace(code))
            conds.Add("(Code LIKE @prefix + '.%' OR Code LIKE @prefix + '-%' OR Code LIKE @prefix + ' %')");
        var ids = await _db.QueryAsync<int>(new CommandDefinition(
            $"SELECT AccountCardID FROM dbo.AccountCard WHERE {string.Join(" OR ", conds)}",
            new { id, prefix = code?.Trim() ?? "" }, cancellationToken: ct));
        var list = ids.Distinct().ToList();
        if (!list.Contains(id)) list.Add(id);
        return list;
    }

    private async Task<(string Debit, string Credit)> AccountAmountExprAsync(CancellationToken ct)
    {
        var c = await ColsAsync("AccountTrans", ct);
        if (c.Contains("Debit") && c.Contains("Credit"))
            return (
                "CASE WHEN at.Debit IS NOT NULL OR at.Credit IS NOT NULL THEN ISNULL(at.Debit, 0) WHEN ISNULL(at.Amount, 0) >= 0 THEN ISNULL(at.Amount, 0) ELSE 0 END",
                "CASE WHEN at.Debit IS NOT NULL OR at.Credit IS NOT NULL THEN ISNULL(at.Credit, 0) WHEN ISNULL(at.Amount, 0) < 0 THEN -at.Amount ELSE 0 END");
        return (
            "CASE WHEN ISNULL(at.Amount, 0) >= 0 THEN ISNULL(at.Amount, 0) ELSE 0 END",
            "CASE WHEN ISNULL(at.Amount, 0) < 0 THEN -at.Amount ELSE 0 END");
    }

    private async Task<List<RawRow>> AccountStatementAsync(List<int> ids, int id, CardStatementResult res, CancellationToken ct)
    {
        if (!await HasAsync("AccountTrans", ct)) return new();
        var hv = await HasColAsync("AccountTrans", "AccountVoucherID", ct) && await HasAsync("AccountVoucher", ct);
        var (debit, credit) = await AccountAmountExprAsync(ct);
        if (ids.Count > 1)
            res.StatementNote = $"Ana hesap: {ids.Count - 1} alt hesabın hareketleri dahil.";
        var sql = $@"
SELECT
  {(hv ? "COALESCE(av.VoucherDate, at.TransDate)" : "at.TransDate")} AS Dt,
  {(hv ? "av.DocumentNumber" : "NULL")} AS DocNo,
  'AccountVoucher' AS Source,
  {(hv ? "CAST(av.[Type] AS int)" : "NULL")} AS TypeCode,
  CAST({(hv ? "COALESCE(at.Description, av.Description)" : "at.Description")} AS nvarchar(max)) AS Description,
  CAST(CASE WHEN at.AccountCardID <> @id THEN CONCAT(ac.Code, N' ', ac.Title) END AS nvarchar(300)) AS Party,
  {debit} AS Debit,
  {credit} AS Credit,
  {(hv ? "at.AccountVoucherID" : "NULL")} AS SourceId
FROM dbo.AccountTrans at
{(hv ? "LEFT JOIN dbo.AccountVoucher av ON av.AccountVoucherID = at.AccountVoucherID" : "")}
LEFT JOIN dbo.AccountCard ac ON ac.AccountCardID = at.AccountCardID
WHERE at.AccountCardID IN @ids";
        return await RawAsync(sql, new { ids, id }, ct);
    }

    private async Task<CardSection?> AccountVouchersAsync(List<int> ids, CancellationToken ct)
    {
        if (!await HasColAsync("AccountTrans", "AccountVoucherID", ct) || !await HasAsync("AccountVoucher", ct)) return null;
        var (debit, credit) = await AccountAmountExprAsync(ct);
        var journal = await HasColAsync("AccountVoucher", "journalNO", ct) ? "av.journalNO" : "NULL";
        var rows = await RowsAsync($@"
SELECT TOP 2000 av.VoucherDate AS Dt, 'AccountVoucher' AS Source, CAST(av.[Type] AS int) AS TypeCode,
  av.DocumentNumber AS DocNo, {journal} AS JournalNo, av.Description, x.Lines, x.Debit, x.Credit
FROM dbo.AccountVoucher av
INNER JOIN (
  SELECT at.AccountVoucherID, COUNT(1) AS Lines, SUM({debit}) AS Debit, SUM({credit}) AS Credit
  FROM dbo.AccountTrans at
  WHERE at.AccountCardID IN @ids
  GROUP BY at.AccountVoucherID
) x ON x.AccountVoucherID = av.AccountVoucherID
ORDER BY av.VoucherDate DESC, av.AccountVoucherID DESC", new { ids }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "hareketler",
            Title = "Hareketler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DocNo", "Fiş No"), Col("JournalNo", "Yevmiye No"),
                Col("TypeLabel", "Fiş Türü"), Col("Description", "Açıklama"), Col("Lines", "Satır", "qty"),
                Col("Debit", "Borç", "money"), Col("Credit", "Alacak", "money"),
            },
            Rows = rows,
        };
    }

    private async Task<CardSection?> AccountChildrenAsync(int id, List<int> ids, CancellationToken ct)
    {
        var hasTrans = await HasAsync("AccountTrans", ct);
        var (debit, credit) = await AccountAmountExprAsync(ct);
        var apply = hasTrans
            ? $@"OUTER APPLY (SELECT SUM({debit}) AS Debit, SUM({credit}) AS Credit
              FROM dbo.AccountTrans at WHERE at.AccountCardID = ac.AccountCardID) x"
            : "OUTER APPLY (SELECT CAST(0 AS float) AS Debit, CAST(0 AS float) AS Credit) x";
        var rows = await RowsAsync($@"
SELECT ac.Code, ac.Title, ISNULL(x.Debit, 0) AS Debit, ISNULL(x.Credit, 0) AS Credit,
  ISNULL(x.Debit, 0) - ISNULL(x.Credit, 0) AS Balance
FROM dbo.AccountCard ac
{apply}
WHERE ac.AccountCardID IN @ids AND ac.AccountCardID <> @id
ORDER BY ac.Code", new { ids, id }, ct);
        return new CardSection
        {
            Key = "althesaplar",
            Title = "Alt Hesaplar",
            Columns = new()
            {
                Col("Code", "Hesap Kodu"), Col("Title", "Hesap Adı"), Col("Debit", "Borç", "money"),
                Col("Credit", "Alacak", "money"), Col("Balance", "Bakiye", "money"),
            },
            Rows = rows,
        };
    }

    // ── ÇEK / SENET ─────────────────────────────────────────────────────

    private async Task<CardSection?> BoundMovementsAsync(int id, CancellationToken ct)
    {
        var cols = await ColsAsync("BoundTrans", ct);
        if (!cols.Contains("CheckID")) return null;
        var rows = await RowsAsync(@"
SELECT TOP 1000 bt.TransDate AS Dt, 'BoundTrans' AS Source, CAST(bt.Type_ AS int) AS TypeCode,
  bt.DocumentNumber AS DocNo, cc.Title AS CustomerTitle, ba.Title AS BankAccountTitle
FROM dbo.BoundTrans bt
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = bt.CustomerID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = bt.BankAccountID
WHERE bt.CheckID = @id
ORDER BY bt.TransDate, bt.BoundTransID", new { id }, ct);
        LabelRows(rows);
        return new CardSection
        {
            Key = "hareketler",
            Title = "Hareketler",
            Columns = new()
            {
                Col("Dt", "Tarih", "date"), Col("DocNo", "Bordro No"), Col("TypeLabel", "İşlem"),
                Col("CustomerTitle", "Cari"), Col("BankAccountTitle", "Banka Hesabı"),
            },
            Rows = rows,
        };
    }
}
