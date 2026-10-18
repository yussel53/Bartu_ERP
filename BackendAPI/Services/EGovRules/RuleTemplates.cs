using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Dapper;

namespace BartuERP.Backend.Services.EGovRules;

/// <summary>Kural şablonları kataloğu</summary>
public static class RuleTemplates
{
    public static readonly IReadOnlyList<IRuleTemplate> All =
    [
        new AddFieldTemplate(), new AddNoteTemplate(), new RemoveNoteTemplate(), new LineFieldTemplate(),
        new CustomerItemCodeTemplate(), new UnitConvertTemplate(), new CollapseLinesTemplate(), new DropZeroLinesTemplate(),
        new ReturnReferenceTemplate(), new PartyNameTemplate(), new DespatchTransportTemplate(),
        new SqlValueFieldTemplate(), new SqlExecTemplate(),
    ];

    public static IRuleTemplate? Find(string code) =>
        All.FirstOrDefault(t => string.Equals(t.Info.Code, code, StringComparison.OrdinalIgnoreCase));

    internal static string P(Dictionary<string, string> p, string key, string def = "") =>
        p.TryGetValue(key, out var v) && !string.IsNullOrEmpty(v) ? v : def;

    internal static bool B(Dictionary<string, string> p, string key, bool def) =>
        p.TryGetValue(key, out var v) && !string.IsNullOrEmpty(v) ? v is "true" or "1" or "True" : def;

    internal static decimal N(Dictionary<string, string> p, string key, decimal def) =>
        p.TryGetValue(key, out var v) && decimal.TryParse(v.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : def;

    /// <summary>* joker destekli virgüllü desen listesi</summary>
    internal static bool MatchAny(string? value, string? patterns)
    {
        if (string.IsNullOrWhiteSpace(patterns)) return true;
        value ??= "";
        return patterns.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Any(p =>
            Regex.IsMatch(value, "^" + Regex.Escape(p).Replace("\\*", ".*") + "$", RegexOptions.IgnoreCase));
    }

    internal static readonly List<RuleOption> LineTargets =
    [
        new() { Value = "Item.Name", Label = "Malzeme adı (Item/Name)" },
        new() { Value = "Item.Description", Label = "Malzeme açıklaması (Item/Description)" },
        new() { Value = "Line.Note", Label = "Satır notu (Note)" },
        new() { Value = "Item.SellersId", Label = "Satıcı malzeme kodu" },
        new() { Value = "Item.BuyersId", Label = "Alıcı malzeme kodu" },
        new() { Value = "Item.ManufacturersId", Label = "Üretici kodu" },
        new() { Value = "Item.BrandName", Label = "Marka" },
        new() { Value = "Item.ModelName", Label = "Model" },
    ];

    internal static List<RuleOption> Opts(params (string V, string L)[] items) =>
        items.Select(i => new RuleOption { Value = i.V, Label = i.L }).ToList();
}

// ── 1. Ek alan ───────────────────────────────────────────────────────────

/// <summary>Logo: App.Doc.WriteStartElement "ADDITIONALDOCUMENTS/ADDITIONALDOCUMENT"</summary>
internal sealed class AddFieldTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "ADD_FIELD",
        Title = "Ek alan ekle",
        Category = "Başlık",
        Description = "Belgeye ek alan (AdditionalDocumentReference) ekler; tasarım (XSLT) bu alanı DocumentType adıyla okur. Bakiye, geciken vade, sipariş/irsaliye no, ödeme tarihi gibi bilgiler için.",
        LogoEquivalent = "Bakiye · Geciken vade · Belge no / irsaliye tarihi ek alan · Sipariş no ve tarih · Ödeme tarihi · Toplam miktar",
        Params =
        [
            new() { Key = "documentType", Label = "Ek alan adı (DocumentType)", Required = true, Help = "Tasarımda bu adla okunur, ör. BAKIYE" },
            new() { Key = "value", Label = "Değer", Type = "template", Required = true, Help = "Yer tutucu kullanılabilir, ör. {Cari.BakiyeBA}" },
            new() { Key = "skipIfEmpty", Label = "Değer boşsa ekleme", Type = "bool", Default = "true" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var type = RuleTemplates.P(p, "documentType").Trim();
        var value = await ctx.RenderAsync(RuleTemplates.P(p, "value"), null, ct);
        if (value.Length == 0 && RuleTemplates.B(p, "skipIfEmpty", true))
        {
            step.Message = "Değer boş — eklenmedi";
            return;
        }
        if (doc.RemoveAdditionalDocuments(type) > 0) step.Changes.Add($"Eski «{type}» ek alanı kaldırıldı");
        doc.AddAdditionalDocument(value, type);
        step.Changes.Add($"Ek alan «{type}» = {value}");
    }
}

// ── 2. Belge notu ────────────────────────────────────────────────────────

internal sealed class AddNoteTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "ADD_NOTE",
        Title = "Belge notu ekle",
        Category = "Başlık",
        Description = "Belgeye not (cbc:Note) ekler; tasarımda notlar bölümünde görünür. Raporlama döviz kuru, sevkiyat bilgisi, banka/ödeme şekli gibi açıklamalar için.",
        LogoEquivalent = "Raporlama döviz kuru genel açıklamaya · Ödeme şekli ve banka · Sevkiyat adresi açıklaması",
        Params =
        [
            new() { Key = "text", Label = "Not", Type = "template", Required = true },
            new() { Key = "skipIfEmpty", Label = "Boşsa ekleme", Type = "bool", Default = "true" },
            new() { Key = "unique", Label = "Aynı not varsa tekrar ekleme", Type = "bool", Default = "true" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var text = await ctx.RenderAsync(RuleTemplates.P(p, "text"), null, ct);
        if (text.Length == 0 && RuleTemplates.B(p, "skipIfEmpty", true)) return;
        if (RuleTemplates.B(p, "unique", true) && doc.Notes.Any(n => n.Value.Trim() == text)) return;
        doc.AddNote(text);
        step.Changes.Add($"Not eklendi: {text}");
    }
}

// ── 3. Not kaldır ────────────────────────────────────────────────────────

internal sealed class RemoveNoteTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "REMOVE_NOTE",
        Title = "Belge notunu kaldır",
        Category = "Başlık",
        Description = "Desene uyan notları siler. Ör. dövizli faturada «Yalnız … TL» yazı ile tutar notunu kaldırmak (koşul: para birimi !TRY).",
        LogoEquivalent = "Dövizli faturalarda «Yalnız TL» ibaresinin kaldırılması (RemoveChild TOTAL_NET_STR)",
        Params =
        [
            new() { Key = "pattern", Label = "Desen", Required = true, Default = "^Yalnız" },
            new()
            {
                Key = "mode", Label = "Eşleşme", Type = "select", Default = "regex",
                Options = RuleTemplates.Opts(("regex", "Düzenli ifade"), ("contains", "İçerir"), ("startsWith", "İle başlar")),
            },
        ],
    };

    public Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var pattern = RuleTemplates.P(p, "pattern");
        var mode = RuleTemplates.P(p, "mode", "regex");
        foreach (var n in doc.Notes)
        {
            var t = n.Value.Trim();
            var hit = mode switch
            {
                "contains" => t.Contains(pattern, StringComparison.OrdinalIgnoreCase),
                "startsWith" => t.StartsWith(pattern, StringComparison.OrdinalIgnoreCase),
                _ => Regex.IsMatch(t, pattern, RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1)),
            };
            if (!hit) continue;
            n.Remove();
            step.Changes.Add($"Not kaldırıldı: {t}");
        }
        return Task.CompletedTask;
    }
}

