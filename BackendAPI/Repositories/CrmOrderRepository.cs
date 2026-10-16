using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class CrmOfferToOrderRequest
{
    public int? CompanyId { get; set; }
    public int? WhouseId { get; set; }
    public DateTime? OrderDate { get; set; }
}

public sealed class CrmOfferToOrderResult
{
    public int OrderVoucherId { get; set; }
    public string? OrderNo { get; set; }
    public int LineCount { get; set; }
    public bool CustomerPromoted { get; set; }
    public string Message { get; set; } = "";
}

/// <summary>
/// CRM teklifi → satış siparişi (OrderVoucher Type_=1 + OrderTrans).
/// Teklif «Onaylandı», fırsat «Kazanıldı» olur; müşteri cariye döner; CRM_Offer.OrderVoucherID bağlanır.
/// </summary>
public sealed class CrmOrderRepository
{
    private readonly IDbConnection _db;
    private readonly CrmRepository _crm;
    private readonly NumberTemplateRepository _numbers;
    private readonly CustomerKindRepository _customerKind;

    public CrmOrderRepository(
        IDbConnection db,
        CrmRepository crm,
        NumberTemplateRepository numbers,
        CustomerKindRepository customerKind)
    {
        _db = db;
        _crm = crm;
        _numbers = numbers;
        _customerKind = customerKind;
    }

