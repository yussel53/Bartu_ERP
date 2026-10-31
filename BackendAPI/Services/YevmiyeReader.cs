using System.Globalization;
using System.IO.Compression;
using System.Xml;

namespace BartuERP.Backend.Services;

/// <summary>
/// e-Defter yevmiye XML (veya bunu içeren zip) → muhasebe fişi aktarım satırları.
/// </summary>
public static class YevmiyeReader
{
    private static readonly string[] Headers =
    [
        "Fiş No", "Fiş Tarihi", "Fiş Tipi", "Yevmiye No", "Açıklama",
        "Belge Türü", "Belge No", "Belge Tarihi", "Ödeme Şekli",
        "Hesap Kodu", "Borç", "Alacak", "Satır Açıklama",
    ];

    public static bool TryRead(byte[] bytes, string fileName, out SpreadsheetData? data, out string? error)
    {
        data = null;
        error = null;
        var ext = Path.GetExtension(fileName ?? "").ToLowerInvariant();
        if (ext is ".xlsx" or ".xls" or ".csv" or ".txt") return false;

        try
        {
            if (ext == ".xml")
            {
                data = FromXml(new MemoryStream(bytes), "yevmiye");
                return true;
            }

            if (ext != ".zip" && !(bytes.Length > 3 && bytes[0] == 0x50 && bytes[1] == 0x4B))
                return false;

            using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
            if (zip.GetEntry("[Content_Types].xml") != null
                && zip.Entries.Any(e => e.FullName.Replace('\\', '/').StartsWith("xl/", StringComparison.OrdinalIgnoreCase)))
                return false;

            var xmls = zip.Entries.Where(e => e.Name.EndsWith(".xml", StringComparison.OrdinalIgnoreCase)).ToList();
            if (xmls.Count == 0) return false;

            var merged = new SpreadsheetData { SheetName = "yevmiye", Headers = Headers.ToList() };
            foreach (var entry in xmls)
            {
                using var s = entry.Open();
                var part = FromXml(s, entry.Name);
                merged.Rows.AddRange(part.Rows);
            }
            if (merged.Rows.Count == 0)
            {
                error = "Dosyada yevmiye satırı bulunamadı.";
                data = merged;
                return true;
            }
            merged.Rows.Sort((a, b) => string.Compare(a.ElementAtOrDefault(1), b.ElementAtOrDefault(1), StringComparison.Ordinal));
            data = merged;
            return true;
        }
        catch (Exception ex)
        {
            error = "Yevmiye okunamadı: " + ex.Message;
            data = new SpreadsheetData();
            return true;
        }
    }

