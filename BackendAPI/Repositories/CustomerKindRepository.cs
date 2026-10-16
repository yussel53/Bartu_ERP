using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

/// <summary>
/// Müşteri / Cari ayrımı — CustomerCard.CardKind (SqlUpdates/72_customer_card_kind.sql).
/// 1 = Müşteri (aday) · 2 = Cari. Müşteri satış yapılınca ya da elle «Cariye Dönüştür» ile cari olur.
/// </summary>
public sealed class CustomerKindRepository
{
    public const byte Musteri = 1;
    public const byte Cari = 2;

    private readonly IDbConnection _db;
    private bool? _ready;

    public CustomerKindRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        if (_ready is bool r) return r;
        if (_db.State != ConnectionState.Open) _db.Open();
        _ready = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.CustomerCard', N'CardKind') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct)) == 1;
        return _ready.Value;
    }

    /// <summary>Müşteriyi cariye çevirir. Zaten cariyse false döner.</summary>
    public async Task<(bool Changed, string Message)> ToCariAsync(int customerId, CancellationToken ct = default)
    {
        if (!await ReadyAsync(ct))
            return (false, "CardKind kolonu yok — Veritabanı Güncelleme ekranından 72_customer_card_kind.sql uygulayın.");
        var kind = await _db.ExecuteScalarAsync<byte?>(new CommandDefinition(
            "SELECT CardKind FROM dbo.CustomerCard WHERE CustomerCardID = @customerId",
            new { customerId }, cancellationToken: ct));
        if (kind is null) return (false, $"Kart #{customerId} bulunamadı.");
        if (kind == Cari) return (false, "Kart zaten cari.");
        await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.CustomerCard SET CardKind = 2, CardKindChangedAt = SYSDATETIME()
              WHERE CustomerCardID = @customerId AND CardKind = 1",
            new { customerId }, cancellationToken: ct));
        return (true, "Müşteri cariye dönüştürüldü.");
    }

    /// <summary>
    /// Satış belgesi kaydında müşteriyi otomatik cariye çevirir:
    /// satış faturası (Invoice 1), satış siparişi (OrderVoucher 1), satış irsaliyesi (ProductVoucher 3).
    /// </summary>
    public async Task<bool> PromoteOnSaleAsync(string tableName, int recordId, CancellationToken ct = default)
    {
        if (recordId <= 0 || !await ReadyAsync(ct)) return false;
        string? sql = tableName.ToLowerInvariant() switch
        {
            "invoice" => await ColAsync("Invoice", "InvoiceType", ct)
                ? "SELECT CustomerID FROM dbo.Invoice WHERE InvoiceID = @recordId AND InvoiceType = 1"
                : null,
            "ordervoucher" => "SELECT CustomerID FROM dbo.OrderVoucher WHERE OrderVoucherID = @recordId AND Type_ = 1",
            "productvoucher" => "SELECT CustomerID FROM dbo.ProductVoucher WHERE ProductVoucherID = @recordId AND VoucherType = 3",
            _ => null,
        };
        if (sql == null) return false;
        var customerId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(sql, new { recordId }, cancellationToken: ct));
        if (customerId is not int cid || cid <= 0) return false;
        var (changed, _) = await ToCariAsync(cid, ct);
        return changed;
    }

    private async Task<bool> ColAsync(string table, string col, CancellationToken ct) =>
        await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + table, c = col }, cancellationToken: ct)) == 1;
}
