using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Xsl;

namespace BartuERP.Backend.Services;

/// <summary>
/// E-Devlet XSLT tasarımı: dosya okuma, doğrulama (derleme) ve örnek UBL-TR belgesiyle HTML önizleme.
/// Güvenlik: XSLT içi script ve document() kapalı, harici kaynak (XmlResolver) yok, DTD yasak.
/// </summary>
public sealed class EGovXsltService
{
    public const int MaxXsltBytes = 5 * 1024 * 1024;
    private static readonly TimeSpan TransformTimeout = TimeSpan.FromSeconds(15);

    /// <summary>Yüklenen dosyayı metne çevirir (BOM / UTF-8 / UTF-16 algılanır).</summary>
    public static string ReadText(byte[] bytes)
    {
        using var reader = new StreamReader(new MemoryStream(bytes), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }

    public static string Sha256Hex(string content) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(content))).ToLowerInvariant();

    /// <summary>
    /// UBL içine gömülü görünüm tasarımı (cac:AdditionalDocumentReference → EmbeddedDocumentBinaryObject,
    /// filename *.xslt / *.xsl ya da DocumentType XSLT). Gönderenin tasarımıdır; yoksa null.
    /// </summary>
    public static (string Xslt, string? FileName)? ExtractEmbeddedXslt(string ublXml)
    {
        XNamespace cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
        XNamespace cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
        XDocument doc;
        using (var reader = XmlReader.Create(new StringReader(ublXml), SafeReaderSettings()))
            doc = XDocument.Load(reader);
        foreach (var r in doc.Root?.Elements(cac + "AdditionalDocumentReference") ?? Enumerable.Empty<XElement>())
        {
            var bin = r.Element(cac + "Attachment")?.Element(cbc + "EmbeddedDocumentBinaryObject");
            if (bin is null || string.IsNullOrWhiteSpace(bin.Value)) continue;
            var fileName = (string?)bin.Attribute("filename");
            var type = r.Element(cbc + "DocumentType")?.Value ?? r.Element(cbc + "DocumentTypeCode")?.Value;
            var isXslt = fileName?.EndsWith(".xslt", StringComparison.OrdinalIgnoreCase) == true
                         || fileName?.EndsWith(".xsl", StringComparison.OrdinalIgnoreCase) == true
                         || string.Equals(type, "XSLT", StringComparison.OrdinalIgnoreCase);
            if (!isXslt) continue;
            try
            {
                return (ReadText(Convert.FromBase64String(bin.Value.Trim())), fileName);
            }
            catch (FormatException)
            {
                // Base64 bozuksa sonraki referansa bak
            }
        }
        return null;
    }

    /// <summary>
    /// XSLT derlenebiliyor ve örnek UBL'de çalışıyor mu? Hata varsa okunur mesaj döner.
    /// version="2.0" başlıklı tasarımlar ileri uyumlu modda derlendiği için XSLT 2.0'a özgü
    /// fonksiyonlar (upper-case() vb.) ancak çalışırken hata verir — bu yüzden deneme dönüşümü yapılır.
    /// Tasarım belge türüne bağlı olmadığından önce tahmin edilen örnekte, olmazsa diğerinde denenir.
    /// </summary>
    public static string? Validate(string xslt)
    {
        var compileError = ValidateCompile(xslt);
        if (compileError != null) return compileError;
        var first = DetectSampleKind(xslt);
        var kinds = first == "despatch" ? new[] { "despatch", "invoice" } : new[] { "invoice", "despatch" };
        Exception? firstError = null;
        foreach (var kind in kinds)
        {
            try
            {
                Transform(xslt, SampleXml(kind));
                return null;
            }
            catch (Exception ex)
            {
                firstError ??= ex;
            }
        }
        return $"XSLT örnek belgede çalıştırılamadı: {Inner(firstError!).Message}";
    }

    /// <summary>XSLT irsaliye (DespatchAdvice) için mi yazılmış? Önizlemede örnek seçimi için.</summary>
    public static string DetectSampleKind(string xslt) =>
        xslt.Contains("schema:xsd:DespatchAdvice-2", StringComparison.Ordinal) ? "despatch" : "invoice";

    /// <summary>XSLT derlenebiliyor mu? Hata varsa okunur mesaj döner.</summary>
    private static string? ValidateCompile(string xslt)
    {
        try
        {
            // Script kapalı derlense de (çalışmaz) tasarımın açıkça reddedilmesi daha anlaşılır
            using (var reader = XmlReader.Create(new StringReader(xslt), SafeReaderSettings()))
            {
                while (reader.Read())
                {
                    if (reader.NodeType == XmlNodeType.Element && reader.LocalName == "script"
                        && reader.NamespaceURI == "urn:schemas-microsoft-com:xslt")
                        return "XSLT geçersiz: msxsl:script içeren tasarımlar kabul edilmez.";
                }
            }
            Compile(xslt);
            return null;
        }
        catch (Exception ex)
        {
            return $"XSLT geçersiz: {Inner(ex).Message}";
        }
    }

    /// <summary>XSLT'yi UBL XML'e uygular ve HTML döner.</summary>
    public static string Transform(string xslt, string xml)
    {
        var transform = Compile(xslt);
        string? html = null;
        Exception? error = null;

        // Derin özyinelemeli tasarımlar için geniş yığınlı ayrı iş parçacığı + süre sınırı
        var thread = new Thread(() =>
        {
            try
            {
                using var input = XmlReader.Create(new StringReader(xml), SafeReaderSettings());
                using var sw = new Utf8StringWriter();
                transform.Transform(input, null, sw);
                html = sw.ToString();
            }
            catch (Exception ex)
            {
                error = ex;
            }
        }, 64 * 1024 * 1024) { IsBackground = true };
        thread.Start();
        if (!thread.Join(TransformTimeout))
            throw new TimeoutException($"Önizleme {TransformTimeout.TotalSeconds:0} saniyede tamamlanamadı.");
        if (error != null) throw new InvalidOperationException($"Dönüştürme hatası: {Inner(error).Message}", error);
        return html ?? "";
    }

    /// <summary>kind: "despatch" → e-İrsaliye (DespatchAdvice), "earsiv" → EARSIVFATURA, diğerleri → TICARIFATURA.</summary>
    public static string SampleXml(string kind) => kind switch
    {
        "despatch" => SampleUbl.Despatch,
        "earsiv" => SampleUbl.Invoice(eArsiv: true),
        _ => SampleUbl.Invoice(eArsiv: false),
    };

    private static XslCompiledTransform Compile(string xslt)
    {
        var transform = new XslCompiledTransform();
        using var reader = XmlReader.Create(new StringReader(xslt), SafeReaderSettings());
        transform.Load(reader, new XsltSettings(enableDocumentFunction: false, enableScript: false), stylesheetResolver: null);
        return transform;
    }

    private static XmlReaderSettings SafeReaderSettings() => new()
    {
        DtdProcessing = DtdProcessing.Prohibit,
        XmlResolver = null,
    };

    private static Exception Inner(Exception ex)
    {
        while (ex.InnerException != null) ex = ex.InnerException;
        return ex;
    }

    /// <summary>html çıktısındaki META charset utf-16 yerine utf-8 yazılsın</summary>
    private sealed class Utf8StringWriter : StringWriter
    {
        public override Encoding Encoding => Encoding.UTF8;
    }
}

