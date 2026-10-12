using System.Net.Http.Headers;
using System.Text;
using System.Xml.Linq;
using BartuERP.Backend.Repositories;

namespace BartuERP.Backend.Services;

public sealed class IntegratorMukellefRequest
{
    public string TaxNr { get; set; } = "";
    public string? IntegratorName { get; set; }
    public string? IntegratorWsUrl { get; set; }
    public string? IntegratorUser { get; set; }
    public string? IntegratorPassword { get; set; }
    public string? IntegratorVkN { get; set; }
}

/// <summary>
/// Firma kartındaki entegratör bilgileri ile mükellef kontrolü (e-Logo CheckGibUser).
/// </summary>
public sealed class IntegratorMukellefService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<IntegratorMukellefService> _log;

    public IntegratorMukellefService(IHttpClientFactory httpFactory, ILogger<IntegratorMukellefService> log)
    {
        _httpFactory = httpFactory;
        _log = log;
    }

    public async Task<EFaturaMukellefQueryResult> CheckAsync(
        IntegratorMukellefRequest req,
        CancellationToken ct = default)
    {
        var tax = NormalizeTax(req.TaxNr);
        var result = new EFaturaMukellefQueryResult { TaxNr = tax, Source = "Integrator" };

        if (string.IsNullOrWhiteSpace(tax) || (tax.Length != 10 && tax.Length != 11))
        {
            result.Message = "Geçerli VKN (10) veya TCKN (11) girin";
            return result;
        }

        var name = (req.IntegratorName ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(name))
        {
            result.Message = "Entegratör seçilmemiş — firma kartında e-Fatura Entegrasyon bilgilerini doldurun";
            return result;
        }

        if (name is "ELOGO" or "LOGO")
            return await CheckElogoAsync(req, tax, result, ct);

        if (name == "GIB")
        {
            result.Message =
                "GİB Portal seçili — mükellef kontrolü yerel/GİB listesi ile yapılır (entegratör WS yok)";
            return result;
        }

        result.Message =
            $"Entegratör '{req.IntegratorName}' için mükellef kontrolü henüz tanımlı değil (destek: e-Logo)";
        return result;
    }

    private async Task<EFaturaMukellefQueryResult> CheckElogoAsync(
        IntegratorMukellefRequest req,
        string tax,
        EFaturaMukellefQueryResult result,
        CancellationToken ct)
    {
        var user = (req.IntegratorUser ?? "").Trim();
        var pass = req.IntegratorPassword ?? "";
        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(pass))
        {
            result.Message = "e-Logo için Kullanıcı ve Şifre zorunlu";
            return result;
        }

        var url = string.IsNullOrWhiteSpace(req.IntegratorWsUrl)
            ? "https://pb.elogo.com.tr/PostBoxService.svc"
            : req.IntegratorWsUrl!.Trim();

        var client = _httpFactory.CreateClient("IntegratorEFatura");
        string? sessionId = null;
        try
        {
            sessionId = await ElogoLoginAsync(client, url, user, pass, ct);
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                result.Message = "e-Logo Login başarısız — kullanıcı/şifre veya WS URL kontrol edin";
                return result;
            }

            var (ok, msg, rows) = await ElogoCheckGibUserAsync(client, url, sessionId, tax, ct);
            result.CheckedExternal = true;
            result.ExternalMessage = msg;

            if (!ok)
            {
                result.Message = msg;
                return result;
            }

            result.Rows = rows;
            result.Found = rows.Count > 0;
            result.Title = rows.FirstOrDefault(r => !string.IsNullOrWhiteSpace(r.Title))?.Title;
            result.SuggestedPostLabel = PickAlias(rows, "PK");
            result.SuggestedSenderLabel = PickAlias(rows, "GB");
            result.SuggestedUnitType = rows.FirstOrDefault()?.UnitType;
            result.Message = result.Found
                ? $"e-Logo: VKN/TCKN {tax} e-Fatura mükellefi — {rows.Count} alias"
                : $"e-Logo: VKN/TCKN {tax} e-Fatura mükellefi değil";
            return result;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "e-Logo mükellef kontrolü başarısız");
            result.Message = $"e-Logo kontrol hatası: {ex.Message}";
            return result;
        }
        finally
        {
            if (!string.IsNullOrWhiteSpace(sessionId))
            {
                try { await ElogoLogoutAsync(client, url, sessionId, ct); }
                catch { /* ignore */ }
            }
        }
    }

    private static async Task<string?> ElogoLoginAsync(
        HttpClient client,
        string url,
        string user,
        string pass,
        CancellationToken ct)
    {
        var body =
            $"""
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:efat="http://schemas.datacontract.org/2004/07/eFaturaWebService">
              <soapenv:Header/>
              <soapenv:Body>
                <tem:Login>
                  <tem:login>
                    <efat:appStr>KaviSoft</efat:appStr>
                    <efat:passWord>{XmlEsc(pass)}</efat:passWord>
                    <efat:source>1</efat:source>
                    <efat:userName>{XmlEsc(user)}</efat:userName>
                    <efat:version>1</efat:version>
                  </tem:login>
                </tem:Login>
              </soapenv:Body>
            </soapenv:Envelope>
            """;

        var xml = await PostSoapAsync(client, url, "http://tempuri.org/IPostBoxService/Login", body, ct);
        var doc = XDocument.Parse(xml);
        var loginOk = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "LoginResult")?.Value;
        var session = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "sessionID")?.Value;
        if (!string.Equals(loginOk, "true", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(session))
            return null;
        return session;
    }

    private static async Task<(bool Ok, string Message, List<EFaturaMukellefRow> Rows)> ElogoCheckGibUserAsync(
        HttpClient client,
        string url,
        string sessionId,
        string tax,
        CancellationToken ct)
    {
        var body =
            $"""
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
              <soapenv:Header/>
              <soapenv:Body>
                <tem:CheckGibUser>
                  <tem:sessionID>{XmlEsc(sessionId)}</tem:sessionID>
                  <tem:vknTcknList>
                    <arr:string>{XmlEsc(tax)}</arr:string>
                  </tem:vknTcknList>
                </tem:CheckGibUser>
              </soapenv:Body>
            </soapenv:Envelope>
            """;

        var xml = await PostSoapAsync(client, url, "http://tempuri.org/IPostBoxService/CheckGibUser", body, ct);
        var doc = XDocument.Parse(xml);

        var fault = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "Fault");
        if (fault != null)
        {
            var faultMsg = fault.Descendants().FirstOrDefault(e => e.Name.LocalName is "faultstring" or "Text")?.Value
                           ?? "SOAP Fault";
            return (false, $"e-Logo CheckGibUser: {faultMsg}", new());
        }

        var rows = new List<EFaturaMukellefRow>();
        foreach (var user in doc.Descendants().Where(e => e.Name.LocalName == "GibUserType"))
        {
            var identifier = Local(user, "Identifier") ?? tax;
            var title = FirstTitle(user);
            AddAliasRows(rows, identifier, title, user, "InvoicePkList", "PK");
            AddAliasRows(rows, identifier, title, user, "InvoiceGbList", "GB");
        }

        // Bazı yanıtlarda doğrudan GibUserInfoType listesi gelebilir
        if (rows.Count == 0)
        {
            foreach (var info in doc.Descendants().Where(e => e.Name.LocalName == "GibUserInfoType"))
            {
                var alias = Local(info, "Alias");
                if (string.IsNullOrWhiteSpace(alias)) continue;
                rows.Add(new EFaturaMukellefRow
                {
                    TaxNr = Local(info, "Identifier") ?? tax,
                    Title = Local(info, "Title"),
                    Alias = alias.Trim(),
                    AliasType = GuessPkGb(alias, null),
                    UnitType = "e-Fatura",
                    IsActive = true,
                });
            }
        }

        return (true, $"CheckGibUser OK ({rows.Count} alias)", rows);
    }

    private static void AddAliasRows(
        List<EFaturaMukellefRow> rows,
        string tax,
        string? title,
        XElement user,
        string listName,
        string aliasType)
    {
        var list = user.Elements().FirstOrDefault(e => e.Name.LocalName == listName);
        if (list == null) return;
        foreach (var info in list.Descendants().Where(e => e.Name.LocalName == "GibUserInfoType"))
        {
            var alias = Local(info, "Alias");
            if (string.IsNullOrWhiteSpace(alias)) continue;
            rows.Add(new EFaturaMukellefRow
            {
                TaxNr = Local(info, "Identifier") ?? tax,
                Title = Local(info, "Title") ?? title,
                Alias = alias.Trim(),
                AliasType = aliasType,
                UnitType = "e-Fatura",
                FirstCreateDate = ParseDate(Local(info, "FirstCreationTime") ?? Local(info, "AliasRegisterTime")),
                IsActive = true,
            });
        }
    }

    private static string? FirstTitle(XElement user) =>
        user.Descendants()
            .Where(e => e.Name.LocalName == "Title" && !string.IsNullOrWhiteSpace(e.Value))
            .Select(e => e.Value.Trim())
            .FirstOrDefault();

    private static async Task ElogoLogoutAsync(HttpClient client, string url, string sessionId, CancellationToken ct)
    {
        var body =
            $"""
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
              <soapenv:Header/>
              <soapenv:Body>
                <tem:Logout>
                  <tem:sessionID>{XmlEsc(sessionId)}</tem:sessionID>
                </tem:Logout>
              </soapenv:Body>
            </soapenv:Envelope>
            """;
        await PostSoapAsync(client, url, "http://tempuri.org/IPostBoxService/Logout", body, ct);
    }

    private static async Task<string> PostSoapAsync(
        HttpClient client,
        string url,
        string soapAction,
        string body,
        CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Content = new StringContent(body, Encoding.UTF8, "text/xml");
        req.Headers.TryAddWithoutValidation("SOAPAction", $"\"{soapAction}\"");
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/xml"));

        using var res = await client.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"HTTP {(int)res.StatusCode}: {Truncate(text, 300)}");
        return text;
    }

    private static string? PickAlias(List<EFaturaMukellefRow> rows, string type)
    {
        var match = rows.FirstOrDefault(r =>
            string.Equals(r.AliasType, type, StringComparison.OrdinalIgnoreCase));
        if (match != null) return match.Alias;
        return rows.FirstOrDefault(r =>
            r.Alias.Contains(type, StringComparison.OrdinalIgnoreCase)
            || (type == "PK" && r.Alias.Contains("defaultpk", StringComparison.OrdinalIgnoreCase))
            || (type == "GB" && r.Alias.Contains("defaultgb", StringComparison.OrdinalIgnoreCase)))
            ?.Alias;
    }

    private static string GuessPkGb(string alias, string? type) =>
        !string.IsNullOrWhiteSpace(type) && (type.Equals("PK", StringComparison.OrdinalIgnoreCase)
                                             || type.Equals("GB", StringComparison.OrdinalIgnoreCase))
            ? type.ToUpperInvariant()
            : alias.Contains("GB", StringComparison.OrdinalIgnoreCase) ? "GB"
            : alias.Contains("PK", StringComparison.OrdinalIgnoreCase) ? "PK"
            : "PK";

    private static string? Local(XElement el, string name) =>
        el.Elements().FirstOrDefault(e => e.Name.LocalName == name)?.Value?.Trim();

    private static DateTime? ParseDate(string? s) =>
        DateTime.TryParse(s, out var d) ? d : null;

    private static string NormalizeTax(string? taxNr) =>
        new string((taxNr ?? "").Where(char.IsDigit).ToArray());

    private static string XmlEsc(string s) =>
        System.Security.SecurityElement.Escape(s) ?? "";

    private static string Truncate(string s, int n) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= n ? s : s[..n] + "…";
}
