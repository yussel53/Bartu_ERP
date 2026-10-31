using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class DocumentLinkDto
{
    public string Kind { get; set; } = "";
    public string Label { get; set; } = "";
    public string Table { get; set; } = "";
    public int Id { get; set; }
    public string? DocumentNumber { get; set; }
    public string FormCode { get; set; } = "";
    public int? TypeHint { get; set; }
}

/// <summary>Fişler arası gezinme: fatura ↔ irsaliye ↔ sipariş ↔ muhasebe fişi.</summary>
public sealed class DocumentLinksService
{
    private readonly IDbConnection _db;

    public DocumentLinksService(IDbConnection db) => _db = db;

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<IReadOnlyList<DocumentLinkDto>> ListAsync(string table, int id, CancellationToken ct = default)
    {
        Open();
        if (id <= 0) return [];
        var t = (table ?? "").Trim();
        var list = new List<DocumentLinkDto>();
        if (t.Equals("Invoice", StringComparison.OrdinalIgnoreCase))
            await AddForInvoiceAsync(list, id, ct);
        else if (t.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase))
            await AddForDispatchAsync(list, id, ct);
        else if (t.Equals("OrderVoucher", StringComparison.OrdinalIgnoreCase))
            await AddForOrderAsync(list, id, ct);
        else if (t.Equals("AccountVoucher", StringComparison.OrdinalIgnoreCase))
            await AddForAccountAsync(list, id, ct);
        else if (t.Equals("SafeVoucher", StringComparison.OrdinalIgnoreCase))
            await AddAccForSourceAsync(list, 4, id, ct);
        else if (t.Equals("CustomerVoucher", StringComparison.OrdinalIgnoreCase))
            await AddForCustomerVoucherAsync(list, id, ct);