/// <summary>Önizleme için örnek UBL-TR 1.2 belgeleri (gerçek kişi / firma bilgisi içermez).</summary>
internal static class SampleUbl
{
    private const string Ns = """
        xmlns="urn:oasis:names:specification:ubl:schema:xsd:{0}-2"
        xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
        xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
        """;

    private const string Supplier = """
          <cac:Party>
            <cac:PartyIdentification><cbc:ID schemeID="VKN">1234567801</cbc:ID></cac:PartyIdentification>
            <cac:PartyName><cbc:Name>ÖRNEK SATICI TİCARET A.Ş.</cbc:Name></cac:PartyName>
            <cac:PostalAddress>
              <cbc:StreetName>Örnek Cad. No:1</cbc:StreetName>
              <cbc:CitySubdivisionName>Merkez</cbc:CitySubdivisionName>
              <cbc:CityName>Ankara</cbc:CityName>
              <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>Örnek Vergi Dairesi</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
            <cac:Contact><cbc:Telephone>0312 000 00 00</cbc:Telephone><cbc:ElectronicMail>info@ornek.test</cbc:ElectronicMail></cac:Contact>
          </cac:Party>
        """;

    private const string Customer = """
          <cac:Party>
            <cac:PartyIdentification><cbc:ID schemeID="VKN">9876543201</cbc:ID></cac:PartyIdentification>
            <cac:PartyName><cbc:Name>ÖRNEK ALICI LTD. ŞTİ.</cbc:Name></cac:PartyName>
            <cac:PostalAddress>
              <cbc:StreetName>Deneme Sok. No:2</cbc:StreetName>
              <cbc:CitySubdivisionName>Kadıköy</cbc:CitySubdivisionName>
              <cbc:CityName>İstanbul</cbc:CityName>
              <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>Deneme Vergi Dairesi</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
          </cac:Party>
        """;

