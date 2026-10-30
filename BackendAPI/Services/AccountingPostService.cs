using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class AccountingPostResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int? AccountVoucherID { get; set; }
    public int? AccPoolID { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public List<string> Missing { get; set; } = new();
}

public sealed class AccPoolConfig
{
    public bool AutoPost { get; set; }
    public bool PoolInvoice { get; set; } = true;
    public bool PoolSafe { get; set; } = true;
    public string InvoiceTypes { get; set; } = "*";
    public string SafeTypes { get; set; } = "*";
}

/// <summary>
/// Y-09 + havuz: kaynak belge → SYS_AccPool (muhasebe kodları) → AccountVoucher.
/// ACC_AUTO_POST=1 ise kayıt sonrası havuzdan hemen fiş; 0 ise havuzda bekler (elle / seçerek).
/// ACC_POOL_INVOICE / ACC_POOL_SAFE ve ACC_INV_TYPES / ACC_SAFE_TYPES hangi belge türlerinin havuza gireceğini belirler.
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

    private async Task<string?> SettingAsync(string code)
    {
        try
        {
            return (await _db.ExecuteScalarAsync<string?>(
                "SELECT TOP 1 Value FROM dbo.Setting WHERE Code = @code", new { code }))?.Trim();
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> AutoPostEnabledAsync()
    {
        Open();
        return (await SettingAsync("ACC_AUTO_POST")) == "1";
    }

    public async Task<AccPoolConfig> GetConfigAsync()
    {
        Open();
        return new AccPoolConfig
        {
            AutoPost = (await SettingAsync("ACC_AUTO_POST")) == "1",
            PoolInvoice = (await SettingAsync("ACC_POOL_INVOICE")) != "0",
            PoolSafe = (await SettingAsync("ACC_POOL_SAFE")) != "0",
            InvoiceTypes = (await SettingAsync("ACC_INV_TYPES")) ?? "*",
            SafeTypes = (await SettingAsync("ACC_SAFE_TYPES")) ?? "*",
        };
    }

    public async Task SaveConfigAsync(AccPoolConfig cfg)
    {
        Open();
        await UpsertSettingAsync("ACC_AUTO_POST", "Kayıt sonrası otomatik muhasebeleştir", cfg.AutoPost ? "1" : "0");
        await UpsertSettingAsync("ACC_POOL_INVOICE", "Havuza: Faturalar", cfg.PoolInvoice ? "1" : "0");
        await UpsertSettingAsync("ACC_POOL_SAFE", "Havuza: Kasa fişleri", cfg.PoolSafe ? "1" : "0");
        await UpsertSettingAsync("ACC_INV_TYPES", "Havuza fatura türleri (* veya 1,2,..)",
            string.IsNullOrWhiteSpace(cfg.InvoiceTypes) ? "*" : cfg.InvoiceTypes.Trim());
        await UpsertSettingAsync("ACC_SAFE_TYPES", "Havuza kasa türleri (* veya 1,2,..)",
            string.IsNullOrWhiteSpace(cfg.SafeTypes) ? "*" : cfg.SafeTypes.Trim());
    }

    private async Task UpsertSettingAsync(string code, string title, string value)
    {
        var n = await _db.ExecuteAsync(
            "UPDATE dbo.Setting SET Value = @value, Title = @title, ModuleKey = N'muhasebe' WHERE Code = @code",
            new { code, title, value });
        if (n == 0)
        {
            var id = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(SettingID), 0) + 1 FROM dbo.Setting");
            await _db.ExecuteAsync(
                "INSERT INTO dbo.Setting (SettingID, Code, Title, Value, ModuleKey) VALUES (@id, @code, @title, @value, N'muhasebe')",
                new { id, code, title, value });
        }
    }

    private static bool TypeAllowed(string list, int? type)
    {
        var s = (list ?? "*").Trim();
        if (s == "" || s == "*") return true;
        if (type is null) return true;
        return s.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(x => int.TryParse(x, out var n) && n == type.Value);
    }

    private sealed record Line(int AccountCardID, string Description, decimal Debit, decimal Credit, string? LinkHint = null);

    private sealed class Builder
    {
        public readonly List<Line> Lines = new();
        public readonly List<string> Missing = new();

        public void Add(int? account, string what, string desc, decimal debit, decimal credit)
        {
            if (debit == 0 && credit == 0) return;
            if (account is not int a || a <= 0)
            {
                if (!Missing.Contains(what)) Missing.Add(what);
                Lines.Add(new Line(0, desc, debit, credit, what));
                return;
            }
            var i = Lines.FindIndex(l => l.AccountCardID == a && l.AccountCardID > 0 && (l.Debit != 0) == (debit != 0));
            if (i >= 0) Lines[i] = Lines[i] with { Debit = Lines[i].Debit + debit, Credit = Lines[i].Credit + credit };
            else Lines.Add(new Line(a, desc, debit, credit));
        }
    }

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

    private static bool PoolTableExists(IDbConnection db) =>
        db.ExecuteScalar<int?>("SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_AccPool', N'U') IS NULL THEN 0 ELSE 1 END") == 1;

    /// <summary>Kayıt sonrası: parametreye göre havuza yaz; ACC_AUTO_POST=1 ise hemen muhasebeleştir.</summary>
    public async Task<AccountingPostResult?> ProcessAfterSaveAsync(string source, int id, CancellationToken ct = default)
    {
        Open();
        if (!PoolTableExists(_db))
        {
            // Eski davranış: yalnızca ACC_AUTO_POST
            if (!await AutoPostEnabledAsync()) return null;
            return await PostAsync(source, id, ct);
        }

        var cfg = await GetConfigAsync();
        var key = source.ToLowerInvariant();
        if (key is "invoice" or "safevoucher") { /* ok */ }
        else return null;

        using var tx = _db.BeginTransaction();
        try
        {
            Draft? draft;
            if (key == "invoice")
            {
                if (!cfg.PoolInvoice) { tx.Rollback(); return null; }
                draft = await BuildInvoiceDraftAsync(id, tx);
                if (draft != null && !TypeAllowed(cfg.InvoiceTypes, draft.SourceType)) { tx.Rollback(); return null; }
            }
            else
            {
                if (!cfg.PoolSafe) { tx.Rollback(); return null; }
                draft = await BuildSafeDraftAsync(id, tx);
                if (draft != null && !TypeAllowed(cfg.SafeTypes, draft.SourceType)) { tx.Rollback(); return null; }
            }

            if (draft == null)
            {
                tx.Rollback();
                return new AccountingPostResult { Message = "Belge bulunamadı veya satır yok — havuza yazılmadı." };
            }

            var poolId = await UpsertPoolAsync(draft, tx);
            var result = new AccountingPostResult
            {
                AccPoolID = poolId,
                Debit = draft.Builder.Lines.Sum(l => l.Debit),
                Credit = draft.Builder.Lines.Sum(l => l.Credit),
                Missing = draft.Builder.Missing.ToList(),
                Success = draft.Builder.Missing.Count == 0,
                Message = draft.Builder.Missing.Count > 0
                    ? "Havuza alındı (eksik bağlantı): " + string.Join(" · ", draft.Builder.Missing)
                    : $"Havuza alındı (#{poolId}).",
            };

            if (cfg.AutoPost && draft.Builder.Missing.Count == 0)
            {
                var posted = await PostPoolRowAsync(poolId, tx);
                tx.Commit();
                return posted;
            }

            tx.Commit();
            return result;
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return new AccountingPostResult { Message = "Muhasebe havuzu hatası: " + ex.Message };
        }
    }

    public async Task<AccountingPostResult> PostAsync(string source, int id, CancellationToken ct = default)
    {
        Open();
        // Önce havuza yaz / güncelle, sonra fişleştir (manuel Muhasebeleştir butonu)
        if (PoolTableExists(_db))
        {
            using var tx = _db.BeginTransaction();
            try
            {
                var key = source.ToLowerInvariant();
                Draft? draft = key switch
                {
                    "invoice" => await BuildInvoiceDraftAsync(id, tx),
                    "safevoucher" => await BuildSafeDraftAsync(id, tx),
                    _ => null,
                };
                if (draft == null)
                {
                    tx.Rollback();
                    return new AccountingPostResult { Message = "Desteklenmeyen kaynak veya belge yok: " + source };
                }
                var poolId = await UpsertPoolAsync(draft, tx);
                if (draft.Builder.Missing.Count > 0)
                {
                    tx.Commit();
                    return new AccountingPostResult
                    {
                        AccPoolID = poolId,
                        Missing = draft.Builder.Missing.ToList(),
                        Message = "Muhasebe bağlantısı eksik: " + string.Join(" · ", draft.Builder.Missing) +
                                  ". Finans → Muhasebe Bağlantıları ya da kartın Muhasebe Hesapları sekmesinden tanımlayın.",
                    };
                }
                var r = await PostPoolRowAsync(poolId, tx);
                if (r.Success) tx.Commit();
                else tx.Rollback();
                return r;
            }
            catch (Exception ex)
            {
                tx.Rollback();
                return new AccountingPostResult { Message = "Muhasebeleştirme hatası: " + ex.Message };
            }
        }

        using var tx2 = _db.BeginTransaction();
        try
        {
            var result = source.ToLowerInvariant() switch
            {
                "invoice" => await PostInvoiceDirectAsync(id, tx2),
                "safevoucher" => await PostSafeDirectAsync(id, tx2),
                _ => new AccountingPostResult { Message = "Desteklenmeyen kaynak: " + source },
            };
            if (result.Success) tx2.Commit();
            else tx2.Rollback();
            return result;
        }
        catch (Exception ex)
        {
            tx2.Rollback();
            return new AccountingPostResult { Message = "Muhasebeleştirme hatası: " + ex.Message };
        }
    }

    public async Task<object> StatusAsync(string source, int id)
    {
        var module = source.ToLowerInvariant() switch { "invoice" => ModuleInvoice, "safevoucher" => ModuleSafe, _ => 0 };
        if (module == 0 || id <= 0) return new { posted = false };
        Open();
        var row = await _db.QueryFirstOrDefaultAsync<(int Id, DateTime? Numbered)?>(
            @"SELECT TOP 1 AccountVoucherID AS Id, JournalNumberedAt AS Numbered
FROM dbo.AccountVoucher WHERE SourceModule = @module AND SourceID = @id",
            new { module, id });
        if (row is not { } r || r.Id <= 0) return new { posted = false };
        return new
        {
            posted = true,
            accountVoucherId = r.Id,
            journalNumbered = r.Numbered != null,
        };
    }

    public async Task<string?> UnpostAsync(string source, int id)
    {
        var module = source.ToLowerInvariant() switch { "invoice" => ModuleInvoice, "safevoucher" => ModuleSafe, _ => 0 };
        if (module == 0) return null;
        Open();
        using var tx = _db.BeginTransaction();
        var msg = await DeleteExistingAsync(module, id, tx);
        if (msg != null)
        {
            tx.Rollback();
            return msg;
        }
        if (PoolTableExists(_db))
        {
            await _db.ExecuteAsync(
                @"UPDATE dbo.SYS_AccPool SET Status_ = 3, PostedAt = NULL, AccountVoucherID = NULL
WHERE SourceModule = @module AND SourceID = @id AND Status_ IN (0, 1, 2)",
                new { module, id }, tx);
        }
        tx.Commit();
        return null;
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

    private sealed class Draft
    {
        public int SourceModule { get; set; }
        public int SourceID { get; set; }
        public int? SourceType { get; set; }
        public DateTime DocumentDate { get; set; }
        public string? DocumentNumber { get; set; }
        public string Description { get; set; } = "";
        public int? CompanyID { get; set; }
        public int? DepartmentID { get; set; }
        public int? CustomerID { get; set; }
        public string? CustomerTitle { get; set; }
        public int? Currency { get; set; }
        public double? CurrencyRate { get; set; }
        public string? AuthCode { get; set; }
        public int VoucherType { get; set; } = 1;
        public Builder Builder { get; set; } = new();
    }

    private async Task<Draft?> BuildInvoiceDraftAsync(int invoiceId, IDbTransaction tx)
    {
        var h = await _db.QueryFirstOrDefaultAsync<InvoiceHead>(
            @"SELECT i.InvoiceID, i.InvoiceType, i.InvoiceDate, i.DocumentNumber, i.CompanyID, i.DepartmentID, i.CustomerID,
  i.Description, i.AuthCode, i.Currency, i.CurrencyRate, c.Title AS CustomerTitle
FROM dbo.Invoice i LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = i.CustomerID
WHERE i.InvoiceID = @invoiceId", new { invoiceId }, tx);
        if (h == null) return null;
        var lines = (await _db.QueryAsync<InvoiceLine>(
            "SELECT ProductCardID, TotalPrice, TotalTax FROM dbo.ProductTrans WHERE InvoiceID = @invoiceId", new { invoiceId }, tx)).ToList();
        if (lines.Count == 0) return null;

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

        return new Draft
        {
            SourceModule = ModuleInvoice,
            SourceID = invoiceId,
            SourceType = t,
            DocumentDate = h.InvoiceDate ?? DateTime.Today,
            DocumentNumber = h.DocumentNumber,
            Description = desc,
            CompanyID = h.CompanyID,
            DepartmentID = h.DepartmentID,
            CustomerID = h.CustomerID,
            CustomerTitle = h.CustomerTitle,
            Currency = h.Currency,
            CurrencyRate = h.CurrencyRate,
            AuthCode = h.AuthCode,
            VoucherType = 1,
            Builder = b,
        };
    }

    private async Task<Draft?> BuildSafeDraftAsync(int id, IDbTransaction tx)
    {
        var h = await _db.QueryFirstOrDefaultAsync<SafeHead>(
            "SELECT SafeVoucherID, Type_, VoucherDate, DocumentNumber, SafeCardID, Description, AuthCode, CompanyID, Currency, CurrencyRate FROM dbo.SafeVoucher WHERE SafeVoucherID = @id",
            new { id }, tx);
        if (h == null) return null;
        var lines = (await _db.QueryAsync<SafeLine>(
            "SELECT CustomerID, BankAccountCardID, AimSafeCardID, AccountCardID, Description, Amount FROM dbo.SafeTrans WHERE SafeVoucherID = @id",
            new { id }, tx)).ToList();
        if (lines.Count == 0) return null;

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
        return new Draft
        {
            SourceModule = ModuleSafe,
            SourceID = id,
            SourceType = h.Type_,
            DocumentDate = h.VoucherDate,
            DocumentNumber = h.DocumentNumber,
            Description = $"{label} {h.DocumentNumber} {h.Description}".Trim(),
            CompanyID = h.CompanyID,
            Currency = h.Currency,
            CurrencyRate = h.CurrencyRate,
            AuthCode = h.AuthCode,
            VoucherType = voucherType,
            Builder = b,
        };
    }

    private async Task<int> UpsertPoolAsync(Draft d, IDbTransaction tx)
    {
        var existing = await _db.QueryFirstOrDefaultAsync<int?>(
            @"SELECT TOP 1 AccPoolID FROM dbo.SYS_AccPool
WHERE SourceModule = @mod AND SourceID = @sid AND Status_ IN (0, 2)
ORDER BY AccPoolID DESC",
            new { mod = d.SourceModule, sid = d.SourceID }, tx);

        var debit = d.Builder.Lines.Sum(l => l.Debit);
        var credit = d.Builder.Lines.Sum(l => l.Credit);
        byte status = (byte)(d.Builder.Missing.Count > 0 ? 2 : 0);
        var err = d.Builder.Missing.Count > 0 ? string.Join(" · ", d.Builder.Missing) : null;
        if (err != null && err.Length > 500) err = err[..500];
        var desc = d.Description.Length > 250 ? d.Description[..250] : d.Description;

        int poolId;
        if (existing is int eid)
        {
            poolId = eid;
            await _db.ExecuteAsync(
                @"UPDATE dbo.SYS_AccPool SET SourceType=@SourceType, DocumentDate=@DocumentDate, DocumentNumber=@DocumentNumber,
  Description=@desc, CompanyID=@CompanyID, DepartmentID=@DepartmentID, CustomerID=@CustomerID, CustomerTitle=@CustomerTitle,
  Currency=@Currency, CurrencyRate=@CurrencyRate, AuthCode=@AuthCode, VoucherType=@VoucherType,
  SumDebit=@debit, SumCredit=@credit, Status_=@status, ErrorMessage=@err, AccountVoucherID=NULL, PostedAt=NULL
WHERE AccPoolID=@poolId",
                new
                {
                    poolId, d.SourceType, DocumentDate = d.DocumentDate.Date, d.DocumentNumber, desc,
                    d.CompanyID, d.DepartmentID, d.CustomerID, d.CustomerTitle, d.Currency, d.CurrencyRate,
                    d.AuthCode, d.VoucherType, debit, credit, status, err,
                }, tx);
            await _db.ExecuteAsync("DELETE FROM dbo.SYS_AccPoolLine WHERE AccPoolID = @poolId", new { poolId }, tx);
        }
        else
        {
            poolId = await _db.ExecuteScalarAsync<int>(
                "SELECT ISNULL(MAX(AccPoolID), 0) + 1 FROM dbo.SYS_AccPool WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
            await _db.ExecuteAsync(
                @"INSERT INTO dbo.SYS_AccPool (AccPoolID, SourceModule, SourceID, SourceType, DocumentDate, DocumentNumber, Description,
  CompanyID, DepartmentID, CustomerID, CustomerTitle, Currency, CurrencyRate, AuthCode, VoucherType,
  SumDebit, SumCredit, Status_, ErrorMessage)
VALUES (@poolId, @SourceModule, @SourceID, @SourceType, @DocumentDate, @DocumentNumber, @desc,
  @CompanyID, @DepartmentID, @CustomerID, @CustomerTitle, @Currency, @CurrencyRate, @AuthCode, @VoucherType,
  @debit, @credit, @status, @err)",
                new
                {
                    poolId, d.SourceModule, d.SourceID, d.SourceType, DocumentDate = d.DocumentDate.Date, d.DocumentNumber, desc,
                    d.CompanyID, d.DepartmentID, d.CustomerID, d.CustomerTitle, d.Currency, d.CurrencyRate,
                    d.AuthCode, d.VoucherType, debit, credit, status, err,
                }, tx);
        }

        var lineId = await _db.ExecuteScalarAsync<int>(
            "SELECT ISNULL(MAX(AccPoolLineID), 0) FROM dbo.SYS_AccPoolLine WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
        var no = 0;
        foreach (var l in d.Builder.Lines)
        {
            no++;
            lineId++;
            string? code = null, title = null;
            if (l.AccountCardID > 0)
            {
                var card = await _db.QueryFirstOrDefaultAsync<(string? Code, string? Title)>(
                    "SELECT Code, Title FROM dbo.AccountCard WHERE AccountCardID = @id", new { id = l.AccountCardID }, tx);
                code = card.Code;
                title = card.Title;
            }
            var ld = l.Description.Length > 250 ? l.Description[..250] : l.Description;
            await _db.ExecuteAsync(
                @"INSERT INTO dbo.SYS_AccPoolLine (AccPoolLineID, AccPoolID, [LineNo], AccountCardID, AccountCode, AccountTitle, Description, Debit, Credit, LinkHint)
VALUES (@lineId, @poolId, @no, @acc, @code, @title, @ld, @debit, @credit, @hint)",
                new
                {
                    lineId, poolId, no, acc = l.AccountCardID > 0 ? l.AccountCardID : (int?)null,
                    code, title, ld, debit = l.Debit, credit = l.Credit, hint = l.LinkHint,
                }, tx);
        }
        return poolId;
    }

    public async Task<AccountingPostResult> PostPoolAsync(int poolId, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        try
        {
            var r = await PostPoolRowAsync(poolId, tx);
            if (r.Success) tx.Commit();
            else tx.Rollback();
            return r;
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return new AccountingPostResult { Message = "Muhasebeleştirme hatası: " + ex.Message };
        }
    }

    public async Task<(int posted, List<string> errors)> PostPoolManyAsync(IEnumerable<int> ids, CancellationToken ct = default)
    {
        var ok = 0;
        var errors = new List<string>();
        foreach (var id in ids.Distinct())
        {
            var r = await PostPoolAsync(id, ct);
            if (r.Success) ok++;
            else errors.Add($"#{id}: {r.Message}");
        }
        return (ok, errors);
    }

    private async Task<AccountingPostResult> PostPoolRowAsync(int poolId, IDbTransaction tx)
    {
        var row = await _db.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT * FROM dbo.SYS_AccPool WHERE AccPoolID = @poolId", new { poolId }, tx);
        if (row == null) return new AccountingPostResult { Message = "Havuz kaydı bulunamadı." };
        int status = (int)row.Status_;
        if (status == 1) return new AccountingPostResult { Success = true, AccPoolID = poolId, AccountVoucherID = (int?)row.AccountVoucherID, Message = "Zaten muhasebeleştirilmiş." };
        if (status == 3) return new AccountingPostResult { Message = "Havuz kaydı iptal edilmiş." };

        var lines = (await _db.QueryAsync<(int? AccountCardID, string? Description, decimal Debit, decimal Credit, string? LinkHint)>(
            "SELECT AccountCardID, Description, Debit, Credit, LinkHint FROM dbo.SYS_AccPoolLine WHERE AccPoolID = @poolId ORDER BY [LineNo]",
            new { poolId }, tx)).ToList();
        if (lines.Count == 0) return new AccountingPostResult { Message = "Havuz satırı yok." };

        var missing = lines.Where(l => l.AccountCardID is null or <= 0).Select(l => l.LinkHint ?? "Hesap eksik").Distinct().ToList();
        if (missing.Count > 0)
        {
            await _db.ExecuteAsync(
                "UPDATE dbo.SYS_AccPool SET Status_ = 2, ErrorMessage = @err WHERE AccPoolID = @poolId",
                new { poolId, err = string.Join(" · ", missing) }, tx);
            return new AccountingPostResult
            {
                AccPoolID = poolId,
                Missing = missing,
                Message = "Muhasebe bağlantısı eksik: " + string.Join(" · ", missing),
            };
        }

        var b = new Builder();
        foreach (var l in lines)
            b.Add(l.AccountCardID, l.LinkHint ?? "Hesap", l.Description ?? "", l.Debit, l.Credit);

        int module = (int)row.SourceModule;
        int sourceId = (int)row.SourceID;
        int voucherType = (int)row.VoucherType;
        DateTime date = row.DocumentDate != null ? (DateTime)row.DocumentDate : DateTime.Today;
        string? docNo = row.DocumentNumber as string;
        string desc = (row.Description as string) ?? "";
        int? companyId = row.CompanyID as int?;
        int? departmentId = row.DepartmentID as int?;
        string? authCode = row.AuthCode as string;
        int? currency = row.Currency as int?;
        double? rate = row.CurrencyRate as double?;

        var written = await WriteAsync(module, sourceId, voucherType, date, docNo, desc,
            companyId, departmentId, authCode, currency, rate, b, tx);
        if (!written.Success) return written;

        await _db.ExecuteAsync(
            @"UPDATE dbo.SYS_AccPool SET Status_ = 1, AccountVoucherID = @vid, PostedAt = SYSUTCDATETIME(), ErrorMessage = NULL
WHERE AccPoolID = @poolId",
            new { poolId, vid = written.AccountVoucherID }, tx);
        written.AccPoolID = poolId;
        return written;
    }

    private async Task<AccountingPostResult> PostInvoiceDirectAsync(int invoiceId, IDbTransaction tx)
    {
        var d = await BuildInvoiceDraftAsync(invoiceId, tx);
        if (d == null) return new AccountingPostResult { Message = "Fatura bulunamadı veya satır yok." };
        return await WriteAsync(d.SourceModule, d.SourceID, d.VoucherType, d.DocumentDate, d.DocumentNumber, d.Description,
            d.CompanyID, d.DepartmentID, d.AuthCode, d.Currency, d.CurrencyRate, d.Builder, tx);
    }

    private async Task<AccountingPostResult> PostSafeDirectAsync(int id, IDbTransaction tx)
    {
        var d = await BuildSafeDraftAsync(id, tx);
        if (d == null) return new AccountingPostResult { Message = "Kasa fişi bulunamadı veya satır yok." };
        return await WriteAsync(d.SourceModule, d.SourceID, d.VoucherType, d.DocumentDate, d.DocumentNumber, d.Description,
            d.CompanyID, d.DepartmentID, d.AuthCode, d.Currency, d.CurrencyRate, d.Builder, tx);
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
        var debit = b.Lines.Where(l => l.AccountCardID > 0).Sum(l => l.Debit);
        var credit = b.Lines.Where(l => l.AccountCardID > 0).Sum(l => l.Credit);
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
        foreach (var l in b.Lines.Where(x => x.AccountCardID > 0))
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
            Message = $"Muhasebe fişi oluşturuldu (#{voucherId}, {no} satır, {debit:N2}).",
        };
    }

    public async Task<IEnumerable<dynamic>> PoolListAsync(DateTime? from, DateTime? to, int? status)
    {
        Open();
        if (!PoolTableExists(_db)) return Array.Empty<dynamic>();
        return await _db.QueryAsync(
            @"SELECT p.AccPoolID, p.SourceModule, p.SourceID, p.SourceType, p.DocumentDate, p.DocumentNumber,
  p.Description, p.CustomerTitle, p.SumDebit, p.SumCredit, p.Status_, p.AccountVoucherID, p.ErrorMessage, p.CreatedAt, p.PostedAt,
  CASE p.SourceModule WHEN 7 THEN N'Fatura' WHEN 4 THEN N'Kasa fişi' ELSE CAST(p.SourceModule AS nvarchar(10)) END AS SourceLabel
FROM dbo.SYS_AccPool p
WHERE (@from IS NULL OR p.DocumentDate >= @from)
  AND (@to IS NULL OR p.DocumentDate < DATEADD(day, 1, @to))
  AND (@status IS NULL OR p.Status_ = @status)
ORDER BY CASE WHEN p.Status_ IN (0, 2) THEN 0 ELSE 1 END, p.DocumentDate DESC, p.AccPoolID DESC",
            new { from, to, status });
    }

    public async Task<IEnumerable<dynamic>> PoolLinesAsync(int poolId)
    {
        Open();
        return await _db.QueryAsync(
            @"SELECT AccPoolLineID, [LineNo] AS LineNo, AccountCardID, AccountCode, AccountTitle, Description, Debit, Credit, LinkHint
FROM dbo.SYS_AccPoolLine WHERE AccPoolID = @poolId ORDER BY [LineNo]",
            new { poolId });
    }

    /// <summary>Eski bekleyen listesi (havuz yoksa / uyumluluk).</summary>
    public async Task<IEnumerable<dynamic>> PendingAsync(DateTime? from, DateTime? to)
    {
        Open();
        if (PoolTableExists(_db))
        {
            return await _db.QueryAsync(
                @"SELECT CASE SourceModule WHEN 7 THEN 'invoice' ELSE 'safevoucher' END AS Source,
  SourceID AS Id, SourceType AS Type, DocumentDate AS Date, DocumentNumber, CustomerTitle, AccPoolID
FROM dbo.SYS_AccPool
WHERE Status_ IN (0, 2)
  AND (@from IS NULL OR DocumentDate >= @from) AND (@to IS NULL OR DocumentDate < DATEADD(day, 1, @to))
ORDER BY DocumentDate",
                new { from, to });
        }
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

    /// <summary>Havuz kaydını belgeden yeniden hesapla (bağlantı düzeltildikten sonra).</summary>
    public async Task<AccountingPostResult> RebuildPoolAsync(int poolId, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        try
        {
            var row = await _db.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT SourceModule, SourceID, Status_ FROM dbo.SYS_AccPool WHERE AccPoolID = @poolId", new { poolId }, tx);
            if (row == null)
            {
                tx.Rollback();
                return new AccountingPostResult { Message = "Havuz kaydı bulunamadı." };
            }
            int sourceModule = (int)row.SourceModule;
            int sourceId = (int)row.SourceID;
            int status = (int)row.Status_;
            if (status == 1)
            {
                tx.Rollback();
                return new AccountingPostResult { Message = "Muhasebeleşmiş kayıt yeniden hesaplanamaz." };
            }
            Draft? draft = sourceModule == ModuleInvoice
                ? await BuildInvoiceDraftAsync(sourceId, tx)
                : sourceModule == ModuleSafe
                    ? await BuildSafeDraftAsync(sourceId, tx)
                    : null;
            if (draft == null)
            {
                tx.Rollback();
                return new AccountingPostResult { Message = "Kaynak belge bulunamadı." };
            }
            var id = await UpsertPoolAsync(draft, tx);
            tx.Commit();
            return new AccountingPostResult
            {
                Success = draft.Builder.Missing.Count == 0,
                AccPoolID = id,
                Missing = draft.Builder.Missing.ToList(),
                Message = draft.Builder.Missing.Count > 0
                    ? "Yeniden hesaplandı — eksik: " + string.Join(" · ", draft.Builder.Missing)
                    : "Yeniden hesaplandı.",
            };
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return new AccountingPostResult { Message = ex.Message };
        }
    }
}
