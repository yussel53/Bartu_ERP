using System.Globalization;
using System.Xml;
using System.Xml.Linq;

namespace BartuERP.Backend.Services.EGovRules;

/// <summary>
/// UBL-TR belgesi (Invoice / DespatchAdvice) üzerinde kural işlemleri için yardımcı: satırlar, alanlar,
/// ek belge (AdditionalDocumentReference) ve notlar — UBL eleman sırası korunarak eklenir.
/// </summary>
public sealed class UblDoc
{
    public static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    public static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

    public XDocument Doc { get; }
    public XElement Root { get; }
    public bool IsDespatch => Root.Name.LocalName == "DespatchAdvice";
    public bool IsInvoice => Root.Name.LocalName == "Invoice";

    public UblDoc(XDocument doc)
    {
        Doc = doc;
        Root = doc.Root ?? throw new InvalidOperationException("UBL boş.");
        if (!IsDespatch && !IsInvoice)
            throw new InvalidOperationException($"Desteklenmeyen UBL kökü: {Root.Name.LocalName}");
    }

    public static UblDoc Parse(string xml)
    {
        using var reader = XmlReader.Create(new StringReader(xml), new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
        });
        return new UblDoc(XDocument.Load(reader, LoadOptions.PreserveWhitespace));
    }

    public override string ToString() =>
        (Doc.Declaration != null ? Doc.Declaration + Environment.NewLine : "") + Doc.Root!.ToString(SaveOptions.DisableFormatting);

    // ── Başlık ───────────────────────────────────────────────────────────

    public string? Text(XElement? parent, XName name) => parent?.Element(name)?.Value?.Trim() is { Length: > 0 } v ? v : null;

    public string? DocumentId => Text(Root, Cbc + "ID");
    public string? IssueDate => Text(Root, Cbc + "IssueDate");
    public string? ProfileId => Text(Root, Cbc + "ProfileID");
    public string? TypeCode => Text(Root, Cbc + (IsDespatch ? "DespatchAdviceTypeCode" : "InvoiceTypeCode"));
    public string? Currency => Text(Root, Cbc + "DocumentCurrencyCode");

    /// <summary>Karşı taraf (giden belgede alıcı)</summary>
    public XElement? CustomerParty =>
        Root.Element(Cac + (IsDespatch ? "DeliveryCustomerParty" : "AccountingCustomerParty"))?.Element(Cac + "Party");

    public XElement? SupplierParty =>
        Root.Element(Cac + (IsDespatch ? "DespatchSupplierParty" : "AccountingSupplierParty"))?.Element(Cac + "Party");

    public static string? PartyTaxNr(XElement? party) =>
        party?.Elements(Cac + "PartyIdentification").Select(x => x.Element(Cbc + "ID"))
            .FirstOrDefault(x => (string?)x?.Attribute("schemeID") is "VKN" or "TCKN")?.Value.Trim();

    public static string? PartyName(XElement? party)
    {
        var n = party?.Element(Cac + "PartyName")?.Element(Cbc + "Name")?.Value;
        if (!string.IsNullOrWhiteSpace(n)) return n.Trim();
        var person = party?.Element(Cac + "Person");
        var full = string.Join(' ', new[] { person?.Element(Cbc + "FirstName")?.Value, person?.Element(Cbc + "FamilyName")?.Value }
            .Where(s => !string.IsNullOrWhiteSpace(s)));
        return full.Length > 0 ? full : null;
    }

    // ── Satırlar ─────────────────────────────────────────────────────────

    public XName LineName => Cac + (IsDespatch ? "DespatchLine" : "InvoiceLine");
    public XName QuantityName => Cbc + (IsDespatch ? "DeliveredQuantity" : "InvoicedQuantity");

    public List<XElement> Lines => Root.Elements(LineName).ToList();

    public XElement Item(XElement line) => line.Element(Cac + "Item") ?? Add(line, new XElement(Cac + "Item"), "Price", before: true);

    /// <summary>Satır alanı okuma — hedef adları: Item.Name, Item.Description, Line.Note, Item.SellersId, Item.BuyersId, Item.ManufacturersId, Item.BrandName, Item.ModelName</summary>
    public string? GetLineField(XElement line, string target) => target switch
    {
        "Line.Note" => line.Elements(Cbc + "Note").FirstOrDefault()?.Value,
        "Item.Name" => Item(line).Element(Cbc + "Name")?.Value,
        "Item.Description" => Item(line).Element(Cbc + "Description")?.Value,
        "Item.BrandName" => Item(line).Element(Cbc + "BrandName")?.Value,
        "Item.ModelName" => Item(line).Element(Cbc + "ModelName")?.Value,
        "Item.SellersId" => Item(line).Element(Cac + "SellersItemIdentification")?.Element(Cbc + "ID")?.Value,
        "Item.BuyersId" => Item(line).Element(Cac + "BuyersItemIdentification")?.Element(Cbc + "ID")?.Value,
        "Item.ManufacturersId" => Item(line).Element(Cac + "ManufacturersItemIdentification")?.Element(Cbc + "ID")?.Value,
        _ => throw new ArgumentException($"Bilinmeyen satır alanı: {target}"),
    };

    /// <summary>UBL Item alt eleman sırası (UBL 2.1)</summary>
    private static readonly string[] ItemOrder =
    [
        "Description", "PackQuantity", "PackSizeNumeric", "CatalogueIndicator", "Name", "HazardousRiskIndicator",
        "AdditionalInformation", "Keyword", "BrandName", "ModelName", "BuyersItemIdentification",
        "SellersItemIdentification", "ManufacturersItemIdentification", "StandardItemIdentification",
        "CatalogueItemIdentification", "AdditionalItemIdentification", "CatalogueDocumentReference",
        "ItemSpecificationDocumentReference", "OriginCountry", "CommodityClassification",
        "TransactionConditions", "HazardousItem", "ClassifiedTaxCategory", "AdditionalItemProperty",
        "ManufacturerParty", "InformationContentProviderParty", "OriginAddress", "ItemInstance",
    ];

    public void SetLineField(XElement line, string target, string? value)
    {
        value ??= "";
        switch (target)
        {
            case "Line.Note":
            {
                var note = line.Elements(Cbc + "Note").FirstOrDefault();
                if (note != null) note.Value = value;
                else line.Element(Cbc + "ID")?.AddAfterSelf(new XElement(Cbc + "Note", value));
                return;
            }
            case "Item.SellersId" or "Item.BuyersId" or "Item.ManufacturersId":
            {
                var name = target switch
                {
                    "Item.SellersId" => "SellersItemIdentification",
                    "Item.BuyersId" => "BuyersItemIdentification",
                    _ => "ManufacturersItemIdentification",
                };
                var item = Item(line);
                var ident = item.Element(Cac + name) ?? InsertOrdered(item, new XElement(Cac + name), ItemOrder, Cac);
                var id = ident.Element(Cbc + "ID");
                if (id != null) id.Value = value;
                else ident.Add(new XElement(Cbc + "ID", value));
                return;
            }
            default:
            {
                var local = target switch
                {
                    "Item.Name" => "Name",
                    "Item.Description" => "Description",
                    "Item.BrandName" => "BrandName",
                    "Item.ModelName" => "ModelName",
                    _ => throw new ArgumentException($"Bilinmeyen satır alanı: {target}"),
                };
                var item = Item(line);
                var el = item.Element(Cbc + local);
                if (el != null) el.Value = value;
                else InsertOrdered(item, new XElement(Cbc + local, value), ItemOrder, Cbc);
                return;
            }
        }
    }

    /// <summary>Elemanı UBL sırasına göre yerleştir (sıra listesinde sonra gelen ilk mevcut elemanın önüne)</summary>
    private static XElement InsertOrdered(XElement parent, XElement el, string[] order, XNamespace _)
    {
        var idx = Array.IndexOf(order, el.Name.LocalName);
        var after = parent.Elements().FirstOrDefault(e => Array.IndexOf(order, e.Name.LocalName) > idx);
        if (after != null) after.AddBeforeSelf(el);
        else parent.Add(el);
        return el;
    }

    private static XElement Add(XElement parent, XElement el, string anchorLocalName, bool before)
    {
        var anchor = parent.Elements().FirstOrDefault(e => e.Name.LocalName == anchorLocalName);
        if (anchor == null) parent.Add(el);
        else if (before) anchor.AddBeforeSelf(el);
        else anchor.AddAfterSelf(el);
        return el;
    }

    public static decimal Dec(string? s) =>
        decimal.TryParse(s?.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    public static string Fmt(decimal d, int decimals = 2) =>
        Math.Round(d, decimals, MidpointRounding.AwayFromZero).ToString("0." + new string('#', Math.Max(decimals, 1)), CultureInfo.InvariantCulture);

    // ── Başlık eklemeleri ────────────────────────────────────────────────

    /// <summary>Belge notu (cbc:Note) — UBL sırasında tip kodundan sonra</summary>
    public XElement AddNote(string text)
    {
        var note = new XElement(Cbc + "Note", text);
        var lastNote = Root.Elements(Cbc + "Note").LastOrDefault();
        if (lastNote != null) lastNote.AddAfterSelf(note);
        else
        {
            var anchor = Root.Element(Cbc + (IsDespatch ? "DespatchAdviceTypeCode" : "InvoiceTypeCode"))
                         ?? Root.Element(Cbc + "IssueTime") ?? Root.Element(Cbc + "IssueDate");
            if (anchor != null) anchor.AddAfterSelf(note);
            else Root.Add(note);
        }
        return note;
    }

    public List<XElement> Notes => Root.Elements(Cbc + "Note").ToList();

    private static readonly string[] HeaderAfterAdditionalDoc =
    [
        "Signature", "AccountingSupplierParty", "DespatchSupplierParty", "DeliveryCustomerParty",
        "AccountingCustomerParty", "BuyerCustomerParty", "SellerSupplierParty", "TaxRepresentativeParty",
        "Delivery", "Shipment", "PaymentMeans", "PaymentTerms", "TaxTotal", "LegalMonetaryTotal",
    ];

    /// <summary>Ek belge (cac:AdditionalDocumentReference) — tasarımda «ek alan» olarak okunur (Logo ADDITIONALDOCUMENT)</summary>
    public XElement AddAdditionalDocument(string id, string documentType, string? issueDate = null)
    {
        var el = new XElement(Cac + "AdditionalDocumentReference",
            new XElement(Cbc + "ID", id),
            new XElement(Cbc + "IssueDate", issueDate ?? DateTime.Today.ToString("yyyy-MM-dd")),
            new XElement(Cbc + "DocumentType", documentType));
        var last = Root.Elements(Cac + "AdditionalDocumentReference").LastOrDefault();
        if (last != null)
        {
            last.AddAfterSelf(el);
            return el;
        }
        var anchor = Root.Elements().FirstOrDefault(e => HeaderAfterAdditionalDoc.Contains(e.Name.LocalName));
        if (anchor != null) anchor.AddBeforeSelf(el);
        else Root.Add(el);
        return el;
    }

    /// <summary>Aynı DocumentType'lı ek belgeyi kaldır (kural tekrar çalışınca çift eklenmesin)</summary>
    public int RemoveAdditionalDocuments(string documentType)
    {
        var list = Root.Elements(Cac + "AdditionalDocumentReference")
            .Where(e => string.Equals(e.Element(Cbc + "DocumentType")?.Value?.Trim(), documentType, StringComparison.OrdinalIgnoreCase))
            .ToList();
        list.ForEach(e => e.Remove());
        return list.Count;
    }

    /// <summary>Satır numaralarını 1'den yeniden ver</summary>
    public void RenumberLines()
    {
        var i = 1;
        foreach (var l in Lines)
        {
            var id = l.Element(Cbc + "ID");
            if (id != null) id.Value = (i++).ToString(CultureInfo.InvariantCulture);
        }
        var count = Root.Element(Cbc + "LineCountNumeric");
        if (count != null) count.Value = Lines.Count.ToString(CultureInfo.InvariantCulture);
    }
}