// ── 4. Satır alanı ───────────────────────────────────────────────────────

internal sealed class LineFieldTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "LINE_FIELD",
        Title = "Satır alanını doldur",
        Category = "Satır",
        Description = "Her satırda seçilen alanı (malzeme adı, açıklama, satır notu, kodlar) yer tutuculu bir değerle yazar, başına/sonuna ekler ya da boşsa doldurur.",
        LogoEquivalent = "Satır açıklaması → malzeme açıklaması · Barkod / seri-lot satır açıklamasına · Malzeme özel kodu satıra · Açıklama2 → satır açıklaması · Sipariş fiş no satır açıklamasına · Künye no",
        Params =
        [
            new() { Key = "target", Label = "Hedef alan", Type = "select", Required = true, Default = "Item.Name", Options = RuleTemplates.LineTargets },
            new() { Key = "value", Label = "Değer", Type = "template", Required = true, Default = "{Satir.Aciklama}" },
            new()
            {
                Key = "mode", Label = "Yazma şekli", Type = "select", Default = "set",
                Options = RuleTemplates.Opts(("set", "Değiştir"), ("append", "Sonuna ekle"), ("prepend", "Başına ekle"), ("ifEmpty", "Yalnız boşsa")),
            },
            new() { Key = "separator", Label = "Ekleme ayırıcı", Default = " " },
            new() { Key = "skipIfEmpty", Label = "Değer boşsa dokunma", Type = "bool", Default = "true" },
            new() { Key = "itemCodes", Label = "Yalnız bu malzeme kodlarında", Help = "Virgülle, * joker (boş: tüm satırlar)" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var target = RuleTemplates.P(p, "target", "Item.Name");
        var mode = RuleTemplates.P(p, "mode", "set");
        var sep = p.TryGetValue("separator", out var s) ? s.Replace("\\n", "\n") : " ";
        var skipEmpty = RuleTemplates.B(p, "skipIfEmpty", true);
        var lines = doc.Lines;
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!RuleTemplates.MatchAny(doc.GetLineField(line, "Item.SellersId"), RuleTemplates.P(p, "itemCodes"))) continue;
            var value = await ctx.RenderAsync(RuleTemplates.P(p, "value"), i, ct);
            if (value.Length == 0 && skipEmpty) continue;
            var current = doc.GetLineField(line, target) ?? "";
            var next = mode switch
            {
                "append" => current.Length == 0 ? value : current + sep + value,
                "prepend" => current.Length == 0 ? value : value + sep + current,
                "ifEmpty" => current.Length == 0 ? value : current,
                _ => value,
            };
            if (next == current) continue;
            doc.SetLineField(line, target, next);
            step.Changes.Add($"Satır {i + 1} {target}: «{current}» → «{next}»");
        }
    }
}

