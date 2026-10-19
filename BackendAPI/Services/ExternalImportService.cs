using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using BartuERP.Backend.Repositories;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

public sealed class ExternalSource
{
    public string Database { get; set; } = "";
    /// <summary>logo | mikro</summary>
    public string Kind { get; set; } = "";
    public List<ExternalFirm> Firms { get; set; } = new();
}

public sealed class ExternalFirm
{
    public int Nr { get; set; }
    public string? Name { get; set; }
    public List<ExternalPeriod> Periods { get; set; } = new();
}

public sealed class ExternalPeriod
{
    public int Nr { get; set; }
    public DateTime? Begin { get; set; }
    public DateTime? End { get; set; }
}

public sealed class ExternalImportRequest
{
    public string Database { get; set; } = "";
    public int Firm { get; set; }
    public int Period { get; set; } = 1;
    public bool Customers { get; set; }
    public bool Products { get; set; }
    public bool CustomerBalances { get; set; }
    public bool StockBalances { get; set; }
    /// <summary>Açılış fişlerinin tarihi; bakiyeler bu tarihten önceki hareketlerden hesaplanır</summary>
    public DateTime OpeningDate { get; set; } = new(DateTime.Today.Year, 1, 1);
    public int? WhouseID { get; set; }
    public bool DryRun { get; set; } = true;
}

public sealed class ExternalImportPart
{
    public string Name { get; set; } = "";
    public int Read { get; set; }
    public int Inserted { get; set; }
    public int Skipped { get; set; }
    public int Failed { get; set; }
    public decimal? Amount { get; set; }
    public List<string> Messages { get; set; } = new();
}

public sealed class ExternalImportResult
{
    public bool DryRun { get; set; }
    public List<ExternalImportPart> Parts { get; set; } = new();
}

/// <summary>
/// Y-16: aynı SQL Server'daki Logo (Tiger / Go: L_CAPIFIRM, LG_fff_CLCARD, LG_fff_ITEMS, LG_fff_pp_CLFLINE, LG_fff_pp_GNTOTST) ya da
/// Mikro (CARI_HESAPLAR, STOKLAR, CARI_HESAP_HAREKETLERI, STOK_HAREKETLERI) veritabanından aktarım. Kartlar Excel aktarımıyla aynı
/// yoldan (ImportRepository, yalnız ekleme — var olan kod atlanır) yazılır; devir bakiyeleri açılış fişi olur
/// (cari: CustomerVoucher Type 8 «Açılış», tek fiş çok satır · stok: ProductVoucher VoucherType 1 «Devir»).
/// Kaynak veritabanı yalnız okunur. Önizlemede (DryRun) hiçbir şey yazılmaz.
/// </summary>
public sealed class ExternalImportService
{
    private static readonly Regex SafeName = new(@"^[A-Za-z0-9_\-]{1,128}$");
    private readonly IDbConnection _db;
    private readonly DbConnectionStore _store;
    private readonly ImportRepository _import;
    private readonly TenantDbRegistry _tenants;

    public ExternalImportService(IDbConnection db, DbConnectionStore store, ImportRepository import, TenantDbRegistry tenants)
    {
        _db = db;
        _store = store;
        _import = import;
        _tenants = tenants;
    }

