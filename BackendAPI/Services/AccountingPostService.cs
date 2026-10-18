using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class AccountingPostResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int? AccountVoucherID { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public List<string> Missing { get; set; } = new();
}

/// <summary>
/// Y-09: kaynak belgeden muhasebe fişi (AccountVoucher + AccountTrans). Hesaplar Muhasebe Bağlantılarından
/// (AccountLinkDetail: önce kartın kendi satırı, yoksa öndeğer SourceCardID = −1) çözülür.
/// SourceModule = AccountLinkModule (7 Fatura, 4 Kasa); aynı belgeye ikinci kez muhasebeleştirmede eski fiş silinip yeniden oluşturulur
/// (yevmiye numarası almış fiş korunur). Setting ACC_AUTO_POST = 1 ise kayıtta kendiliğinden çalışır.
/// Fatura: 1 Satış / 7 Satış fiyat farkı → cari B, satış A, KDV satış A · 2 Alış / 5 Alınan hizmet / 6 Alış fiyat farkı → alış B, KDV alış B, cari A ·
/// 3 Satış iade → iade B, KDV satış iade B, cari A · 4 Alış iade → cari B, alış iade A, KDV alış iade A.
/// </summary>
public sealed class AccountingPostService
{
    public const int ModuleProduct = 1, ModuleCustomer = 2, ModuleBank = 3, ModuleSafe = 4, ModuleTax = 6, ModuleInvoice = 7;

    private readonly IDbConnection _db;

