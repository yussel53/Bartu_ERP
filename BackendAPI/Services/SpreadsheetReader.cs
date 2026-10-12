using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

namespace BartuERP.Backend.Services;

public sealed class SpreadsheetData
{
    public string SheetName { get; set; } = "";
    public List<string> Headers { get; set; } = new();
    public List<List<string>> Rows { get; set; } = new();
}

/// <summary>
/// Harici paket olmadan .xlsx (OpenXML) ve .csv/.txt okur. İlk dolu satır başlık kabul edilir.
/// </summary>
public static class SpreadsheetReader
{
    public const int MaxRows = 20000;

    public static SpreadsheetData Read(Stream stream, string fileName)
    {
        var ext = Path.GetExtension(fileName ?? "").ToLowerInvariant();
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        var bytes = ms.ToArray();

        if (ext == ".xls")
            throw new InvalidOperationException("Eski .xls biçimi desteklenmiyor — dosyayı Excel'de .xlsx veya .csv olarak kaydedin.");

        var isZip = bytes.Length > 4 && bytes[0] == 0x50 && bytes[1] == 0x4B;
        var table = isZip ? ReadXlsx(bytes, out var sheet) : ReadCsv(bytes, out sheet);
        return ToData(table, sheet);
    }

    private static SpreadsheetData ToData(List<List<string>> table, string sheet)
    {
        var data = new SpreadsheetData { SheetName = sheet };
        var start = table.FindIndex(r => r.Any(c => !string.IsNullOrWhiteSpace(c)));
        if (start < 0) return data;

        data.Headers = table[start].Select(h => h.Trim()).ToList();
        while (data.Headers.Count > 0 && string.IsNullOrWhiteSpace(data.Headers[^1]))
            data.Headers.RemoveAt(data.Headers.Count - 1);

        var width = data.Headers.Count;
        for (var i = 1; i < width; i++)
        {
            if (string.IsNullOrWhiteSpace(data.Headers[i])) data.Headers[i] = $"Kolon{i + 1}";
        }

        foreach (var row in table.Skip(start + 1))
        {
            if (!row.Any(c => !string.IsNullOrWhiteSpace(c))) continue;
            var cells = new List<string>(width);
            for (var i = 0; i < width; i++) cells.Add(i < row.Count ? row[i].Trim() : "");
            data.Rows.Add(cells);
            if (data.Rows.Count >= MaxRows) break;
        }
        return data;
    }

    // ── XLSX ────────────────────────────────────────────────────────────────

    private static readonly XNamespace Main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace RelNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PkgRel = "http://schemas.openxmlformats.org/package/2006/relationships";