    private async Task<bool> ColAsync(string table, string col) =>
        await _db.ExecuteScalarAsync<int>(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + table, c = col }) == 1;

    public async Task<CrmOfferToOrderResult> ConvertAsync(int offerId, CrmOfferToOrderRequest req, int userId, CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();

        var offer = await _crm.GetOfferAsync(offerId) ?? throw new ArgumentException($"Teklif #{offerId} bulunamadı.");
        if (offer.Lines.Count == 0) throw new ArgumentException("Teklifte satır yok.");
        if (offer.Status == 4) throw new ArgumentException("Revize edilmiş (eski) teklif siparişe dönüştürülemez; son revizyonu kullanın.");

        var hasLink = await ColAsync("CRM_Offer", "OrderVoucherID");
        if (hasLink)
        {
            var existing = await _db.ExecuteScalarAsync<int?>(
                @"SELECT f.OrderVoucherID FROM dbo.CRM_Offer f
                  INNER JOIN dbo.OrderVoucher v ON v.OrderVoucherID = f.OrderVoucherID
                  WHERE f.OfferID = @offerId", new { offerId });
            if (existing is int ex)
            {
                var no = await _db.ExecuteScalarAsync<string?>("SELECT OrderSlipNo FROM dbo.OrderVoucher WHERE OrderVoucherID=@ex", new { ex });
                throw new ArgumentException($"Bu teklif zaten siparişe dönüştürülmüş: {no ?? "#" + ex}");
            }
        }

        var opp = await _crm.GetOpportunityAsync(offer.OpportunityID)
                  ?? throw new ArgumentException("Teklifin fırsatı bulunamadı.");
        if (opp.CustomerCardID is not int customerId || customerId <= 0)
            throw new ArgumentException("Fırsatta müşteri seçili değil; siparişe dönüştürmek için önce fırsata müşteri bağlayın.");

        // Firma / ambar: istek → son satış siparişi → 1
        var last = await _db.QueryFirstOrDefaultAsync<(int? CompanyID, int? WhouseID)>(
            "SELECT TOP 1 CompanyID, WhouseID FROM dbo.OrderVoucher WHERE Type_ = 1 ORDER BY OrderVoucherID DESC");
        var companyId = req.CompanyId ?? last.CompanyID ?? 1;
        var whouseId = req.WhouseId ?? last.WhouseID ?? 1;
        var orderDate = (req.OrderDate ?? DateTime.Today).Date;

        // Numara (kendi transaction'ını açtığı için sipariş transaction'ından önce)
        var alloc = await _numbers.AllocateAsync(new NumberAllocateRequest
        {
            FormCode = "SalesOrderForm",
            TableName = "OrderVoucher",
            CompanyId = companyId.ToString(),
            WhouseId = whouseId.ToString(),
            UserId = userId > 0 ? userId.ToString() : null,
            DocumentDate = orderDate.ToString("yyyy-MM-dd"),
        }, ct);
        var orderNo = alloc.Success && !string.IsNullOrWhiteSpace(alloc.Number)
            ? alloc.Number!
            : $"CRM-{offer.DocNum}{(offer.RevisionNo > 0 ? "-R" + offer.RevisionNo : "")}";

        var otCols = (await _db.QueryAsync<string>(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='OrderTrans'"))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var ovCols = (await _db.QueryAsync<string>(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='OrderVoucher'"))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Genel iskonto satırlara oransal dağıtılır (CrmRepository.Calculate ile aynı)
        CrmRepository.Calculate(offer);
        var ratio = offer.SubTotal == 0 ? 1m : (offer.SubTotal - offer.GeneralDiscount) / offer.SubTotal;
        var description = $"CRM Teklif No {offer.DocNum}{(offer.RevisionNo > 0 ? " / R" + offer.RevisionNo : "")} · {opp.Title}";

        using var tx = _db.BeginTransaction();
        try
        {
            var ovId = await _db.ExecuteScalarAsync<int>(
                "SELECT ISNULL(MAX(CASE WHEN OrderVoucherID > 0 THEN OrderVoucherID END), 0) + 1 FROM dbo.OrderVoucher WITH (UPDLOCK, HOLDLOCK)",
                transaction: tx);

            var hCols = new List<string> { "OrderVoucherID", "CompanyID", "WhouseID", "Type_", "Status_", "OrderSlipNo", "OrderDate", "CustomerID", "Description" };
            var p = new DynamicParameters(new
            {
                ovId, companyId, whouseId, type = 1, status = 1, orderNo, orderDate, customerId,
                description = description.Length > 500 ? description[..500] : description,
            });
            var hVals = new List<string> { "@ovId", "@companyId", "@whouseId", "@type", "@status", "@orderNo", "@orderDate", "@customerId", "@description" };
            if (ovCols.Contains("Currency")) { hCols.Add("Currency"); hVals.Add("@currency"); p.Add("currency", offer.CurrencyID ?? 1); }
            if (ovCols.Contains("CurrencyRate")) { hCols.Add("CurrencyRate"); hVals.Add("@rate"); p.Add("rate", 1.0); }
            await _db.ExecuteAsync(
                $"INSERT INTO dbo.OrderVoucher ({string.Join(",", hCols)}) VALUES ({string.Join(",", hVals)})", p, tx);

            var lineId = await _db.ExecuteScalarAsync<int>(
                "SELECT ISNULL(MAX(CASE WHEN OrderTransID > 0 THEN OrderTransID END), 0) FROM dbo.OrderTrans WITH (UPDLOCK, HOLDLOCK)",
                transaction: tx);

            var lineNr = 0;
            foreach (var l in offer.Lines)
            {
                lineNr++;
                lineId++;
                var gross = Math.Round(l.Quantity * l.Price, 2);
                var net = Math.Round(l.NetTotal * ratio, 2);
                var discount = gross - net;
                var tax = Math.Round(net * l.VatRate / 100m, 2);
                int? unitId = l.ProductCardID is int pid
                    ? await _db.ExecuteScalarAsync<int?>("SELECT DefaultUnitID FROM dbo.ProductCard WHERE ProductCardID=@pid", new { pid }, tx)
                    : null;
                var text = string.IsNullOrWhiteSpace(l.Description) ? l.ProductCode : l.Description;

                var cols = new List<string> { "OrderTransID", "OrderSlipID", "ItemsID", "Description", "Quantity", "UnitID", "Price", "TotalDiscount", "TotalPrice", "TransLineNo" };
                var vals = new List<string> { "@lineId", "@ovId", "@item", "@text", "@qty", "@unitId", "@price", "@discount", "@gross", "@lineNr" };
                var lp = new DynamicParameters(new
                {
                    lineId, ovId, item = l.ProductCardID, text = text is { Length: > 0 } && text.Length > 500 ? text[..500] : text,
                    qty = (double)l.Quantity, unitId, price = (double)l.Price, discount = (double)discount, gross = (double)gross, lineNr,
                });
                void Opt(string col, string name, object? val)
                {
                    if (!otCols.Contains(col)) return;
                    cols.Add(col);
                    vals.Add("@" + name);
                    lp.Add(name, val);
                }
                Opt("OrderVoucherID", "ovId2", ovId);
                Opt("WhouseID", "wh", whouseId);
                Opt("Type_", "ltype", 1);
                Opt("Status_", "lstatus", 1);
                Opt("TaxRate", "taxRate", (double)l.VatRate);
                Opt("TotalTax", "tax", (double)tax);
                Opt("NetTotal", "net", (double)net);
                await _db.ExecuteAsync(
                    $"INSERT INTO dbo.OrderTrans ({string.Join(",", cols)}) VALUES ({string.Join(",", vals)})", lp, tx);
            }

            // Teklif onaylandı + sipariş bağı · fırsat kazanıldı
            await _db.ExecuteAsync(
                $"UPDATE dbo.CRM_Offer SET Status = 2{(hasLink ? ", OrderVoucherID = @ovId" : "")}, UpdateDate = SYSDATETIME() WHERE OfferID = @offerId",
                new { ovId, offerId }, tx);
            await _db.ExecuteAsync(
                @"UPDATE dbo.CRM_Opportunity
                  SET Status = 1, CloseDate = ISNULL(CloseDate, SYSDATETIME()),
                      CloseNote = ISNULL(CloseNote, @note), UpdateDate = SYSDATETIME()
                  WHERE OpportunityID = @oppId AND Status = 0",
                new { oppId = offer.OpportunityID, note = $"Sipariş: {orderNo}" }, tx);

            tx.Commit();

            var promoted = false;
            try { promoted = (await _customerKind.ToCariAsync(customerId, ct)).Changed; }
            catch { /* dönüşüm siparişi etkilemez */ }

            return new CrmOfferToOrderResult
            {
                OrderVoucherId = ovId,
                OrderNo = orderNo,
                LineCount = offer.Lines.Count,
                CustomerPromoted = promoted,
                Message = $"Satış siparişi oluşturuldu: {orderNo}" + (promoted ? " · müşteri cariye dönüştürüldü" : ""),
            };
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
