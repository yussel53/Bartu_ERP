using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services.EGovRules;

/// <summary>
/// Kuralın çalıştığı bağlam: belge (UBL) + ERP kayıtları (fatura / irsaliye, cari, satırlar).
/// Şablon metinlerindeki {Yer.Tutucu} değerleri buradan gelir; veritabanı değerleri ilk ihtiyaçta okunur.
/// </summary>
public sealed partial class RuleContext
{
    public IDbConnection Db { get; }
    public UblDoc Ubl { get; }
    public byte DocKind { get; }
    public byte Direction { get; }
    public bool Preview { get; }
    public int? InvoiceId { get; private set; }
    public int? DespatchId { get; private set; }
    public int? CustomerId { get; private set; }
    public int? EGovDocumentId { get; }
    public int? CompanyId { get; set; }

    private readonly CardStatementRepository _statement;
    private Dictionary<string, string>? _header;
    private List<LineData>? _lines;
    private readonly Dictionary<string, List<(string Field, string Type)>> _extra = new(StringComparer.OrdinalIgnoreCase);

    public RuleContext(IDbConnection db, CardStatementRepository statement, UblDoc ubl, byte docKind, byte direction,
        bool preview, int? invoiceId, int? egovDocumentId)
    {
        Db = db;
        _statement = statement;
        Ubl = ubl;
        DocKind = docKind;
        Direction = direction;
        Preview = preview;
        InvoiceId = invoiceId;
        EGovDocumentId = egovDocumentId;
    }

    /// <summary>Satırın ERP karşılığı (sıra ile eşlenir)</summary>
    public sealed class LineData
    {
        public int? ProductTransId { get; set; }
        public int? ProductCardId { get; set; }
        public int? UnitId { get; set; }
        public string? ProductCode { get; set; }
        public string? ProductTitle { get; set; }
        public string? Description { get; set; }
        public string? Description2 { get; set; }
        public string? AuxilCode { get; set; }
        public string? Barcode { get; set; }
        public string? CustomerCode { get; set; }
        public string? CustomerTitle { get; set; }
        public string? OrderNo { get; set; }
        public DateTime? OrderDate { get; set; }
        public string? DespatchNo { get; set; }
        public DateTime? DespatchDate { get; set; }
        public int? OrderVoucherId { get; set; }
    }

    private static string D(DateTime? d) => d?.ToString("dd.MM.yyyy") ?? "";
    private static string Iso(string? d) => DateTime.TryParse(d, CultureInfo.InvariantCulture, DateTimeStyles.None, out var x) ? x.ToString("dd.MM.yyyy") : d ?? "";
    private static string Tr(decimal v) => v.ToString("#,##0.00", CultureInfo.GetCultureInfo("tr-TR"));

    private async Task<bool> HasAsync(string table) =>
        await Db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END", new { t = "dbo." + table }) == 1;

    private void Open()
    {
        if (Db.State != ConnectionState.Open) Db.Open();
    }

    // ── Ek alanlar (U_) ──────────────────────────────────────────────────

    /// <summary>Ek alan yer tutucusu: tablo → önek ({Cari.U_EdiNo}); satır tabloları satırda okunur</summary>
    public static readonly (string Table, string Prefix, bool Line, string Title)[] ExtraTables =
    [
        ("Invoice", "Belge", false, "Fatura"), ("ProductVoucher", "Belge", false, "İrsaliye"),
        ("CustomerCard", "Cari", false, "Cari"), ("OrderVoucher", "Siparis", false, "Sipariş"),
        ("ProductCard", "Malzeme", true, "Malzeme"), ("ProductTrans", "Satir", true, "Satır"),
    ];

    [GeneratedRegex(@"^U_[A-Za-z0-9_]{1,60}$")]
    private static partial Regex ExtraFieldRx();