    private static string Line(int no, string name, decimal qty, decimal price)
    {
        var inv = CultureInfo.InvariantCulture;
        var amount = (qty * price).ToString("0.00", inv);
        var tax = Math.Round(qty * price * 0.20m, 2).ToString("0.00", inv);
        var q = qty.ToString("0.##", inv);
        var p = price.ToString("0.00", inv);
        return $"""
              <cac:InvoiceLine>
                <cbc:ID>{no}</cbc:ID>
                <cbc:InvoicedQuantity unitCode="C62">{q}</cbc:InvoicedQuantity>
                <cbc:LineExtensionAmount currencyID="TRY">{amount}</cbc:LineExtensionAmount>
                <cac:TaxTotal>
                  <cbc:TaxAmount currencyID="TRY">{tax}</cbc:TaxAmount>
                  <cac:TaxSubtotal>
                    <cbc:TaxableAmount currencyID="TRY">{amount}</cbc:TaxableAmount>
                    <cbc:TaxAmount currencyID="TRY">{tax}</cbc:TaxAmount>
                    <cbc:Percent>20</cbc:Percent>
                    <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
                  </cac:TaxSubtotal>
                </cac:TaxTotal>
                <cac:Item><cbc:Description>{name} açıklaması</cbc:Description><cbc:Name>{name}</cbc:Name><cac:SellersItemIdentification><cbc:ID>STK-{no:000}</cbc:ID></cac:SellersItemIdentification></cac:Item>
                <cac:Price><cbc:PriceAmount currencyID="TRY">{p}</cbc:PriceAmount></cac:Price>
              </cac:InvoiceLine>
            """;
    }

