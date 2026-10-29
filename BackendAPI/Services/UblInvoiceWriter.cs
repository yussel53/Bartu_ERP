using System.Globalization;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace BartuERP.Backend.Services;

public sealed class UblOutParty
{
    /// <summary>10 hane VKN · 11 hane TCKN</summary>
    public string TaxNr { get; set; } = "";
    public string Name { get; set; } = "";
    public string? TaxOffice { get; set; }
    public string? Street { get; set; }
    public string? BuildingNumber { get; set; }
    /// <summary>İlçe (CitySubdivisionName — GİB zorunlu)</summary>
    public string? Town { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Web { get; set; }
    public bool IsPerson => TaxNr.Length == 11;
}

public sealed class UblOutLine
{
    public int LineNo { get; set; }
    public string? Code { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    /// <summary>UN/ECE birim kodu (C62, KGM …)</summary>
    public string UnitCode { get; set; } = "C62";
    public decimal Price { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxRate { get; set; }
    /// <summary>KDV istisna / muafiyet kodu (301, 351 …)</summary>
    public string? ExemptionCode { get; set; }
    public string? ExemptionReason { get; set; }
    /// <summary>KDV tevkifat kodu (601 …) ve oranı (%; örn. 5/10 → 50)</summary>
    public string? WithholdingCode { get; set; }
    public decimal WithholdingRate { get; set; }

    public decimal Gross => UblInvoiceWriter.R(Quantity * Price);
    public decimal Net => Gross - UblInvoiceWriter.R(Discount);
    public decimal Tax => UblInvoiceWriter.R(Net * TaxRate / 100m);
    public decimal Withholding => string.IsNullOrWhiteSpace(WithholdingCode) ? 0 : UblInvoiceWriter.R(Tax * WithholdingRate / 100m);
}

/// <summary>e-Arşiv'e özgü bilgiler (GİB e-Arşiv kılavuzu 3.3.2.4 gonderimSekli, 3.3.2.17 internetSatisBilgi)</summary>
public sealed class UblEArchiveInfo
{
    /// <summary>ELEKTRONIK · KAGIT</summary>
    public string SendType { get; set; } = "ELEKTRONIK";
    public bool IsInternetSale { get; set; }
    public string? WebAddress { get; set; }
    /// <summary>KREDIKARTI/BANKAKARTI · EFT/HAVALE · KAPIDAODEME · ODEMEARACISI · DIGER</summary>
    public string? PaymentMethod { get; set; }
    /// <summary>DIGER'de ödeme şeklinin açıklaması</summary>
    public string? PaymentNote { get; set; }
    public string? PaymentAgent { get; set; }
    public DateTime? PaymentDate { get; set; }
    public DateTime? DespatchDate { get; set; }
    public string? CarrierTaxNr { get; set; }
    public string? CarrierName { get; set; }

    /// <summary>Ödeme şekli → UN/ECE 4461 ödeme aracı kodu (entegratörlerin e-Arşiv rapor eşlemesi)</summary>
    public static string? PaymentMeansCode(string? method) => method switch
    {
        "ODEMEARACISI" => "1",
        "KAPIDAODEME" => "10",
        "EFT/HAVALE" => "30",
        "KREDIKARTI/BANKAKARTI" => "48",
        "DIGER" => "97",
        _ => null,
    };

    public static readonly string[] PaymentMethods = { "KREDIKARTI/BANKAKARTI", "EFT/HAVALE", "KAPIDAODEME", "ODEMEARACISI", "DIGER" };
}

public sealed class UblOutInvoice
{
    public string InvoiceNo { get; set; } = "";
    public string Uuid { get; set; } = Guid.NewGuid().ToString();
    public DateTime IssueDate { get; set; }
    public DateTime? IssueTime { get; set; }
    /// <summary>TEMELFATURA · TICARIFATURA · EARSIVFATURA</summary>
    public string ProfileId { get; set; } = "TICARIFATURA";
    /// <summary>SATIS · IADE · ISTISNA · TEVKIFAT</summary>
    public string TypeCode { get; set; } = "SATIS";
    public string Currency { get; set; } = "TRY";
    public decimal? ExchangeRate { get; set; }
    public List<string> Notes { get; set; } = new();
    /// <summary>İade: iade edilen fatura no ve tarihi</summary>
    public string? ReturnInvoiceNo { get; set; }
    public DateTime? ReturnInvoiceDate { get; set; }
    public List<(string No, DateTime Date)> DespatchRefs { get; set; } = new();
    public UblOutParty Supplier { get; set; } = new();
    public UblOutParty Customer { get; set; } = new();
    public List<UblOutLine> Lines { get; set; } = new();
    /// <summary>Yalnız EARSIVFATURA'da yazılır</summary>
    public UblEArchiveInfo? EArchive { get; set; }
}

/// <summary>
/// UBL-TR 1.2 fatura üretici (E-03). Eleman sırası UBL 2.1 şemasına göredir; imza (UBLExtensions içeriği) entegratörde atılır.
/// Gidiş-dönüş: üretilen XML <see cref="UblInvoiceReader"/> ile okunduğunda toplamlar faturayla aynı olmalı.
/// </summary>
public static class UblInvoiceWriter
{
    private static readonly XNamespace Inv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
    private static readonly XNamespace Cac = UblInvoiceReader.Cac;
    private static readonly XNamespace Cbc = UblInvoiceReader.Cbc;
    private static readonly XNamespace Ext = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";
    private static readonly CultureInfo Inv0 = CultureInfo.InvariantCulture;

    internal static decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    private static string A(decimal v) => R(v).ToString("0.00", Inv0);
    private static string Q(decimal v) => v.ToString("0.########", Inv0);
    private static string P(decimal v) => v.ToString("0.##", Inv0);

    public sealed record Totals(decimal LineExtension, decimal Allowance, decimal TaxExclusive, decimal Tax, decimal TaxInclusive, decimal Withholding, decimal Payable);

    public static Totals Calc(UblOutInvoice inv)
    {
        var net = inv.Lines.Sum(l => l.Net);
        var disc = inv.Lines.Sum(l => R(l.Discount));
        var tax = inv.Lines.Sum(l => l.Tax);
        var wh = inv.Lines.Sum(l => l.Withholding);
        return new Totals(net, disc, net, tax, net + tax, wh, net + tax - wh);
    }

    public static string Write(UblOutInvoice inv)
    {
        var cur = string.IsNullOrWhiteSpace(inv.Currency) ? "TRY" : inv.Currency.Trim().ToUpperInvariant();
        XElement Amt(XName n, decimal v) => new(n, new XAttribute("currencyID", cur), A(v));
        var t = Calc(inv);

        var root = new XElement(Inv + "Invoice",
            new XAttribute(XNamespace.Xmlns + "cac", Cac.NamespaceName),
            new XAttribute(XNamespace.Xmlns + "cbc", Cbc.NamespaceName),
            new XAttribute(XNamespace.Xmlns + "ext", Ext.NamespaceName),
            // İmza entegratörde bu alana yazılır
            new XElement(Ext + "UBLExtensions", new XElement(Ext + "UBLExtension", new XElement(Ext + "ExtensionContent"))),
            new XElement(Cbc + "UBLVersionID", "2.1"),
            new XElement(Cbc + "CustomizationID", "TR1.2"),
            new XElement(Cbc + "ProfileID", inv.ProfileId),
            new XElement(Cbc + "ID", inv.InvoiceNo),
            new XElement(Cbc + "CopyIndicator", "false"),
            new XElement(Cbc + "UUID", inv.Uuid),
            new XElement(Cbc + "IssueDate", inv.IssueDate.ToString("yyyy-MM-dd", Inv0)),
            new XElement(Cbc + "IssueTime", (inv.IssueTime ?? inv.IssueDate).ToString("HH:mm:ss", Inv0)),
            new XElement(Cbc + "InvoiceTypeCode", inv.TypeCode),
            inv.Notes.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => new XElement(Cbc + "Note", n.Trim())),
            new XElement(Cbc + "DocumentCurrencyCode", cur),
            new XElement(Cbc + "LineCountNumeric", inv.Lines.Count));

        if (!string.IsNullOrWhiteSpace(inv.ReturnInvoiceNo))
            root.Add(new XElement(Cac + "BillingReference",
                new XElement(Cac + "InvoiceDocumentReference",
                    new XElement(Cbc + "ID", inv.ReturnInvoiceNo.Trim()),
                    new XElement(Cbc + "IssueDate", (inv.ReturnInvoiceDate ?? inv.IssueDate).ToString("yyyy-MM-dd", Inv0)),
                    new XElement(Cbc + "DocumentTypeCode", "IADE"))));

        foreach (var (no, date) in inv.DespatchRefs)
            root.Add(new XElement(Cac + "DespatchDocumentReference",
                new XElement(Cbc + "ID", no),
                new XElement(Cbc + "IssueDate", date.ToString("yyyy-MM-dd", Inv0))));

        // e-Arşiv gönderim şekli / internet satışı işareti — entegratör bu alanlardan e-Arşiv raporunu üretir
        var ea = inv.ProfileId == "EARSIVFATURA" ? inv.EArchive : null;
        if (ea != null)
        {
            var day = inv.IssueDate.ToString("yyyy-MM-dd", Inv0);
            root.Add(new XElement(Cac + "AdditionalDocumentReference",
                new XElement(Cbc + "ID", "SendType"), new XElement(Cbc + "IssueDate", day), new XElement(Cbc + "DocumentType", ea.SendType)));
            if (ea.IsInternetSale)
                root.Add(new XElement(Cac + "AdditionalDocumentReference",
                    new XElement(Cbc + "ID", "IsInternetSale"), new XElement(Cbc + "IssueDate", day), new XElement(Cbc + "DocumentType", "true")));
        }

        // GİB şematronu cac:Signature ister; asıl imza UBLExtensions içindedir
        root.Add(new XElement(Cac + "Signature",
            new XElement(Cbc + "ID", new XAttribute("schemeID", "VKN_TCKN"), inv.Supplier.TaxNr),
            new XElement(Cac + "SignatoryParty",
                new XElement(Cac + "PartyIdentification", new XElement(Cbc + "ID", new XAttribute("schemeID", inv.Supplier.IsPerson ? "TCKN" : "VKN"), inv.Supplier.TaxNr)),
                Address(inv.Supplier)),
            new XElement(Cac + "DigitalSignatureAttachment",
                new XElement(Cac + "ExternalReference", new XElement(Cbc + "URI", "#Signature_" + inv.InvoiceNo)))));

        root.Add(new XElement(Cac + "AccountingSupplierParty", Party(inv.Supplier)));
        root.Add(new XElement(Cac + "AccountingCustomerParty", Party(inv.Customer)));

        if (ea is { IsInternetSale: true })
        {
            // İnternet satışı: gönderi tarihi + taşıyıcı (Delivery), ödeme şekli / aracı / tarihi (PaymentMeans)
            var carrier = (ea.CarrierTaxNr ?? "").Trim();
            var delivery = new XElement(Cac + "Delivery");
            if (carrier.Length > 0)
            {
                var person = carrier.Length == 11;
                var name = (ea.CarrierName ?? "").Trim();
                var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                delivery.Add(new XElement(Cac + "CarrierParty",
                    new XElement(Cac + "PartyIdentification", new XElement(Cbc + "ID", new XAttribute("schemeID", person ? "TCKN" : "VKN"), carrier)),
                    person ? null : new XElement(Cac + "PartyName", new XElement(Cbc + "Name", name)),
                    // UBL-TR şeması Party'de adres ister; taşıyıcının adresi tutulmuyor
                    new XElement(Cac + "PostalAddress",
                        new XElement(Cbc + "CitySubdivisionName", ""),
                        new XElement(Cbc + "CityName", ""),
                        new XElement(Cac + "Country", new XElement(Cbc + "Name", "Türkiye"))),
                    person ? new XElement(Cac + "Person",
                        new XElement(Cbc + "FirstName", parts.Length > 1 ? string.Join(' ', parts[..^1]) : name),
                        new XElement(Cbc + "FamilyName", parts.Length > 1 ? parts[^1] : name)) : null));
            }
            if (ea.DespatchDate is DateTime dd)
                delivery.Add(new XElement(Cac + "Despatch", new XElement(Cbc + "ActualDespatchDate", dd.ToString("yyyy-MM-dd", Inv0))));
            if (delivery.HasElements) root.Add(delivery);

            if (UblEArchiveInfo.PaymentMeansCode(ea.PaymentMethod) is { } code)
                root.Add(new XElement(Cac + "PaymentMeans",
                    new XElement(Cbc + "PaymentMeansCode", code),
                    ea.PaymentDate is DateTime pd ? new XElement(Cbc + "PaymentDueDate", pd.ToString("yyyy-MM-dd", Inv0)) : null,
                    string.IsNullOrWhiteSpace(ea.PaymentAgent) ? null : new XElement(Cbc + "PaymentChannelCode", ea.PaymentAgent.Trim()),
                    code == "97" && !string.IsNullOrWhiteSpace(ea.PaymentNote) ? new XElement(Cbc + "InstructionNote", ea.PaymentNote.Trim()) : null));
        }

        if (cur != "TRY" && inv.ExchangeRate is decimal rate && rate > 0)
            root.Add(new XElement(Cac + "PricingExchangeRate",
                new XElement(Cbc + "SourceCurrencyCode", cur),
                new XElement(Cbc + "TargetCurrencyCode", "TRY"),
                new XElement(Cbc + "CalculationRate", rate.ToString("0.######", Inv0))));

        root.Add(TaxTotal(inv.Lines, cur, Amt));
        var wh = WithholdingTotal(inv.Lines, Amt);
        if (wh != null) root.Add(wh);

        root.Add(new XElement(Cac + "LegalMonetaryTotal",
            Amt(Cbc + "LineExtensionAmount", t.LineExtension),
            Amt(Cbc + "TaxExclusiveAmount", t.TaxExclusive),
            Amt(Cbc + "TaxInclusiveAmount", t.TaxInclusive),
            Amt(Cbc + "AllowanceTotalAmount", t.Allowance),
            Amt(Cbc + "PayableAmount", t.Payable)));

        foreach (var l in inv.Lines)
        {
            var line = new XElement(Cac + "InvoiceLine",
                new XElement(Cbc + "ID", l.LineNo),
                string.IsNullOrWhiteSpace(l.Description) ? null : new XElement(Cbc + "Note", l.Description),
                new XElement(Cbc + "InvoicedQuantity", new XAttribute("unitCode", l.UnitCode), Q(l.Quantity)),
                Amt(Cbc + "LineExtensionAmount", l.Net));
            if (R(l.Discount) != 0)
                line.Add(new XElement(Cac + "AllowanceCharge",
                    new XElement(Cbc + "ChargeIndicator", "false"),
                    new XElement(Cbc + "MultiplierFactorNumeric", l.Gross == 0 ? "0" : (R(l.Discount) / l.Gross).ToString("0.####", Inv0)),
                    Amt(Cbc + "Amount", l.Discount),
                    Amt(Cbc + "BaseAmount", l.Gross)));
            line.Add(TaxTotal(new[] { l }, cur, Amt));
            var lwh = WithholdingTotal(new[] { l }, Amt);
            if (lwh != null) line.Add(lwh);
            // Tasarımların çoğu kodlu malzemede adı Item/Description'dan okur
            line.Add(new XElement(Cac + "Item",
                new XElement(Cbc + "Description", l.Name),
                new XElement(Cbc + "Name", l.Name),
                string.IsNullOrWhiteSpace(l.Code) ? null : new XElement(Cac + "SellersItemIdentification", new XElement(Cbc + "ID", l.Code))));
            line.Add(new XElement(Cac + "Price", new XElement(Cbc + "PriceAmount", new XAttribute("currencyID", cur), Q(l.Price))));
            root.Add(line);
        }

        return Serialize(new XDocument(new XDeclaration("1.0", "UTF-8", null), root));
    }

    /// <summary>
    /// XSLT tasarımını AdditionalDocumentReference olarak gömer (belge kurallarından sonra, imzadan önce).
    /// Varsa eski XSLT referansı çıkarılır; yeni referans cac:Signature'dan önce eklenir.
    /// </summary>
    public static string EmbedXslt(string xml, string xslt, string? fileName)
    {
        var doc = XDocument.Parse(xml);
        var root = doc.Root!;
        root.Elements(Cac + "AdditionalDocumentReference")
            .Where(e => string.Equals((string?)e.Element(Cbc + "DocumentType"), "XSLT", StringComparison.OrdinalIgnoreCase))
            .Remove();
        var no = (string?)root.Element(Cbc + "ID") ?? "fatura";
        var reference = new XElement(Cac + "AdditionalDocumentReference",
            new XElement(Cbc + "ID", (string?)root.Element(Cbc + "UUID") ?? Guid.NewGuid().ToString()),
            new XElement(Cbc + "IssueDate", (string?)root.Element(Cbc + "IssueDate") ?? DateTime.Today.ToString("yyyy-MM-dd", Inv0)),
            new XElement(Cbc + "DocumentType", "XSLT"),
            new XElement(Cac + "Attachment",
                new XElement(Cbc + "EmbeddedDocumentBinaryObject",
                    new XAttribute("characterSetCode", "UTF-8"),
                    new XAttribute("encodingCode", "Base64"),
                    new XAttribute("filename", string.IsNullOrWhiteSpace(fileName) ? no + ".xslt" : fileName),
                    new XAttribute("mimeCode", "application/xml"),
                    Convert.ToBase64String(Encoding.UTF8.GetBytes(xslt)))));
        var before = root.Element(Cac + "Signature") ?? root.Element(Cac + "AccountingSupplierParty");
        if (before != null) before.AddBeforeSelf(reference);
        else root.Add(reference);
        return Serialize(doc);
    }

    private static string Serialize(XDocument doc)
    {
        var sb = new StringBuilder();
        using (var w = XmlWriter.Create(new Utf8Writer(sb), new XmlWriterSettings { Indent = true, Encoding = new UTF8Encoding(false) }))
            doc.Save(w);
        return sb.ToString();
    }

    /// <summary>Oran + istisna koduna göre gruplanmış KDV alt toplamları</summary>
    private static XElement TaxTotal(IEnumerable<UblOutLine> lines, string cur, Func<XName, decimal, XElement> amt)
    {
        var groups = lines.GroupBy(l => (l.TaxRate, Code: l.TaxRate == 0 ? (l.ExemptionCode ?? "").Trim() : ""))
            .Select(g => (g.Key.TaxRate, g.Key.Code, Reason: g.Select(x => x.ExemptionReason).FirstOrDefault(r => !string.IsNullOrWhiteSpace(r)),
                Base: g.Sum(x => x.Net), Tax: g.Sum(x => x.Tax)))
            .ToList();
        return new XElement(Cac + "TaxTotal",
            amt(Cbc + "TaxAmount", groups.Sum(g => g.Tax)),
            groups.Select(g => new XElement(Cac + "TaxSubtotal",
                amt(Cbc + "TaxableAmount", g.Base),
                amt(Cbc + "TaxAmount", g.Tax),
                new XElement(Cbc + "Percent", P(g.TaxRate)),
                new XElement(Cac + "TaxCategory",
                    string.IsNullOrEmpty(g.Code) ? null : new XElement(Cbc + "TaxExemptionReasonCode", g.Code),
                    string.IsNullOrEmpty(g.Code) ? null : new XElement(Cbc + "TaxExemptionReason", g.Reason ?? ExemptionText(g.Code)),
                    new XElement(Cac + "TaxScheme",
                        new XElement(Cbc + "Name", "KDV"),
                        new XElement(Cbc + "TaxTypeCode", "0015"))))));
    }

    private static XElement? WithholdingTotal(IEnumerable<UblOutLine> lines, Func<XName, decimal, XElement> amt)
    {
        var groups = lines.Where(l => !string.IsNullOrWhiteSpace(l.WithholdingCode))
            .GroupBy(l => (Code: l.WithholdingCode!.Trim(), l.WithholdingRate))
            .Select(g => (g.Key.Code, g.Key.WithholdingRate, Base: g.Sum(x => x.Tax), Amount: g.Sum(x => x.Withholding)))
            .ToList();
        if (groups.Count == 0) return null;
        return new XElement(Cac + "WithholdingTaxTotal",
            amt(Cbc + "TaxAmount", groups.Sum(g => g.Amount)),
            groups.Select(g => new XElement(Cac + "TaxSubtotal",
                amt(Cbc + "TaxableAmount", g.Base),
                amt(Cbc + "TaxAmount", g.Amount),
                new XElement(Cbc + "Percent", P(g.WithholdingRate)),
                new XElement(Cac + "TaxCategory",
                    new XElement(Cac + "TaxScheme",
                        new XElement(Cbc + "Name", "KDV TEVKİFAT"),
                        new XElement(Cbc + "TaxTypeCode", g.Code))))));
    }

    private static XElement Party(UblOutParty p)
    {
        var party = new XElement(Cac + "Party",
            string.IsNullOrWhiteSpace(p.Web) ? null : new XElement(Cbc + "WebsiteURI", p.Web),
            new XElement(Cac + "PartyIdentification", new XElement(Cbc + "ID", new XAttribute("schemeID", p.IsPerson ? "TCKN" : "VKN"), p.TaxNr)),
            p.IsPerson ? null : new XElement(Cac + "PartyName", new XElement(Cbc + "Name", p.Name)),
            Address(p),
            new XElement(Cac + "PartyTaxScheme", new XElement(Cac + "TaxScheme", new XElement(Cbc + "Name", p.TaxOffice ?? ""))));
        if (!string.IsNullOrWhiteSpace(p.Phone) || !string.IsNullOrWhiteSpace(p.Email))
            party.Add(new XElement(Cac + "Contact",
                string.IsNullOrWhiteSpace(p.Phone) ? null : new XElement(Cbc + "Telephone", p.Phone),
                string.IsNullOrWhiteSpace(p.Email) ? null : new XElement(Cbc + "ElectronicMail", p.Email)));
        if (p.IsPerson)
        {
            // TCKN: ad / soyad (son kelime soyad)
            var parts = p.Name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var family = parts.Length > 1 ? parts[^1] : p.Name.Trim();
            var first = parts.Length > 1 ? string.Join(' ', parts[..^1]) : p.Name.Trim();
            party.Add(new XElement(Cac + "Person", new XElement(Cbc + "FirstName", first), new XElement(Cbc + "FamilyName", family)));
        }
        return party;
    }

    private static XElement Address(UblOutParty p) => new(Cac + "PostalAddress",
        string.IsNullOrWhiteSpace(p.Street) ? null : new XElement(Cbc + "StreetName", p.Street),
        string.IsNullOrWhiteSpace(p.BuildingNumber) ? null : new XElement(Cbc + "BuildingNumber", p.BuildingNumber),
        new XElement(Cbc + "CitySubdivisionName", p.Town ?? ""),
        new XElement(Cbc + "CityName", p.City ?? ""),
        string.IsNullOrWhiteSpace(p.PostalCode) ? null : new XElement(Cbc + "PostalZone", p.PostalCode),
        new XElement(Cac + "Country", new XElement(Cbc + "Name", string.IsNullOrWhiteSpace(p.Country) ? "Türkiye" : p.Country)));

    /// <summary>Sık kullanılan KDV istisna kodlarının GİB açıklaması</summary>
    public static string ExemptionText(string code) => code switch
    {
        "301" => "11/1-a Mal ihracatı",
        "302" => "11/1-a Hizmet ihracatı",
        "308" => "13/a Deniz hava ve demiryolu taşıma araçlarının teslimi",
        "317" => "17/4-s Engellilerin eğitimleri meslekleri ve günlük yaşamlarına ilişkin araç-gereç ve bilgisayar programları",
        "325" => "13/i Teknoloji geliştirme bölgelerinde yazılım teslimleri",
        "350" => "Diğerleri",
        "351" => "KDV - İstisna Olmayan Diğer",
        _ => "KDV istisnası",
    };

    /// <summary>UBL'i StringBuilder'a UTF-8 bildirimle yazar</summary>
    private sealed class Utf8Writer : StringWriter
    {
        public Utf8Writer(StringBuilder sb) : base(sb, CultureInfo.InvariantCulture) { }
        public override Encoding Encoding => new UTF8Encoding(false);
    }
}
