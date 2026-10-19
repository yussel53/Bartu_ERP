using System.Globalization;
using System.IO.Compression;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;

namespace BartuERP.Backend.Services;

/// <summary>
/// e-Logo PostBoxService SOAP istemcisi — eftaura_elogo_kontrol/ELogoSoapClient örnek alınarak.
/// Login · GetDocumentList · GetDocumentData · SendDocument · GetDocumentStatus · Logout
/// </summary>
public sealed class ELogoPostBoxClient : IAsyncDisposable
{
    private static readonly XNamespace SoapEnv = "http://schemas.xmlsoap.org/soap/envelope/";
    private static readonly XNamespace Tem = "http://tempuri.org/";
    private static readonly XNamespace Arr = "http://schemas.microsoft.com/2003/10/Serialization/Arrays";
    private static readonly XNamespace Efat = "http://schemas.datacontract.org/2004/07/eFaturaWebService";

    private readonly HttpClient _http;
    private readonly string _serviceUrl;
    private readonly string _userName;
    private readonly string _password;
    private readonly string _appStr;
    private readonly bool _ownsHttp;
    private string? _sessionId;

    public ELogoPostBoxClient(
        HttpClient http,
        string serviceUrl,
        string userName,
        string password,
        string appStr = "KaviSoft",
        bool ownsHttp = false)
    {
        _http = http;
        _serviceUrl = string.IsNullOrWhiteSpace(serviceUrl)
            ? "https://pb.elogo.com.tr/PostBoxService.svc"
            : serviceUrl.Trim();
        _userName = userName;
        _password = password;
        _appStr = string.IsNullOrWhiteSpace(appStr) ? "KaviSoft" : appStr;
        _ownsHttp = ownsHttp;
    }

    public bool IsLoggedIn => !string.IsNullOrWhiteSpace(_sessionId);

