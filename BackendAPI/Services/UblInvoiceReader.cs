using System.Globalization;
using System.Xml;
using System.Xml.Linq;

namespace BartuERP.Backend.Services;

public sealed class UblParty
{
    public string? TaxNr { get; set; }
    public string? Name { get; set; }
}

public sealed class UblInvoiceLine
{
    public int LineNo { get; set; }
    /// <summary>Satıcının malzeme kodu (SellersItemIdentification)</summary>
    public string? SellerCode { get; set; }
    /// <summary>Alıcının malzeme kodu (BuyersItemIdentification)</summary>
    public string? BuyerCode { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public string? UnitCode { get; set; }
    public decimal Price { get; set; }
    public decimal Discount { get; set; }
    /// <summary>Mal/hizmet tutarı = miktar × fiyat − iskonto (LineExtensionAmount)</summary>
    public decimal LineAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    /// <summary>KDV matrahı (TaxSubtotal/TaxableAmount); yoksa null</summary>
    public decimal? TaxableAmount { get; set; }
}

public sealed class UblInvoice
{
    public string? InvoiceNo { get; set; }
    public string? Uuid { get; set; }
    public DateTime? IssueDate { get; set; }
    public string? ProfileId { get; set; }
    /// <summary>SATIS · IADE · TEVKIFAT · ISTISNA …</summary>
    public string? TypeCode { get; set; }
    public string? Currency { get; set; }
    public decimal? ExchangeRate { get; set; }
    public UblParty Supplier { get; set; } = new();
    public UblParty Customer { get; set; } = new();
    public decimal LineExtensionAmount { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal PayableAmount { get; set; }
    public List<UblInvoiceLine> Lines { get; set; } = new();
}

/// <summary>UBL-TR Invoice okuyucu (gelen e-fatura → alış faturası). Yalnız gereken alanlar.</summary>
public static class UblInvoiceReader
{
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private const string KdvTaxTypeCode = "0015";

    public static UblInvoice Read(string xml)
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
        if (root.Name.LocalName != "Invoice")
            throw new InvalidOperationException($"UBL bir fatura değil ({root.Name.LocalName}).");

        var inv = new UblInvoice
        {
            InvoiceNo = Text(root, Cbc + "ID"),
            Uuid = Text(root, Cbc + "UUID"),
            IssueDate = Date(Text(root, Cbc + "IssueDate")),
            ProfileId = Text(root, Cbc + "ProfileID"),
            TypeCode = Text(root, Cbc + "InvoiceTypeCode"),
            Currency = Text(root, Cbc + "DocumentCurrencyCode"),
            ExchangeRate = Num(root.Element(Cac + "PricingExchangeRate")?.Element(Cbc + "CalculationRate")?.Value),
            Supplier = Party(root.Element(Cac + "AccountingSupplierParty")),
            Customer = Party(root.Element(Cac + "AccountingCustomerParty")),
        };

        var total = root.Element(Cac + "LegalMonetaryTotal");
        inv.LineExtensionAmount = Num(total?.Element(Cbc + "LineExtensionAmount")?.Value) ?? 0;
        inv.PayableAmount = Num(total?.Element(Cbc + "PayableAmount")?.Value) ?? 0;
        inv.TaxTotal = root.Elements(Cac + "TaxTotal").Sum(t => Num(t.Element(Cbc + "TaxAmount")?.Value) ?? 0);

        var i = 0;
        foreach (var l in root.Elements(Cac + "InvoiceLine"))
        {
            i++;
            var item = l.Element(Cac + "Item");
            var qtyEl = l.Element(Cbc + "InvoicedQuantity");
            var kdv = l.Element(Cac + "TaxTotal")?.Elements(Cac + "TaxSubtotal")
                .FirstOrDefault(s => s.Element(Cac + "TaxCategory")?.Element(Cac + "TaxScheme")?.Element(Cbc + "TaxTypeCode")?.Value == KdvTaxTypeCode)
                ?? l.Element(Cac + "TaxTotal")?.Elements(Cac + "TaxSubtotal").FirstOrDefault();
            inv.Lines.Add(new UblInvoiceLine
            {
                LineNo = int.TryParse(Text(l, Cbc + "ID"), out var no) ? no : i,
                SellerCode = Text(item?.Element(Cac + "SellersItemIdentification"), Cbc + "ID"),
                BuyerCode = Text(item?.Element(Cac + "BuyersItemIdentification"), Cbc + "ID"),
                Name = Text(item, Cbc + "Name"),
                Description = Text(item, Cbc + "Description"),
                Quantity = Num(qtyEl?.Value) ?? 0,
                UnitCode = qtyEl?.Attribute("unitCode")?.Value,
                Price = Num(l.Element(Cac + "Price")?.Element(Cbc + "PriceAmount")?.Value) ?? 0,
                Discount = l.Elements(Cac + "AllowanceCharge")
                    .Where(a => !string.Equals(a.Element(Cbc + "ChargeIndicator")?.Value, "true", StringComparison.OrdinalIgnoreCase))
                    .Sum(a => Num(a.Element(Cbc + "Amount")?.Value) ?? 0),
                LineAmount = Num(l.Element(Cbc + "LineExtensionAmount")?.Value) ?? 0,
                TaxRate = Num(kdv?.Element(Cbc + "Percent")?.Value) ?? 0,
                TaxAmount = Num(kdv?.Element(Cbc + "TaxAmount")?.Value) ?? 0,
                TaxableAmount = Num(kdv?.Element(Cbc + "TaxableAmount")?.Value),
            });
        }
        return inv;
    }

    private static UblParty Party(XElement? wrapper)
    {
        var p = wrapper?.Element(Cac + "Party");
        if (p is null) return new UblParty();
        var ids = p.Elements(Cac + "PartyIdentification").Select(x => x.Element(Cbc + "ID")).Where(x => x != null).ToList();
        var tax = ids.FirstOrDefault(x => (string?)x!.Attribute("schemeID") is "VKN" or "TCKN")?.Value;
        var name = Text(p.Element(Cac + "PartyName"), Cbc + "Name");
        if (string.IsNullOrWhiteSpace(name))
        {
            var person = p.Element(Cac + "Person");
            name = string.Join(' ', new[] { Text(person, Cbc + "FirstName"), Text(person, Cbc + "FamilyName") }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
        }
        return new UblParty { TaxNr = tax?.Trim(), Name = string.IsNullOrWhiteSpace(name) ? null : name };
    }

    private static string? Text(XElement? parent, XName name)
    {
        var v = parent?.Element(name)?.Value?.Trim();
        return string.IsNullOrEmpty(v) ? null : v;
    }

    private static decimal? Num(string? v) =>
        decimal.TryParse(v?.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;

    private static DateTime? Date(string? v) =>
        DateTime.TryParseExact(v, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
}