// ── 5. Cariye özel malzeme kodu ──────────────────────────────────────────

internal sealed class CustomerItemCodeTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "CUSTOMER_ITEM_CODE",
        Title = "Cariye özel malzeme kodu / adı",
        Category = "Satır",
        Description = "Malzeme kartındaki cari bağlantısından (müşteri/tedarikçi kodu-adı) satıra alıcının kendi kodunu ve adını yazar.",
        LogoEquivalent = "İrsaliye/fatura müşteri-tedarikçi kodu ataması (ICUSTSUPCODE / ICUSTSUPNAME)",
        Params =
        [
            new()
            {
                Key = "codeTarget", Label = "Kod yazılacak alan", Type = "select", Default = "Item.BuyersId",
                Options = RuleTemplates.Opts(("Item.BuyersId", "Alıcı malzeme kodu (önerilen)"), ("Item.SellersId", "Satıcı malzeme kodu (değiştir)"), ("", "Kod yazma")),
            },
            new() { Key = "replaceName", Label = "Malzeme adını cari adıyla değiştir", Type = "bool", Default = "true" },
            new() { Key = "keepOriginal", Label = "Kendi kodumuzu açıklamaya yaz", Type = "bool", Default = "false" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var codeTarget = p.TryGetValue("codeTarget", out var t) ? t : "Item.BuyersId";
        var lines = doc.Lines;
        for (var i = 0; i < lines.Count; i++)
        {
            var v = await ctx.LineValuesAsync(i, ct);
            var code = v["Satir.CariKodu"];
            var name = v["Satir.CariAdi"];
            if (code.Length == 0 && name.Length == 0) continue;
            var line = lines[i];
            if (RuleTemplates.B(p, "keepOriginal", false))
            {
                var own = $"{v["Satir.MalzemeKodu"]} {v["Satir.MalzemeAdi"]}".Trim();
                if (own.Length > 0) doc.SetLineField(line, "Item.Description", own);
            }
            if (code.Length > 0 && codeTarget.Length > 0)
            {
                doc.SetLineField(line, codeTarget, code);
                step.Changes.Add($"Satır {i + 1} kod → {code}");
            }
            if (name.Length > 0 && RuleTemplates.B(p, "replaceName", true))
            {
                doc.SetLineField(line, "Item.Name", name);
                step.Changes.Add($"Satır {i + 1} ad → {name}");
            }
        }
    }
}

// ── 6. Birim çevrimi ─────────────────────────────────────────────────────

