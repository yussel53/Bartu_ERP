using System.Data;
using System.Xml;
using System.Xml.Linq;
using Dapper;
using BartuERP.Backend.Services;

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
    /// <summary>e-Fatura posta kutusu etiketi (PK) — GİB mükellef listesinden</summary>
    public string? PostLabel { get; set; }
    /// <summary>e-Fatura gönderici birim etiketi (GB)</summary>
    public string? SenderLabel { get; set; }
    /// <summary>e-Fatura'ya geçiş (ilk etiket kayıt) tarihi</summary>
    public DateTime? EinvoiceEntryDate { get; set; }
    /// <summary>GİB listesinde e-Fatura mükellefi mi (null: sorgulanamadı)</summary>
    public bool? IsEInvoiceUser { get; set; }
    public string? LabelMessage { get; set; }
}

/// <summary>
/// e-Fatura / e-Arşiv / e-İrsaliye UBL'sindeki karşı taraf bilgisini okur (cari kart formunu doldurmak için;
/// kayıt kullanıcıya bırakılır). PK/GB etiketleri GİB mükellef listesinden (yerel tablo, yoksa e-Logo CheckGibUser).
/// </summary>
public sealed class EGovPartyCardRepository
{
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    private readonly IDbConnection _db;
    private readonly EFaturaMukellefRepository _mukellef;
    private readonly IntegratorMukellefService _integrator;
    private readonly ELogoDocumentSyncService _elogo;

    public EGovPartyCardRepository(
        IDbConnection db,
        EFaturaMukellefRepository mukellef,
        IntegratorMukellefService integrator,
        ELogoDocumentSyncService elogo)
    {
        _db = db;
        _mukellef = mukellef;
        _integrator = integrator;
        _elogo = elogo;
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
        await FillLabelsAsync(info, ct);
        return (info, null);
    }

    /// <summary>PK / GB etiketleri: önce yerel GİB listesi, yoksa e-Logo CheckGibUser (hata formu engellemez)</summary>
    private async Task FillLabelsAsync(EGovPartyInfo info, CancellationToken ct)
    {
        try
        {
            var r = await _mukellef.QueryByTaxNrAsync(info.TaxNr!, ct);
            if (!r.Found)
            {
                var cred = (await _elogo.ListCompaniesAsync(ct)).FirstOrDefault(c =>
                    (c.IntegratorName ?? "").Trim().ToUpperInvariant() is "ELOGO" or "LOGO" or "E-LOGO"
                    && !string.IsNullOrWhiteSpace(c.IntegratorUser) && !string.IsNullOrWhiteSpace(c.IntegratorPassword));
                if (cred != null)
                    r = await _integrator.CheckAsync(new IntegratorMukellefRequest
                    {
                        TaxNr = info.TaxNr!,
                        IntegratorName = cred.IntegratorName,
                        IntegratorWsUrl = ELogoDocumentSyncService.ResolvePostBoxUrl(cred.IntegratorWsUrl),
                        IntegratorUser = cred.IntegratorUser,
                        IntegratorPassword = cred.IntegratorPassword,
                        IntegratorVkN = cred.IntegratorVkN,
                        CompanyId = cred.CompanyId,
                    }, ct);
            }
            info.LabelMessage = r.Message;
            if (!r.Found && !r.CheckedExternal && r.Rows.Count == 0 && string.IsNullOrEmpty(r.SuggestedPostLabel))
                return;
            info.IsEInvoiceUser = r.Found;
            info.PostLabel = r.SuggestedPostLabel;
            info.SenderLabel = r.SuggestedSenderLabel;
            info.EinvoiceEntryDate = r.Rows.Where(x => x.FirstCreateDate != null).Min(x => x.FirstCreateDate);
        }
        catch (Exception ex)
        {
            info.LabelMessage = "Etiket sorgulanamadı: " + ex.Message;
        }
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