        return list
            .GroupBy(x => $"{x.Table}:{x.Id}")
            .Select(g => g.First())
            .OrderBy(x => x.Kind)
            .ThenBy(x => x.Id)
            .ToList();
    }

    private static string InvoiceForm(int? type) =>
        type is 2 or 4 or 5 or 6 ? "PurchaseInvoiceForm" : "SalesInvoiceForm";

    private static string DispatchForm(int? type) =>
        type is 2 or 4 ? "PurchaseDispatchForm" : "SalesDispatchForm";

    private static string OrderForm(int? type) =>
        type is 2 or 4 or 5 ? "PurchaseOrderForm" : "SalesOrderForm";

    private async Task AddForInvoiceAsync(List<DocumentLinkDto> list, int invoiceId, CancellationToken ct)
    {
        // İrsaliyeler (ProductTrans.InvoiceID)
        var dispatches = await _db.QueryAsync<(int Id, string? No, int? Vt)>(new CommandDefinition(
            @"SELECT DISTINCT v.ProductVoucherID AS Id, v.DocumentNumber AS No, v.VoucherType AS Vt
FROM dbo.ProductTrans t
INNER JOIN dbo.ProductVoucher v ON v.ProductVoucherID = t.ProductVoucherID
WHERE t.InvoiceID = @invoiceId AND t.ProductVoucherID IS NOT NULL AND t.ProductVoucherID > 0",
            new { invoiceId }, cancellationToken: ct));
        foreach (var d in dispatches)
            list.Add(new DocumentLinkDto
            {
                Kind = "dispatch",
                Label = "İrsaliye",
                Table = "ProductVoucher",
                Id = d.Id,
                DocumentNumber = d.No,
                FormCode = DispatchForm(d.Vt),
                TypeHint = d.Vt,
            });

        // Siparişler (irsaliye satırı ↔ sipariş satırı)
        var orders = await _db.QueryAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
            @"SELECT DISTINCT o.OrderVoucherID AS Id, o.OrderSlipNo AS No, o.Type_ AS Ty
FROM dbo.ProductTrans t
INNER JOIN dbo.OrderTransProductTrans x ON x.ProductTransID = t.ProductTransID
INNER JOIN dbo.OrderTrans ot ON ot.OrderTransID = x.OrderTransID
INNER JOIN dbo.OrderVoucher o ON o.OrderVoucherID = ISNULL(NULLIF(ot.OrderVoucherID, 0), ot.OrderSlipID)
WHERE t.InvoiceID = @invoiceId AND ISNULL(NULLIF(ot.OrderVoucherID, 0), ot.OrderSlipID) IS NOT NULL",
            new { invoiceId }, cancellationToken: ct));
        foreach (var o in orders)
            list.Add(new DocumentLinkDto
            {
                Kind = "order",
                Label = "Sipariş",
                Table = "OrderVoucher",
                Id = o.Id,
                DocumentNumber = o.No,
                FormCode = OrderForm(o.Ty),
                TypeHint = o.Ty,
            });

        await AddAccForSourceAsync(list, 7, invoiceId, ct);
        await AddCollectionsForSourceAsync(list, "Invoice", invoiceId, ct);
    }

    private async Task AddCollectionsForSourceAsync(List<DocumentLinkDto> list, string sourceTable, int sourceId, CancellationToken ct)
    {
        if (!await ColExistsAsync("CustomerVoucher", "SourceTable")) return;
        var rows = await _db.QueryAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
            @"SELECT CustomerVoucherID AS Id, DocumentNumber AS No, Type AS Ty
FROM dbo.CustomerVoucher
WHERE SourceTable = @sourceTable AND SourceID = @sourceId",
            new { sourceTable, sourceId }, cancellationToken: ct));
        foreach (var r in rows)
        {
            var ty = r.Ty ?? 0;
            var label = ty is 11 or 13 ? "Kredi kartı tahsilat" : ty == 2 ? "Tahsilat" : "Cari fiş";
            list.Add(new DocumentLinkDto
            {
                Kind = "collection",
                Label = label,
                Table = "CustomerVoucher",
                Id = r.Id,
                DocumentNumber = r.No,
                FormCode = "CustomerVoucherForm",
                TypeHint = r.Ty,
            });
        }
    }

    private async Task AddForCustomerVoucherAsync(List<DocumentLinkDto> list, int voucherId, CancellationToken ct)
    {
        if (!await ColExistsAsync("CustomerVoucher", "SourceTable")) return;
        var src = await _db.QueryFirstOrDefaultAsync<(string? Table, int? Sid)>(new CommandDefinition(
            "SELECT SourceTable AS [Table], SourceID AS Sid FROM dbo.CustomerVoucher WHERE CustomerVoucherID = @id",
            new { id = voucherId }, cancellationToken: ct));
        if (string.IsNullOrWhiteSpace(src.Table) || src.Sid is not int sid || sid <= 0) return;
        if (src.Table.Equals("Invoice", StringComparison.OrdinalIgnoreCase))
        {
            var inv = await _db.QueryFirstOrDefaultAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
                "SELECT InvoiceID AS Id, DocumentNumber AS No, InvoiceType AS Ty FROM dbo.Invoice WHERE InvoiceID = @sid",
                new { sid }, cancellationToken: ct));
            if (inv.Id > 0)
                list.Add(new DocumentLinkDto
                {
                    Kind = "invoice",
                    Label = "Fatura",
                    Table = "Invoice",
                    Id = inv.Id,
                    DocumentNumber = inv.No,
                    FormCode = InvoiceForm(inv.Ty),
                    TypeHint = inv.Ty,
                });
        }
        else if (src.Table.Equals("OrderVoucher", StringComparison.OrdinalIgnoreCase))
        {
            var o = await _db.QueryFirstOrDefaultAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
                "SELECT OrderVoucherID AS Id, OrderSlipNo AS No, Type_ AS Ty FROM dbo.OrderVoucher WHERE OrderVoucherID = @sid",
                new { sid }, cancellationToken: ct));
            if (o.Id > 0)
                list.Add(new DocumentLinkDto
                {
                    Kind = "order",
                    Label = "Sipariş",
                    Table = "OrderVoucher",
                    Id = o.Id,
                    DocumentNumber = o.No,
                    FormCode = OrderForm(o.Ty),
                    TypeHint = o.Ty,
                });
        }
    }

    private async Task AddForDispatchAsync(List<DocumentLinkDto> list, int voucherId, CancellationToken ct)
    {
        var invoices = await _db.QueryAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
            @"SELECT DISTINCT i.InvoiceID AS Id, i.DocumentNumber AS No, i.InvoiceType AS Ty
FROM dbo.ProductTrans t
INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE t.ProductVoucherID = @voucherId AND t.InvoiceID IS NOT NULL AND t.InvoiceID > 0",
            new { voucherId }, cancellationToken: ct));
        foreach (var i in invoices)
            list.Add(new DocumentLinkDto
            {
                Kind = "invoice",
                Label = "Fatura",
                Table = "Invoice",
                Id = i.Id,
                DocumentNumber = i.No,
                FormCode = InvoiceForm(i.Ty),
                TypeHint = i.Ty,
            });

        var orders = await _db.QueryAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
            @"SELECT DISTINCT o.OrderVoucherID AS Id, o.OrderSlipNo AS No, o.Type_ AS Ty