internal sealed class UnitConvertTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "UNIT_CONVERT",
        Title = "Birim çevrimi (koli → adet)",
        Category = "Satır",
        Description = "Satır miktarını katsayıyla çarpar, birim fiyatı böler (satır tutarı değişmez) ve birim kodunu değiştirir. Katsayı sabit ya da malzeme kartındaki birim çevriminden.",
        LogoEquivalent = "Koli / adet çevrimleri (ITMUNITA CONVFACT1/CONVFACT2, 152.0005 × 25)",
        Params =
        [
            new()
            {
                Key = "source", Label = "Katsayı", Type = "select", Default = "productUnit",
                Options = RuleTemplates.Opts(("productUnit", "Malzeme kartı birim çevrimi"), ("fixed", "Sabit katsayı")),
            },
            new() { Key = "factor", Label = "Sabit katsayı", Type = "number", Default = "1" },
            new() { Key = "itemCodes", Label = "Malzeme kodları", Help = "Virgülle, * joker (boş: tümü)" },
            new() { Key = "fromUnits", Label = "Yalnız bu birim kodlarında", Help = "UBL birim kodu, ör. BX,CT (boş: tümü)" },
            new() { Key = "targetUnit", Label = "Yeni birim kodu", Default = "C62", Help = "C62 = adet" },
            new() { Key = "priceDecimals", Label = "Fiyat ondalık", Type = "number", Default = "6" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var source = RuleTemplates.P(p, "source", "productUnit");
        var targetUnit = RuleTemplates.P(p, "targetUnit", "C62");
        var dec = (int)RuleTemplates.N(p, "priceDecimals", 6);
        var lines = doc.Lines;
        var data = await ctx.LinesAsync(ct);
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var qtyEl = line.Element(doc.QuantityName);
            if (qtyEl == null) continue;
            var unit = (string?)qtyEl.Attribute("unitCode") ?? "";
            if (!RuleTemplates.MatchAny(doc.GetLineField(line, "Item.SellersId"), RuleTemplates.P(p, "itemCodes"))) continue;
            if (!RuleTemplates.MatchAny(unit, RuleTemplates.P(p, "fromUnits"))) continue;
            if (string.Equals(unit, targetUnit, StringComparison.OrdinalIgnoreCase)) continue;

            var factor = source == "fixed" ? RuleTemplates.N(p, "factor", 1m) : await ProductFactorAsync(ctx, i < data.Count ? data[i] : null);
            if (factor <= 0 || factor == 1m) continue;

            var qty = UblDoc.Dec(qtyEl.Value);
            var newQty = qty * factor;
            qtyEl.Value = UblDoc.Fmt(newQty, 4);
            qtyEl.SetAttributeValue("unitCode", targetUnit);
            var priceEl = line.Element(UblDoc.Cac + "Price")?.Element(UblDoc.Cbc + "PriceAmount");
            if (priceEl != null)
            {
                var price = UblDoc.Dec(priceEl.Value);
                priceEl.Value = UblDoc.Fmt(price / factor, dec);
            }
            step.Changes.Add($"Satır {i + 1}: {UblDoc.Fmt(qty, 4)} {unit} → {UblDoc.Fmt(newQty, 4)} {targetUnit} (×{UblDoc.Fmt(factor, 4)})");
        }
    }

    /// <summary>Satır biriminin ana birime katsayısı (ProductUnit.ConvFactor ya da MainQty/UnitQty)</summary>
    private static async Task<decimal> ProductFactorAsync(RuleContext ctx, RuleContext.LineData? ld)
    {
        if (ld?.ProductCardId is not int pid || ld.UnitId is not int uid) return 0m;
        var r = await ctx.Db.QueryFirstOrDefaultAsync(
            "SELECT TOP 1 ConvFactor, MainQty, UnitQty, IsMain FROM dbo.ProductUnit WHERE ProductCardID = @pid AND UnitID = @uid",
            new { pid, uid });
        if (r == null || r.IsMain == true) return 0m;
        decimal conv = r.ConvFactor == null ? 0m : Convert.ToDecimal(r.ConvFactor);
        if (conv > 0) return conv;
        decimal main = r.MainQty == null ? 0m : Convert.ToDecimal(r.MainQty);
        decimal unit = r.UnitQty == null ? 0m : Convert.ToDecimal(r.UnitQty);
        return unit > 0 ? main / unit : 0m;
    }
}

// ── 7. Satırları topla ───────────────────────────────────────────────────