    private async Task<List<(string Field, string Type)>> ExtraFieldsAsync(string table)
    {
        if (_extra.TryGetValue(table, out var list)) return list;
        list = [];
        if (await HasAsync("SYS_ExtraFields"))
            list = (await Db.QueryAsync<(string, string)>(@"
SELECT FieldName, DataType FROM dbo.SYS_ExtraFields
WHERE TableName = @table AND IsActive = 1 AND COL_LENGTH(N'dbo.' + TableName, FieldName) IS NOT NULL", new { table }))
                .Where(f => ExtraFieldRx().IsMatch(f.Item1)).ToList();
        return _extra[table] = list;
    }

    /// <summary>Kaydın U_ değerleri metin olarak (tarih gg.aa.yyyy)</summary>
    private async Task<Dictionary<string, string>> ExtraValuesAsync(string table, string keyColumn, int? id)
    {
        var r = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var fields = await ExtraFieldsAsync(table);
        if (fields.Count == 0) return r;
        foreach (var f in fields) r[f.Field] = "";
        if (id == null) return r;
        var row = (IDictionary<string, object?>?)await Db.QueryFirstOrDefaultAsync(
            $"SELECT {string.Join(", ", fields.Select(f => $"[{f.Field}]"))} FROM dbo.[{table}] WHERE [{keyColumn}] = @id", new { id });
        if (row == null) return r;
        foreach (var f in fields)
            r[f.Field] = row[f.Field] switch
            {
                null => "",
                DateTime d => D(d),
                double x => x.ToString("0.######", CultureInfo.InvariantCulture),
                var v => Convert.ToString(v, CultureInfo.InvariantCulture)?.Trim() ?? "",
            };
        return r;
    }

    private static void Put(Dictionary<string, string> target, string prefix, Dictionary<string, string> values)
    {
        foreach (var (k, v) in values) target[$"{prefix}.{k}"] = v;
    }

    // ── Başlık değerleri ─────────────────────────────────────────────────

    public async Task<Dictionary<string, string>> HeaderAsync(CancellationToken ct)
    {
        if (_header != null) return _header;
        Open();
        var h = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var u = Ubl;
        var counter = Direction == 2 ? u.CustomerParty : u.SupplierParty;
        h["Belge.No"] = u.DocumentId ?? "";
        h["Belge.Tarih"] = Iso(u.IssueDate);
        h["Belge.Senaryo"] = u.ProfileId ?? "";
        h["Belge.Tip"] = u.TypeCode ?? "";
        h["Belge.ParaBirimi"] = u.Currency ?? "";
        var rate = u.Root.Element(UblDoc.Cac + "PricingExchangeRate")?.Element(UblDoc.Cbc + "CalculationRate")?.Value;
        h["Belge.Kur"] = rate ?? "";
        h["Belge.SatirSayisi"] = u.Lines.Count.ToString(CultureInfo.InvariantCulture);
        h["Belge.ToplamMiktar"] = UblDoc.Fmt(u.Lines.Sum(l => UblDoc.Dec(l.Element(u.QuantityName)?.Value)), 3);
        h["Belge.OdenecekTutar"] = u.Root.Element(UblDoc.Cac + "LegalMonetaryTotal")?.Element(UblDoc.Cbc + "PayableAmount")?.Value ?? "";
        h["Belge.VadeTarihi"] = Iso(u.Root.Element(UblDoc.Cac + "PaymentMeans")?.Element(UblDoc.Cbc + "PaymentDueDate")?.Value);
        h["Cari.VKN"] = UblDoc.PartyTaxNr(counter) ?? "";
        h["Cari.Unvan"] = UblDoc.PartyName(counter) ?? "";
        h["Bugun"] = DateTime.Today.ToString("dd.MM.yyyy");

        int? addressId = null;
        // ERP kaydı: fatura (giden belgede belge no ile) / irsaliye
        if (InvoiceId == null && !u.IsDespatch && !string.IsNullOrEmpty(u.DocumentId) && await HasAsync("Invoice"))
            InvoiceId = await Db.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 InvoiceID FROM dbo.Invoice WHERE DocumentNumber = @no ORDER BY InvoiceID DESC", new { no = u.DocumentId });
        if (u.IsDespatch && !string.IsNullOrEmpty(u.DocumentId) && await HasAsync("ProductVoucher"))
            DespatchId = await Db.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 ProductVoucherID FROM dbo.ProductVoucher WHERE DocumentNumber = @no ORDER BY ProductVoucherID DESC", new { no = u.DocumentId });

        if (InvoiceId is int inv)
        {
            var r = await Db.QueryFirstOrDefaultAsync(
                "SELECT CustomerID, CompanyID, Description, CurrencyRate, CustomerAdressID FROM dbo.Invoice WHERE InvoiceID = @inv", new { inv });
            if (r != null)
            {
                CustomerId ??= (int?)r.CustomerID;
                CompanyId ??= (int?)r.CompanyID;
                addressId = (int?)r.CustomerAdressID;
                h["Belge.Aciklama"] = (string?)r.Description ?? "";
                if (string.IsNullOrEmpty(h["Belge.Kur"]) && r.CurrencyRate != null)
                    h["Belge.Kur"] = Convert.ToDecimal(r.CurrencyRate).ToString("0.####", CultureInfo.InvariantCulture);
            }
        }
        else if (DespatchId is int dsp)
        {
            var r = await Db.QueryFirstOrDefaultAsync(
                "SELECT CustomerID, CompanyID, Description, CustomerAdressID FROM dbo.ProductVoucher WHERE ProductVoucherID = @dsp", new { dsp });
            if (r != null)
            {
                CustomerId ??= (int?)r.CustomerID;
                CompanyId ??= (int?)r.CompanyID;
                addressId = (int?)r.CustomerAdressID;
                h["Belge.Aciklama"] = (string?)r.Description ?? "";
            }
        }
        h.TryAdd("Belge.Aciklama", "");
        Put(h, "Belge", InvoiceId != null ? await ExtraValuesAsync("Invoice", "InvoiceID", InvoiceId)
            : await ExtraValuesAsync("ProductVoucher", "ProductVoucherID", DespatchId));

        // Cari: ERP kaydından, yoksa VKN ile
        if (CustomerId == null && h["Cari.VKN"].Length > 0)
            CustomerId = await Db.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 CustomerCardID FROM dbo.CustomerCard WHERE LTRIM(RTRIM(TaxNr)) = @tax ORDER BY CustomerCardID", new { tax = h["Cari.VKN"] });
        h["Cari.Kod"] = "";
        if (CustomerId is int cid)
        {
            var c = await Db.QueryFirstOrDefaultAsync("SELECT Code, Title FROM dbo.CustomerCard WHERE CustomerCardID = @cid", new { cid });
            if (c != null)
            {
                h["Cari.Kod"] = (string?)c.Code ?? "";
                if (string.IsNullOrEmpty(h["Cari.Unvan"])) h["Cari.Unvan"] = (string?)c.Title ?? "";
            }
            var (debit, credit) = await _statement.CustomerBalanceAsync(cid, ct);
            var bal = debit - credit;
            h["Cari.Bakiye"] = UblDoc.Fmt(bal);
            h["Cari.BakiyeMutlak"] = Tr(Math.Abs(bal));
            h["Cari.BakiyeBA"] = Math.Abs(bal) < 0.005m ? "0,00" : $"{Tr(Math.Abs(bal))} ({(bal > 0 ? "B" : "A")})";
            h["Cari.AcikSiparis"] = (await Db.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM dbo.OrderVoucher WHERE CustomerID = @cid AND ISNULL(Status_, 1) IN (1, 2)", new { cid })).ToString(CultureInfo.InvariantCulture);
            // Y-10: vadesi geçmiş açık borç (FIFO kapama sonrası)
            var (overdue, days) = await new CustomerAgingService(_statement, Db).OverdueAsync(cid, ct);
            h["Cari.GecikenVade"] = overdue > 0 ? Tr(overdue) : "";
            h["Cari.GecikenGun"] = overdue > 0 ? days.ToString(CultureInfo.InvariantCulture) : "";
        }
        foreach (var k in new[] { "Cari.Bakiye", "Cari.BakiyeMutlak", "Cari.BakiyeBA", "Cari.AcikSiparis", "Cari.GecikenVade", "Cari.GecikenGun" }) h.TryAdd(k, "");
        Put(h, "Cari", await ExtraValuesAsync("CustomerCard", "CustomerCardID", CustomerId));
        h["Cari.Ilgili"] = CustomerId is int cc && await HasAsync("CustomerContact")
            ? await Db.ExecuteScalarAsync<string?>(
                "SELECT TOP 1 Name FROM dbo.CustomerContact WHERE CustomerCardID = @cc ORDER BY ISNULL(IsDefault, 0) DESC, CustomerContactID", new { cc }) ?? ""
            : "";

        var lines = await LinesAsync(ct);
        // Sevk adresi: belgenin adresi, yoksa bağlı siparişin, yoksa carinin varsayılan adresi
        var orderIds = lines.Select(l => l.OrderVoucherId).OfType<int>().Distinct().ToList();
        if (addressId == null && orderIds.Count > 0)
            addressId = await Db.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 CustomerAdressID FROM dbo.OrderVoucher WHERE OrderVoucherID IN @orderIds AND CustomerAdressID IS NOT NULL ORDER BY OrderVoucherID", new { orderIds });
        if (addressId == null && CustomerId is int ca && await HasAsync("CustomerAdress"))
            addressId = await Db.ExecuteScalarAsync<int?>(
                "SELECT TOP 1 CustomerAdressID FROM dbo.CustomerAdress WHERE CustomerCardID = @ca AND ISNULL(Active, 1) = 1 ORDER BY ISNULL(IsDefault, 0) DESC, CustomerAdressID", new { ca });
        var adr = addressId is int aid
            ? await Db.QueryFirstOrDefaultAsync("SELECT AdressCode, Title, Adress, Town, City, Country, LocationCode FROM dbo.CustomerAdress WHERE CustomerAdressID = @aid", new { aid })
            : null;
        h["Sevk.Kod"] = (string?)adr?.AdressCode ?? "";
        h["Sevk.Adi"] = (string?)adr?.Title ?? "";
        h["Sevk.Adres"] = (string?)adr?.Adress ?? "";
        h["Sevk.Ilce"] = (string?)adr?.Town ?? "";
        h["Sevk.Il"] = (string?)adr?.City ?? "";
        h["Sevk.Ulke"] = (string?)adr?.Country ?? "";
        h["Sevk.LokasyonKodu"] = (string?)adr?.LocationCode ?? "";
        var place = string.Join(" / ", new[] { h["Sevk.Ilce"], h["Sevk.Il"] }.Where(x => x.Length > 0));
        h["Sevk.AdresTam"] = string.Join(" ", new[] { h["Sevk.Adres"], place }.Where(x => x.Length > 0));

        // Sipariş ek alanları: bağlı siparişlerin dolu değerleri virgülle
        var orderExtra = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var f in await ExtraFieldsAsync("OrderVoucher")) orderExtra[f.Field] = [];
        foreach (var oid in orderIds)
            foreach (var (k, v) in await ExtraValuesAsync("OrderVoucher", "OrderVoucherID", oid))
                if (v.Length > 0 && !orderExtra[k].Contains(v)) orderExtra[k].Add(v);
        foreach (var (k, v) in orderExtra) h[$"Siparis.{k}"] = string.Join(", ", v);
        h["Siparis.No"] = string.Join(", ", lines.Select(l => l.OrderNo).Where(s => !string.IsNullOrEmpty(s)).Distinct());
        h["Siparis.Tarih"] = D(lines.Select(l => l.OrderDate).FirstOrDefault(d => d != null));
        h["Irsaliye.No"] = string.Join(", ", lines.Select(l => l.DespatchNo).Where(s => !string.IsNullOrEmpty(s)).Distinct());
        h["Irsaliye.Tarih"] = D(lines.Select(l => l.DespatchDate).FirstOrDefault(d => d != null));
        return _header = h;
    }

    // ── Satır değerleri ──────────────────────────────────────────────────

    public async Task<List<LineData>> LinesAsync(CancellationToken ct)
    {
        if (_lines != null) return _lines;
        Open();
        var result = new List<LineData>();
        var where = InvoiceId is int ? "pt.InvoiceID = @id" : DespatchId is int ? "pt.ProductVoucherID = @id" : null;
        var id = InvoiceId ?? DespatchId;
        if (where != null && await HasAsync("ProductTrans"))
        {
            var hasOrderLink = await HasAsync("OrderTransProductTrans");
            result = (await Db.QueryAsync<LineData>($@"
SELECT pt.ProductTransID, pt.ProductCardID, pt.UnitID, p.Code AS ProductCode, p.Title AS ProductTitle,
       pt.Description, pt.Description2, pt.AuxilCode,
       (SELECT TOP 1 b.Barcode FROM dbo.ProductBarcode b WHERE b.ProductCardID = pt.ProductCardID ORDER BY ISNULL(b.LineNr, 99), b.ProductBarcodeID) AS Barcode,
       {(hasOrderLink ? @"(SELECT TOP 1 ov.OrderSlipNo FROM dbo.OrderTransProductTrans x JOIN dbo.OrderTrans ot ON ot.OrderTransID = x.OrderTransID
          JOIN dbo.OrderVoucher ov ON ov.OrderVoucherID = COALESCE(ot.OrderVoucherID, ot.OrderSlipID) WHERE x.ProductTransID = pt.ProductTransID)" : "NULL")} AS OrderNo,
       {(hasOrderLink ? @"(SELECT TOP 1 ov.OrderDate FROM dbo.OrderTransProductTrans x JOIN dbo.OrderTrans ot ON ot.OrderTransID = x.OrderTransID
          JOIN dbo.OrderVoucher ov ON ov.OrderVoucherID = COALESCE(ot.OrderVoucherID, ot.OrderSlipID) WHERE x.ProductTransID = pt.ProductTransID)" : "NULL")} AS OrderDate,
       {(hasOrderLink ? @"(SELECT TOP 1 COALESCE(ot.OrderVoucherID, ot.OrderSlipID) FROM dbo.OrderTransProductTrans x JOIN dbo.OrderTrans ot ON ot.OrderTransID = x.OrderTransID
          WHERE x.ProductTransID = pt.ProductTransID)" : "NULL")} AS OrderVoucherId,
       pv.DocumentNumber AS DespatchNo, pv.VoucherDate AS DespatchDate
FROM dbo.ProductTrans pt
LEFT JOIN dbo.ProductCard p ON p.ProductCardID = pt.ProductCardID
LEFT JOIN dbo.ProductVoucher pv ON pv.ProductVoucherID = pt.ProductVoucherID
WHERE {where}
ORDER BY ISNULL(pt.TransLineNo, 2147483647), pt.ProductTransID", new { id })).ToList();
        }

        // ERP satırı yoksa (ör. dışarıdan gelen UBL) malzeme kodu ile kart bilgisi
        var ublLines = Ubl.Lines;
        for (var i = 0; i < ublLines.Count; i++)
        {
            if (i >= result.Count) result.Add(new LineData());
            var ld = result[i];
            if (ld.ProductCardId == null)
            {
                var code = Ubl.GetLineField(ublLines[i], "Item.SellersId")?.Trim();
                if (!string.IsNullOrEmpty(code))
                {
                    var p = await Db.QueryFirstOrDefaultAsync("SELECT ProductCardID, Code, Title FROM dbo.ProductCard WHERE Code = @code", new { code });
                    if (p != null)
                    {
                        ld.ProductCardId = (int)p.ProductCardID;
                        ld.ProductCode = (string?)p.Code;
                        ld.ProductTitle = (string?)p.Title;
                        ld.Barcode = await Db.ExecuteScalarAsync<string?>(
                            "SELECT TOP 1 Barcode FROM dbo.ProductBarcode WHERE ProductCardID = @id ORDER BY ISNULL(LineNr, 99), ProductBarcodeID",
                            new { id = ld.ProductCardId });
                    }
                }
            }
            if (ld.ProductCardId is int pid && CustomerId is int cid && await HasAsync("ProductCustomerAlias"))
            {
                var a = await Db.QueryFirstOrDefaultAsync(@"
SELECT TOP 1 a.CustomerCode, a.CustomerTitle
FROM dbo.ProductCustomerAlias a
LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = @cid
WHERE a.ProductCardID = @pid AND ISNULL(a.IsActive, 1) = 1
  AND (
        (ISNULL(a.MatchBy, 1) = 1 AND a.CustomerCardID = @cid)
     OR (a.MatchBy = 2 AND NULLIF(LTRIM(RTRIM(a.TaxNr)), N'') = NULLIF(LTRIM(RTRIM(c.TaxNr)), N''))
      )
ORDER BY CASE WHEN ISNULL(a.MatchBy, 1) = 1 THEN 0 ELSE 1 END, a.ProductCustomerAliasID", new { pid, cid });
                ld.CustomerCode = (string?)a?.CustomerCode;
                ld.CustomerTitle = (string?)a?.CustomerTitle;
            }
        }
        return _lines = result;
    }

    public async Task<Dictionary<string, string>> LineValuesAsync(int index, CancellationToken ct)
    {
        var lines = await LinesAsync(ct);
        var ubl = Ubl.Lines[index];
        var ld = index < lines.Count ? lines[index] : new LineData();
        var r = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Satir.No"] = (index + 1).ToString(CultureInfo.InvariantCulture),
            ["Satir.MalzemeKodu"] = Ubl.GetLineField(ubl, "Item.SellersId") ?? ld.ProductCode ?? "",
            ["Satir.MalzemeAdi"] = Ubl.GetLineField(ubl, "Item.Name") ?? ld.ProductTitle ?? "",
            ["Satir.Aciklama"] = ld.Description ?? Ubl.GetLineField(ubl, "Line.Note") ?? "",
            ["Satir.Aciklama2"] = ld.Description2 ?? "",
            ["Satir.OzelKod"] = ld.AuxilCode ?? "",
            ["Satir.Barkod"] = ld.Barcode ?? "",
            ["Satir.CariKodu"] = ld.CustomerCode ?? "",
            ["Satir.CariAdi"] = ld.CustomerTitle ?? "",
            ["Satir.SiparisNo"] = ld.OrderNo ?? "",
            ["Satir.SiparisTarihi"] = D(ld.OrderDate),
            ["Satir.IrsaliyeNo"] = ld.DespatchNo ?? "",
            ["Satir.IrsaliyeTarihi"] = D(ld.DespatchDate),
            ["Satir.Miktar"] = ubl.Element(Ubl.QuantityName)?.Value ?? "",
            ["Satir.Birim"] = (string?)ubl.Element(Ubl.QuantityName)?.Attribute("unitCode") ?? "",
            ["Satir.Fiyat"] = ubl.Element(UblDoc.Cac + "Price")?.Element(UblDoc.Cbc + "PriceAmount")?.Value ?? "",
        };
        Put(r, "Satir", await ExtraValuesAsync("ProductTrans", "ProductTransID", ld.ProductTransId));
        Put(r, "Malzeme", await ExtraValuesAsync("ProductCard", "ProductCardID", ld.ProductCardId));
        // satırın kendi siparişi (başlıktaki virgüllü listenin yerine)
        if (ld.OrderVoucherId != null) Put(r, "Siparis", await ExtraValuesAsync("OrderVoucher", "OrderVoucherID", ld.OrderVoucherId));
        return r;
    }

    // ── Yer tutucu ───────────────────────────────────────────────────────

    [GeneratedRegex(@"\{([A-Za-zÇĞİÖŞÜçğıöşü0-9_.]+)\}")]
    private static partial Regex PlaceholderRx();

    /// <summary>{Yer.Tutucu} değerlerini doldur; satır şablonunda lineIndex verilir. Bilinmeyen tutucu boş olur.</summary>
    public async Task<string> RenderAsync(string? template, int? lineIndex, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(template)) return "";
        var header = await HeaderAsync(ct);
        var line = lineIndex is int i ? await LineValuesAsync(i, ct) : null;
        var any = false;
        var hasPlaceholder = false;
        var text = PlaceholderRx().Replace(template, m =>
        {
            hasPlaceholder = true;
            var key = m.Groups[1].Value;
            var v = line != null && line.TryGetValue(key, out var lv) ? lv : header.TryGetValue(key, out var hv) ? hv : "";
            if (!string.IsNullOrWhiteSpace(v)) any = true;
            return v;
        }).Trim();
        // «Barkod: {Satir.Barkod}» gibi metinde tüm yer tutucular boşsa sonuç boş sayılır (yalnız etiket yazılmaz)
        return hasPlaceholder && !any ? "" : text;
    }

    /// <summary>Ekranda gösterilecek yer tutucu listesi</summary>
    public static readonly (string Key, string Label, bool Line)[] Placeholders =
    [
        ("Belge.No", "Belge no", false), ("Belge.Tarih", "Belge tarihi", false), ("Belge.Senaryo", "Senaryo (profil)", false),
        ("Belge.Tip", "Fatura / irsaliye tipi", false), ("Belge.ParaBirimi", "Para birimi", false), ("Belge.Kur", "Döviz kuru", false),
        ("Belge.SatirSayisi", "Satır sayısı", false), ("Belge.ToplamMiktar", "Toplam miktar", false),
        ("Belge.OdenecekTutar", "Ödenecek tutar", false), ("Belge.VadeTarihi", "Vade (ödeme) tarihi", false),
        ("Belge.Aciklama", "Fiş açıklaması", false),
        ("Cari.Kod", "Cari kodu", false), ("Cari.Unvan", "Cari unvanı", false), ("Cari.VKN", "Cari VKN/TCKN", false),
        ("Cari.Bakiye", "Cari bakiye (işaretli, 1234.56)", false), ("Cari.BakiyeBA", "Cari bakiye «1.234,56 (B)»", false),
        ("Cari.BakiyeMutlak", "Cari bakiye (mutlak)", false), ("Cari.AcikSiparis", "Açık sipariş sayısı", false),
        ("Cari.GecikenVade", "Vadesi geçmiş borç (boşsa gecikme yok)", false), ("Cari.GecikenGun", "En eski gecikme (gün)", false),
        ("Cari.Ilgili", "Cari ilgili kişi", false),
        ("Sevk.Kod", "Sevk adresi kodu (mağaza / depo)", false), ("Sevk.Adi", "Sevk adresi adı", false),
        ("Sevk.Adres", "Sevk adresi", false), ("Sevk.Ilce", "Sevk ilçe", false), ("Sevk.Il", "Sevk il", false),
        ("Sevk.Ulke", "Sevk ülke", false), ("Sevk.LokasyonKodu", "Sevk lokasyon kodu", false),
        ("Sevk.AdresTam", "Sevk adresi «adres ilçe / il»", false),
        ("Siparis.No", "Sipariş no(ları)", false), ("Siparis.Tarih", "Sipariş tarihi", false),
        ("Irsaliye.No", "İrsaliye no(ları)", false), ("Irsaliye.Tarih", "İrsaliye tarihi", false), ("Bugun", "Bugünün tarihi", false),
        ("Satir.No", "Satır no", true), ("Satir.MalzemeKodu", "Malzeme kodu", true), ("Satir.MalzemeAdi", "Malzeme adı", true),
        ("Satir.Aciklama", "Satır açıklaması", true), ("Satir.Aciklama2", "Satır açıklaması 2", true),
        ("Satir.OzelKod", "Satır özel kodu", true), ("Satir.Barkod", "Barkod", true),
        ("Satir.CariKodu", "Cariye özel malzeme kodu", true), ("Satir.CariAdi", "Cariye özel malzeme adı", true),
        ("Satir.SiparisNo", "Satırın sipariş no", true), ("Satir.SiparisTarihi", "Satırın sipariş tarihi", true),
        ("Satir.IrsaliyeNo", "Satırın irsaliye no", true), ("Satir.IrsaliyeTarihi", "Satırın irsaliye tarihi", true),
        ("Satir.Miktar", "Miktar", true), ("Satir.Birim", "Birim kodu", true), ("Satir.Fiyat", "Birim fiyat", true),
    ];

    /// <summary>Tanımlı ek alanların yer tutucuları (Ek Alanlar ekranından eklenenler dahil)</summary>
    public static async Task<List<(string Key, string Label, bool Line)>> ExtraPlaceholdersAsync(IDbConnection db)
    {
        if (await db.ExecuteScalarAsync<int?>("SELECT OBJECT_ID(N'dbo.SYS_ExtraFields', N'U')") == null) return [];
        var defs = await db.QueryAsync<(string Table, string Field, string Label)>(@"
SELECT TableName, FieldName, Label FROM dbo.SYS_ExtraFields
WHERE IsActive = 1 AND COL_LENGTH(N'dbo.' + TableName, FieldName) IS NOT NULL ORDER BY TableName, OrderIndex, Label");
        return (from d in defs
                from t in ExtraTables
                where t.Table.Equals(d.Table, StringComparison.OrdinalIgnoreCase) && ExtraFieldRx().IsMatch(d.Field)
                select ($"{t.Prefix}.{d.Field}", $"{d.Label} (ek alan · {t.Title})", t.Line)).ToList();
    }
}
