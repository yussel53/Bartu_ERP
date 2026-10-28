using System.Data;
using System.Globalization;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class SafeParamItem
{
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Value { get; set; } = "";
}

public sealed class SafeParamsService
{
    private readonly IDbConnection _db;

    public SafeParamsService(IDbConnection db)
    {
        _db = db;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<string?> GetAsync(string code)
    {
        Open();
        try
        {
            return (await _db.ExecuteScalarAsync<string?>(
                "SELECT TOP 1 Value FROM dbo.Setting WHERE Code = @code", new { code }))?.Trim();
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> IsOnAsync(string code) => (await GetAsync(code)) == "1";

    public async Task<IReadOnlyList<SafeParamItem>> ListAsync()
    {
        Open();
        var rows = (await _db.QueryAsync<SafeParamItem>(
            @"SELECT Code, Title, Value FROM dbo.Setting
WHERE ModuleKey = N'kasa' OR Code LIKE N'KASA_%'
ORDER BY SettingID")).ToList();
        return rows;
    }

    public async Task SaveAsync(IEnumerable<SafeParamItem> items)
    {
        Open();
        foreach (var it in items)
        {
            if (string.IsNullOrWhiteSpace(it.Code)) continue;
            var n = await _db.ExecuteAsync(
                "UPDATE dbo.Setting SET Value = @Value, Title = COALESCE(NULLIF(@Title, N''), Title) WHERE Code = @Code",
                new { it.Code, it.Title, Value = it.Value ?? "" });
            if (n == 0)
            {
                var id = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(SettingID), 0) + 1 FROM dbo.Setting");
                await _db.ExecuteAsync(
                    "INSERT INTO dbo.Setting (SettingID, Code, Title, Value, ModuleKey) VALUES (@id, @Code, @Title, @Value, N'kasa')",
                    new { id, it.Code, Title = string.IsNullOrWhiteSpace(it.Title) ? it.Code : it.Title, Value = it.Value ?? "" });
            }
        }
    }

    /// <summary>Kayıt öncesi: çalışma günü + negatif kasa. Hata varsa message döner.</summary>
    public async Task<string?> ValidateBeforeSaveAsync(
        int voucherId,
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>>? lines,
        CancellationToken ct = default)
    {
        Open();
        static string? F(IDictionary<string, object?> d, string k) =>
            Convert.ToString(d.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value);
        static int? I(string? v) => int.TryParse(v, out var n) ? n : null;
        static decimal D(string? v) =>
            decimal.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

        var type = I(F(header, "Type_")) ?? 0;
        var safeId = I(F(header, "SafeCardID")) ?? 0;
        var dateRaw = F(header, "VoucherDate");
        DateTime.TryParse(dateRaw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var vDate);

        if (await IsOnAsync("KASA_WORKDAY_CTRL"))
        {
            if (vDate == default) vDate = DateTime.Today;
            if (vDate.Date != DateTime.Today)
                return "Kasa çalışma günü kontrolü: fiş tarihi bugün (" + DateTime.Today.ToString("dd.MM.yyyy") + ") olmalı.";
        }

        if (safeId <= 0 || lines == null || lines.Count == 0) return null;

        if (await IsOnAsync("KASA_NEG_CTRL"))
        {
            var outTypes = type is 2 or 3 or 5 or 6;
            if (outTypes)
            {
                var outAmt = lines.Sum(l => Math.Abs(D(F(l, "Amount"))));
                if (outAmt > 0)
                {
                    var bal = await BalanceAsync(safeId, voucherId > 0 ? voucherId : null, ct);
                    if (bal - outAmt < -0.009m)
                        return $"Kasa negatif seviye kontrolü: bakiye {bal:N2}, çıkış {outAmt:N2} — kayıt engellendi.";
                }
            }
            // Virman: hedef kasaya giriş — kaynak çıkışı yukarıda; hedef için negatif yok
        }

        return null;
    }

    /// <summary>Boş satır muhasebe kodlarını Muhasebe Bağlantılarından doldurur (KASA_FILL_ACC=1).</summary>
    public async Task FillEmptyAccountCodesAsync(
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>> lines,
        CancellationToken ct = default)
    {
        if (!await IsOnAsync("KASA_FILL_ACC") || lines.Count == 0) return;
        Open();
        static string? F(IDictionary<string, object?> d, string k) =>
            Convert.ToString(d.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value);
        static int? I(string? v) => int.TryParse(v, out var n) && n > 0 ? n : null;

        var type = I(F(header, "Type_")) ?? 0;
        var safeId = I(F(header, "SafeCardID"));

        foreach (var line in lines)
        {
            if (I(F(line, "AccountCardID")) is int existing && existing > 0) continue;

            int? acc = null;
            if (type is 1 or 2)
            {
                // Karşı hesap: cari
                acc = await ResolveLinkAsync(2, 1, I(F(line, "CustomerID")), ct);
            }
            else if (type is 3 or 4)
            {
                acc = await ResolveLinkAsync(3, null, I(F(line, "BankAccountCardID")), ct);
            }
            else if (type == 5)
            {
                // Masraf: kasa çıkış bağlantısı öndeğer
                acc = await ResolveLinkAsync(4, 2, safeId, ct) ?? await ResolveLinkAsync(4, null, safeId, ct);
            }
            else if (type == 6)
            {
                acc = await ResolveLinkAsync(4, 1, I(F(line, "AimSafeCardID")), ct)
                      ?? await ResolveLinkAsync(4, null, I(F(line, "AimSafeCardID")), ct);
            }

            if (acc is int a)
            {
                var key = line.Keys.FirstOrDefault(k => k.Equals("AccountCardID", StringComparison.OrdinalIgnoreCase)) ?? "AccountCardID";
                line[key] = a;
            }
        }
    }

    private async Task<decimal> BalanceAsync(int safeCardId, int? excludeVoucherId, CancellationToken ct)
    {
        // Giriş: tip 1,4 veya virman hedefi · Çıkış: tip 2,3,5,6 (kaynak kasa)
        var bal = await _db.ExecuteScalarAsync<decimal?>(new CommandDefinition(
            @"SELECT ISNULL(SUM(
    CASE
      WHEN (sv.SafeCardID = @id AND sv.Type_ IN (1, 4)) OR (sv.Type_ = 6 AND st.AimSafeCardID = @id)
        THEN ABS(ISNULL(st.Amount, 0))
      WHEN sv.SafeCardID = @id AND sv.Type_ IN (2, 3, 5, 6)
        THEN -ABS(ISNULL(st.Amount, 0))
      ELSE 0
    END), 0)
FROM dbo.SafeTrans st
JOIN dbo.SafeVoucher sv ON sv.SafeVoucherID = st.SafeVoucherID
WHERE ISNULL(sv.Status_, 0) <> 2
  AND (@ex IS NULL OR sv.SafeVoucherID <> @ex)
  AND (sv.SafeCardID = @id OR (sv.Type_ = 6 AND st.AimSafeCardID = @id))",
            new { id = safeCardId, ex = excludeVoucherId }, cancellationToken: ct));
        return bal ?? 0;
    }

    private async Task<int?> ResolveLinkAsync(int module, int? type, int? sourceCardId, CancellationToken ct)
    {
        if (sourceCardId is null or <= 0 && module != 6) { /* öndeğer -1 yine de bakılabilir */ }
        var raw = await _db.QueryAsync<int>(new CommandDefinition(
            @"SELECT AccountID FROM dbo.AccountLinkDetail
WHERE Module = @module AND (@type IS NULL OR Type = @type) AND SourceCardID IN (@src, -1)
  AND AccountID IS NOT NULL AND AccountID <> 0
ORDER BY CASE WHEN SourceCardID = @src THEN 0 ELSE 1 END, AccountLinkDetailID",
            new { module, type, src = sourceCardId ?? -1 }, cancellationToken: ct));
        foreach (var acc in raw)
        {
            var id = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                @"SELECT TOP 1 AccountCardID FROM dbo.AccountCard
WHERE AccountCardID = @acc OR Code = CAST(@acc AS nvarchar(50))
ORDER BY CASE WHEN AccountCardID = @acc THEN 0 ELSE 1 END",
                new { acc }, cancellationToken: ct));
            if (id is int found) return found;
        }
        return null;
    }
}