internal sealed class CollapseLinesTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "COLLAPSE_LINES",
        Title = "Satırları tek satırda topla",
        Category = "Satır",
        Description = "Tüm satırları KDV oranı başına tek satıra indirir (miktar 1, tutar = satırların net toplamı). Belge toplamları değişmez. Hizmet / toplu faturada «sadece ilk satır» ihtiyacı için.",
        LogoEquivalent = "SADECE İLK SATIRI BASSIN (diğer satırların RemoveChild ile gizlenmesi)",
        DocKinds = [1, 2],
        Params =
        [
            new() { Key = "name", Label = "Satır adı", Type = "template", Required = true, Default = "{Belge.Aciklama}" },
            new() { Key = "fallbackName", Label = "Ad boşsa", Default = "Hizmet bedeli" },
            new() { Key = "unitCode", Label = "Birim kodu", Default = "C62" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var lines = doc.Lines;
        if (lines.Count < 2) return;
        var name = await ctx.RenderAsync(RuleTemplates.P(p, "name"), null, ct);
        if (name.Length == 0) name = RuleTemplates.P(p, "fallbackName", "Hizmet bedeli");
        var currency = doc.Currency ?? "TRY";

        string Rate(XElement l) =>
            l.Element(UblDoc.Cac + "TaxTotal")?.Element(UblDoc.Cac + "TaxSubtotal")?.Element(UblDoc.Cbc + "Percent")?.Value?.Trim() ?? "0";

        // Tutarlar belgenin KDV dökümünden (TaxTotal/TaxSubtotal): toplama dahil olmayan bilgi satırları sayılmaz
        var docSubtotals = doc.Root.Elements(UblDoc.Cac + "TaxTotal").Elements(UblDoc.Cac + "TaxSubtotal")
            .Where(s => s.Element(UblDoc.Cac + "TaxCategory")?.Element(UblDoc.Cac + "TaxScheme")?.Element(UblDoc.Cbc + "TaxTypeCode")?.Value is null or "0015")
            .GroupBy(s => UblDoc.Dec(s.Element(UblDoc.Cbc + "Percent")?.Value))
            .ToDictionary(g => g.Key, g => (Net: g.Sum(s => UblDoc.Dec(s.Element(UblDoc.Cbc + "TaxableAmount")?.Value)),
                Tax: g.Sum(s => UblDoc.Dec(s.Element(UblDoc.Cbc + "TaxAmount")?.Value))));

        var groups = lines.GroupBy(Rate).ToList();
        foreach (var g in groups)
        {
            var first = g.First();
            var rate = UblDoc.Dec(g.Key);
            var (net, tax) = docSubtotals.TryGetValue(rate, out var st)
                ? st
                : (g.Sum(l => UblDoc.Dec(l.Element(UblDoc.Cbc + "LineExtensionAmount")?.Value)),
                   g.Sum(l => UblDoc.Dec(l.Element(UblDoc.Cac + "TaxTotal")?.Element(UblDoc.Cbc + "TaxAmount")?.Value)));
            if (net == 0m && tax == 0m)
            {
                // bu oranda belgede tutar yok (bilgi satırları) — satırlar çıkarılır
                foreach (var l in g) l.Remove();
                step.Changes.Add($"%{g.Key}: {g.Count()} bilgi satırı çıkarıldı");
                continue;
            }
            var keep = new XElement(first);
            keep.Elements(UblDoc.Cbc + "Note").Remove();
            keep.Elements(UblDoc.Cac + "AllowanceCharge").Remove();
            keep.Element(doc.QuantityName)?.ReplaceWith(new XElement(doc.QuantityName, new XAttribute("unitCode", RuleTemplates.P(p, "unitCode", "C62")), "1"));
            keep.Element(UblDoc.Cbc + "LineExtensionAmount")?.SetValue(UblDoc.Fmt(net));
            var tt = keep.Element(UblDoc.Cac + "TaxTotal");
            if (tt != null)
            {
                tt.Element(UblDoc.Cbc + "TaxAmount")?.SetValue(UblDoc.Fmt(tax));
                var sub = tt.Element(UblDoc.Cac + "TaxSubtotal");
                sub?.Element(UblDoc.Cbc + "TaxableAmount")?.SetValue(UblDoc.Fmt(net));
                sub?.Element(UblDoc.Cbc + "TaxAmount")?.SetValue(UblDoc.Fmt(tax));
                tt.Elements(UblDoc.Cac + "TaxSubtotal").Skip(1).Remove();
            }
            var item = keep.Element(UblDoc.Cac + "Item");
            item?.Elements().Where(e => e.Name.LocalName is "Description" or "SellersItemIdentification" or "BuyersItemIdentification"
                or "ManufacturersItemIdentification" or "BrandName" or "ModelName").Remove();
            keep.Element(UblDoc.Cac + "Price")?.Element(UblDoc.Cbc + "PriceAmount")?.SetValue(UblDoc.Fmt(net));
            first.AddBeforeSelf(keep);
            var nameEl = keep.Element(UblDoc.Cac + "Item")?.Element(UblDoc.Cbc + "Name");
            if (nameEl != null) nameEl.Value = groups.Count > 1 ? $"{name} (%{g.Key})" : name;
            foreach (var l in g) l.Remove();
            step.Changes.Add($"%{g.Key} KDV: {g.Count()} satır → 1 satır ({UblDoc.Fmt(net)} {currency})");
        }
        doc.RenumberLines();
    }
}

// ── 8. Sıfır tutarlı satırlar ────────────────────────────────────────────