    public async Task LoginAsync(CancellationToken ct = default)
    {
        var envelope =
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "efat", Efat.NamespaceName),
                new XElement(SoapEnv + "Header"),
                new XElement(SoapEnv + "Body",
                    new XElement(Tem + "Login",
                        new XElement(Tem + "login",
                            new XElement(Efat + "appStr", _appStr),
                            new XElement(Efat + "passWord", _password),
                            new XElement(Efat + "source", "1"),
                            new XElement(Efat + "userName", _userName),
                            new XElement(Efat + "version", "1")))));

        var (doc, _) = await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/Login", ct);
        var ok = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "LoginResult")?.Value;
        var session = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "sessionID")?.Value;
        if (!string.Equals(ok, "true", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(session))
        {
            var fault = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "faultstring")?.Value;
            throw new InvalidOperationException(
                $"e-Logo Login başarısız{(fault is null ? "" : ": " + fault)}");
        }

        _sessionId = session;
    }

    public async Task LogoutAsync(CancellationToken ct = default)
    {
        if (_sessionId is null) return;
        try
        {
            var envelope =
                new XElement(SoapEnv + "Envelope",
                    new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                    new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                    new XElement(SoapEnv + "Header"),
                    new XElement(SoapEnv + "Body",
                        new XElement(Tem + "Logout",
                            new XElement(Tem + "sessionID", _sessionId))));
            await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/Logout", ct);
        }
        finally
        {
            _sessionId = null;
        }
    }

    /// <param name="opType">1=Giden, 2=Gelen (e-Logo)</param>
    /// <param name="documentType">EINVOICEDETAIL / EARCHIVEDETAIL / EDESPATCHDETAIL</param>
    public async Task<List<ELogoDocumentRecord>> GetDocumentListAsync(
        DateTime beginDate,
        DateTime endDate,
        int opType,
        string documentType,
        int dateBy = 0,
        CancellationToken ct = default)
    {
        EnsureLoggedIn();

        // E-Arşiv: başlangıç ve bitiş aynı gün olmalı
        if (documentType.StartsWith("EARCHIVE", StringComparison.OrdinalIgnoreCase)
            && beginDate.Date != endDate.Date)
        {
            var all = new List<ELogoDocumentRecord>();
            for (var day = beginDate.Date; day <= endDate.Date; day = day.AddDays(1))
            {
                ct.ThrowIfCancellationRequested();
                all.AddRange(await GetDocumentListAsync(day, day, opType, documentType, dateBy, ct));
            }
            return all;
        }

        var paramList = new List<string>
        {
            $"DOCUMENTTYPE={documentType}",
            $"BEGINDATE={beginDate:yyyy-MM-dd}",
            $"ENDDATE={endDate:yyyy-MM-dd}",
            $"OPTYPE={opType}",
            $"DATEBY={dateBy}"
        };

        var envelope =
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "arr", Arr.NamespaceName),
                new XElement(SoapEnv + "Header"),
                new XElement(SoapEnv + "Body",
                    new XElement(Tem + "GetDocumentList",
                        new XElement(Tem + "sessionID", _sessionId),
                        new XElement(Tem + "paramList",
                            paramList.Select(p => new XElement(Arr + "string", p))))));

        var (doc, _) = await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/GetDocumentList", ct);
        return ParseDocumentList(doc);
    }

    /// <param name="documentType">EINVOICE / EARCHIVE / EDESPATCH</param>
    /// <param name="dataFormat">PDF veya UBL</param>
    public async Task<(byte[] FileBytes, string FileName)> GetDocumentDataAsync(
        string uuid,
        string documentType,
        string dataFormat,
        CancellationToken ct = default)
    {
        EnsureLoggedIn();
        if (string.IsNullOrWhiteSpace(uuid))
            throw new ArgumentException("UUID zorunlu", nameof(uuid));

        var paramList = new List<string>
        {
            $"DOCUMENTTYPE={documentType}",
            $"DATAFORMAT={dataFormat.ToUpperInvariant()}"
        };
        if (string.Equals(dataFormat, "PDF", StringComparison.OrdinalIgnoreCase))
            paramList.Add("UseDefaultXSLT=1");

        var envelope =
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "arr", Arr.NamespaceName),
                new XElement(SoapEnv + "Header"),
                new XElement(SoapEnv + "Body",
                    new XElement(Tem + "GetDocumentData",
                        new XElement(Tem + "sessionID", _sessionId),
                        new XElement(Tem + "uuid", uuid),
                        new XElement(Tem + "paramList",
                            paramList.Select(p => new XElement(Arr + "string", p))))));

        // Sabit SOAPAction — WSDL keşfi InternalServiceFault üretebiliyor (örnek proje notu)
        var (doc, _) = await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/GetDocumentData", ct);

        var resultCode = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "resultCode")?.Value;
        if (!string.Equals(resultCode, "1", StringComparison.Ordinal))
        {
            var msg = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "resultMsg")?.Value;
            throw new InvalidOperationException($"e-Logo GetDocumentData başarısız (resultCode={resultCode}). {msg}");
        }

        var base64 = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Value")?.Value;
        var fileName = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "fileName")?.Value ?? uuid;
        if (string.IsNullOrWhiteSpace(base64))
            throw new InvalidOperationException("e-Logo yanıtında belge verisi yok.");

        var zipBytes = Convert.FromBase64String(base64);
        return ExtractFirstFileFromZip(zipBytes, dataFormat, fileName);
    }

    /// <summary>
    /// E-03: imzasız UBL'i zip + base64 olarak gönderir (SIGNED=0 → imzayı e-Logo atar).
    /// Test hesabıyla doğrulanmadı; çağıran taraf canlı adres kilidini (EGovOutgoingService) kontrol eder.
    /// </summary>
    /// <param name="documentType">EINVOICE / EARCHIVE / EDESPATCH</param>
    public async Task<(bool Ok, string? Code, string? Message)> SendDocumentAsync(
        string xml,
        string fileBaseName,
        string documentType,
        string? receiverAlias,
        CancellationToken ct = default)
    {
        EnsureLoggedIn();
        byte[] zip;
        using (var ms = new MemoryStream())
        {
            using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
            {
                var entry = archive.CreateEntry(fileBaseName + ".xml", CompressionLevel.Optimal);
                using var es = entry.Open();
                var bytes = new UTF8Encoding(false).GetBytes(xml);
                es.Write(bytes, 0, bytes.Length);
            }
            zip = ms.ToArray();
        }
        var hash = Convert.ToHexString(System.Security.Cryptography.MD5.HashData(zip)).ToLowerInvariant();

        var paramList = new List<string> { $"DOCUMENTTYPE={documentType}", "SIGNED=0" };
        if (!string.IsNullOrWhiteSpace(receiverAlias)) paramList.Add($"ALIAS={receiverAlias.Trim()}");

        var envelope =
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "arr", Arr.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "efat", Efat.NamespaceName),
                new XElement(SoapEnv + "Header"),
                new XElement(SoapEnv + "Body",
                    new XElement(Tem + "SendDocument",
                        new XElement(Tem + "sessionID", _sessionId),
                        new XElement(Tem + "paramList", paramList.Select(p => new XElement(Arr + "string", p))),
                        new XElement(Tem + "document",
                            new XElement(Efat + "binaryData", new XElement(Efat + "Value", Convert.ToBase64String(zip))),
                            new XElement(Efat + "fileName", fileBaseName + ".zip"),
                            new XElement(Efat + "hash", hash)))));

        var (doc, _) = await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/SendDocument", ct);
        var code = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "resultCode")?.Value;
        var msg = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "resultMsg")?.Value
                  ?? doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "faultstring")?.Value;
        return (code == "1", code, msg);
    }

    /// <summary>
    /// E-04: gönderilmiş e-Arşiv faturayı iptal eder (DOCUMENTTYPE=CANCELEARCHIVEINVOICE, belge ETTN'si ile).
    /// e-Logo web servis dokümanına göre yazıldı; test hesabıyla doğrulanmadı. Kilit çağıran tarafta (EGovOutgoingService).
    /// </summary>
    public async Task<(bool Ok, string? Code, string? Message)> CancelEArchiveInvoiceAsync(string uuid, CancellationToken ct = default)
    {
        EnsureLoggedIn();
        var envelope =
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "arr", Arr.NamespaceName),
                new XElement(SoapEnv + "Header"),
                new XElement(SoapEnv + "Body",
                    new XElement(Tem + "SendDocument",
                        new XElement(Tem + "sessionID", _sessionId),
                        new XElement(Tem + "paramList",
                            new XElement(Arr + "string", "DOCUMENTTYPE=CANCELEARCHIVEINVOICE"),
                            new XElement(Arr + "string", $"UUID={uuid}")))));

        var (doc, _) = await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/SendDocument", ct);
        var code = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "resultCode")?.Value;
        var msg = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "resultMsg")?.Value
                  ?? doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "faultstring")?.Value;
        return (code == "1", code, msg);
    }

    /// <summary>Belgenin entegratör / GİB durumunu sorgular (yalnız okuma)</summary>
    /// <param name="documentType">EINVOICE / EARCHIVE / EDESPATCH</param>
    public async Task<Dictionary<string, string>> GetDocumentStatusAsync(string uuid, string documentType, CancellationToken ct = default)
    {
        EnsureLoggedIn();
        var envelope =
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "tem", Tem.NamespaceName),
                new XAttribute(XNamespace.Xmlns + "arr", Arr.NamespaceName),
                new XElement(SoapEnv + "Header"),
                new XElement(SoapEnv + "Body",
                    new XElement(Tem + "GetDocumentStatus",
                        new XElement(Tem + "sessionID", _sessionId),
                        new XElement(Tem + "uuid", uuid),
                        new XElement(Tem + "paramList", new XElement(Arr + "string", $"DOCUMENTTYPE={documentType}")))));

        var (doc, _) = await PostSoapAsync(envelope, "http://tempuri.org/IPostBoxService/GetDocumentStatus", ct);
        // Yanıt alanları sürüme göre değişebiliyor: yaprak elemanlar ad → değer
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var body = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Body");
        foreach (var e in (body ?? doc.Root!).Descendants().Where(e => !e.HasElements))
        {
            var key = e.Name.LocalName;
            if (result.ContainsKey(key)) key = e.Parent?.Name.LocalName + "." + key;
            result[key] = e.Value;
        }
        return result;
    }

    private static (byte[] Bytes, string Name) ExtractFirstFileFromZip(byte[] zipBytes, string preferredFormat, string fallbackName)
    {
        try
        {
            using var ms = new MemoryStream(zipBytes);
            using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
            var preferredExt = "." + preferredFormat.Trim().ToLowerInvariant();
            var entry = archive.Entries.FirstOrDefault(e =>
                            e.FullName.EndsWith(preferredExt, StringComparison.OrdinalIgnoreCase))
                        ?? archive.Entries.FirstOrDefault();
            if (entry is null) return (zipBytes, fallbackName);

            using var entryStream = entry.Open();
            using var outMs = new MemoryStream();
            entryStream.CopyTo(outMs);
            return (outMs.ToArray(), string.IsNullOrWhiteSpace(entry.Name) ? fallbackName : entry.Name);
        }
        catch (InvalidDataException)
        {
            // Zip değilse ham veri
            return (zipBytes, fallbackName);
        }
    }

    private static List<ELogoDocumentRecord> ParseDocumentList(XDocument doc)
    {
        var records = new List<ELogoDocumentRecord>();
        foreach (var docEl in doc.Descendants().Where(e => e.Name.LocalName == "Document"))
        {
            var uuid = docEl.Elements().FirstOrDefault(e => e.Name.LocalName == "documentUuid")?.Value;
            var documentId = docEl.Elements().FirstOrDefault(e => e.Name.LocalName == "documentId")?.Value;
            var strings = docEl.Descendants().Where(e => e.Name.LocalName == "string").Select(e => e.Value).ToList();
            var record = TryParseAsJson(strings) ?? ParseAsKeyValuePairs(strings);
            if (string.IsNullOrWhiteSpace(record.Uuid)) record.Uuid = uuid ?? "";
            if (string.IsNullOrWhiteSpace(record.ElementId)) record.ElementId = documentId ?? "";
            records.Add(record);
        }
        return records;
    }

    private static ELogoDocumentRecord? TryParseAsJson(List<string> strings)
    {
        foreach (var s in strings)
        {
            var trimmed = s.TrimStart();
            if (!trimmed.StartsWith('{')) continue;
            try
            {
                using var jsonDoc = JsonDocument.Parse(s);
                var root = jsonDoc.RootElement;
                return new ELogoDocumentRecord
                {
                    Uuid = GetJsonString(root, "Uuid") ?? "",
                    ElementId = GetJsonString(root, "ElementId") ?? "",
                    SupplierVknTckn = GetJsonString(root, "SupplierVknTckn") ?? "",
                    SupplierName = GetJsonString(root, "SupplierPartyName") ?? "",
                    CustomerVknTckn = GetJsonString(root, "CustomerVknTckn") ?? "",
                    CustomerName = GetJsonString(root, "CustomerPartyName") ?? "",
                    Total = GetJsonDecimal(root, "InvoiceTotal") ?? GetJsonDecimal(root, "PayableAmount"),
                    TaxAmount = GetJsonDecimal(root, "TaxTotal") ?? GetJsonDecimal(root, "TaxAmount"),
                    Currency = GetJsonString(root, "CurrencyUnit"),
                    IssueDate = GetJsonDate(root, "IssueDate"),
                    ProfileId = GetJsonString(root, "ProfileId") ?? GetJsonString(root, "ProfileID"),
                    Description = GetJsonString(root, "Description") ?? ""
                };
            }
            catch (JsonException) { /* sonraki */ }
        }
        return null;
    }

    private static ELogoDocumentRecord ParseAsKeyValuePairs(List<string> strings)
    {
        var kv = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in strings)
        {
            var parts = s.Split('=', 2);
            if (parts.Length == 2) kv[parts[0].Trim()] = parts[1].Trim();
        }

        kv.TryGetValue("ELEMENTID", out var elementId);
        kv.TryGetValue("UUID", out var uuid);
        kv.TryGetValue("SUPPLIERVKNTCKN", out var supplierVkn);
        kv.TryGetValue("SUPPLIERPARTYNAME", out var supplierName);
        kv.TryGetValue("CUSTOMERPARTYNAME", out var customerName);
        kv.TryGetValue("CUSTOMERVKNTCKN", out var customerVkn);
        kv.TryGetValue("INVOICETOTAL", out var totalStr);
        kv.TryGetValue("ISSUEDATE", out var issueDateStr);
        kv.TryGetValue("CURRENCYUNIT", out var currency);
        kv.TryGetValue("DESCRIPTION", out var description);
        kv.TryGetValue("PROFILEID", out var profile);

        DateTime? issueDate = null;
        if (!string.IsNullOrWhiteSpace(issueDateStr)
            && DateTime.TryParse(issueDateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            issueDate = dt;

        decimal? total = null;
        if (!string.IsNullOrWhiteSpace(totalStr)
            && decimal.TryParse(totalStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var amt))
            total = amt;

        return new ELogoDocumentRecord
        {
            Uuid = uuid ?? "",
            ElementId = elementId ?? "",
            SupplierVknTckn = supplierVkn ?? "",
            SupplierName = supplierName ?? "",
            CustomerVknTckn = customerVkn ?? "",
            CustomerName = customerName ?? "",
            Total = total,
            Currency = currency,
            IssueDate = issueDate,
            ProfileId = profile,
            Description = description ?? ""
        };
    }

    private static string? GetJsonString(JsonElement root, string propertyName)
    {
        foreach (var prop in root.EnumerateObject())
        {
            if (string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                return prop.Value.ValueKind == JsonValueKind.Null ? null : prop.Value.GetString();
        }
        return null;
    }

    private static decimal? GetJsonDecimal(JsonElement root, string propertyName)
    {
        foreach (var prop in root.EnumerateObject())
        {
            if (!string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase)) continue;
            if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDecimal(out var val))
                return val;
            if (prop.Value.ValueKind == JsonValueKind.String
                && decimal.TryParse(prop.Value.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                return parsed;
        }
        return null;
    }

    private static DateTime? GetJsonDate(JsonElement root, string propertyName)
    {
        var s = GetJsonString(root, propertyName);
        if (!string.IsNullOrWhiteSpace(s)
            && DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return dt;
        return null;
    }

    private void EnsureLoggedIn()
    {
        if (_sessionId is null)
            throw new InvalidOperationException("Önce LoginAsync() çağrılmalı.");
    }

    private async Task<(XDocument Doc, string Raw)> PostSoapAsync(XElement envelope, string soapAction, CancellationToken ct)
    {
        var xml = envelope.ToString(SaveOptions.DisableFormatting);
        using var request = new HttpRequestMessage(HttpMethod.Post, _serviceUrl)
        {
            Content = new StringContent(xml, Encoding.UTF8, "text/xml")
        };
        request.Headers.TryAddWithoutValidation("SOAPAction", $"\"{soapAction}\"");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/xml"));

        using var response = await _http.SendAsync(request, ct);
        var responseText = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"e-Logo HTTP {(int)response.StatusCode}: {(responseText.Length > 400 ? responseText[..400] + "…" : responseText)}");

        return (XDocument.Parse(responseText), responseText);
    }

    public async ValueTask DisposeAsync()
    {
        try { await LogoutAsync(); }
        catch { /* ignore */ }
        if (_ownsHttp) _http.Dispose();
    }
}

public sealed class ELogoDocumentRecord
{
    public string Uuid { get; set; } = "";
    public string ElementId { get; set; } = "";
    public string SupplierVknTckn { get; set; } = "";
    public string SupplierName { get; set; } = "";
    public string CustomerVknTckn { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public decimal? Total { get; set; }
    public decimal? TaxAmount { get; set; }
    public string? Currency { get; set; }
    public DateTime? IssueDate { get; set; }
    public string? ProfileId { get; set; }
    public string Description { get; set; } = "";
}