FROM dbo.ProductTrans t
INNER JOIN dbo.OrderTransProductTrans x ON x.ProductTransID = t.ProductTransID
INNER JOIN dbo.OrderTrans ot ON ot.OrderTransID = x.OrderTransID
INNER JOIN dbo.OrderVoucher o ON o.OrderVoucherID = ISNULL(NULLIF(ot.OrderVoucherID, 0), ot.OrderSlipID)
WHERE t.ProductVoucherID = @voucherId AND o.OrderVoucherID > 0",
            new { voucherId }, cancellationToken: ct));
        foreach (var o in orders)
            list.Add(new DocumentLinkDto
            {
                Kind = "order",
                Label = "Sipariş",
                Table = "OrderVoucher",
                Id = o.Id,
                DocumentNumber = o.No,
                FormCode = OrderForm(o.Ty),
                TypeHint = o.Ty,
            });
    }

    private async Task AddForOrderAsync(List<DocumentLinkDto> list, int orderId, CancellationToken ct)
    {
        // Talep → sipariş / kaynak
        if (await ColExistsAsync("OrderVoucher", "SourceOrderVoucherID"))
        {
            var src = await _db.QueryFirstOrDefaultAsync<(int Id, string? No, int? Ty)?>(new CommandDefinition(
                @"SELECT TOP 1 o.OrderVoucherID AS Id, o.OrderSlipNo AS No, o.Type_ AS Ty
FROM dbo.OrderVoucher c
INNER JOIN dbo.OrderVoucher o ON o.OrderVoucherID = c.SourceOrderVoucherID
WHERE c.OrderVoucherID = @orderId AND c.SourceOrderVoucherID IS NOT NULL",
                new { orderId }, cancellationToken: ct));
            if (src is { } s && s.Id > 0)
                list.Add(new DocumentLinkDto
                {
                    Kind = "request",
                    Label = "Kaynak talep/sipariş",
                    Table = "OrderVoucher",
                    Id = s.Id,
                    DocumentNumber = s.No,
                    FormCode = OrderForm(s.Ty),
                    TypeHint = s.Ty,
                });

            var children = await _db.QueryAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
                @"SELECT o.OrderVoucherID AS Id, o.OrderSlipNo AS No, o.Type_ AS Ty
FROM dbo.OrderVoucher o WHERE o.SourceOrderVoucherID = @orderId",
                new { orderId }, cancellationToken: ct));
            foreach (var c in children)
                list.Add(new DocumentLinkDto
                {
                    Kind = "order",
                    Label = "Bağlı sipariş",
                    Table = "OrderVoucher",
                    Id = c.Id,
                    DocumentNumber = c.No,
                    FormCode = OrderForm(c.Ty),
                    TypeHint = c.Ty,
                });
        }

        var dispatches = await _db.QueryAsync<(int Id, string? No, int? Vt)>(new CommandDefinition(
            @"SELECT DISTINCT v.ProductVoucherID AS Id, v.DocumentNumber AS No, v.VoucherType AS Vt
FROM dbo.OrderTrans ot
INNER JOIN dbo.OrderTransProductTrans x ON x.OrderTransID = ot.OrderTransID
INNER JOIN dbo.ProductTrans t ON t.ProductTransID = x.ProductTransID
INNER JOIN dbo.ProductVoucher v ON v.ProductVoucherID = t.ProductVoucherID
WHERE ISNULL(NULLIF(ot.OrderVoucherID, 0), ot.OrderSlipID) = @orderId",
            new { orderId }, cancellationToken: ct));
        foreach (var d in dispatches)
            list.Add(new DocumentLinkDto
            {
                Kind = "dispatch",
                Label = "İrsaliye",
                Table = "ProductVoucher",
                Id = d.Id,
                DocumentNumber = d.No,
                FormCode = DispatchForm(d.Vt),
                TypeHint = d.Vt,
            });

        var invoices = await _db.QueryAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
            @"SELECT DISTINCT i.InvoiceID AS Id, i.DocumentNumber AS No, i.InvoiceType AS Ty