internal sealed class DropZeroLinesTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "DROP_ZERO_LINES",
        Title = "Sıfır tutarlı satırları gönderme",
        Category = "Satır",
        Description = "Net tutarı 0 olan satırları (karma koli içeriği, bilgi satırı, promosyon) belgeden çıkarır; toplamlar değişmez.",
        LogoEquivalent = "Karma kolinin içindeki malzemelerin faturada görünmemesi",
        Params = [new() { Key = "itemCodes", Label = "Yalnız bu malzeme kodları", Help = "Boş: tüm 0 tutarlı satırlar" }],
    };

    public Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var drop = doc.Lines.Where(l =>
            UblDoc.Dec(l.Element(UblDoc.Cbc + "LineExtensionAmount")?.Value) == 0m
            && RuleTemplates.MatchAny(doc.GetLineField(l, "Item.SellersId"), RuleTemplates.P(p, "itemCodes"))).ToList();
        if (drop.Count == 0 || drop.Count == doc.Lines.Count) return Task.CompletedTask;
        foreach (var l in drop)
        {
            step.Changes.Add($"Satır çıkarıldı: {doc.GetLineField(l, "Item.Name")}");
            l.Remove();
        }
        doc.RenumberLines();
        return Task.CompletedTask;
    }
}

// ── 9. İade referansı ────────────────────────────────────────────────────

internal sealed class ReturnReferenceTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "RETURN_REFERENCE",
        Title = "İade faturası referansı",
        Category = "Başlık",
        Description = "Fatura tipi İADE ve iade edilen fatura referansı (BillingReference) yoksa varsayılan belge no / tarih ile ekler; GİB «iade faturasında referans zorunlu» hatasını önler.",
        LogoEquivalent = "İADE FATURASI (RETURN_DOCNO / RETURN_DATE boşsa doldurma)",
        DocKinds = [1, 2],
        Params =
        [
            new() { Key = "docNo", Label = "İade edilen belge no", Type = "template", Required = true, Default = "{Belge.Aciklama}" },
            new() { Key = "fallbackDocNo", Label = "Belge no boşsa", Default = "ABC2025000000001" },
            new() { Key = "issueDate", Label = "Belge tarihi (yyyy-aa-gg)", Default = "2025-01-01" },
        ],
    };

    private static readonly string[] Before =
    [
        "DespatchDocumentReference", "ReceiptDocumentReference", "OriginatorDocumentReference", "ContractDocumentReference",
        "AdditionalDocumentReference", "Signature", "AccountingSupplierParty",
    ];

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        if (!string.Equals(doc.TypeCode, "IADE", StringComparison.OrdinalIgnoreCase)) return;
        if (doc.Root.Element(UblDoc.Cac + "BillingReference") != null) return;
        var no = await ctx.RenderAsync(RuleTemplates.P(p, "docNo"), null, ct);
        if (no.Length == 0) no = RuleTemplates.P(p, "fallbackDocNo", "ABC2025000000001");
        var date = RuleTemplates.P(p, "issueDate", "2025-01-01");
        var el = new XElement(UblDoc.Cac + "BillingReference",
            new XElement(UblDoc.Cac + "InvoiceDocumentReference",
                new XElement(UblDoc.Cbc + "ID", no),
                new XElement(UblDoc.Cbc + "IssueDate", date),
                new XElement(UblDoc.Cbc + "DocumentTypeCode", "IADE")));
        var anchor = doc.Root.Elements().FirstOrDefault(e => Before.Contains(e.Name.LocalName));
        if (anchor != null) anchor.AddBeforeSelf(el);
        else doc.Root.Add(el);
        step.Changes.Add($"İade referansı eklendi: {no} / {date}");
    }
}

// ── 10. Alıcı unvanı ─────────────────────────────────────────────────────

internal sealed class PartyNameTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "PARTY_NAME",
        Title = "Alıcı unvanını düzenle",
        Category = "Başlık",
        Description = "Alıcı (giden belgede) unvanını yer tutuculu değerle değiştirir ya da sonuna ekler — ikinci unvan satırı gibi ihtiyaçlar için.",
        LogoEquivalent = "Ünvan2 kuralı",
        Params =
        [
            new() { Key = "value", Label = "Değer", Type = "template", Required = true, Default = "{Cari.Unvan}" },
            new() { Key = "mode", Label = "Yazma şekli", Type = "select", Default = "append", Options = RuleTemplates.Opts(("set", "Değiştir"), ("append", "Sonuna ekle")) },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var party = ctx.Direction == 2 ? doc.CustomerParty : doc.SupplierParty;
        var nameEl = party?.Element(UblDoc.Cac + "PartyName")?.Element(UblDoc.Cbc + "Name");
        if (nameEl == null) return;
        var value = await ctx.RenderAsync(RuleTemplates.P(p, "value"), null, ct);
        if (value.Length == 0) return;
        var old = nameEl.Value;
        nameEl.Value = RuleTemplates.P(p, "mode", "append") == "set" ? value : $"{old} {value}".Trim();
        if (nameEl.Value != old) step.Changes.Add($"Unvan: «{old}» → «{nameEl.Value}»");
    }
}

// ── 11. e-İrsaliye plaka / şoför ─────────────────────────────────────────

