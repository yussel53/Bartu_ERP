using System.Xml;
using System.Xml.Schema;

namespace BartuERP.Backend.Services;

public sealed class UblIssue
{
    /// <summary>error · warning · info</summary>
    public string Level { get; set; } = "error";
    /// <summary>kontrol · xsd · sematron</summary>
    public string Source { get; set; } = "kontrol";
    public string Message { get; set; } = "";
}

/// <summary>
/// Giden UBL doğrulaması (E-03): iş kuralları + GİB UBL-TR XSD (paket App_Data/gib-ubl-tr altındaysa).
/// </summary>
public sealed class UblValidator
{
    private readonly string _packageDir;
    private readonly ILogger<UblValidator> _log;
    private static readonly object Lock = new();
    private static XmlSchemaSet? _invoiceSchemas;
    private static string? _invoiceSchemaPath;

    public UblValidator(IWebHostEnvironment env, ILogger<UblValidator> log)
    {
        _packageDir = Path.Combine(env.ContentRootPath, "App_Data", "gib-ubl-tr");
        _log = log;
    }

    public string PackageDir => _packageDir;

    /// <summary>Faturanın iş kuralları — UBL üretilmeden önce</summary>
    public static List<UblIssue> CheckRules(UblOutInvoice inv, bool numberRequired)
    {
        var r = new List<UblIssue>();
        void E(string m) => r.Add(new UblIssue { Level = "error", Message = m });
        void W(string m) => r.Add(new UblIssue { Level = "warning", Message = m });

        static bool Digits(string s, params int[] lens) => lens.Contains(s.Length) && s.All(char.IsDigit);

        if (!Digits(inv.Supplier.TaxNr, 10, 11)) E("Firma VKN/TCKN eksik ya da hatalı (Sistem → Firmalar).");
        if (string.IsNullOrWhiteSpace(inv.Supplier.Name)) E("Firma unvanı eksik.");
        if (string.IsNullOrWhiteSpace(inv.Supplier.Town) || string.IsNullOrWhiteSpace(inv.Supplier.City)) E("Firma adresinde il / ilçe eksik.");
        if (string.IsNullOrWhiteSpace(inv.Supplier.TaxOffice)) W("Firma vergi dairesi boş.");

        if (!Digits(inv.Customer.TaxNr, 10, 11)) E("Cari VKN/TCKN eksik ya da hatalı (10 hane VKN, 11 hane TCKN).");
        if (string.IsNullOrWhiteSpace(inv.Customer.Name)) E("Cari unvanı eksik.");
        if (string.IsNullOrWhiteSpace(inv.Customer.Town) || string.IsNullOrWhiteSpace(inv.Customer.City)) E("Cari adresinde il / ilçe eksik.");
        if (string.IsNullOrWhiteSpace(inv.Customer.TaxOffice) && !inv.Customer.IsPerson) W("Cari vergi dairesi boş.");

        if (numberRequired && !System.Text.RegularExpressions.Regex.IsMatch(inv.InvoiceNo ?? "", "^[A-Z0-9]{3}[0-9]{13}$"))
            E("Belge numarası GİB biçiminde değil (3 karakter önek + yıl + 9 hane).");

        if (inv.Lines.Count == 0) E("Faturada satır yok.");
        foreach (var l in inv.Lines)
        {
            var at = $"Satır {l.LineNo} ({l.Name})";
            if (l.Quantity <= 0) E($"{at}: miktar sıfır ya da negatif.");
            if (l.Price < 0) E($"{at}: birim fiyat negatif.");
            if (l.Discount < 0 || l.Discount > l.Gross) E($"{at}: iskonto tutarı satır tutarını aşıyor ya da negatif.");
            if (l.TaxRate == 0 && string.IsNullOrWhiteSpace(l.ExemptionCode)) E($"{at}: KDV %0 için istisna kodu gerekli (satır ek alanı TaxExemptionCode; istisna değilse 351).");
            if (!string.IsNullOrWhiteSpace(l.WithholdingCode) && (l.WithholdingRate <= 0 || l.WithholdingRate > 100)) E($"{at}: tevkifat oranı (WithholdingRate) 1–100 olmalı.");
            if (!string.IsNullOrWhiteSpace(l.WithholdingCode) && l.TaxRate == 0) E($"{at}: KDV'siz satırda tevkifat olamaz.");
        }

        if (inv.TypeCode == "IADE")
        {
            if (string.IsNullOrWhiteSpace(inv.ReturnInvoiceNo)) E("İade faturasında iade edilen faturanın numarası gerekli.");
            if (inv.ProfileId == "TICARIFATURA") E("İade faturası TICARIFATURA senaryosuyla gönderilemez; TEMELFATURA seçin.");
        }
        if (inv.Currency != "TRY" && (inv.ExchangeRate ?? 0) <= 0) E($"Döviz ({inv.Currency}) için kur girilmemiş.");
        return r;
    }