    public AccountingPostService(IDbConnection db)
    {
        _db = db;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<bool> AutoPostEnabledAsync()
    {
        Open();
        try
        {
            return (await _db.ExecuteScalarAsync<string?>("SELECT TOP 1 Value FROM dbo.Setting WHERE Code = 'ACC_AUTO_POST'"))?.Trim() == "1";
        }
        catch
        {
            return false;
        }
    }

    private sealed record Line(int AccountCardID, string Description, decimal Debit, decimal Credit);

    private sealed class Builder
    {
        public readonly List<Line> Lines = new();
        public readonly List<string> Missing = new();

        public void Add(int? account, string what, string desc, decimal debit, decimal credit)
        {
            if (debit == 0 && credit == 0) return;
            if (account is not int a)
            {
                if (!Missing.Contains(what)) Missing.Add(what);
                return;
            }
            // Aynı hesap ve aynı taraf tek satırda toplanır
            var i = Lines.FindIndex(l => l.AccountCardID == a && (l.Debit != 0) == (debit != 0));
            if (i >= 0) Lines[i] = Lines[i] with { Debit = Lines[i].Debit + debit, Credit = Lines[i].Credit + credit };
            else Lines.Add(new Line(a, desc, debit, credit));
        }
    }

    /// <summary>Bağlantı hesabı: kartın satırı, yoksa öndeğer (−1). AccountID hesap kartı ID'si ya da hesap kodu olabilir.</summary>
    private async Task<int?> ResolveAsync(int module, int? type, int? sourceCardId, IDbTransaction tx)
    {
        var raw = await _db.QueryAsync<int>(
            @"SELECT AccountID FROM dbo.AccountLinkDetail
WHERE Module = @module AND (@type IS NULL OR Type = @type) AND SourceCardID IN (@src, -1)
  AND AccountID IS NOT NULL AND AccountID <> 0
ORDER BY CASE WHEN SourceCardID = @src THEN 0 ELSE 1 END, AccountLinkDetailID",
            new { module, type, src = sourceCardId ?? -1 }, tx);
        foreach (var acc in raw)
        {
            var id = await _db.ExecuteScalarAsync<int?>(
                @"SELECT TOP 1 AccountCardID FROM dbo.AccountCard
WHERE AccountCardID = @acc OR Code = CAST(@acc AS nvarchar(50))
ORDER BY CASE WHEN AccountCardID = @acc THEN 0 ELSE 1 END",
                new { acc }, tx);
            if (id is int found) return found;
        }
        return null;
    }

    private static decimal R(double? v) => Math.Round((decimal)(v ?? 0), 2, MidpointRounding.AwayFromZero);

    public async Task<AccountingPostResult> PostAsync(string source, int id, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        try
        {
            var result = source.ToLowerInvariant() switch
            {
                "invoice" => await PostInvoiceAsync(id, tx),
                "safevoucher" => await PostSafeVoucherAsync(id, tx),
                _ => new AccountingPostResult { Message = "Desteklenmeyen kaynak: " + source },
            };
            if (result.Success) tx.Commit();
            else tx.Rollback();
            return result;
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return new AccountingPostResult { Message = "Muhasebeleştirme hatası: " + ex.Message };
        }
    }

    /// <summary>Belgenin muhasebe fişini siler (belge silinince). Yevmiye numarası almışsa dokunmaz.</summary>
    public async Task<string?> UnpostAsync(string source, int id)
    {
        var module = source.ToLowerInvariant() switch { "invoice" => ModuleInvoice, "safevoucher" => ModuleSafe, _ => 0 };
        if (module == 0) return null;
        Open();
        using var tx = _db.BeginTransaction();
        var msg = await DeleteExistingAsync(module, id, tx);
        tx.Commit();
        return msg;
    }

    private async Task<string?> DeleteExistingAsync(int module, int sourceId, IDbTransaction tx)
    {
        var rows = (await _db.QueryAsync<(int Id, DateTime? Numbered)>(
            "SELECT AccountVoucherID, JournalNumberedAt FROM dbo.AccountVoucher WHERE SourceModule = @module AND SourceID = @sourceId",
            new { module, sourceId }, tx)).ToList();
        if (rows.Any(r => r.Numbered != null))
            return "Muhasebe fişi yevmiye numarası almış — değiştirilmedi.";
        foreach (var r in rows)
        {
            await _db.ExecuteAsync("DELETE FROM dbo.AccountTrans WHERE AccountVoucherID = @Id", new { r.Id }, tx);
            await _db.ExecuteAsync("DELETE FROM dbo.AccountVoucher WHERE AccountVoucherID = @Id", new { r.Id }, tx);
        }
        return null;
    }

    private sealed class InvoiceHead
    {
        public int InvoiceID { get; set; }
        public int? InvoiceType { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public string? DocumentNumber { get; set; }
        public int? CompanyID { get; set; }
        public int? DepartmentID { get; set; }
        public int? CustomerID { get; set; }
        public string? Description { get; set; }
        public string? AuthCode { get; set; }
        public int? Currency { get; set; }
        public double? CurrencyRate { get; set; }
        public string? CustomerTitle { get; set; }
    }

    private sealed class InvoiceLine
    {
        public int? ProductCardID { get; set; }
        public double? TotalPrice { get; set; }
        public double? TotalTax { get; set; }
    }

    private async Task<AccountingPostResult> PostInvoiceAsync(int invoiceId, IDbTransaction tx)
    {
        var h = await _db.QueryFirstOrDefaultAsync<InvoiceHead>(
            @"SELECT i.InvoiceID, i.InvoiceType, i.InvoiceDate, i.DocumentNumber, i.CompanyID, i.DepartmentID, i.CustomerID,
  i.Description, i.AuthCode, i.Currency, i.CurrencyRate, c.Title AS CustomerTitle
FROM dbo.Invoice i LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = i.CustomerID
WHERE i.InvoiceID = @invoiceId", new { invoiceId }, tx);
        if (h == null) return new AccountingPostResult { Message = "Fatura bulunamadı." };
        var lines = (await _db.QueryAsync<InvoiceLine>(
            "SELECT ProductCardID, TotalPrice, TotalTax FROM dbo.ProductTrans WHERE InvoiceID = @invoiceId", new { invoiceId }, tx)).ToList();
        if (lines.Count == 0) return new AccountingPostResult { Message = "Faturada satır yok — muhasebeleştirilmedi." };

        // Yön: satış tarafı (cari borçlu) mı, alış tarafı mı; iade mi
        var t = h.InvoiceType ?? 1;
        var (customerDebit, productLinkType, taxLinkType, label) = t switch
        {
            2 or 5 or 6 => (false, 2, 1, "Alış"),
            3 => (false, 5, 5, "Satış iade"),
            4 => (true, 4, 4, "Alış iade"),
            _ => (true, 3, 2, "Satış"),
        };
        var desc = $"{label} faturası {h.DocumentNumber} {h.CustomerTitle}".Trim();

        var b = new Builder();
        decimal total = 0;
        foreach (var l in lines)
        {
            var net = R(l.TotalPrice);
            var tax = R(l.TotalTax);
            total += net + tax;
            // Malzeme hesabı: kart → öndeğer; yoksa fatura türü bağlantısı
            var acc = await ResolveAsync(ModuleProduct, productLinkType, l.ProductCardID, tx)
                      ?? await ResolveAsync(ModuleInvoice, t, null, tx);
            b.Add(acc, $"{label} hesabı (malzeme / fatura bağlantısı)", desc, customerDebit ? 0 : net, customerDebit ? net : 0);
            if (tax != 0)
            {
                var taxAcc = await ResolveAsync(ModuleTax, taxLinkType, null, tx);
                b.Add(taxAcc, "KDV hesabı (KDV bağlantısı)", desc + " KDV", customerDebit ? 0 : tax, customerDebit ? tax : 0);
            }
        }
        var custAcc = await ResolveAsync(ModuleCustomer, 1, h.CustomerID, tx);
        b.Add(custAcc, "Cari hesabı (cari kartı muhasebe kodu)", desc, customerDebit ? total : 0, customerDebit ? 0 : total);

        return await WriteAsync(ModuleInvoice, invoiceId, 1, h.InvoiceDate ?? DateTime.Today, h.DocumentNumber, desc,
            h.CompanyID, h.DepartmentID, h.AuthCode, h.Currency, h.CurrencyRate, b, tx);
    }

    private sealed class SafeHead
    {
        public int SafeVoucherID { get; set; }
        public int Type_ { get; set; }
        public DateTime VoucherDate { get; set; }
        public string? DocumentNumber { get; set; }
        public int SafeCardID { get; set; }
        public string? Description { get; set; }
        public string? AuthCode { get; set; }
        public int? CompanyID { get; set; }
        public int? Currency { get; set; }
        public double? CurrencyRate { get; set; }
    }

    private sealed class SafeLine
    {
        public int? CustomerID { get; set; }
        public int? BankAccountCardID { get; set; }
        public int? AimSafeCardID { get; set; }
        public int? AccountCardID { get; set; }
        public string? Description { get; set; }
        public double? Amount { get; set; }
    }

    private async Task<AccountingPostResult> PostSafeVoucherAsync(int id, IDbTransaction tx)
    {
        var h = await _db.QueryFirstOrDefaultAsync<SafeHead>(
            "SELECT SafeVoucherID, Type_, VoucherDate, DocumentNumber, SafeCardID, Description, AuthCode, CompanyID, Currency, CurrencyRate FROM dbo.SafeVoucher WHERE SafeVoucherID = @id",
            new { id }, tx);
        if (h == null) return new AccountingPostResult { Message = "Kasa fişi bulunamadı." };
        var lines = (await _db.QueryAsync<SafeLine>(
            "SELECT CustomerID, BankAccountCardID, AimSafeCardID, AccountCardID, Description, Amount FROM dbo.SafeTrans WHERE SafeVoucherID = @id",
            new { id }, tx)).ToList();
        if (lines.Count == 0) return new AccountingPostResult { Message = "Kasa fişinde satır yok — muhasebeleştirilmedi." };

        // Kasa girişi: 1 tahsilat, 4 bankadan kasaya · diğerleri kasa çıkışı
        var safeIn = h.Type_ is 1 or 4;
        var label = h.Type_ switch
        {
            1 => "Tahsilat", 2 => "Tediye", 3 => "Kasadan bankaya", 4 => "Bankadan kasaya", 5 => "Masraf", 6 => "Kasa virman", _ => "Kasa fişi",
        };
        var safeAcc = await ResolveAsync(ModuleSafe, safeIn ? 1 : 2, h.SafeCardID, tx)
                      ?? await ResolveAsync(ModuleSafe, null, h.SafeCardID, tx);
        var b = new Builder();
        foreach (var l in lines)
        {
            var amt = R(l.Amount);
            if (amt == 0) continue;
            var desc = string.IsNullOrWhiteSpace(l.Description) ? $"{label} {h.DocumentNumber}".Trim() : l.Description!;
            b.Add(safeAcc, "Kasa hesabı (kasa kartı muhasebe kodu)", desc, safeIn ? amt : 0, safeIn ? 0 : amt);

            int? counter;
            string what;
            if (l.AccountCardID is int direct && direct > 0) { counter = direct; what = "Karşı hesap"; }
            else if (h.Type_ is 1 or 2) { counter = await ResolveAsync(ModuleCustomer, 1, l.CustomerID, tx); what = "Cari hesabı (cari kartı muhasebe kodu)"; }
            else if (h.Type_ is 3 or 4) { counter = await ResolveAsync(ModuleBank, null, l.BankAccountCardID, tx); what = "Banka hesabı (banka kartı muhasebe kodu)"; }
            else if (h.Type_ == 6)
            {
                counter = await ResolveAsync(ModuleSafe, 1, l.AimSafeCardID, tx) ?? await ResolveAsync(ModuleSafe, null, l.AimSafeCardID, tx);
                what = "Hedef kasa hesabı";
            }
            else { counter = null; what = "Masraf hesabı (satırda muhasebe hesabı seçin)"; }
            b.Add(counter, what, desc, safeIn ? 0 : amt, safeIn ? amt : 0);
        }
        var voucherType = h.Type_ switch { 1 => 2, 2 => 3, _ => 1 };
        return await WriteAsync(ModuleSafe, id, voucherType, h.VoucherDate, h.DocumentNumber, $"{label} {h.DocumentNumber} {h.Description}".Trim(),
            h.CompanyID, null, h.AuthCode, h.Currency, h.CurrencyRate, b, tx);
    }

    private async Task<AccountingPostResult> WriteAsync(int module, int sourceId, int voucherType, DateTime date, string? docNo, string desc,
        int? companyId, int? departmentId, string? authCode, int? currency, double? rate, Builder b, IDbTransaction tx)
    {
        if (b.Missing.Count > 0)
            return new AccountingPostResult
            {
                Missing = b.Missing,
                Message = "Muhasebe bağlantısı eksik: " + string.Join(" · ", b.Missing) +
                          ". Finans → Muhasebe Bağlantıları ya da kartın Muhasebe Hesapları sekmesinden tanımlayın.",
            };
        var debit = b.Lines.Sum(l => l.Debit);
        var credit = b.Lines.Sum(l => l.Credit);
        if (debit != credit)
            return new AccountingPostResult { Message = $"Fiş dengesiz (borç {debit:N2} ≠ alacak {credit:N2})." };

        var locked = await DeleteExistingAsync(module, sourceId, tx);
        if (locked != null) return new AccountingPostResult { Message = locked };

        if (desc.Length > 250) desc = desc[..250];
        var voucherId = await _db.ExecuteScalarAsync<int>(
            "SELECT ISNULL(MAX(CASE WHEN AccountVoucherID > 0 THEN AccountVoucherID END), 0) + 1 FROM dbo.AccountVoucher WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
        await _db.ExecuteAsync(
            @"INSERT INTO dbo.AccountVoucher (AccountVoucherID, CompanyID, DepartmentID, Type, Status, DocumentNumber, SourceModule, SourceID,
  VoucherDate, Description, SumDebit, SumCredit, AuthCode, Currency, CurrencyRate)
VALUES (@voucherId, @companyId, @departmentId, @voucherType, 0, @docNo, @module, @sourceId, @date, @desc, @debit, @credit, @authCode, @currency, @rate)",
            new { voucherId, companyId, departmentId, voucherType, docNo, module, sourceId, date = date.Date, desc, debit, credit, authCode, currency, rate }, tx);

        var transId = await _db.ExecuteScalarAsync<int>(
            "SELECT ISNULL(MAX(CASE WHEN AccountTrasnID > 0 THEN AccountTrasnID END), 0) FROM dbo.AccountTrans WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
        var no = 0;
        foreach (var l in b.Lines)
        {
            no++;
            transId++;
            var d = l.Description.Length > 250 ? l.Description[..250] : l.Description;
            await _db.ExecuteAsync(
                @"INSERT INTO dbo.AccountTrans (AccountTrasnID, CompanyID, DepartmentID, Type_, Status_, AccountCardID, Description, Amount,
  TransDate, Currency, CurrencyRate, TransLineNo, AccountVoucherID, Debit, Credit)
VALUES (@transId, @companyId, @departmentId, @type, 0, @acc, @d, @amount, @date, @currency, @rate, @no, @voucherId, @debit, @credit)",
                new
                {
                    transId, companyId, departmentId, type = l.Debit != 0 ? 1 : 2, acc = l.AccountCardID, d,
                    amount = l.Debit != 0 ? l.Debit : l.Credit, date = date.Date, currency, rate, no, voucherId, debit = l.Debit, credit = l.Credit,
                }, tx);
        }
        return new AccountingPostResult
        {
            Success = true,
            AccountVoucherID = voucherId,
            Debit = debit,
            Credit = credit,
            Message = $"Muhasebe fişi oluşturuldu (#{voucherId}, {b.Lines.Count} satır, {debit:N2}).",
        };
    }

    /// <summary>Muhasebeleşmemiş belgeler (toplu muhasebeleştirme için).</summary>
    public async Task<IEnumerable<dynamic>> PendingAsync(DateTime? from, DateTime? to)
    {
        Open();
        return await _db.QueryAsync(
            @"SELECT 'invoice' AS Source, i.InvoiceID AS Id, i.InvoiceType AS Type, i.InvoiceDate AS Date, i.DocumentNumber, c.Title AS CustomerTitle
FROM dbo.Invoice i LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = i.CustomerID
WHERE (@from IS NULL OR i.InvoiceDate >= @from) AND (@to IS NULL OR i.InvoiceDate < DATEADD(day, 1, @to))
  AND NOT EXISTS (SELECT 1 FROM dbo.AccountVoucher v WHERE v.SourceModule = 7 AND v.SourceID = i.InvoiceID)
UNION ALL
SELECT 'safevoucher', s.SafeVoucherID, s.Type_, s.VoucherDate, s.DocumentNumber, NULL
FROM dbo.SafeVoucher s
WHERE (@from IS NULL OR s.VoucherDate >= @from) AND (@to IS NULL OR s.VoucherDate < DATEADD(day, 1, @to))
  AND NOT EXISTS (SELECT 1 FROM dbo.AccountVoucher v WHERE v.SourceModule = 4 AND v.SourceID = s.SafeVoucherID)
ORDER BY Date",
            new { from, to });
    }
}
