using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

/// <summary>Cari fiş parametreleri — CAR_FILL_ACC ile satır muhasebe kodu doldurma.</summary>
public sealed class CustomerParamsService
{
    private readonly IDbConnection _db;

    public CustomerParamsService(IDbConnection db)
    {
        _db = db;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<bool> IsOnAsync(string code)
    {
        Open();
        try
        {
            var v = (await _db.ExecuteScalarAsync<string?>(
                "SELECT TOP 1 Value FROM dbo.Setting WHERE Code = @code", new { code }))?.Trim();
            return v == "1";
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Boş CustomerTrans.AccountCardID → cari kart AccountLink (Module=2, Type=1).</summary>
    public async Task FillEmptyAccountCodesAsync(
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>> lines,
        CancellationToken ct = default)
    {
        _ = header;
        if (!await IsOnAsync("CAR_FILL_ACC") || lines.Count == 0) return;
        Open();
        static string? F(IDictionary<string, object?> d, string k) =>
            Convert.ToString(d.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value);
        static int? I(string? v) => int.TryParse(v, out var n) && n > 0 ? n : null;

        foreach (var line in lines)
        {
            if (I(F(line, "AccountCardID")) is int) continue;
            var customerId = I(F(line, "CustomerID"));
            var acc = await ResolveLinkAsync(2, 1, customerId, ct);
            if (acc is int a)
            {
                var key = line.Keys.FirstOrDefault(k => k.Equals("AccountCardID", StringComparison.OrdinalIgnoreCase))
                          ?? "AccountCardID";
                line[key] = a;
            }
        }
    }

    private async Task<int?> ResolveLinkAsync(int module, int? type, int? sourceCardId, CancellationToken ct)
    {
        var raw = await _db.QueryAsync<int>(new CommandDefinition(
            @"SELECT AccountID FROM dbo.AccountLinkDetail
WHERE Module = @module AND (@type IS NULL OR Type = @type) AND SourceCardID IN (@src, -1)
  AND AccountID IS NOT NULL AND AccountID <> 0
ORDER BY CASE WHEN SourceCardID = @src THEN 0 ELSE 1 END",
            new { module, type, src = sourceCardId ?? -1 },
            cancellationToken: ct));
        return raw.Cast<int?>().FirstOrDefault();
    }
}
