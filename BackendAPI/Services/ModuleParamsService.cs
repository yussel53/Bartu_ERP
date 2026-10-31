using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class ModuleParamItem
{
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Value { get; set; } = "";
}

/// <summary>Setting satırları — ModuleKey = kasa | fatura | stok | cari …</summary>
public sealed class ModuleParamsService
{
    private readonly IDbConnection _db;

    public ModuleParamsService(IDbConnection db)
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

    public async Task<string> GetOrAsync(string code, string def) =>
        string.IsNullOrWhiteSpace(await GetAsync(code)) ? def : (await GetAsync(code))!;

    public async Task<IReadOnlyList<ModuleParamItem>> ListAsync(string moduleKey)
    {
        Open();
        var key = (moduleKey ?? "").Trim().ToLowerInvariant();
        var prefix = key switch
        {
            "kasa" => "KASA_%",
            "fatura" => "FAT_%",
            "stok" => "STK_%",
            "cari" => "CAR_%",
            _ => key.ToUpperInvariant() + "_%",
        };
        // fatura: PUR_ / SAL_ / ORD_ da dahil
        if (key == "fatura")
        {
            return (await _db.QueryAsync<ModuleParamItem>(
                @"SELECT Code, Title, Value FROM dbo.Setting
WHERE ModuleKey = N'fatura' OR Code LIKE N'FAT_%' OR Code LIKE N'PUR_%' OR Code LIKE N'SAL_%' OR Code LIKE N'ORD_%'
ORDER BY SettingID")).ToList();
        }
        return (await _db.QueryAsync<ModuleParamItem>(
            @"SELECT Code, Title, Value FROM dbo.Setting
WHERE ModuleKey = @key OR Code LIKE @prefix
ORDER BY SettingID",
            new { key, prefix })).ToList();
    }

    public async Task SaveAsync(string moduleKey, IEnumerable<ModuleParamItem> items)
    {
        Open();
        var key = (moduleKey ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) key = "genel";
        foreach (var it in items)
        {
            if (string.IsNullOrWhiteSpace(it.Code)) continue;
            var n = await _db.ExecuteAsync(
                "UPDATE dbo.Setting SET Value = @Value, Title = COALESCE(NULLIF(@Title, N''), Title), ModuleKey = @key WHERE Code = @Code",
                new { it.Code, it.Title, Value = it.Value ?? "", key });
            if (n == 0)
            {
                var id = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(SettingID), 0) + 1 FROM dbo.Setting");
                await _db.ExecuteAsync(
                    "INSERT INTO dbo.Setting (SettingID, Code, Title, Value, ModuleKey) VALUES (@id, @Code, @Title, @Value, @key)",
                    new
                    {
                        id,
                        it.Code,
                        Title = string.IsNullOrWhiteSpace(it.Title) ? it.Code : it.Title,
                        Value = it.Value ?? "",
                        key,
                    });
            }
        }
    }

    /// <summary>
    /// STK_KDV_* öndeğer oranına göre TaxCard bul (kod/başlıkta oran; örn. 20 → KDV20).
    /// Malzeme kartı öndeğeri / yeni kart TaxCardID için.
    /// </summary>
    public async Task<(int? TaxCardId, string? Rate)> ResolveTaxCardForSettingAsync(string settingCode)
    {
        Open();
        var raw = await GetAsync(settingCode) ?? "20";
        var rate = new string(raw.Where(c => char.IsDigit(c) || c == '.' || c == ',').ToArray())
            .Replace(',', '.');
        if (string.IsNullOrWhiteSpace(rate)) rate = "20";
        var rateInt = rate.Contains('.') ? rate.TrimEnd('0').TrimEnd('.') : rate;

        var id = await _db.ExecuteScalarAsync<int?>(
            @"SELECT TOP 1 TaxCardID FROM dbo.TaxCard
WHERE ISNULL(IsActive, 1) = 1
  AND (
    Code = N'KDV' + @r
    OR Code = @r
    OR Code LIKE N'%' + @r
    OR Title LIKE N'%' + @r + N'%'
  )
ORDER BY CASE
  WHEN Code = N'KDV' + @r THEN 0
  WHEN Code = @r THEN 1
  WHEN Code LIKE N'KDV%' + @r THEN 2
  ELSE 3 END, TaxCardID",
            new { r = rateInt });
        return (id, rateInt);
    }
}
