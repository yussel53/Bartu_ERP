using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// Yardım dokümanları: BackendAPI/Help/*.md DLL içine gömülüdür (diskte / wwwroot'ta dosya yok) ve yalnız oturum açmış
/// kullanıcıya verilir (varsayılan yetki politikası) — program dışından okunamaz.
/// </summary>
[ApiController]
[Route("api/help")]
public sealed partial class HelpController : ControllerBase
{
    private sealed record Page(string Slug, string Title, int Order, string Markdown);

    private static readonly Lazy<List<Page>> Pages = new(Load);

    [GeneratedRegex(@"^(\d+)-(.+)\.md$")]
    private static partial Regex FileRx();

    private static List<Page> Load()
    {
        var asm = Assembly.GetExecutingAssembly();
        var list = new List<Page>();
        foreach (var res in asm.GetManifestResourceNames().Where(n => n.StartsWith("BartuHelp/", StringComparison.Ordinal)))
        {
            var file = res["BartuHelp/".Length..];
            var m = FileRx().Match(file);
            if (!m.Success) continue;
            using var s = asm.GetManifestResourceStream(res)!;
            using var r = new StreamReader(s);
            var md = r.ReadToEnd();
            var title = md.Split('\n').FirstOrDefault(l => l.StartsWith("# "))?[2..].Trim() ?? m.Groups[2].Value;
            list.Add(new Page(m.Groups[2].Value, title, int.Parse(m.Groups[1].Value), md));
        }
        return list.OrderBy(p => p.Order).ToList();
    }

    [HttpGet]
    public IActionResult List() => Ok(Pages.Value.Select(p => new { p.Slug, p.Title, p.Order }));

    [HttpGet("{slug}")]
    public IActionResult Get(string slug)
    {
        var p = Pages.Value.FirstOrDefault(x => string.Equals(x.Slug, slug, StringComparison.OrdinalIgnoreCase));
        return p == null ? NotFound(new { message = "Yardım sayfası bulunamadı." }) : Ok(new { p.Slug, p.Title, p.Markdown });
    }

    /// <summary>Tüm sayfalarda arama</summary>
    [HttpGet("search")]
    public IActionResult Search([FromQuery] string q)
    {
        q = (q ?? "").Trim();
        if (q.Length < 2) return Ok(Array.Empty<object>());
        var hits = Pages.Value
            .Select(p => new { p, i = p.Markdown.IndexOf(q, StringComparison.CurrentCultureIgnoreCase) })
            .Where(x => x.i >= 0)
            .Select(x => new
            {
                x.p.Slug,
                x.p.Title,
                Snippet = x.p.Markdown.Substring(Math.Max(0, x.i - 60), Math.Min(160, x.p.Markdown.Length - Math.Max(0, x.i - 60))).Replace('\n', ' '),
            });
        return Ok(hits);
    }
}