internal sealed class DespatchTransportTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "DESPATCH_TRANSPORT",
        Title = "e-İrsaliye plaka ve şoför",
        Category = "e-İrsaliye",
        Description = "Sevkiyat (Shipment) bölümüne araç plakası, dorse plakası ve şoför bilgisini yazar. Değerler sabit ya da yer tutucu / SQL değeri ile.",
        LogoEquivalent = "Plaka tanımlama (L_DRIVERS tablosundan PLATENUM / DRIVERNAME / TCNO)",
        DocKinds = [3],
        Params =
        [
            new() { Key = "plate", Label = "Araç plakası", Type = "template", Required = true },
            new() { Key = "trailerPlate", Label = "Dorse plakası", Type = "template" },
            new() { Key = "driverName", Label = "Şoför adı", Type = "template" },
            new() { Key = "driverSurname", Label = "Şoför soyadı", Type = "template" },
            new() { Key = "driverTckn", Label = "Şoför TCKN", Type = "template" },
            new() { Key = "overwrite", Label = "Belgede plaka varsa da değiştir", Type = "bool", Default = "false" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        if (!doc.IsDespatch) return;
        XNamespace cac = UblDoc.Cac, cbc = UblDoc.Cbc;
        var plate = await ctx.RenderAsync(RuleTemplates.P(p, "plate"), null, ct);
        if (plate.Length == 0) return;
        var shipment = doc.Root.Element(cac + "Shipment");
        if (shipment == null)
        {
            shipment = new XElement(cac + "Shipment", new XElement(cbc + "ID", "1"));
            var anchor = doc.Root.Element(cac + "DespatchLine");
            if (anchor != null) anchor.AddBeforeSelf(shipment);
            else doc.Root.Add(shipment);
        }
        var stage = shipment.Element(cac + "ShipmentStage");
        if (stage == null)
        {
            stage = new XElement(cac + "ShipmentStage");
            var after = shipment.Elements().LastOrDefault(e => e.Name.LocalName is "ID" or "HandlingCode" or "HandlingInstructions"
                or "GrossWeightMeasure" or "NetWeightMeasure" or "GrossVolumeMeasure" or "NetVolumeMeasure" or "TotalTransportHandlingUnitQuantity"
                or "GoodsItem");
            if (after != null) after.AddAfterSelf(stage);
            else shipment.AddFirst(stage);
        }
        var road = stage.Element(cac + "TransportMeans")?.Element(cac + "RoadTransport")?.Element(cbc + "LicensePlateID");
        if (road != null && !RuleTemplates.B(p, "overwrite", false)) return;
        stage.Element(cac + "TransportMeans")?.Remove();
        stage.Elements(cac + "DriverPerson").Remove();
        stage.Add(new XElement(cac + "TransportMeans",
            new XElement(cac + "RoadTransport", new XElement(cbc + "LicensePlateID", new XAttribute("schemeID", "PLAKA"), plate))));
        var driverName = await ctx.RenderAsync(RuleTemplates.P(p, "driverName"), null, ct);
        if (driverName.Length > 0)
            stage.Add(new XElement(cac + "DriverPerson",
                new XElement(cbc + "FirstName", driverName),
                new XElement(cbc + "FamilyName", await ctx.RenderAsync(RuleTemplates.P(p, "driverSurname"), null, ct)),
                new XElement(cbc + "Title", "Şoför"),
                new XElement(cbc + "NationalityID", await ctx.RenderAsync(RuleTemplates.P(p, "driverTckn"), null, ct))));
        step.Changes.Add($"Plaka {plate}{(driverName.Length > 0 ? $", şoför {driverName}" : "")}");

        var trailer = await ctx.RenderAsync(RuleTemplates.P(p, "trailerPlate"), null, ct);
        if (trailer.Length > 0)
        {
            var handling = shipment.Element(cac + "TransportHandlingUnit") ?? new XElement(cac + "TransportHandlingUnit");
            if (handling.Parent == null) shipment.Add(handling);
            handling.Elements(cac + "TransportEquipment").Remove();
            handling.Add(new XElement(cac + "TransportEquipment", new XElement(cbc + "ID", new XAttribute("schemeID", "DORSEPLAKA"), trailer)));
            step.Changes.Add($"Dorse {trailer}");
        }
    }
}

// ── 12. SQL değeri → ek alan (yönetici) ──────────────────────────────────