    public static string Invoice(bool eArsiv)
    {
        var profile = eArsiv ? "EARSIVFATURA" : "TICARIFATURA";
        var prefix = eArsiv ? "EAR" : "ORN";
        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Invoice {string.Format(Ns, "Invoice")}>
              <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
              <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
              <cbc:ProfileID>{profile}</cbc:ProfileID>
              <cbc:ID>{prefix}2026000000001</cbc:ID>
              <cbc:CopyIndicator>false</cbc:CopyIndicator>
              <cbc:UUID>00000000-0000-4000-8000-000000000001</cbc:UUID>
              <cbc:IssueDate>2026-10-17</cbc:IssueDate>
              <cbc:IssueTime>10:30:00</cbc:IssueTime>
              <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
              <cbc:Note>Bu belge XSLT tasarım önizlemesi için örnek veridir.</cbc:Note>
              <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
              <cbc:LineCountNumeric>2</cbc:LineCountNumeric>
              <cac:AccountingSupplierParty>{Supplier}</cac:AccountingSupplierParty>
              <cac:AccountingCustomerParty>{Customer}</cac:AccountingCustomerParty>
              <cac:TaxTotal>
                <cbc:TaxAmount currencyID="TRY">460.00</cbc:TaxAmount>
                <cac:TaxSubtotal>
                  <cbc:TaxableAmount currencyID="TRY">2300.00</cbc:TaxableAmount>
                  <cbc:TaxAmount currencyID="TRY">460.00</cbc:TaxAmount>
                  <cbc:Percent>20</cbc:Percent>
                  <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
                </cac:TaxSubtotal>
              </cac:TaxTotal>
              <cac:LegalMonetaryTotal>
                <cbc:LineExtensionAmount currencyID="TRY">2300.00</cbc:LineExtensionAmount>
                <cbc:TaxExclusiveAmount currencyID="TRY">2300.00</cbc:TaxExclusiveAmount>
                <cbc:TaxInclusiveAmount currencyID="TRY">2760.00</cbc:TaxInclusiveAmount>
                <cbc:AllowanceTotalAmount currencyID="TRY">0.00</cbc:AllowanceTotalAmount>
                <cbc:PayableAmount currencyID="TRY">2760.00</cbc:PayableAmount>
              </cac:LegalMonetaryTotal>
            {Line(1, "Örnek Ürün A", 2, 500m)}
            {Line(2, "Örnek Hizmet B", 1, 1300m)}
            </Invoice>
            """;
    }

    public static string Despatch => $"""
        <?xml version="1.0" encoding="UTF-8"?>
        <DespatchAdvice {string.Format(Ns, "DespatchAdvice")}>
          <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
          <cbc:CustomizationID>TR1.2.1</cbc:CustomizationID>
          <cbc:ProfileID>TEMELIRSALIYE.V1</cbc:ProfileID>
          <cbc:ID>IRS2026000000001</cbc:ID>
          <cbc:CopyIndicator>false</cbc:CopyIndicator>
          <cbc:UUID>00000000-0000-4000-8000-000000000003</cbc:UUID>
          <cbc:IssueDate>2026-10-17</cbc:IssueDate>
          <cbc:IssueTime>09:00:00</cbc:IssueTime>
          <cbc:DespatchAdviceTypeCode>SEVK</cbc:DespatchAdviceTypeCode>
          <cbc:Note>Bu belge XSLT tasarım önizlemesi için örnek veridir.</cbc:Note>
          <cbc:LineCountNumeric>2</cbc:LineCountNumeric>
          <cac:DespatchSupplierParty>{Supplier}</cac:DespatchSupplierParty>
          <cac:DeliveryCustomerParty>{Customer}</cac:DeliveryCustomerParty>
          <cac:Shipment>
            <cbc:ID>1</cbc:ID>
            <cac:Delivery>
              <cac:CarrierParty>
                <cac:PartyIdentification><cbc:ID schemeID="VKN">1111111101</cbc:ID></cac:PartyIdentification>
                <cac:PartyName><cbc:Name>ÖRNEK NAKLİYAT</cbc:Name></cac:PartyName>
              </cac:CarrierParty>
              <cac:Despatch><cbc:ActualDespatchDate>2026-10-17</cbc:ActualDespatchDate><cbc:ActualDespatchTime>09:00:00</cbc:ActualDespatchTime></cac:Despatch>
            </cac:Delivery>
            <cac:TransportHandlingUnit>
              <cac:TransportEquipment><cbc:ID schemeID="DORSEPLAKA">06ABC001</cbc:ID></cac:TransportEquipment>
            </cac:TransportHandlingUnit>
            <cac:ShipmentStage>
              <cac:TransportMeans><cac:RoadTransport><cbc:LicensePlateID schemeID="PLAKA">06XYZ001</cbc:LicensePlateID></cac:RoadTransport></cac:TransportMeans>
              <cac:DriverPerson><cbc:FirstName>Örnek</cbc:FirstName><cbc:FamilyName>Sürücü</cbc:FamilyName><cbc:NationalityID>11111111111</cbc:NationalityID></cac:DriverPerson>
            </cac:ShipmentStage>
          </cac:Shipment>
          <cac:DespatchLine>
            <cbc:ID>1</cbc:ID>
            <cbc:DeliveredQuantity unitCode="C62">2</cbc:DeliveredQuantity>
            <cac:OrderLineReference><cbc:LineID>1</cbc:LineID></cac:OrderLineReference>
            <cac:Item><cbc:Description>Örnek Ürün A açıklaması</cbc:Description><cbc:Name>Örnek Ürün A</cbc:Name><cac:SellersItemIdentification><cbc:ID>STK-001</cbc:ID></cac:SellersItemIdentification></cac:Item>
          </cac:DespatchLine>
          <cac:DespatchLine>
            <cbc:ID>2</cbc:ID>
            <cbc:DeliveredQuantity unitCode="KGM">15.5</cbc:DeliveredQuantity>
            <cac:OrderLineReference><cbc:LineID>2</cbc:LineID></cac:OrderLineReference>
            <cac:Item><cbc:Description>Örnek Ürün C açıklaması</cbc:Description><cbc:Name>Örnek Ürün C</cbc:Name><cac:SellersItemIdentification><cbc:ID>STK-003</cbc:ID></cac:SellersItemIdentification></cac:Item>
          </cac:DespatchLine>
        </DespatchAdvice>
        """;
}
