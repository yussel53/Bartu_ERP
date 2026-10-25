using System.Reflection;
using System.Text;

namespace BartuERP.Backend.Services;

/// <summary>
/// GİB'in UBL-TR 1.2.1 paketindeki (ebelge.gib.gov.tr) standart görünüm XSLT'leri — DLL'e gömülü
/// (BackendAPI/EGovStandart). Tasarım Aracı → «Standart şablonları yükle» ile tasarım kütüphanesine eklenir.
/// general.xslt e-Fatura ve e-Arşiv'i (EARSIVFATURA) birlikte gösterir; iki gruba ayrı tasarım olarak eklenir.
/// </summary>
public static class EGovStandardDesigns
{
    public sealed record Item(string File, string Title, string DocGroup);

    public static readonly IReadOnlyList<Item> Items = new[]
    {
        new Item("gib-efatura-earsiv.xslt", "GİB Standart e-Fatura", "EFATURA"),
        new Item("gib-efatura-earsiv.xslt", "GİB Standart e-Arşiv", "EARSIV"),
        new Item("gib-eirsaliye.xslt", "GİB Standart e-İrsaliye", "EIRSALIYE"),
    };

    public const string Notes = "GİB UBL-TR 1.2.1 paketi standart görünümü (ebelge.gib.gov.tr)";

    public static string Read(string file)
    {
        using var s = Assembly.GetExecutingAssembly().GetManifestResourceStream($"EGovStandart/{file}")
                      ?? throw new FileNotFoundException($"Standart tasarım bulunamadı: {file}");
        using var r = new StreamReader(s, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return r.ReadToEnd();
    }
}