FROM dbo.OrderTrans ot
INNER JOIN dbo.OrderTransProductTrans x ON x.OrderTransID = ot.OrderTransID
INNER JOIN dbo.ProductTrans t ON t.ProductTransID = x.ProductTransID
INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE ISNULL(NULLIF(ot.OrderVoucherID, 0), ot.OrderSlipID) = @orderId AND t.InvoiceID IS NOT NULL",
            new { orderId }, cancellationToken: ct));
        foreach (var i in invoices)
            list.Add(new DocumentLinkDto
            {
                Kind = "invoice",
                Label = "Fatura",
                Table = "Invoice",
                Id = i.Id,
                DocumentNumber = i.No,
                FormCode = InvoiceForm(i.Ty),
                TypeHint = i.Ty,
            });

        await AddCollectionsForSourceAsync(list, "OrderVoucher", orderId, ct);
    }

    private async Task AddForAccountAsync(List<DocumentLinkDto> list, int accountVoucherId, CancellationToken ct)
    {
        var row = await _db.QueryFirstOrDefaultAsync<(int? Mod, int? Sid)>(new CommandDefinition(
            "SELECT SourceModule AS Mod, SourceID AS Sid FROM dbo.AccountVoucher WHERE AccountVoucherID = @id",
            new { id = accountVoucherId }, cancellationToken: ct));
        if (row.Mod is not int mod || row.Sid is not int sid || sid <= 0) return;
        if (mod == 7)
        {
            var inv = await _db.QueryFirstOrDefaultAsync<(int Id, string? No, int? Ty)>(new CommandDefinition(
                "SELECT InvoiceID AS Id, DocumentNumber AS No, InvoiceType AS Ty FROM dbo.Invoice WHERE InvoiceID = @sid",
                new { sid }, cancellationToken: ct));
            if (inv.Id > 0)
                list.Add(new DocumentLinkDto
                {
                    Kind = "invoice",
                    Label = "Fatura",
                    Table = "Invoice",
                    Id = inv.Id,
                    DocumentNumber = inv.No,
                    FormCode = InvoiceForm(inv.Ty),
                    TypeHint = inv.Ty,
                });
        }
        else if (mod == 4)
        {
            var safe = await _db.QueryFirstOrDefaultAsync<(int Id, string? No)>(new CommandDefinition(
                "SELECT SafeVoucherID AS Id, DocumentNumber AS No FROM dbo.SafeVoucher WHERE SafeVoucherID = @sid",
                new { sid }, cancellationToken: ct));
            if (safe.Id > 0)
                list.Add(new DocumentLinkDto
                {
                    Kind = "safe",
                    Label = "Kasa fişi",
                    Table = "SafeVoucher",
                    Id = safe.Id,
                    DocumentNumber = safe.No,
                    FormCode = "SafeVoucherForm",
                });
        }
    }

    private async Task AddAccForSourceAsync(List<DocumentLinkDto> list, int module, int sourceId, CancellationToken ct)
    {
        var rows = await _db.QueryAsync<(int Id, string? No)>(new CommandDefinition(
            @"SELECT AccountVoucherID AS Id, DocumentNumber AS No
FROM dbo.AccountVoucher
WHERE SourceModule = @module AND SourceID = @sourceId",
            new { module, sourceId }, cancellationToken: ct));
        foreach (var r in rows)
            list.Add(new DocumentLinkDto
            {
                Kind = "account",
                Label = "Muhasebe fişi",
                Table = "AccountVoucher",
                Id = r.Id,
                DocumentNumber = r.No,
                FormCode = "AccountVoucherForm",
            });
    }

    private async Task<bool> ColExistsAsync(string table, string col)
    {
        var n = await _db.ExecuteScalarAsync<int>(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}", c = col });
        return n == 1;
    }
}