    private SqlConnection Source(string database)
    {
        if (!SafeName.IsMatch(database)) throw new InvalidOperationException("Geçersiz veritabanı adı.");
        if (_tenants.List().Contains(database, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Bu bir Bartu veritabanı — kaynak olarak Logo / Mikro veritabanı seçin.");
        return _store.CreateConnection(database);
    }

    private static async Task<bool> HasTableAsync(IDbConnection c, string table) =>
        await c.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END", new { t = "dbo." + table }) == 1;

    private static async Task<HashSet<string>> ColsAsync(IDbConnection c, string table) =>
        (await c.QueryAsync<string>("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@t)", new { t = "dbo." + table }))
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    /// <summary>Sunucudaki Logo / Mikro veritabanları ve Logo firma / dönemleri</summary>
    public async Task<List<ExternalSource>> SourcesAsync(CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var tenants = _tenants.List().ToHashSet(StringComparer.OrdinalIgnoreCase);
        var names = (await _db.QueryAsync<string>(
            "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 AND HAS_DBACCESS(name) = 1 ORDER BY name")).ToList();
        var list = new List<ExternalSource>();
        foreach (var name in names.Where(n => !tenants.Contains(n) && SafeName.IsMatch(n)))
        {
            try
            {
                await using var c = Source(name);
                await c.OpenAsync(ct);
                if (await HasTableAsync(c, "L_CAPIFIRM"))
                {
                    var src = new ExternalSource { Database = name, Kind = "logo" };
                    var firms = await c.QueryAsync<(short Nr, string? Name)>("SELECT NR, NAME FROM dbo.L_CAPIFIRM ORDER BY NR");
                    var periods = await HasTableAsync(c, "L_CAPIPERIOD")
                        ? (await c.QueryAsync<(short Firm, short Nr, DateTime? Beg, DateTime? End)>(
                            "SELECT FIRMNR, NR, BEGDATE, ENDDATE FROM dbo.L_CAPIPERIOD ORDER BY FIRMNR, NR")).ToList()
                        : new();
                    foreach (var f in firms)
                        if (await HasTableAsync(c, $"LG_{f.Nr:000}_CLCARD"))
                            src.Firms.Add(new ExternalFirm
                            {
                                Nr = f.Nr,
                                Name = f.Name,
                                Periods = periods.Where(p => p.Firm == f.Nr).Select(p => new ExternalPeriod { Nr = p.Nr, Begin = p.Beg, End = p.End }).ToList(),
                            });
                    if (src.Firms.Count > 0) list.Add(src);
                }
                else if (await HasTableAsync(c, "CARI_HESAPLAR") && await HasTableAsync(c, "STOKLAR"))
                    list.Add(new ExternalSource { Database = name, Kind = "mikro" });
            }
            catch
            {
                /* erişilemeyen veritabanı listelenmez */
            }
        }
        return list;
    }

    private static string? S(object? v) => v == null || v is DBNull ? null : Convert.ToString(v, CultureInfo.InvariantCulture)?.Trim();

    // ── Kaynak okuma ────────────────────────────────────────────────────

    private static async Task<List<Dictionary<string, string?>>> LogoCustomersAsync(SqlConnection c, string f)
    {
        var cols = await ColsAsync(c, $"LG_{f}_CLCARD");
        string Col(string name, string fallback = "NULL") => cols.Contains(name) ? $"c.[{name}]" : fallback;
        var rows = await c.QueryAsync(
            $@"SELECT c.CODE, c.DEFINITION_, c.CARDTYPE, c.ACTIVE, {Col("TAXNR")} AS TAXNR, {Col("TAXOFFICE")} AS TAXOFFICE, {Col("TCKNO")} AS TCKNO,
  {Col("ISPERSCOMP", "0")} AS ISPERSCOMP, {Col("ADDR1")} AS ADDR1, {Col("ADDR2")} AS ADDR2, {Col("CITY")} AS CITY, {Col("TOWN")} AS TOWN,
  {Col("DISTRICT")} AS DISTRICT, {Col("COUNTRY")} AS COUNTRY, {Col("TELNRS1")} AS TELNRS1, {Col("EMAILADDR")} AS EMAILADDR
FROM dbo.LG_{f}_CLCARD c WHERE ISNULL(c.CODE, '') <> '' AND c.CARDTYPE <> 4 ORDER BY c.CODE");
        return rows.Select(r =>
        {
            var pers = Convert.ToInt32(r.ISPERSCOMP ?? 0) == 1;
            var type = Convert.ToInt32(r.CARDTYPE ?? 3);
            return new Dictionary<string, string?>
            {
                ["Code"] = S(r.CODE),
                ["Title"] = S(r.DEFINITION_),
                ["Type_"] = type == 1 ? "1" : type == 2 ? "2" : "3",
                ["TaxNr"] = pers ? S(r.TCKNO) ?? S(r.TAXNR) : S(r.TAXNR) ?? S(r.TCKNO),
                ["TaxOffice"] = S(r.TAXOFFICE),
                ["TaxType"] = pers ? "2" : "1",
                ["U_Phone"] = S(r.TELNRS1),
                ["U_Email"] = S(r.EMAILADDR),
                ["Addr_Country"] = S(r.COUNTRY),
                ["Addr_City"] = S(r.CITY),
                ["Addr_Town"] = S(r.TOWN),
                ["Addr_District"] = S(r.DISTRICT),
                ["Addr_Address"] = string.Join(" ", new[] { S(r.ADDR1), S(r.ADDR2) }.Where(x => !string.IsNullOrEmpty(x))),
                ["Active"] = Convert.ToInt32(r.ACTIVE ?? 0) == 0 ? "1" : "0",
            };
        }).ToList();
    }

    private static async Task<List<Dictionary<string, string?>>> LogoProductsAsync(SqlConnection c, string f)
    {
        var hasUnit = await HasTableAsync(c, $"LG_{f}_UNITSETL");
        var rows = await c.QueryAsync(
            $@"SELECT i.CODE, i.NAME, i.ACTIVE, {(hasUnit ? "u.CODE" : "NULL")} AS UNIT
FROM dbo.LG_{f}_ITEMS i
{(hasUnit ? $"LEFT JOIN dbo.LG_{f}_UNITSETL u ON u.UNITSETREF = i.UNITSETREF AND u.MAINUNIT = 1" : "")}
WHERE ISNULL(i.CODE, '') <> '' AND ISNULL(i.CODE, '') <> 'ÿ' ORDER BY i.CODE");
        return rows.Select(r => new Dictionary<string, string?>
        {
            ["Code"] = S(r.CODE),
            ["Title"] = S(r.NAME) ?? S(r.CODE),
            ["DefaultUnitID"] = Unit(S(r.UNIT)),
            ["IsActive"] = Convert.ToInt32(r.ACTIVE ?? 0) == 0 ? "1" : "0",
        }).ToList();
    }

    private static string? Unit(string? code)
    {
        var u = (code ?? "").Trim().ToUpperInvariant().Replace("İ", "I");
        return u switch
        {
            "ADET" or "AD" or "ADT" or "PCS" or "AD." => "1",
            "KOLI" or "KOLİ" => "2",
            "PAKET" or "PK" => "3",
            "KG" or "KILO" or "KILOGRAM" => "4",
            "LT" or "LITRE" or "L" => "5",
            "MT" or "METRE" or "M" => "6",
            "SAAT" or "SA" => "7",
            "GUN" or "GÜN" => "8",
            _ => null,
        };
    }

    private static async Task<List<(string Code, decimal Net)>> LogoCustomerBalancesAsync(SqlConnection c, string f, string p, DateTime opening)
    {
        if (!await HasTableAsync(c, $"LG_{f}_{p}_CLFLINE")) throw new InvalidOperationException($"LG_{f}_{p}_CLFLINE yok (dönem?).");
        return (await c.QueryAsync<(string Code, decimal Net)>(
            $@"SELECT cl.CODE, CAST(SUM(CASE WHEN l.SIGN = 0 THEN l.AMOUNT ELSE -l.AMOUNT END) AS decimal(19,2)) AS Net
FROM dbo.LG_{f}_{p}_CLFLINE l JOIN dbo.LG_{f}_CLCARD cl ON cl.LOGICALREF = l.CLIENTREF
WHERE ISNULL(l.CANCELLED, 0) = 0 AND l.DATE_ < @opening
GROUP BY cl.CODE HAVING ABS(SUM(CASE WHEN l.SIGN = 0 THEN l.AMOUNT ELSE -l.AMOUNT END)) >= 0.01", new { opening })).ToList();
    }

    private static async Task<List<(string Code, decimal Qty)>> LogoStockAsync(SqlConnection c, string f, string p)
    {
        if (!await HasTableAsync(c, $"LG_{f}_{p}_GNTOTST")) throw new InvalidOperationException($"LG_{f}_{p}_GNTOTST yok (dönem?).");
        return (await c.QueryAsync<(string Code, decimal Qty)>(
            $@"SELECT i.CODE, CAST(SUM(t.ONHAND) AS decimal(19,4)) AS Qty
FROM dbo.LG_{f}_{p}_GNTOTST t JOIN dbo.LG_{f}_ITEMS i ON i.LOGICALREF = t.STOCKREF
WHERE t.INVENNO = -1 GROUP BY i.CODE HAVING SUM(t.ONHAND) > 0")).ToList();
    }

    private static async Task<List<Dictionary<string, string?>>> MikroCustomersAsync(SqlConnection c)
    {
        var hasAdr = await HasTableAsync(c, "CARI_HESAP_ADRESLERI");
        var rows = await c.QueryAsync(
            $@"SELECT ch.cari_kod, ch.cari_unvan1, ch.cari_unvan2, ch.cari_vdaire_adi, ch.cari_vdaire_no, ch.cari_EMail, ch.cari_CepTel
  {(hasAdr ? ", a.adr_cadde, a.adr_mahalle, a.adr_ilce, a.adr_il" : "")}
FROM dbo.CARI_HESAPLAR ch
{(hasAdr ? "OUTER APPLY (SELECT TOP 1 adr_cadde, adr_mahalle, adr_ilce, adr_il FROM dbo.CARI_HESAP_ADRESLERI x WHERE x.adr_cari_kod = ch.cari_kod ORDER BY x.adr_adres_no) a" : "")}
WHERE ISNULL(ch.cari_kod, '') <> '' ORDER BY ch.cari_kod");
        return rows.Select(r =>
        {
            var d = (IDictionary<string, object?>)r;
            string? G(string k) => d.TryGetValue(k, out var v) ? S(v) : null;
            var tax = G("cari_vdaire_no");
            return new Dictionary<string, string?>
            {
                ["Code"] = G("cari_kod"),
                ["Title"] = string.Join(" ", new[] { G("cari_unvan1"), G("cari_unvan2") }.Where(x => !string.IsNullOrEmpty(x))),
                ["Type_"] = "3",
                ["TaxNr"] = tax,
                ["TaxOffice"] = G("cari_vdaire_adi"),
                ["TaxType"] = tax?.Length == 11 ? "2" : "1",
                ["U_Phone"] = G("cari_CepTel"),
                ["U_Email"] = G("cari_EMail"),
                ["Addr_City"] = G("adr_il"),
                ["Addr_Town"] = G("adr_ilce"),
                ["Addr_District"] = G("adr_mahalle"),
                ["Addr_Address"] = G("adr_cadde"),
                ["Active"] = "1",
            };
        }).ToList();
    }

    private static async Task<List<Dictionary<string, string?>>> MikroProductsAsync(SqlConnection c) =>
        (await c.QueryAsync("SELECT sto_kod, sto_isim, sto_birim1_ad FROM dbo.STOKLAR WHERE ISNULL(sto_kod, '') <> '' ORDER BY sto_kod"))
        .Select(r => new Dictionary<string, string?>
        {
            ["Code"] = S(r.sto_kod),
            ["Title"] = S(r.sto_isim) ?? S(r.sto_kod),
            ["DefaultUnitID"] = Unit(S(r.sto_birim1_ad)),
            ["IsActive"] = "1",
        }).ToList();

    private static async Task<List<(string Code, decimal Net)>> MikroCustomerBalancesAsync(SqlConnection c, DateTime opening) =>
        (await c.QueryAsync<(string Code, decimal Net)>(
            @"SELECT cha_kod, CAST(SUM(CASE WHEN cha_tip = 0 THEN cha_meblag ELSE -cha_meblag END) AS decimal(19,2))
FROM dbo.CARI_HESAP_HAREKETLERI WHERE ISNULL(cha_cari_cins, 0) = 0 AND cha_tarihi < @opening
GROUP BY cha_kod HAVING ABS(SUM(CASE WHEN cha_tip = 0 THEN cha_meblag ELSE -cha_meblag END)) >= 0.01", new { opening })).ToList();

    private static async Task<List<(string Code, decimal Qty)>> MikroStockAsync(SqlConnection c, DateTime opening) =>
        (await c.QueryAsync<(string Code, decimal Qty)>(
            @"SELECT sth_stok_kod, CAST(SUM(CASE WHEN sth_tip = 0 THEN sth_miktar WHEN sth_tip = 1 THEN -sth_miktar ELSE 0 END) AS decimal(19,4))
FROM dbo.STOK_HAREKETLERI WHERE sth_tarih < @opening
GROUP BY sth_stok_kod HAVING SUM(CASE WHEN sth_tip = 0 THEN sth_miktar WHEN sth_tip = 1 THEN -sth_miktar ELSE 0 END) > 0", new { opening })).ToList();

    // ── Aktarım ─────────────────────────────────────────────────────────

    public async Task<ExternalImportResult> ImportAsync(ExternalImportRequest req, string? user, CancellationToken ct = default)
    {
        var result = new ExternalImportResult { DryRun = req.DryRun };
        await using var c = Source(req.Database);
        await c.OpenAsync(ct);
        var logo = await HasTableAsync(c, "L_CAPIFIRM");
        if (!logo && !await HasTableAsync(c, "CARI_HESAPLAR")) throw new InvalidOperationException("Kaynak Logo ya da Mikro veritabanı değil.");
        var f = req.Firm.ToString("000", CultureInfo.InvariantCulture);
        var p = req.Period.ToString("00", CultureInfo.InvariantCulture);
        if (logo && !await HasTableAsync(c, $"LG_{f}_CLCARD")) throw new InvalidOperationException($"Logo firması {f} bulunamadı.");
        var tag = $"AKT-{(logo ? "LOGO" : "MIKRO")}-{(logo ? f : "")}{req.OpeningDate:yyyyMMdd}";
        if (_db.State != ConnectionState.Open) _db.Open();

        async Task Card(string name, string kind, Func<Task<List<Dictionary<string, string?>>>> read)
        {
            var part = new ExternalImportPart { Name = name };
            result.Parts.Add(part);
            try
            {
                var rows = await read();
                part.Read = rows.Count;
                var r = await _import.ApplyAsync(kind, new ImportApplyRequest
                {
                    Rows = rows, Mode = "insert", DryRun = req.DryRun, ProductType = 1,
                    FileName = $"{req.Database} {(logo ? "Logo " + f : "Mikro")}", ImportedBy = user,
                }, ct);
                part.Inserted = r.Inserted;
                part.Skipped = r.Skipped + r.Updated;
                part.Failed = r.Failed;
                part.Messages.AddRange(r.Rows.Where(x => x.Action == "error").Take(20).Select(x => $"{x.Code}: {x.Message}"));
            }
            catch (Exception ex)
            {
                part.Messages.Add(ex.Message);
            }
        }

        if (req.Customers) await Card("Cari kartlar", "customer", () => logo ? LogoCustomersAsync(c, f) : MikroCustomersAsync(c));
        if (req.Products) await Card("Malzemeler", "product", () => logo ? LogoProductsAsync(c, f) : MikroProductsAsync(c));

        if (req.CustomerBalances)
        {
            var part = new ExternalImportPart { Name = "Cari devir bakiyeleri" };
            result.Parts.Add(part);
            try
            {
                var bal = logo ? await LogoCustomerBalancesAsync(c, f, p, req.OpeningDate) : await MikroCustomerBalancesAsync(c, req.OpeningDate);
                part.Read = bal.Count;
                part.Amount = bal.Sum(b => b.Net);
                var ids = (await _db.QueryAsync<(int Id, string Code)>("SELECT CustomerCardID, Code FROM dbo.CustomerCard WHERE Code IS NOT NULL"))
                    .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);
                var matched = bal.Where(b => ids.ContainsKey(b.Code)).ToList();
                var missing = bal.Count - matched.Count;
                if (missing > 0) part.Messages.Add($"{missing} carinin kartı Bartu'da yok{(req.DryRun && req.Customers ? " (önizleme — kartlar aktarılınca eşleşir)" : "")}.");
                if (await _db.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM dbo.CustomerVoucher WHERE DocumentNumber = @tag", new { tag }) > 0)
                {
                    part.Messages.Add($"{tag} açılış fişi zaten var — tekrar aktarılmadı.");
                    part.Skipped = bal.Count;
                }
                else
                {
                    part.Inserted = matched.Count;
                    part.Skipped = missing;
                    if (!req.DryRun && matched.Count > 0)
                    {
                        using var tx = _db.BeginTransaction();
                        var vid = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(CASE WHEN CustomerVoucherID > 0 THEN CustomerVoucherID END), 0) + 1 FROM dbo.CustomerVoucher WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
                        await _db.ExecuteAsync(
                            "INSERT INTO dbo.CustomerVoucher (CustomerVoucherID, Type, Status, VoucherDate, DocumentNumber, Description, Amount) VALUES (@vid, 8, 0, @date, @tag, @desc, @amount)",
                            new { vid, date = req.OpeningDate.Date, tag, desc = $"{(logo ? "Logo" : "Mikro")} devir ({req.Database})", amount = matched.Sum(m => Math.Abs(m.Net)) }, tx);
                        var tid = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(CASE WHEN CustomerTransID > 0 THEN CustomerTransID END), 0) FROM dbo.CustomerTrans WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
                        var line = 0;
                        foreach (var m in matched)
                            await _db.ExecuteAsync(
                                @"INSERT INTO dbo.CustomerTrans (CustomerTransID, Type, Status, CustomerID, TransDate, LocalAmount, Amount, CustomerVoucherID, Description, LineNr)
VALUES (@id, 8, 0, @cust, @date, @amt, @amt, @vid, N'Açılış bakiyesi', @line)",
                                new { id = ++tid, cust = ids[m.Code], date = req.OpeningDate.Date, amt = m.Net, vid, line = ++line }, tx);
                        tx.Commit();
                        part.Messages.Add($"Açılış fişi {tag} oluşturuldu.");
                    }
                }
            }
            catch (Exception ex)
            {
                part.Messages.Add(ex.Message);
            }
        }

        if (req.StockBalances)
        {
            var part = new ExternalImportPart { Name = "Stok devir miktarları" };
            result.Parts.Add(part);
            try
            {
                var stock = logo ? await LogoStockAsync(c, f, p) : await MikroStockAsync(c, req.OpeningDate);
                part.Read = stock.Count;
                part.Amount = stock.Sum(s => s.Qty);
                var ids = (await _db.QueryAsync<(int Id, string Code)>("SELECT ProductCardID, Code FROM dbo.ProductCard WHERE Code IS NOT NULL"))
                    .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);
                var matched = stock.Where(s => ids.ContainsKey(s.Code)).ToList();
                var missing = stock.Count - matched.Count;
                if (missing > 0) part.Messages.Add($"{missing} malzemenin kartı Bartu'da yok{(req.DryRun && req.Products ? " (önizleme — kartlar aktarılınca eşleşir)" : "")}.");
                if (await _db.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM dbo.ProductVoucher WHERE DocumentNumber = @tag", new { tag }) > 0)
                {
                    part.Messages.Add($"{tag} devir fişi zaten var — tekrar aktarılmadı.");
                    part.Skipped = stock.Count;
                }
                else
                {
                    part.Inserted = matched.Count;
                    part.Skipped = missing;
                    if (!req.DryRun && matched.Count > 0)
                    {
                        using var tx = _db.BeginTransaction();
                        var vid = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(CASE WHEN ProductVoucherID > 0 THEN ProductVoucherID END), 0) + 1 FROM dbo.ProductVoucher WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
                        await _db.ExecuteAsync(
                            "INSERT INTO dbo.ProductVoucher (ProductVoucherID, VoucherType, VoucherDate, DocumentNumber, Description, WhouseID, Status_) VALUES (@vid, 1, @date, @tag, @desc, @wh, 1)",
                            new { vid, date = req.OpeningDate.Date, tag, desc = $"{(logo ? "Logo" : "Mikro")} stok devri ({req.Database})", wh = req.WhouseID }, tx);
                        var tid = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(CASE WHEN ProductTransID > 0 THEN ProductTransID END), 0) FROM dbo.ProductTrans WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
                        var line = 0;
                        foreach (var m in matched)
                            await _db.ExecuteAsync(
                                @"INSERT INTO dbo.ProductTrans (ProductTransID, ProductVoucherID, ProductCardID, VoucherType, TransDate, WhouseID, Quantity, Price, TotalPrice, TransLineNo)
VALUES (@id, @vid, @pid, 1, @date, @wh, @qty, 0, 0, @line)",
                                new { id = ++tid, vid, pid = ids[m.Code], date = req.OpeningDate.Date, wh = req.WhouseID, qty = (double)m.Qty, line = ++line }, tx);
                        tx.Commit();
                        part.Messages.Add($"Devir fişi {tag} oluşturuldu (birim maliyet girilmedi — maliyeti fişte ya da Maliyetlendirme'de düzeltin).");
                    }
                }
            }
            catch (Exception ex)
            {
                part.Messages.Add(ex.Message);
            }
        }
        return result;
    }
}
