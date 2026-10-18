using System.Data;
using BartuERP.Backend.Services;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EGovDespatchPreviewLine
{
    public int LineNo { get; set; }
    public string? SellerCode { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public string? UnitCode { get; set; }
    /// <summary>Malzeme–cari bağlantısından bulunan malzeme</summary>
    public int? ProductCardID { get; set; }
    public string? ProductCode { get; set; }
    public string? ProductTitle { get; set; }
    public int? ProductType { get; set; }
}

public sealed class EGovDespatchPreview
{
    public string? DespatchNo { get; set; }
    public string? Uuid { get; set; }
    public DateTime? IssueDate { get; set; }
    public DateTime? ActualDespatchDate { get; set; }
    public string? ProfileId { get; set; }
    public string? TypeCode { get; set; }
    public string? SupplierTaxNr { get; set; }
    public string? SupplierName { get; set; }
    public int? SupplierCardID { get; set; }
    public string? SupplierCode { get; set; }
    public string? SupplierTitle { get; set; }
    public List<string> OrderRefs { get; set; } = new();
    public string? PlateNo { get; set; }
    public string? DriverName { get; set; }
    /// <summary>Kaydedildiyse alış irsaliyesi</summary>
    public int? ProductVoucherID { get; set; }
    public List<EGovDespatchPreviewLine> Lines { get; set; } = new();
}

public sealed class EGovDespatchSaveRequest
{
    public int? CompanyId { get; set; }
    public int? WhouseId { get; set; }
    public string? Description { get; set; }
    public List<EGovIncomingSaveLine> Lines { get; set; } = new();
}

/// <summary>
/// Gelen e-İrsaliye → alış irsaliyesi (yol haritası E-05): UBL DespatchAdvice okunur, satırlar malzeme–cari bağlantısıyla
/// (ProductCustomerAlias — gelen e-faturayla aynı) eşlenir, ProductVoucher (VoucherType 2 Alış) + ProductTrans genel kayıt
/// yolundan (RecordsRepository) yazılır — stok irsaliyeden hesaplandığı için kayıtla stok girişi olur.
/// Belge EGovDocument.ProductVoucherID ile bağlanır (SqlUpdates/84_egov_incoming_despatch.sql).
/// </summary>
public sealed class EGovDespatchRepository
{
    public const string FormCode = "PurchaseDispatchForm";
    public const string MissingSetupMessage =
        "EGovDocument.ProductVoucherID yok — Veritabanı Güncelleme ekranından 84_egov_incoming_despatch.sql uygulayın.";
    /// <summary>ProductVoucher.VoucherType — Alış irsaliyesi (documentTypes.DispatchType.Alis)</summary>
    private const int PurchaseDispatchType = 2;

    private readonly IDbConnection _db;
    private readonly RecordsRepository _records;
    private readonly EGovIncomingRepository _incoming;

    public EGovDespatchRepository(IDbConnection db, RecordsRepository records, EGovIncomingRepository incoming)
    {
        _db = db;
        _records = records;
        _incoming = incoming;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.EGovDocument', N'ProductVoucherID') IS NULL OR OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct)) == 1;
    }

    public async Task<(EGovDespatchPreview? Preview, string? Error)> PreviewAsync(int id, CancellationToken ct = default)
    {
        Open();
        var doc = await _db.QueryFirstOrDefaultAsync<DocRow>(new CommandDefinition(
            "SELECT DocKind, Direction, XmlContent, ProductVoucherID FROM dbo.EGovDocument WHERE EGovDocumentID = @id",
            new { id }, cancellationToken: ct));
        if (doc is null) return (null, $"e-Belge #{id} bulunamadı.");
        if (doc.DocKind != 3 || doc.Direction != 1) return (null, "Yalnız gelen e-İrsaliye alış irsaliyesi olarak kaydedilir.");
        if (string.IsNullOrWhiteSpace(doc.XmlContent))
            return (null, "Belgenin UBL/XML içeriği yok — e-Logo Belge Çekme ekranından XML ile birlikte yeniden çekin.");

        UblDespatch ubl;
        try
        {
            ubl = UblDespatchReader.Read(doc.XmlContent);
        }
        catch (Exception ex)
        {
            return (null, $"UBL okunamadı: {ex.Message}");
        }

        var p = new EGovDespatchPreview
        {
            DespatchNo = ubl.DespatchNo,
            Uuid = ubl.Uuid,
            IssueDate = ubl.IssueDate,
            ActualDespatchDate = ubl.ActualDespatchDate,
            ProfileId = ubl.ProfileId,
            TypeCode = ubl.TypeCode,
            SupplierTaxNr = ubl.Supplier.TaxNr,
            SupplierName = ubl.Supplier.Name,
            OrderRefs = ubl.OrderRefs,
            PlateNo = ubl.PlateNo,
            DriverName = ubl.DriverName,
            ProductVoucherID = doc.ProductVoucherID,
        };
        if (!string.IsNullOrWhiteSpace(ubl.Supplier.TaxNr))
        {
            var sup = await _db.QueryFirstOrDefaultAsync<(int Id, string? Code, string? Title)?>(new CommandDefinition(
                "SELECT TOP 1 CustomerCardID, Code, Title FROM dbo.CustomerCard WHERE TaxNr = @tax ORDER BY CustomerCardID",
                new { tax = ubl.Supplier.TaxNr }, cancellationToken: ct));
            if (sup is { } s)
            {
                p.SupplierCardID = s.Id;
                p.SupplierCode = s.Code;
                p.SupplierTitle = s.Title;
            }
        }

        foreach (var l in ubl.Lines)
        {
            var line = new EGovDespatchPreviewLine
            {
                LineNo = l.LineNo,
                SellerCode = l.SellerCode,
                Name = l.Name,
                Description = l.Description,
                Quantity = l.Quantity,
                UnitCode = l.UnitCode,
            };
            if (p.SupplierCardID is int supId && await _incoming.FindAliasAsync(supId, l.SellerCode, l.Name, ct) is { } hit)
            {
                line.ProductCardID = hit.Id;
                line.ProductCode = hit.Code;
                line.ProductTitle = hit.Title;
                line.ProductType = hit.ProductType;
            }
            p.Lines.Add(line);
        }
        return (p, null);
    }

    /// <summary>
    /// Alış irsaliyesi olarak kaydeder: eşlemeler ProductCustomerAlias'a, irsaliye RecordsRepository ile yazılır.
    /// Dönen RecordSaveRequest çağıran tarafta kayıt sonrası adımlar (PostSave / süreç tetikleyici) için kullanılır.
    /// </summary>
    public async Task<(bool Ok, int VoucherId, string Message, RecordSaveRequest? Body)> SaveAsync(
        int id, EGovDespatchSaveRequest req, CancellationToken ct = default)
    {
        if (!await ReadyAsync(ct)) return (false, 0, MissingSetupMessage, null);
        if (req.WhouseId is not > 0) return (false, 0, "Ambar seçin — stok girişi bu ambara yapılır.", null);

        var (p, error) = await PreviewAsync(id, ct);
        if (p is null) return (false, 0, error ?? "Belge okunamadı.", null);
        if (p.ProductVoucherID is > 0) return (false, p.ProductVoucherID.Value, "Belge zaten alış irsaliyesi olarak kaydedildi.", null);
        if (p.SupplierCardID is not int supplierId)
            return (false, 0, $"Tedarikçi cari kartı bulunamadı (VKN/TCKN {p.SupplierTaxNr}). Önce cari kartı açın.", null);

        var excluded = req.Lines.Where(l => l.Exclude).Select(l => l.LineNo).ToHashSet();
        p.Lines.RemoveAll(l => excluded.Contains(l.LineNo));
        if (p.Lines.Count == 0) return (false, 0, "İrsaliyeye yazılacak satır yok.", null);

        var chosen = req.Lines.Where(l => !l.Exclude && l.ProductCardID > 0).ToDictionary(l => l.LineNo, l => l.ProductCardID);
        var missing = p.Lines.Where(l => !chosen.ContainsKey(l.LineNo)).Select(l => l.LineNo).ToList();
        if (missing.Count > 0) return (false, 0, $"Eşlenmemiş satır var: {string.Join(", ", missing)}.", null);

        var productIds = chosen.Values.Distinct().ToArray();
        var products = (await _db.QueryAsync<(int Id, int? UnitId, int? ProductType)>(new CommandDefinition(
            "SELECT ProductCardID, DefaultUnitID, ProductType FROM dbo.ProductCard WHERE ProductCardID IN @productIds",
            new { productIds }, cancellationToken: ct))).ToDictionary(x => x.Id);
        var unknown = productIds.Where(pid => !products.ContainsKey(pid)).ToList();
        if (unknown.Count > 0) return (false, 0, $"Malzeme kartı bulunamadı: #{string.Join(", #", unknown)}.", null);
        // Stok hareketi yalnız malzeme kartında anlamlı — hizmet kartı irsaliyeye yazılmaz
        var services = p.Lines.Where(l => products[chosen[l.LineNo]].ProductType is 2 or 3).Select(l => l.LineNo).ToList();
        if (services.Count > 0) return (false, 0, $"İrsaliye satırı hizmet kartına eşlenemez — satır {string.Join(", ", services)}.", null);

        foreach (var l in p.Lines)
            await _incoming.UpsertAliasAsync(chosen[l.LineNo], supplierId, Blank(l.SellerCode), Blank(l.Name), ct);

        var lines = p.Lines.Select(l => new Dictionary<string, object?>
        {
            ["ProductCardID"] = chosen[l.LineNo],
            ["Description1"] = l.Name,
            ["Description2"] = l.Description,
            ["Quantity"] = l.Quantity,
            ["UnitID"] = products[chosen[l.LineNo]].UnitId,
            ["WhouseID"] = req.WhouseId,
            ["TransLineNo"] = l.LineNo,
        }).ToList();

        var desc = string.IsNullOrWhiteSpace(req.Description)
            ? $"Gelen e-İrsaliye {p.DespatchNo} · ETTN {p.Uuid}"
            : req.Description.Trim();
        var body = new RecordSaveRequest
        {
            RecordId = 0,
            FormCode = FormCode,
            StandardFields = new Dictionary<string, object?>
            {
                ["VoucherType"] = PurchaseDispatchType,
                ["VoucherDate"] = (p.ActualDespatchDate ?? p.IssueDate)?.ToString("yyyy-MM-dd"),
                ["DocumentNumber"] = p.DespatchNo,
                ["CustomerID"] = supplierId,
                ["CompanyID"] = req.CompanyId is > 0 ? req.CompanyId : null,
                ["WhouseID"] = req.WhouseId,
                ["Status_"] = 1,
                ["Description"] = desc,
            },
            AdditionalFields = new Dictionary<string, object?>
            {
                ["U_PlateNo"] = p.PlateNo,
                ["U_DriverName"] = p.DriverName,
                ["U_WaybillNo"] = p.DespatchNo,
            },
            Lines = lines,
        };

        var (ok, voucherId, message) = await _records.SaveAsync("ProductVoucher", "ProductVoucherID", body, ct);
        if (!ok) return (false, 0, message, null);

        Open();
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.EGovDocument SET ProductVoucherID = @voucherId WHERE EGovDocumentID = @id AND ProductVoucherID IS NULL",
            new { voucherId, id }, cancellationToken: ct));
        return (true, voucherId, $"Alış irsaliyesi #{voucherId} kaydedildi — {p.Lines.Count} satır stoğa girdi.", body);
    }

    private sealed class DocRow
    {
        public byte DocKind { get; set; }
        public byte Direction { get; set; }
        public string? XmlContent { get; set; }
        public int? ProductVoucherID { get; set; }
    }

    private static string? Blank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