internal sealed class SqlValueFieldTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "SQL_VALUE_FIELD",
        Title = "SQL sonucu → ek alan / not (yönetici)",
        Category = "Gelişmiş",
        AdminOnly = true,
        Description = "Tek değer döndüren SELECT sorgusunu çalıştırır, sonucu ek alan ya da not olarak yazar. Sorgu salt-okunur çalışır (işlem her zaman geri alınır). Parametreler: @InvoiceID, @DespatchID, @CustomerID, @EGovDocumentID, @DocumentNo.",
        LogoEquivalent = "App.UQUERY_GETFLD(…) ile değer okuyup ADDITIONALDOCUMENT yazan kurallar",
        Params =
        [
            new() { Key = "sql", Label = "SELECT sorgusu", Type = "sql", Required = true, Default = "SELECT TOP 1 Code FROM dbo.CustomerCard WHERE CustomerCardID = @CustomerID" },
            new() { Key = "output", Label = "Yazılacak yer", Type = "select", Default = "field", Options = RuleTemplates.Opts(("field", "Ek alan"), ("note", "Belge notu")) },
            new() { Key = "documentType", Label = "Ek alan adı", Default = "SQL_DEGER" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var sql = RuleTemplates.P(p, "sql");
        if (sql.Length == 0) return;
        await ctx.HeaderAsync(ct);
        if (ctx.Db.State != ConnectionState.Open) ctx.Db.Open();
        object? result;
        using (var tx = ctx.Db.BeginTransaction())
        {
            try
            {
                result = await ctx.Db.ExecuteScalarAsync(new CommandDefinition(sql, SqlArgs(ctx, doc), tx, 30, cancellationToken: ct));
            }
            finally
            {
                tx.Rollback(); // salt-okunur: sorgu ne yaparsa yapsın kalıcı olmaz
            }
        }
        var value = Convert.ToString(result, CultureInfo.InvariantCulture)?.Trim() ?? "";
        if (value.Length == 0)
        {
            step.Message = "Sorgu boş döndü";
            return;
        }
        if (RuleTemplates.P(p, "output", "field") == "note")
        {
            doc.AddNote(value);
            step.Changes.Add($"Not: {value}");
            return;
        }
        var type = RuleTemplates.P(p, "documentType", "SQL_DEGER");
        doc.RemoveAdditionalDocuments(type);
        doc.AddAdditionalDocument(value, type);
        step.Changes.Add($"Ek alan «{type}» = {value}");
    }

    internal static object SqlArgs(RuleContext ctx, UblDoc doc) => new
    {
        InvoiceID = ctx.InvoiceId,
        DespatchID = ctx.DespatchId,
        CustomerID = ctx.CustomerId,
        EGovDocumentID = ctx.EGovDocumentId,
        DocumentNo = doc.DocumentId,
    };
}

// ── 13. Gönderim öncesi kayıt güncelleme (yönetici) ──────────────────────

internal sealed class SqlExecTemplate : IRuleTemplate
{
    public RuleTemplateInfo Info { get; } = new()
    {
        Code = "SQL_EXEC",
        Title = "Gönderim öncesi kayıt güncelleme (SQL, yönetici)",
        Category = "Gelişmiş",
        AdminOnly = true,
        Description = "Belge gönderilmeden önce ERP kayıtlarında düzeltme yapar (ör. sevk tarihi < belge tarihi ise eşitle, sipariş tarihini irsaliyeye çek). Önizlemede çalışır ama geri alınır; gerçek gönderimde kalıcıdır. Bağlantı bilgisi yazılmaz — uygulamanın kendi bağlantısı kullanılır. Parametreler: @InvoiceID, @DespatchID, @CustomerID, @EGovDocumentID, @DocumentNo.",
        LogoEquivalent = "UPDATE QUERYLERİ · Plaka tanımlama (EINVOICEDET UPDATE) — ADODB bağlantısı + şifreli script yerine",
        Params =
        [
            new() { Key = "sql", Label = "SQL (UPDATE / INSERT)", Type = "sql", Required = true, Default = "UPDATE dbo.ProductVoucher SET Description = Description WHERE ProductVoucherID = @DespatchID" },
        ],
    };

    public async Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct)
    {
        var sql = RuleTemplates.P(p, "sql");
        if (sql.Length == 0) return;
        await ctx.HeaderAsync(ct);
        if (ctx.Db.State != ConnectionState.Open) ctx.Db.Open();
        using var tx = ctx.Db.BeginTransaction();
        try
        {
            var n = await ctx.Db.ExecuteAsync(new CommandDefinition(sql, SqlValueFieldTemplate.SqlArgs(ctx, doc), tx, 60, cancellationToken: ct));
            if (ctx.Preview)
            {
                tx.Rollback();
                step.Changes.Add($"(önizleme) {n} kayıt etkilenecek — geri alındı");
            }
            else
            {
                tx.Commit();
                step.Changes.Add($"{n} kayıt güncellendi");
            }
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