    private static SpreadsheetData FromXml(Stream stream, string name)
    {
        var data = new SpreadsheetData { SheetName = name, Headers = Headers.ToList() };
        var header = new Head();
        var line = new Line();
        var inDetail = false;

        using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, IgnoreComments = true });
        while (reader.Read())
        {
            if (reader.NodeType == XmlNodeType.Element && !reader.IsEmptyElement)
            {
                var local = reader.LocalName;
                if (local.Equals("entryHeader", StringComparison.OrdinalIgnoreCase))
                {
                    header = new Head();
                    continue;
                }
                if (local.Equals("entryDetail", StringComparison.OrdinalIgnoreCase))
                {
                    inDetail = true;
                    line = new Line();
                    continue;
                }
                if (!IsLeaf(local)) continue;
                var text = ReadText(reader);
                if (inDetail) line.Take(local, text);
                else header.Take(local, text);
                continue;
            }

            if (reader.NodeType != XmlNodeType.EndElement) continue;
            if (reader.LocalName.Equals("entryDetail", StringComparison.OrdinalIgnoreCase))
            {
                data.Rows.Add(header.Row(line));
                inDetail = false;
            }
            else if (reader.LocalName.Equals("entryHeader", StringComparison.OrdinalIgnoreCase))
            {
                header = new Head();
            }
        }
        return data;
    }

    private static bool IsLeaf(string local) =>
        local.Equals("enteredDate", StringComparison.OrdinalIgnoreCase)
        || local.Equals("postingDate", StringComparison.OrdinalIgnoreCase)
        || local.Equals("entryNumber", StringComparison.OrdinalIgnoreCase)
        || local.Equals("entryNumberCounter", StringComparison.OrdinalIgnoreCase)
        || local.Equals("entryComment", StringComparison.OrdinalIgnoreCase)
        || local.Equals("documentType", StringComparison.OrdinalIgnoreCase)
        || local.Equals("documentNumber", StringComparison.OrdinalIgnoreCase)
        || local.Equals("documentDate", StringComparison.OrdinalIgnoreCase)
        || local.Equals("paymentMethod", StringComparison.OrdinalIgnoreCase)
        || local.Equals("accountMainID", StringComparison.OrdinalIgnoreCase)
        || local.Equals("accountSubID", StringComparison.OrdinalIgnoreCase)
        || local.Equals("amount", StringComparison.OrdinalIgnoreCase)
        || local.Equals("debitCreditCode", StringComparison.OrdinalIgnoreCase)
        || local.Equals("detailComment", StringComparison.OrdinalIgnoreCase)
        || local.Equals("lineNumberComment", StringComparison.OrdinalIgnoreCase);

    private static string ReadText(XmlReader reader)
    {
        var local = reader.LocalName;
        if (reader.IsEmptyElement) return "";
        var sb = new System.Text.StringBuilder();
        while (reader.Read())
        {
            if (reader.NodeType == XmlNodeType.Text || reader.NodeType == XmlNodeType.CDATA)
                sb.Append(reader.Value);
            else if (reader.NodeType == XmlNodeType.EndElement && reader.LocalName.Equals(local, StringComparison.OrdinalIgnoreCase))
                break;
            else if (reader.NodeType == XmlNodeType.Element)
                reader.Skip();
        }
        return sb.ToString().Trim();
    }

    private sealed class Head
    {
        public string No = "";
        public string Date = "";
        public string Journal = "";
        public string Comment = "";
        public string DocType = "";
        public string DocNo = "";
        public string DocDate = "";
        public string Pay = "";

        public void Take(string local, string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            if (local.Equals("enteredDate", StringComparison.OrdinalIgnoreCase) || local.Equals("postingDate", StringComparison.OrdinalIgnoreCase))
                Date = DateOf(text);
            else if (local.Equals("entryNumber", StringComparison.OrdinalIgnoreCase) && No.Length == 0)
                No = text;
            else if (local.Equals("entryNumberCounter", StringComparison.OrdinalIgnoreCase))
                Journal = text;
            else if (local.Equals("entryComment", StringComparison.OrdinalIgnoreCase))
                Comment = text;
            else if (local.Equals("documentType", StringComparison.OrdinalIgnoreCase) && DocType.Length == 0)
                DocType = DocKind(text);
            else if (local.Equals("documentNumber", StringComparison.OrdinalIgnoreCase) && DocNo.Length == 0)
                DocNo = text;
            else if (local.Equals("documentDate", StringComparison.OrdinalIgnoreCase) && DocDate.Length == 0)
                DocDate = DateOf(text);
            else if (local.Equals("paymentMethod", StringComparison.OrdinalIgnoreCase) && Pay.Length == 0)
                Pay = text;
        }

        public List<string> Row(Line line) =>
        [
            No.Length > 0 ? No : Journal,
            line.Date.Length > 0 ? line.Date : Date,
            "Mahsup",
            Journal,
            Comment,
            line.DocType.Length > 0 ? line.DocType : DocType,
            line.DocNo.Length > 0 ? line.DocNo : DocNo,
            line.DocDate.Length > 0 ? line.DocDate : DocDate,
            Pay,
            line.Account,
            line.Debit,
            line.Credit,
            line.Comment.Length > 0 ? line.Comment : Comment,
        ];
    }

    private sealed class Line
    {
        public string Account = "";
        public string Debit = "";
        public string Credit = "";
        public string Comment = "";
        public string Date = "";
        public string DocType = "";
        public string DocNo = "";
        public string DocDate = "";
        private string _side = "";
        private string _amount = "";

        public void Take(string local, string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            if (local.Equals("accountMainID", StringComparison.OrdinalIgnoreCase) || local.Equals("accountSubID", StringComparison.OrdinalIgnoreCase))
            {
                if (Account.Length == 0 || local.Equals("accountSubID", StringComparison.OrdinalIgnoreCase))
                    Account = text;
            }
            else if (local.Equals("amount", StringComparison.OrdinalIgnoreCase))
                _amount = text;
            else if (local.Equals("debitCreditCode", StringComparison.OrdinalIgnoreCase))
                _side = text;
            else if (local.Equals("detailComment", StringComparison.OrdinalIgnoreCase) || local.Equals("lineNumberComment", StringComparison.OrdinalIgnoreCase))
                Comment = text;
            else if (local.Equals("postingDate", StringComparison.OrdinalIgnoreCase))
                Date = DateOf(text);
            else if (local.Equals("documentType", StringComparison.OrdinalIgnoreCase))
                DocType = DocKind(text);
            else if (local.Equals("documentNumber", StringComparison.OrdinalIgnoreCase))
                DocNo = text;
            else if (local.Equals("documentDate", StringComparison.OrdinalIgnoreCase))
                DocDate = DateOf(text);
            ApplyAmount();
        }

        private void ApplyAmount()
        {
            if (_amount.Length == 0 || _side.Length == 0) return;
            var credit = _side.StartsWith("C", StringComparison.OrdinalIgnoreCase)
                || _side.Contains("alacak", StringComparison.OrdinalIgnoreCase)
                || _side.Equals("A", StringComparison.OrdinalIgnoreCase);
            if (credit) Credit = _amount;
            else Debit = _amount;
        }
    }

    private static string DateOf(string text)
    {
        if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)
            || DateTime.TryParse(text, CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.None, out dt))
            return dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return text.Length >= 10 ? text[..10] : text;
    }

    private static string DocKind(string text)
    {
        var n = text.Trim().ToLowerInvariant();
        if (n.Contains("invoice") || n.Contains("fatura")) return "Fatura";
        if (n.Contains("check") || n.Contains("cek") || n.Contains("çek")) return "Çek";
        if (n.Contains("voucher") || n.Contains("senet")) return "Senet";
        if (n.Contains("receipt") || n.Contains("makbuz")) return "Makbuz";
        if (n.Contains("shipment") || n.Contains("irsaliye") || n.Contains("irsaliye")) return "İrsaliye / Sevk";
        if (n.Contains("order-customer") || n.Contains("müşteri")) return "Müşteri Siparişi";
        if (n.Contains("order-vendor") || n.Contains("satici") || n.Contains("satıcı")) return "Satıcı Siparişi";
        if (n.Contains("other") || n.Contains("diger") || n.Contains("diğer")) return "Diğer";
        return text;
    }
}