    /// <summary>GİB XSD paketi yüklüyse şema doğrulaması; değilse bilgi notu</summary>
    public List<UblIssue> CheckXsd(string xml)
    {
        var r = new List<UblIssue>();
        var set = InvoiceSchemas();
        if (set == null)
        {
            r.Add(new UblIssue
            {
                Level = "info", Source = "xsd",
                Message = "GİB UBL-TR şema paketi yüklü değil; XSD doğrulaması atlandı (BackendAPI/App_Data/gib-ubl-tr).",
            });
            return r;
        }

        var settings = new XmlReaderSettings { ValidationType = ValidationType.Schema, Schemas = set, DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
        settings.ValidationEventHandler += (_, e) =>
        {
            // İmza entegratörde eklenir; boş ExtensionContent beklenen durum
            if (e.Message.Contains("ExtensionContent", StringComparison.OrdinalIgnoreCase)) return;
            r.Add(new UblIssue
            {
                Level = e.Severity == XmlSeverityType.Error ? "error" : "warning", Source = "xsd",
                Message = $"{e.Message} (satır {e.Exception?.LineNumber})",
            });
        };
        using var reader = XmlReader.Create(new StringReader(xml), settings);
        while (reader.Read()) { }
        if (r.Count == 0) r.Add(new UblIssue { Level = "info", Source = "xsd", Message = "GİB UBL-TR 1.2.1 XSD doğrulaması geçti." });
        return r;
    }

    private XmlSchemaSet? InvoiceSchemas()
    {
        lock (Lock)
        {
            if (!Directory.Exists(_packageDir)) return null;
            var path = Directory.EnumerateFiles(_packageDir, "UBL-Invoice-2.1.xsd", SearchOption.AllDirectories).FirstOrDefault();
            if (path == null) return null;
            if (_invoiceSchemas != null && _invoiceSchemaPath == path) return _invoiceSchemas;
            try
            {
                var set = new XmlSchemaSet { XmlResolver = new XmlUrlResolver() };
                // xmldsig / XAdES şemaları zincirden içe aktarılmıyor: common klasörü tümüyle eklenir (DTD'ler yok sayılır)
                var readerSettings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore };
                var common = Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(path)!)!, "common");
                var files = (Directory.Exists(common) ? Directory.GetFiles(common, "*.xsd") : Array.Empty<string>()).Append(path);
                foreach (var f in files)
                {
                    using var xr = XmlReader.Create(f, readerSettings);
                    var schema = XmlSchema.Read(xr, null)!;
                    if (!set.Contains(schema.TargetNamespace) || f == path) set.Add(schema);
                }
                set.Compile();
                _invoiceSchemas = set;
                _invoiceSchemaPath = path;
                return set;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "GİB UBL-TR şeması yüklenemedi: {Path}", path);
                return null;
            }
        }
    }
}
