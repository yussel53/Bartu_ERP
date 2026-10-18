using System.Data;
using BartuERP.Backend.Services;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class KdvRateRow
{
    public decimal Rate { get; set; }
    public decimal SalesBase { get; set; }
    public decimal SalesTax { get; set; }
    public decimal PurchaseBase { get; set; }
    public decimal PurchaseTax { get; set; }
}

public sealed class KdvReport
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    /// <summary>Hesaplanan KDV — bizim kestiğimiz faturalar (1 Satış · 4 Alış İade)</summary>
    public decimal CalculatedTax { get; set; }
    public decimal SalesBase { get; set; }
    public int IssuedCount { get; set; }
    /// <summary>İndirilecek KDV — bize kesilen faturalar (2 Alış · 3 Satış İade · 5 Alınan Hizmet · 6 / 7 fiyat farkı)</summary>
    public decimal DeductibleTax { get; set; }
    public decimal PurchaseBase { get; set; }
    public int ReceivedCount { get; set; }
    public List<KdvRateRow> Rates { get; set; } = new();
    /// <summary>e-Belgesi (UBL) olan alış faturalarındaki KDV tevkifatı</summary>
    public decimal WithholdingTax { get; set; }
    public int WithholdingDocs { get; set; }
    /// <summary>e-Belgesi olan faturalardaki istisna / muaf matrah</summary>
    public decimal ExemptBase { get; set; }
    public int ExemptDocs { get; set; }
    public List<string> ExemptionCodes { get; set; } = new();
    /// <summary>Tevkifat / istisna okunabilen (UBL'i olan) fatura sayısı — kalanlarda bu bilgi ERP'de yok</summary>
    public int UblDocs { get; set; }
    public int TotalDocs { get; set; }
    /// <summary>Satırı olmayan (tutarı hesaplanamayan) fatura sayısı</summary>
    public int EmptyDocs { get; set; }
}

public sealed class BaBsRow
{
    /// <summary>VKN/TCKN; yoksa «#kartNo»</summary>
    public string Key { get; set; } = "";
    public string? TaxNr { get; set; }
    public string? Title { get; set; }
    public int CardCount { get; set; }
    /// <summary>yyyy-MM</summary>
    public string Period { get; set; } = "";
    public int DocCount { get; set; }
    /// <summary>KDV hariç TL tutar</summary>
    public decimal Amount { get; set; }
}

public sealed class BaBsReport
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public decimal Limit { get; set; }
    /// <summary>Form Ba — mal ve hizmet alımları (bize kesilen faturalar)</summary>
    public List<BaBsRow> Ba { get; set; } = new();
    /// <summary>Form Bs — mal ve hizmet satışları (bizim kestiğimiz faturalar)</summary>
    public List<BaBsRow> Bs { get; set; } = new();
    /// <summary>VKN/TCKN'si girilmemiş carilere ait fatura sayısı (Ba/Bs'de VKN zorunlu)</summary>
    public int MissingTaxNrDocs { get; set; }
}

public sealed class BaBsDoc
{
    public int InvoiceID { get; set; }
    public int InvoiceType { get; set; }
    public string? DocumentNumber { get; set; }
    public DateTime? InvoiceDate { get; set; }
    public string? CustomerTitle { get; set; }
    public decimal Amount { get; set; }
    public decimal Tax { get; set; }
}

/// <summary>
/// E-Devlet → Raporlar → KDV ve Ba / Bs (yol haritası E-08). Fatura satırlarından (ProductTrans.InvoiceID) okunur;
/// tutarlar faturanın kuru (CurrencyRate) ile TL'ye çevrilir, iptal (Status_ = 3) faturalar hariç.
/// Bizim kestiğimiz: 1 Satış · 4 Alış İade → hesaplanan KDV / Form Bs.
/// Bize kesilen: 2 Alış · 3 Satış İade · 5 Alınan Hizmet · 6 Satınalma Fiyat Farkı · 7 Satış Fiyat Farkı → indirilecek KDV / Form Ba.
/// Tevkifat / istisna ERP'de tutulmaz: e-belgesi (EGovDocument.InvoiceID + UBL) olan faturalarda UBL'den okunur.
/// </summary>
public sealed class EGovTaxReportRepository
{
    private const string Issued = "1, 4";
    private const string Received = "2, 3, 5, 6, 7";

    private readonly IDbConnection _db;

    public EGovTaxReportRepository(IDbConnection db) => _db = db;