    private static List<List<string>> ReadXlsx(byte[] bytes, out string sheetName)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);

        var shared = new List<string>();
        var sst = Find(zip, "xl/sharedStrings.xml");
        if (sst != null)
        {
            var doc = Load(sst);
            foreach (var si in doc.Root!.Elements(Main + "si"))
                shared.Add(string.Concat(si.Descendants(Main + "t").Select(t => t.Value)));
        }

        var dateStyles = ReadDateStyles(zip);

        var wb = Load(Find(zip, "xl/workbook.xml") ?? throw new InvalidOperationException("Geçersiz xlsx: workbook.xml yok"));
        var firstSheet = wb.Root!.Element(Main + "sheets")?.Elements(Main + "sheet").FirstOrDefault()
                         ?? throw new InvalidOperationException("Excel dosyasında sayfa yok");
        sheetName = (string?)firstSheet.Attribute("name") ?? "Sayfa1";
        var rid = (string?)firstSheet.Attribute(RelNs + "id");

        var sheetPath = "xl/worksheets/sheet1.xml";
        var rels = Find(zip, "xl/_rels/workbook.xml.rels");
        if (rels != null && rid != null)
        {
            var target = Load(rels).Root!.Elements(PkgRel + "Relationship")
                .FirstOrDefault(r => (string?)r.Attribute("Id") == rid)?.Attribute("Target")?.Value;
            if (!string.IsNullOrWhiteSpace(target))
                sheetPath = target.StartsWith('/') ? target.TrimStart('/') : "xl/" + target;
        }

        var sheetEntry = Find(zip, sheetPath) ?? throw new InvalidOperationException($"Sayfa bulunamadı: {sheetPath}");
        var sheetDoc = Load(sheetEntry);

        var result = new List<List<string>>();
        var rowsEl = sheetDoc.Root!.Element(Main + "sheetData")?.Elements(Main + "row") ?? Enumerable.Empty<XElement>();
        var autoRow = 0;
        foreach (var rowEl in rowsEl)
        {
            var rowIndex = int.TryParse((string?)rowEl.Attribute("r"), out var rn) ? rn - 1 : autoRow;
            autoRow = rowIndex + 1;
            while (result.Count < rowIndex) result.Add(new List<string>());

            var cells = new List<string>();
            var autoCol = 0;
            foreach (var c in rowEl.Elements(Main + "c"))
            {
                var col = ColumnIndex((string?)c.Attribute("r")) ?? autoCol;
                autoCol = col + 1;
                while (cells.Count < col) cells.Add("");
                cells.Add(CellText(c, shared, dateStyles));
            }
            result.Add(cells);
            if (result.Count > MaxRows + 50) break;
        }
        return result;
    }

    private static string CellText(XElement c, List<string> shared, HashSet<int> dateStyles)
    {
        var t = (string?)c.Attribute("t");
        var v = c.Element(Main + "v")?.Value;
        switch (t)
        {
            case "s":
                return int.TryParse(v, out var i) && i >= 0 && i < shared.Count ? shared[i] : "";
            case "inlineStr":
                return string.Concat(c.Descendants(Main + "t").Select(x => x.Value));
            case "b":
                return v == "1" ? "1" : "0";
            case "str":
            case "e":
                return v ?? "";
        }
        if (string.IsNullOrEmpty(v)) return "";
        if (int.TryParse((string?)c.Attribute("s"), out var style) && dateStyles.Contains(style)
            && double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var oa))
        {
            try { return DateTime.FromOADate(oa).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); }
            catch { /* sayı olarak bırak */ }
        }
        if (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
            return d.ToString("0.###############", CultureInfo.InvariantCulture);
        return v;
    }

    private static HashSet<int> ReadDateStyles(ZipArchive zip)
    {
        var set = new HashSet<int>();
        var entry = Find(zip, "xl/styles.xml");
        if (entry == null) return set;
        var doc = Load(entry);
        var customDate = new HashSet<int>();
        foreach (var nf in doc.Root!.Element(Main + "numFmts")?.Elements(Main + "numFmt") ?? Enumerable.Empty<XElement>())
        {
            var code = ((string?)nf.Attribute("formatCode") ?? "").ToLowerInvariant();
            if (int.TryParse((string?)nf.Attribute("numFmtId"), out var id)
                && (code.Contains('d') || code.Contains("yy")) && !code.Contains('0'))
                customDate.Add(id);
        }
        var idx = 0;
        foreach (var xf in doc.Root.Element(Main + "cellXfs")?.Elements(Main + "xf") ?? Enumerable.Empty<XElement>())
        {
            if (int.TryParse((string?)xf.Attribute("numFmtId"), out var fmt)
                && ((fmt >= 14 && fmt <= 22) || customDate.Contains(fmt)))
                set.Add(idx);
            idx++;
        }
        return set;
    }

    private static int? ColumnIndex(string? cellRef)
    {
        if (string.IsNullOrEmpty(cellRef)) return null;
        var n = 0;
        var any = false;
        foreach (var ch in cellRef)
        {
            if (ch is >= 'A' and <= 'Z') { n = n * 26 + (ch - 'A' + 1); any = true; }
            else if (ch is >= 'a' and <= 'z') { n = n * 26 + (ch - 'a' + 1); any = true; }
            else break;
        }
        return any ? n - 1 : null;
    }

    private static ZipArchiveEntry? Find(ZipArchive zip, string path) =>
        zip.Entries.FirstOrDefault(e => e.FullName.Replace('\\', '/').Equals(path, StringComparison.OrdinalIgnoreCase));

    private static XDocument Load(ZipArchiveEntry entry)
    {
        using var s = entry.Open();
        return XDocument.Load(s);
    }

    // ── CSV ─────────────────────────────────────────────────────────────────

    private static List<List<string>> ReadCsv(byte[] bytes, out string sheetName)
    {
        sheetName = "CSV";
        var text = DecodeText(bytes);
        var firstLine = text.Split('\n').FirstOrDefault() ?? "";
        var delimiter = new[] { ';', '\t', ',' }
            .OrderByDescending(d => firstLine.Count(ch => ch == d))
            .First();

        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                    else inQuotes = false;
                }
                else cell.Append(ch);
                continue;
            }

            if (ch == '"' && cell.Length == 0) inQuotes = true;
            else if (ch == delimiter) { row.Add(cell.ToString()); cell.Clear(); }
            else if (ch == '\n' || ch == '\r')
            {
                if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString());
                cell.Clear();
                rows.Add(row);
                row = new List<string>();
                if (rows.Count > MaxRows + 50) break;
            }
            else cell.Append(ch);
        }
        if (cell.Length > 0 || row.Count > 0)
        {
            row.Add(cell.ToString());
            rows.Add(row);
        }
        return rows;
    }

    private static string DecodeText(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
            return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
            return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);
        try
        {
            return new UTF8Encoding(false, true).GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(1254).GetString(bytes);
        }
    }
}
