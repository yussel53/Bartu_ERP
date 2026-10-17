using System.Data;
using System.Xml;
using System.Xml.Linq;
using Dapper;

namespace BartuERP.Backend.Repositories;

/// <summary>e-Belgenin (UBL) karşı tarafı — gelen: satıcı (AccountingSupplierParty) · giden: alıcı</summary>
public sealed class EGovPartyInfo
{
    public int EGovDocumentID { get; set; }
    public byte Direction { get; set; }
    public string? DocumentNo { get; set; }
    public string? ProfileId { get; set; }
    public string? TaxNr { get; set; }
    /// <summary>1 Tüzel (VKN) · 2 Gerçek (TCKN)</summary>
    public int? TaxType { get; set; }
    public string? Title { get; set; }
    public string? TaxOffice { get; set; }
    public string? Street { get; set; }
    public string? District { get; set; }
    public string? Town { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? PostalZone { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Website { get; set; }
    /// <summary>Aynı VKN/TCKN ile kayıtlı cari (varsa)</summary>
    public int? ExistingCardID { get; set; }
    public string? ExistingCode { get; set; }
    public string? ExistingTitle { get; set; }
    /// <summary>Önerilen cari kodu (VKN/TCKN)</summary>
    public string? SuggestedCode { get; set; }
}

public sealed class EGovPartyCreateRequest
{
    public string? Code { get; set; }
    public string? Title { get; set; }
}

/// <summary>
/// e-Fatura / e-Arşiv / e-İrsaliye UBL'sindeki karşı taraf bilgisinden cari kart açar
/// (CustomerCard CardKind 2 + varsayılan «Merkez» adresi + iletişim). Aynı VKN/TCKN'li cari varsa yenisi açılmaz.
/// </summary>
public sealed class EGovPartyCardRepository
{
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    private readonly IDbConnection _db;

    public EGovPartyCardRepository(IDbConnection db)
    {
        _db = db;
    }

    private sealed class DocRow
    {
        public int EGovDocumentID { get; set; }
        public byte Direction { get; set; }
        public string? DocumentNo { get; set; }
        public string? ProfileId { get; set; }
        public string? XmlContent { get; set; }
        public string? TaxNr { get; set; }
        public string? CustomerTitle { get; set; }
    }

    private sealed class CardHit
    {
        public int Id { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
    }

    public async Task<(EGovPartyInfo? Info, string? Error)> ReadAsync(int id, CancellationToken ct = default)
    {
        Open();
        var row = await _db.QueryFirstOrDefaultAsync<DocRow>(new CommandDefinition(
            """
            SELECT EGovDocumentID, CAST(Direction AS tinyint) AS Direction, DocumentNo, ProfileId, XmlContent, TaxNr, CustomerTitle
            FROM dbo.EGovDocument WHERE EGovDocumentID = @id
            """, new { id }, cancellationToken: ct));
        if (row is null) return (null, $"e-Belge #{id} bulunamadı.");

        var info = new EGovPartyInfo
        {
            EGovDocumentID = row.EGovDocumentID,
            Direction = row.Direction,
            DocumentNo = row.DocumentNo,
            ProfileId = row.ProfileId,
        };

        if (!string.IsNullOrWhiteSpace(row.XmlContent))
        {
            try
            {
                FillFromUbl(info, row.XmlContent, row.Direction);
            }
            catch (Exception ex)
            {
                return (null, $"UBL okunamadı: {ex.Message}");
            }
        }
        // XML yoksa liste bilgisiyle (unvan + VKN) yetin
        info.TaxNr ??= Clean(row.TaxNr);
        info.Title ??= Clean(row.CustomerTitle);
        if (string.IsNullOrWhiteSpace(info.TaxNr))
            return (null, "Belgede karşı tarafın VKN/TCKN bilgisi yok.");
        info.TaxType ??= info.TaxNr!.Length == 11 ? 2 : 1;
        info.SuggestedCode = info.TaxNr;

        var hit = await _db.QueryFirstOrDefaultAsync<CardHit>(new CommandDefinition(
            "SELECT TOP 1 CustomerCardID AS Id, Code, Title FROM dbo.CustomerCard WHERE LTRIM(RTRIM(TaxNr)) = @tax ORDER BY CustomerCardID",
            new { tax = info.TaxNr }, cancellationToken: ct));
        if (hit != null)
        {
            info.ExistingCardID = hit.Id;
            info.ExistingCode = hit.Code;
            info.ExistingTitle = hit.Title;
        }
        return (info, null);
    }

    public async Task<(bool Ok, int CardId, string? Code, string Message)> CreateAsync(
        int id, EGovPartyCreateRequest req, CancellationToken ct = default)
    {
        var (info, error) = await ReadAsync(id, ct);
        if (info is null) return (false, 0, null, error ?? "Belge okunamadı.");
        if (info.ExistingCardID is int existing)
            return (true, existing, info.ExistingCode,
                $"Bu VKN/TCKN ile cari zaten kayıtlı: {info.ExistingCode} — {info.ExistingTitle}");

        var code = Clean(req.Code) ?? info.SuggestedCode!;
        var title = Clean(req.Title) ?? info.Title;
        if (string.IsNullOrWhiteSpace(title)) return (false, 0, null, "Ünvan boş olamaz.");
        if (code.Length > 50) return (false, 0, null, "Cari kodu en fazla 50 karakter olabilir.");

        Open();
        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.CustomerCard WHERE Code = @code", new { code }, cancellationToken: ct)) > 0)
            return (false, 0, null, $"«{code}» cari kodu başka bir kartta kullanılıyor — farklı bir kod girin.");

        var incoming = info.Direction != 2;
        var einvoiceType = (info.ProfileId ?? "").Contains("EARSIV", StringComparison.OrdinalIgnoreCase) ? 2 : 1;
        var taxOffice = Cut(info.TaxOffice, 50);

        using var tx = _db.BeginTransaction();
        try
        {
            var (cardCol, cardVal) = await IdColumnAsync("CustomerCard", "CustomerCardID", tx, ct);
            var cardId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                $"""
                INSERT INTO dbo.CustomerCard
                  ({cardCol}Code, Title, Active, Type_, CardKind, CardKindChangedAt, AccountGroupID, TaxNr, TaxOffice, TaxType,
                   EinvoiceType, SalesModuleCheck, PurchaseModuleCheck, FinanceModuleCheck)
                OUTPUT INSERTED.CustomerCardID
                VALUES
                  ({cardVal}@code, @title, 1, @type, 2, SYSDATETIME(), 1, @tax, @taxOffice, @taxType,
                   @einvoiceType, @sales, @purchase, 1)
                """,
                new
                {
                    newId = _nextId, code, title,
                    type = incoming ? 2 : 1, // gelen: Satıcı · giden: Alıcı
                    tax = info.TaxNr, taxOffice, taxType = info.TaxType, einvoiceType,
                    sales = !incoming, purchase = incoming,
                }, tx, cancellationToken: ct));

            var (adrCol, adrVal) = await IdColumnAsync("CustomerAdress", "CustomerAdressID", tx, ct);
            await _db.ExecuteAsync(new CommandDefinition(
                $"""
                INSERT INTO dbo.CustomerAdress
                  ({adrCol}CustomerCardID, Active, IsDefault, AdressType, Title, Adress, Dictrict, Town, City, Country, CountryCode,
                   TaxNr, TaxOffice, TaxType)
                VALUES
                  ({adrVal}@cardId, 1, 1, 1, N'Merkez', @street, @district, @town, @city, @country, @countryCode,
                   @tax, @taxOffice, @taxType)
                """,
                new
                {
                    newId = _nextId, cardId,
                    street = info.Street,
                    district = Cut(info.District, 80),
                    town = Cut(info.Town, 80),
                    city = Cut(info.City, 80),
                    country = Cut(info.Country ?? "Türkiye", 80),
                    countryCode = IsTurkey(info.Country) ? "TR" : null,
                    tax = info.TaxNr, taxOffice, taxType = info.TaxType,
                }, tx, cancellationToken: ct));

            if (!string.IsNullOrWhiteSpace(info.Phone) || !string.IsNullOrWhiteSpace(info.Email))
            {
                var (conCol, conVal) = await IdColumnAsync("CustomerContact", "CustomerContactID", tx, ct);
                await _db.ExecuteAsync(new CommandDefinition(
                    $"""
                    INSERT INTO dbo.CustomerContact ({conCol}CustomerCardID, IsDefault, ContactTitle, Name, Phone, Email)
                    VALUES ({conVal}@cardId, 1, N'Genel', @name, @phone, @email)
                    """,
                    new
                    {
                        newId = _nextId, cardId,
                        name = Cut(title, 100),
                        phone = Cut(info.Phone, 50),
                        email = Cut(info.Email, 100),
                    }, tx, cancellationToken: ct));
            }

            tx.Commit();
            return (true, cardId, code, $"Cari kart açıldı: {code} — {title}");
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    private int _nextId;

    /// <summary>
    /// PK identity değilse (CustomerCard / CustomerAdress / CustomerContact) RecordsRepository ile aynı şekilde
    /// MAX+1 (UPDLOCK) ile numara alınır; INSERT'e eklenecek kolon / değer öneklerini döner.
    /// </summary>
    private async Task<(string Col, string Val)> IdColumnAsync(string table, string pk, IDbTransaction tx, CancellationToken ct)
    {
        var identity = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT COLUMNPROPERTY(OBJECT_ID(@t), @c, 'IsIdentity')", new { t = "dbo." + table, c = pk }, tx, cancellationToken: ct));
        if (identity == 1) return ("", "");
        _nextId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT ISNULL(MAX(CASE WHEN [{pk}] > 0 THEN [{pk}] END), 0) + 1 FROM dbo.[{table}] WITH (UPDLOCK, HOLDLOCK)",
            transaction: tx, cancellationToken: ct));
        return ($"{pk}, ", "@newId, ");
    }

    private static void FillFromUbl(EGovPartyInfo info, string xml, byte direction)
    {
        XDocument doc;
        using (var reader = XmlReader.Create(new StringReader(xml), new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
        }))
        {
            doc = XDocument.Load(reader);
        }
        var root = doc.Root ?? throw new InvalidOperationException("UBL boş.");

        // Gelen belgede karşı taraf satıcı; giden belgede alıcı (irsaliyede Despatch/DeliveryCustomer)
        var wrapperNames = direction == 2
            ? new[] { "AccountingCustomerParty", "DeliveryCustomerParty" }
            : new[] { "AccountingSupplierParty", "DespatchSupplierParty" };
        var party = wrapperNames
            .Select(n => root.Element(Cac + n)?.Element(Cac + "Party"))
            .FirstOrDefault(p => p != null);
        if (party is null) return;

        foreach (var idEl in party.Elements(Cac + "PartyIdentification").Select(x => x.Element(Cbc + "ID")))
        {
            var scheme = (string?)idEl?.Attribute("schemeID");
            if (scheme is "VKN" or "TCKN")
            {
                info.TaxNr = Clean(idEl!.Value);
                info.TaxType = scheme == "TCKN" ? 2 : 1;
                break;
            }
        }

        var name = Text(party.Element(Cac + "PartyName"), "Name");
        if (string.IsNullOrWhiteSpace(name))
        {
            var person = party.Element(Cac + "Person");
            name = string.Join(' ', new[] { Text(person, "FirstName"), Text(person, "MiddleName"), Text(person, "FamilyName") }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
        }
        info.Title = Clean(name);

        var addr = party.Element(Cac + "PostalAddress");
        if (addr != null)
        {
            var street = string.Join(' ', new[]
                {
                    Text(addr, "Room"), Text(addr, "StreetName"), Text(addr, "BuildingName"),
                    Text(addr, "BuildingNumber") is { } no ? "No: " + no : null,
                }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
            info.Street = Clean(street);
            info.District = Text(addr, "District");
            info.Town = Text(addr, "CitySubdivisionName");
            info.City = Text(addr, "CityName");
            info.PostalZone = Text(addr, "PostalZone");
            info.Country = Text(addr.Element(Cac + "Country"), "Name");
        }

        info.TaxOffice = Text(party.Element(Cac + "PartyTaxScheme")?.Element(Cac + "TaxScheme"), "Name");
        var contact = party.Element(Cac + "Contact");
        info.Phone = Text(contact, "Telephone");
        info.Email = Text(contact, "ElectronicMail");
        info.Website = Text(party, "WebsiteURI");
    }

    private static string? Text(XElement? parent, string localName) => Clean(parent?.Element(Cbc + localName)?.Value);

    private static string? Clean(string? s)
    {
        var v = s == null ? null : string.Join(' ', s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return string.IsNullOrEmpty(v) ? null : v;
    }

    private static string? Cut(string? s, int max) => s is null ? null : s.Length <= max ? s : s[..max];

    private static bool IsTurkey(string? country) =>
        country is null || country.Trim().ToUpperInvariant() is "TÜRKIYE" or "TÜRKİYE" or "TURKIYE" or "TURKEY" or "TR"
        || country.StartsWith("T", StringComparison.OrdinalIgnoreCase) && country.Contains("rk", StringComparison.OrdinalIgnoreCase);

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