    /// <summary>Fatura satırı tabanı: TL matrah / KDV, yön (issued = 1)</summary>
    private async Task<string> LinesSqlAsync(CancellationToken ct)
    {
        var cols = (await _db.QueryAsync<string>(new CommandDefinition(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Invoice')", cancellationToken: ct)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var docNo = cols.Contains("DocumentNumber") ? "i.DocumentNumber" : "CAST(NULL AS nvarchar(50))";
        var company = cols.Contains("CompanyID") ? "i.CompanyID" : "CAST(NULL AS int)";
        return $"""
            WITH l AS (
              SELECT i.InvoiceID, CAST(i.InvoiceType AS int) AS InvoiceType, i.CustomerID, {docNo} AS DocumentNumber,
                     CAST(i.InvoiceDate AS date) AS InvoiceDate,
                     CASE WHEN i.InvoiceType IN ({Issued}) THEN 1 ELSE 0 END AS IsIssued,
                     CAST(ISNULL(t.TaxRate, 0) AS decimal(9, 2)) AS Rate,
                     CAST(ISNULL(t.TotalPrice, ISNULL(t.Quantity, 0) * ISNULL(t.Price, 0) - ISNULL(t.TotalDiscount, 0)) * x.Fx AS decimal(19, 2)) AS Base,
                     CAST(ISNULL(t.TotalTax, ISNULL(t.TotalPrice, 0) * ISNULL(t.TaxRate, 0) / 100.0) * x.Fx AS decimal(19, 2)) AS Tax
              FROM dbo.Invoice i
              JOIN dbo.ProductTrans t ON t.InvoiceID = i.InvoiceID
              CROSS APPLY (SELECT CASE WHEN ISNULL(i.CurrencyRate, 0) > 0 THEN CAST(i.CurrencyRate AS decimal(19, 6)) ELSE 1 END AS Fx) x
              WHERE i.InvoiceDate >= @from AND i.InvoiceDate < @toExcl
                AND ISNULL(i.Status_, 1) <> 3
                AND i.InvoiceType IN ({Issued}, {Received})
                AND (@companyId IS NULL OR {company} = @companyId)
            )
            """;
    }

    public async Task<KdvReport> KdvAsync(DateTime from, DateTime to, int? companyId, CancellationToken ct = default)
    {
        Open();
        var r = new KdvReport { From = from.Date, To = to.Date };
        var p = new { from = r.From, toExcl = r.To.AddDays(1), companyId };
        var lines = await LinesSqlAsync(ct);

        r.Rates = (await _db.QueryAsync<KdvRateRow>(new CommandDefinition(lines + """
            SELECT Rate,
                   SUM(CASE WHEN IsIssued = 1 THEN Base ELSE 0 END) AS SalesBase,
                   SUM(CASE WHEN IsIssued = 1 THEN Tax ELSE 0 END) AS SalesTax,
                   SUM(CASE WHEN IsIssued = 0 THEN Base ELSE 0 END) AS PurchaseBase,
                   SUM(CASE WHEN IsIssued = 0 THEN Tax ELSE 0 END) AS PurchaseTax
            FROM l GROUP BY Rate ORDER BY Rate DESC
            """, p, cancellationToken: ct))).ToList();
        r.SalesBase = r.Rates.Sum(x => x.SalesBase);
        r.CalculatedTax = r.Rates.Sum(x => x.SalesTax);
        r.PurchaseBase = r.Rates.Sum(x => x.PurchaseBase);
        r.DeductibleTax = r.Rates.Sum(x => x.PurchaseTax);

        var counts = await _db.QueryFirstAsync<(int Issued, int Received)>(new CommandDefinition(lines + """
            SELECT COUNT(DISTINCT CASE WHEN IsIssued = 1 THEN InvoiceID END), COUNT(DISTINCT CASE WHEN IsIssued = 0 THEN InvoiceID END) FROM l
            """, p, cancellationToken: ct));
        r.IssuedCount = counts.Issued;
        r.ReceivedCount = counts.Received;

        // Dönemdeki tüm faturalar (satırsızlar dahil) — satırsız fatura tutara yansımaz, uyarı olarak gösterilir
        var all = (await _db.QueryAsync<int>(new CommandDefinition(
            $"""
            SELECT i.InvoiceID FROM dbo.Invoice i
            WHERE i.InvoiceDate >= @from AND i.InvoiceDate < @toExcl AND ISNULL(i.Status_, 1) <> 3
              AND i.InvoiceType IN ({Issued}, {Received})
              AND (@companyId IS NULL OR i.CompanyID = @companyId)
            """, p, cancellationToken: ct))).ToList();
        r.TotalDocs = all.Count;
        r.EmptyDocs = all.Count - r.IssuedCount - r.ReceivedCount;

        // Tevkifat / istisna: faturaya bağlı e-belgenin UBL'i
        if (all.Count > 0 && await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.EGovDocument', N'U') IS NULL THEN 0 ELSE 1 END", cancellationToken: ct)) == 1)
        {
            foreach (var chunk in all.Chunk(500))
            {
                var docs = await _db.QueryAsync<(int InvoiceID, string Xml, decimal Fx)>(new CommandDefinition(
                    """
                    SELECT e.InvoiceID, e.XmlContent,
                           CASE WHEN ISNULL(i.CurrencyRate, 0) > 0 THEN CAST(i.CurrencyRate AS decimal(19, 6)) ELSE 1 END
                    FROM dbo.EGovDocument e JOIN dbo.Invoice i ON i.InvoiceID = e.InvoiceID
                    WHERE e.InvoiceID IN @chunk AND e.XmlContent IS NOT NULL AND ISNULL(e.IsActive, 1) = 1
                    """, new { chunk }, cancellationToken: ct));
                foreach (var d in docs.GroupBy(x => x.InvoiceID).Select(g => g.First()))
                {
                    UblInvoice ubl;
                    try { ubl = UblInvoiceReader.Read(d.Xml); }
                    catch { continue; }
                    r.UblDocs++;
                    if (ubl.WithholdingTax > 0)
                    {
                        r.WithholdingTax += Math.Round(ubl.WithholdingTax * d.Fx, 2);
                        r.WithholdingDocs++;
                    }
                    if (ubl.ExemptBase > 0)
                    {
                        r.ExemptBase += Math.Round(ubl.ExemptBase * d.Fx, 2);
                        r.ExemptDocs++;
                        foreach (var c in ubl.ExemptionCodes.Where(c => !r.ExemptionCodes.Contains(c))) r.ExemptionCodes.Add(c);
                    }
                }
            }
        }
        return r;
    }

    public async Task<BaBsReport> BaBsAsync(DateTime from, DateTime to, int? companyId, decimal limit, CancellationToken ct = default)
    {
        Open();
        var r = new BaBsReport { From = from.Date, To = to.Date, Limit = limit };
        var p = new { from = r.From, toExcl = r.To.AddDays(1), companyId, limit };
        var lines = await LinesSqlAsync(ct);
        // Aynı VKN'li cari kartlar birleştirilir; VKN'siz cari kart numarasıyla ayrı satır (uyarı)
        var rows = (await _db.QueryAsync<(int IsIssued, string Key, string? TaxNr, string? Title, int CardCount, string Period, int DocCount, decimal Amount)>(
            new CommandDefinition(lines + """
            , k AS (
              SELECT l.IsIssued, l.InvoiceID, l.Base, CONVERT(char(7), l.InvoiceDate, 126) AS Period, l.CustomerID,
                     NULLIF(LTRIM(RTRIM(c.TaxNr)), N'') AS TaxNr, CAST(c.Title AS nvarchar(400)) AS Title
              FROM l LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = l.CustomerID
            )
            SELECT IsIssued, COALESCE(TaxNr, N'#' + CAST(ISNULL(CustomerID, 0) AS nvarchar(20))) AS [Key], MAX(TaxNr) AS TaxNr,
                   MAX(Title) AS Title, COUNT(DISTINCT CustomerID) AS CardCount, Period,
                   COUNT(DISTINCT InvoiceID) AS DocCount, SUM(Base) AS Amount
            FROM k
            GROUP BY IsIssued, COALESCE(TaxNr, N'#' + CAST(ISNULL(CustomerID, 0) AS nvarchar(20))), Period
            HAVING SUM(Base) >= @limit
            ORDER BY Period, SUM(Base) DESC
            """, p, cancellationToken: ct))).ToList();

        foreach (var x in rows)
        {
            var row = new BaBsRow
            {
                Key = x.Key, TaxNr = x.TaxNr, Title = x.Title, CardCount = x.CardCount,
                Period = x.Period, DocCount = x.DocCount, Amount = x.Amount,
            };
            if (x.IsIssued == 1) r.Bs.Add(row);
            else r.Ba.Add(row);
        }
        r.MissingTaxNrDocs = await _db.ExecuteScalarAsync<int>(new CommandDefinition(lines + """
            SELECT COUNT(DISTINCT l.InvoiceID) FROM l LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = l.CustomerID
            WHERE NULLIF(LTRIM(RTRIM(c.TaxNr)), N'') IS NULL
            """, p, cancellationToken: ct));
        return r;
    }

    /// <summary>Ba (kind = ba) / Bs (bs) satırının faturaları — key: VKN ya da «#kartNo»</summary>
    public async Task<List<BaBsDoc>> BaBsDocsAsync(string kind, string key, DateTime from, DateTime to, int? companyId, CancellationToken ct = default)
    {
        Open();
        var issued = kind.Equals("bs", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
        int? cardId = key.StartsWith('#') && int.TryParse(key[1..], out var id) ? id : null;
        var lines = await LinesSqlAsync(ct);
        return (await _db.QueryAsync<BaBsDoc>(new CommandDefinition(lines + """
            SELECT l.InvoiceID, l.InvoiceType, l.DocumentNumber, CAST(l.InvoiceDate AS datetime) AS InvoiceDate,
                   CAST(c.Title AS nvarchar(400)) AS CustomerTitle, SUM(l.Base) AS Amount, SUM(l.Tax) AS Tax
            FROM l LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = l.CustomerID
            WHERE l.IsIssued = @issued
              AND ((@cardId IS NOT NULL AND l.CustomerID = @cardId AND NULLIF(LTRIM(RTRIM(c.TaxNr)), N'') IS NULL)
                   OR (@cardId IS NULL AND LTRIM(RTRIM(c.TaxNr)) = @key))
            GROUP BY l.InvoiceID, l.InvoiceType, l.DocumentNumber, l.InvoiceDate, CAST(c.Title AS nvarchar(400))
            ORDER BY l.InvoiceDate, l.InvoiceID
            """, new { from = from.Date, toExcl = to.Date.AddDays(1), companyId, issued, cardId, key }, cancellationToken: ct))).ToList();
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
