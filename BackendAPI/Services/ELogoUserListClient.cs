using System.IO.Compression;
using System.Net.Http.Headers;
using System.Security;
using System.Text;
using System.Xml;

namespace BartuERP.Backend.Services;

/// <summary>
/// e-Logo PostBox getUserListNew: GİB e-Fatura kayıtlı kullanıcı listesi (PKLIST / GBLIST) — merkez.gib.gov.tr
/// zip adresine doğrudan erişilemediğinde (entegratör dışı IP) liste e-Logo'dan alınır (E-06).
/// Yanıt çok büyük olabilir: SOAP gövdesi akış olarak okunur, binaryData/Value doğrudan dosyaya yazılır.
/// </summary>
public static class ELogoUserListClient
{
    private const string Action = "http://tempuri.org/IPostBoxService/getUserListNew";

    /// <summary>Listeyi indirip zip olarak <paramref name="zipPath"/>'e yazar (gelen veri zip değilse zip'e sarar).</summary>
    public static async Task DownloadAsync(
        HttpClient http, string url, string user, string pass, string listType, string zipPath, CancellationToken ct)
    {
        var body = $"""
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:efat="http://schemas.datacontract.org/2004/07/eFaturaWebService">
              <soapenv:Header/>
              <soapenv:Body>
                <tem:getUserListNew>
                  <tem:login>
                    <efat:appStr>KaviSoft</efat:appStr>
                    <efat:passWord>{SecurityElement.Escape(pass)}</efat:passWord>
                    <efat:source>1</efat:source>
                    <efat:userName>{SecurityElement.Escape(user)}</efat:userName>
                    <efat:version>1</efat:version>
                  </tem:login>
                  <tem:listType>{listType}</tem:listType>
                </tem:getUserListNew>
              </soapenv:Body>
            </soapenv:Envelope>
            """;
        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = new StringContent(body, Encoding.UTF8, "text/xml") };
        req.Headers.TryAddWithoutValidation("SOAPAction", $"\"{Action}\"");
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/xml"));

        using var res = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        await using var stream = await res.Content.ReadAsStreamAsync(ct);
        var tmp = zipPath + ".elogo.tmp";
        string? fault = null;
        var wrote = false;
        using (var reader = XmlReader.Create(stream, new XmlReaderSettings { Async = true, IgnoreWhitespace = true, DtdProcessing = DtdProcessing.Prohibit }))
        {
            while (await reader.ReadAsync())
            {
                if (reader.NodeType != XmlNodeType.Element) continue;
                if (reader.LocalName == "faultstring")
                {
                    fault = await reader.ReadElementContentAsStringAsync();
                    break;
                }
                // getUserListNewResult/binaryData/Value
                if (reader.LocalName == "Value" && !reader.IsEmptyElement)
                {
                    await using var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None);
                    var buf = new byte[1 << 16];
                    int n;
                    while ((n = await reader.ReadElementContentAsBase64Async(buf, 0, buf.Length)) > 0)
                        await fs.WriteAsync(buf.AsMemory(0, n), ct);
                    wrote = true;
                    break;
                }
            }
        }
        if (fault != null) throw new InvalidOperationException($"e-Logo getUserListNew ({listType}): {fault}");
        if (!res.IsSuccessStatusCode) throw new InvalidOperationException($"e-Logo getUserListNew ({listType}): HTTP {(int)res.StatusCode}");
        if (!wrote || new FileInfo(tmp).Length == 0)
            throw new InvalidOperationException($"e-Logo getUserListNew ({listType}) boş döndü.");

        // Zip ise olduğu gibi; değilse (düz XML) zip'e sar — içe aktarma zip bekler
        var head = new byte[4];
        await using (var f = File.OpenRead(tmp)) _ = await f.ReadAsync(head, ct);
        if (File.Exists(zipPath)) File.Delete(zipPath);
        if (head[0] == (byte)'P' && head[1] == (byte)'K')
        {
            File.Move(tmp, zipPath);
        }
        else
        {
            using (var zip = ZipFile.Open(zipPath, ZipArchiveMode.Create))
                zip.CreateEntryFromFile(tmp, $"{listType.ToLowerInvariant()}.xml", CompressionLevel.Fastest);
            File.Delete(tmp);
        }
    }
}
