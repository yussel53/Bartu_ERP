using System.Data;
using System.Text.Json;
using BartuERP.Backend.Services;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EGovSendSetting
{
    public int CompanyId { get; set; }
    public string? EInvoicePrefix { get; set; }
    public string? EArchivePrefix { get; set; }
    public string? EDespatchPrefix { get; set; }
    public string DefaultProfile { get; set; } = "TICARIFATURA";
    public bool AllowLiveSend { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class EGovCounterRow
{
    public string Prefix { get; set; } = "";
    public int Year { get; set; }
    public long LastValue { get; set; }
    /// <summary>Entegratörden çekilmiş giden belgelerdeki en büyük sıra (sayaç başlangıcı önerisi)</summary>
    public long? SeenMax { get; set; }
}

/// <summary>Giden faturanın UBL üretimi için okunan veri + bağlam</summary>
public sealed class OutgoingInvoiceData
{
    public int InvoiceId { get; set; }
    public byte InvoiceType { get; set; }
    public string? DocumentNumber { get; set; }
    public int? CompanyId { get; set; }
    public string? CustomerCode { get; set; }
    public string? PostLabel { get; set; }
    public string? Description { get; set; }
    public UblOutInvoice Invoice { get; set; } = new();
    /// <summary>Bu faturadan daha önce gönderilmiş giden belge</summary>
    public int? EGovDocumentId { get; set; }
    public string? SentDocumentNo { get; set; }
    public string? SentUuid { get; set; }
    public string? SendStatus { get; set; }
    public DateTime? SentAt { get; set; }
    /// <summary>Faturanın programdaki toplamları (gidiş-dönüş karşılaştırması)</summary>
    public decimal ProgramTax { get; set; }
    public decimal ProgramTotal { get; set; }
}

/// <summary>E-03: giden e-fatura ayarları, GİB numara sayacı ve faturadan UBL verisi</summary>
public sealed class EGovOutgoingRepository
{
    private readonly IDbConnection _db;

    public EGovOutgoingRepository(IDbConnection db) => _db = db;

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    /// <summary>Faturada e-belge olarak gönderilebilen tipler: 1 Satış · 3 Satış İade · 4 Alış İade</summary>
    public static bool IsOutgoingType(byte t) => t is 1 or 3 or 4;

    public async Task<EGovSendSetting> GetSettingAsync(int companyId, CancellationToken ct)
    {
        Open();
        return await _db.QueryFirstOrDefaultAsync<EGovSendSetting>(new CommandDefinition(
                   "SELECT * FROM dbo.EGovSendSetting WHERE CompanyId = @companyId", new { companyId }, cancellationToken: ct))
               ?? new EGovSendSetting { CompanyId = companyId };
    }

    /// <summary>AllowLiveSend bu uçtan değiştirilmez (yalnız veritabanından açılır)</summary>
    public async Task SaveSettingAsync(EGovSendSetting s, int? userId, CancellationToken ct)
    {
        Open();
        await _db.ExecuteAsync(new CommandDefinition("""
            MERGE dbo.EGovSendSetting AS t
            USING (SELECT @CompanyId AS CompanyId) AS s ON t.CompanyId = s.CompanyId
            WHEN MATCHED THEN UPDATE SET EInvoicePrefix = @EInvoicePrefix, EArchivePrefix = @EArchivePrefix, EDespatchPrefix = @EDespatchPrefix,
                 DefaultProfile = @DefaultProfile, UpdatedAt = SYSDATETIME(), UpdatedBy = @userId
            WHEN NOT MATCHED THEN INSERT (CompanyId, EInvoicePrefix, EArchivePrefix, EDespatchPrefix, DefaultProfile, UpdatedAt, UpdatedBy)
                 VALUES (@CompanyId, @EInvoicePrefix, @EArchivePrefix, @EDespatchPrefix, @DefaultProfile, SYSDATETIME(), @userId);
            """, new { s.CompanyId, s.EInvoicePrefix, s.EArchivePrefix, s.EDespatchPrefix, s.DefaultProfile, userId }, cancellationToken: ct));
    }

    /// <summary>Firmanın önekleri için sayaçlar + entegratörden çekilmiş giden belgelerde görülen en büyük sıra</summary>
    public async Task<List<EGovCounterRow>> ListCountersAsync(int companyId, CancellationToken ct)
    {
        Open();
        var s = await GetSettingAsync(companyId, ct);
        var prefixes = new[] { s.EInvoicePrefix, s.EArchivePrefix, s.EDespatchPrefix }
            .Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim().ToUpperInvariant()).Distinct().ToList();
        var year = DateTime.Today.Year;
        var rows = new List<EGovCounterRow>();
        foreach (var p in prefixes)
        {
            var last = await _db.ExecuteScalarAsync<long?>(new CommandDefinition(
                "SELECT LastValue FROM dbo.EGovNumberCounter WHERE CompanyId = @companyId AND Prefix = @p AND [Year] = @year",
                new { companyId, p, year }, cancellationToken: ct)) ?? 0;
            // Giden belgeler (Direction = 2) entegratörden çekildiğinde DocumentNo = ÖNEK + YIL + 9 hane
            var seen = await _db.ExecuteScalarAsync<long?>(new CommandDefinition("""
                SELECT MAX(TRY_CAST(SUBSTRING(DocumentNo, 8, 9) AS BIGINT)) FROM dbo.EGovDocument
                WHERE Direction = 2 AND LEN(DocumentNo) = 16 AND LEFT(DocumentNo, 7) = @key
                """, new { key = p + year }, cancellationToken: ct));
            rows.Add(new EGovCounterRow { Prefix = p, Year = year, LastValue = last, SeenMax = seen });
        }
        return rows;
    }

    public async Task SetCounterAsync(int companyId, string prefix, int year, long lastValue, CancellationToken ct)
    {
        Open();
        await _db.ExecuteAsync(new CommandDefinition("""
            MERGE dbo.EGovNumberCounter AS t
            USING (SELECT @companyId AS CompanyId, @prefix AS Prefix, @year AS [Year]) AS s
              ON t.CompanyId = s.CompanyId AND t.Prefix = s.Prefix AND t.[Year] = s.[Year]
            WHEN MATCHED THEN UPDATE SET LastValue = @lastValue, UpdatedAt = SYSDATETIME()
            WHEN NOT MATCHED THEN INSERT (CompanyId, Prefix, [Year], LastValue, UpdatedAt) VALUES (@companyId, @prefix, @year, @lastValue, SYSDATETIME());
            """, new { companyId, prefix, year, lastValue }, cancellationToken: ct));
    }

    public IDbTransaction BeginTransaction()
    {
        Open();
        return _db.BeginTransaction();
    }

    public sealed class SentDocRow
    {
        public int EGovDocumentID { get; set; }
        public byte DocKind { get; set; }
        public string? Uuid { get; set; }
        public string? DocumentNo { get; set; }
        public int? CompanyId { get; set; }
    }

    /// <summary>Giden belge (durum sorgusu için); firma faturadan</summary>
    public async Task<SentDocRow?> GetDocumentAsync(int egovDocumentId, CancellationToken ct)
    {
        Open();
        return await _db.QueryFirstOrDefaultAsync<SentDocRow>(new CommandDefinition("""
            SELECT d.EGovDocumentID, d.DocKind, d.UUID AS Uuid, d.DocumentNo, i.CompanyID AS CompanyId
            FROM dbo.EGovDocument d LEFT JOIN dbo.Invoice i ON i.InvoiceID = d.InvoiceID
            WHERE d.EGovDocumentID = @egovDocumentId AND d.Direction = 2
            """, new { egovDocumentId }, cancellationToken: ct));
    }

    /// <summary>Sıradaki GİB numarası: ÖNEK + YIL + 9 hane. Yalnız gönderimde, işlem içinde çağrılır.</summary>
    public async Task<string> NextNumberAsync(int companyId, string prefix, int year, IDbTransaction tx, CancellationToken ct)
    {
        var next = await _db.ExecuteScalarAsync<long>(new CommandDefinition("""
            DECLARE @v BIGINT;
            UPDATE dbo.EGovNumberCounter WITH (UPDLOCK, HOLDLOCK) SET @v = LastValue = LastValue + 1, UpdatedAt = SYSDATETIME()
            WHERE CompanyId = @companyId AND Prefix = @prefix AND [Year] = @year;
            IF @v IS NULL
            BEGIN
              INSERT dbo.EGovNumberCounter (CompanyId, Prefix, [Year], LastValue, UpdatedAt) VALUES (@companyId, @prefix, @year, 1, SYSDATETIME());
              SET @v = 1;
            END
            SELECT @v;
            """, new { companyId, prefix, year }, tx, cancellationToken: ct));
        return $"{prefix}{year}{next:000000000}";
    }

    /// <summary>Gönderilen belge: EGovDocument (Direction = 2) kaydı</summary>
    public async Task<int> SaveSentAsync(OutgoingInvoiceData d, string documentNo, string uuid, byte docKind, string xml, string status, string? error,
        int? userId, IDbTransaction? tx, CancellationToken ct)
    {
        var t = UblInvoiceWriter.Calc(d.Invoice);
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
            INSERT dbo.EGovDocument (DocKind, Direction, DocumentNo, UUID, DocumentDate, IssueDate, CustomerCode, CustomerTitle, TaxNr,
                   Amount, TaxAmount, CurrencyCode, Status, ProfileId, InvoiceID, XmlContent, IsActive, CreatedAt, SendStatus, SendError, SentAt, SentBy)
            VALUES (@docKind, 2, @documentNo, @uuid, @date, @date, @CustomerCode, @title, @taxNr,
                   @amount, @tax, @cur, @status, @profile, @InvoiceId, @xml, 1, GETDATE(), @status, @error, SYSDATETIME(), @userId);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, new
        {
            docKind, documentNo, uuid, date = d.Invoice.IssueDate, d.CustomerCode, title = d.Invoice.Customer.Name, taxNr = d.Invoice.Customer.TaxNr,
            amount = t.Payable, tax = t.Tax, cur = d.Invoice.Currency, status, profile = d.Invoice.ProfileId, d.InvoiceId, xml, error, userId,
        }, tx, cancellationToken: ct));
    }

    /// <summary>Alıcının GİB e-Fatura posta kutusu (PK) etiketi; mükellef değilse null</summary>
    public async Task<string?> FindPostLabelAsync(string taxNr, CancellationToken ct)
    {
        Open();
        if (await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL THEN 0 ELSE 1 END") == 0) return null;
        return await _db.ExecuteScalarAsync<string?>(new CommandDefinition("""
            SELECT TOP 1 Alias FROM dbo.EFaturaMukellef
            WHERE TaxNr = @taxNr AND IsActive = 1 AND AliasType = N'PK' AND UnitType = N'e-Fatura'
            ORDER BY CASE WHEN Alias LIKE N'%defaultpk%' THEN 0 ELSE 1 END, EFaturaMukellefID
            """, new { taxNr }, cancellationToken: ct));
    }

    private static string? N(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    /// <summary>Program birim kodu → UN/ECE (formSchemas unitOptions ile aynı sıra)</summary>
    public static string UnitCode(int? unitId) => unitId switch
    {
        2 => "CT", 3 => "PA", 4 => "KGM", 5 => "LTR", 6 => "MTR", 7 => "HUR", 8 => "DAY",
        _ => "C62",
    };

    public async Task<OutgoingInvoiceData?> LoadAsync(int invoiceId, CancellationToken ct)
    {
        Open();
        var h = await _db.QueryFirstOrDefaultAsync(new CommandDefinition("""
            SELECT i.InvoiceID, i.InvoiceType, i.InvoiceDate, i.DocumentNumber, i.CompanyID, i.Description, i.CurrencyRate,
                   cur.Code AS CurrencyCode,
                   c.Code AS CustCode, c.Title AS CustTitle, c.TaxNr AS CustTaxNr, c.TaxOffice AS CustTaxOffice,
                   a.Adress, a.City, a.Town, a.CountryCode, a.TaxNr AS AdrTaxNr, a.TaxOffice AS AdrTaxOffice, a.PostLabel, a.EinvoiceEmailAdress,
                   co.Title AS CoTitle, co.TradeTitle, co.TaxNumber, co.TaxOffice AS CoTaxOffice, co.Street, co.Street2, co.DoorNo, co.Town AS CoTown,
                   co.City AS CoCity, co.PostalCode, co.Country AS CoCountry, co.Phone, co.Email, co.WebAddress, co.AddressText
            FROM dbo.Invoice i
            LEFT JOIN dbo.SYS_Currency cur ON cur.CurrencyID = i.Currency
            LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = i.CustomerID
            OUTER APPLY (SELECT TOP 1 * FROM dbo.CustomerAdress x
                         WHERE (i.CustomerAdressID IS NOT NULL AND x.CustomerAdressID = i.CustomerAdressID)
                            OR (i.CustomerAdressID IS NULL AND x.CustomerCardID = i.CustomerID AND ISNULL(x.Active, 1) = 1)
                         ORDER BY CASE WHEN x.CustomerAdressID = i.CustomerAdressID THEN 0 ELSE 1 END, ISNULL(x.IsDefault, 0) DESC, x.CustomerAdressID) a
            LEFT JOIN dbo.SYS_Companies co ON co.CompanyId = i.CompanyID
            WHERE i.InvoiceID = @invoiceId
            """, new { invoiceId }, cancellationToken: ct));
        if (h == null) return null;

        // Satır istisna / tevkifat: ek alan kolonları (U_); eski kayıtlarda AdditionalFields JSON anahtarı
        var udf = (await _db.QueryAsync<string>(new CommandDefinition(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ProductTrans') AND name IN @names",
            new { names = LineUdf }, cancellationToken: ct))).ToList();
        var udfSelect = string.Concat(udf.Select(c => $", t.[{c}]"));
        var lines = (await _db.QueryAsync(new CommandDefinition($"""
            SELECT t.ProductTransID, t.TransLineNo, t.Quantity, t.Price, t.TotalDiscount, t.TotalPrice, t.TotalTax, t.NetTotal, t.UnitID, t.TaxRate,
                   t.Description, t.AdditionalFields{udfSelect}, p.Code, p.Title, tc.Rate AS CardRate
            FROM dbo.ProductTrans t
            LEFT JOIN dbo.ProductCard p ON p.ProductCardID = t.ProductCardID
            LEFT JOIN dbo.TaxCard tc ON tc.TaxCardID = t.TaxCardID
            WHERE t.InvoiceID = @invoiceId
            ORDER BY ISNULL(t.TransLineNo, 2147483647), t.ProductTransID
            """, new { invoiceId }, cancellationToken: ct))).ToList();

        var d = new OutgoingInvoiceData
        {
            InvoiceId = h.InvoiceID,
            InvoiceType = h.InvoiceType == null ? (byte)0 : Convert.ToByte(h.InvoiceType),
            DocumentNumber = h.DocumentNumber,
            CompanyId = h.CompanyID,
            CustomerCode = h.CustCode,
            PostLabel = N(h.PostLabel),
            Description = N(h.Description),
        };
        var street = string.Join(" ", new[] { (string?)h.Street, (string?)h.Street2 }.Where(x => !string.IsNullOrWhiteSpace(x)));
        var inv = d.Invoice;
        inv.IssueDate = h.InvoiceDate == null ? DateTime.Today : (DateTime)h.InvoiceDate;
        inv.Currency = N((string?)h.CurrencyCode) ?? "TRY";
        inv.ExchangeRate = h.CurrencyRate == null ? null : Convert.ToDecimal(h.CurrencyRate);
        inv.Supplier = new UblOutParty
        {
            TaxNr = N((string?)h.TaxNumber) ?? "",
            Name = N((string?)h.TradeTitle) ?? N((string?)h.CoTitle) ?? "",
            TaxOffice = N(h.CoTaxOffice),
            Street = N(street) ?? N(h.AddressText),
            BuildingNumber = N(h.DoorNo),
            Town = N(h.CoTown),
            City = N(h.CoCity),
            PostalCode = N(h.PostalCode),
            Country = N(h.CoCountry),
            Phone = N(h.Phone),
            Email = N(h.Email),
            Web = N(h.WebAddress),
        };
        inv.Customer = new UblOutParty
        {
            TaxNr = N((string?)h.AdrTaxNr) ?? N((string?)h.CustTaxNr) ?? "",
            Name = N((string?)h.CustTitle) ?? "",
            TaxOffice = N((string?)h.AdrTaxOffice) ?? N((string?)h.CustTaxOffice),
            Street = N(h.Adress),
            Town = N(h.Town),
            City = N(h.City),
            Email = N(h.EinvoiceEmailAdress),
        };
        if (d.Description != null) inv.Notes.Add(d.Description);

        var no = 0;
        foreach (var l in lines)
        {
            var extra = Extra((string?)l.AdditionalFields);
            var row = (IDictionary<string, object?>)l;
            foreach (var c in udf)
                if (Convert.ToString(row[c], System.Globalization.CultureInfo.InvariantCulture)?.Trim() is { Length: > 0 } v) extra[c[2..]] = v;
            var rate = l.TaxRate != null ? Convert.ToDecimal(l.TaxRate) : l.CardRate != null ? Convert.ToDecimal(l.CardRate) : 0m;
            inv.Lines.Add(new UblOutLine
            {
                LineNo = ++no,
                Code = N(l.Code),
                Name = N((string?)l.Title) ?? N((string?)l.Description) ?? "Hizmet",
                Description = N(l.Description),
                Quantity = l.Quantity == null ? 0 : Convert.ToDecimal(l.Quantity),
                UnitCode = UnitCode(l.UnitID == null ? null : Convert.ToInt32(l.UnitID)),
                Price = l.Price == null ? 0 : Convert.ToDecimal(l.Price),
                Discount = l.TotalDiscount == null ? 0 : Convert.ToDecimal(l.TotalDiscount),
                TaxRate = Math.Round(rate, 2),
                ExemptionCode = extra.GetValueOrDefault("TaxExemptionCode"),
                ExemptionReason = extra.GetValueOrDefault("TaxExemptionReason"),
                WithholdingCode = extra.GetValueOrDefault("WithholdingCode"),
                WithholdingRate = decimal.TryParse(extra.GetValueOrDefault("WithholdingRate"), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var wr) ? wr : 0,
            });
            d.ProgramTax += l.TotalTax == null ? 0 : Convert.ToDecimal(l.TotalTax);
            d.ProgramTotal += l.NetTotal == null ? 0 : Convert.ToDecimal(l.NetTotal);
        }
        d.ProgramTax = UblInvoiceWriter.R(d.ProgramTax);
        d.ProgramTotal = UblInvoiceWriter.R(d.ProgramTotal);

        var sent = await _db.QueryFirstOrDefaultAsync(new CommandDefinition("""
            SELECT TOP 1 EGovDocumentID, DocumentNo, UUID, SendStatus, SentAt FROM dbo.EGovDocument
            WHERE Direction = 2 AND InvoiceID = @invoiceId AND ISNULL(IsActive, 1) = 1
            ORDER BY EGovDocumentID DESC
            """, new { invoiceId }, cancellationToken: ct));
        if (sent != null)
        {
            d.EGovDocumentId = sent.EGovDocumentID;
            d.SentDocumentNo = sent.DocumentNo;
            d.SentUuid = sent.UUID;
            d.SendStatus = sent.SendStatus;
            d.SentAt = sent.SentAt;
        }
        return d;
    }

    /// <summary>Satırın e-Belge ek alanları (ProductTrans U_ kolonları)</summary>
    private static readonly string[] LineUdf = ["U_TaxExemptionCode", "U_TaxExemptionReason", "U_WithholdingCode", "U_WithholdingRate"];

    /// <summary>Satır AdditionalFields (JSON) → metin sözlüğü</summary>
    private static Dictionary<string, string> Extra(string? json)
    {
        var r = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(json)) return r;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return r;
            foreach (var p in doc.RootElement.EnumerateObject())
            {
                var v = p.Value.ValueKind switch
                {
                    JsonValueKind.String => p.Value.GetString(),
                    JsonValueKind.Number => p.Value.GetRawText(),
                    _ => null,
                };
                if (!string.IsNullOrWhiteSpace(v)) r[p.Name] = v.Trim();
            }
        }
        catch (JsonException) { }
        return r;
    }
}
