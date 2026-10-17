using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

public sealed class SystemInfoDto
{
    public string DateFormat { get; set; } = "dd.MM.yyyy";
    public string Culture { get; set; } = "tr-TR";
    /** setting | os */
    public string DateFormatSource { get; set; } = "os";
}

/// <summary>
/// Uygulama ilk girişte sistem bilgilerini (tarih formatı vb.) alır.
/// </summary>
[ApiController]
[Route("api/system")]
public sealed class SystemController : ControllerBase
{
    private readonly IDbConnection _db;

    public SystemController(IDbConnection db)
    {
        _db = db;
    }

    /// <summary>Tarih biçimi — giriş ekranından önce okunur (yetkisiz)</summary>
    [AllowAnonymous]
    [HttpGet("info")]
    public async Task<ActionResult<SystemInfoDto>> Info(CancellationToken ct)
    {
        var culture = CultureInfo.CurrentCulture;
        var osPattern = culture.DateTimeFormat.ShortDatePattern;
        var fromSetting = await TryGetSettingDateFormatAsync(ct);

        var raw = !string.IsNullOrWhiteSpace(fromSetting) ? fromSetting! : osPattern;
        var normalized = NormalizeDateFormat(raw);

        return Ok(new SystemInfoDto
        {
            DateFormat = normalized,
            Culture = culture.Name,
            DateFormatSource = !string.IsNullOrWhiteSpace(fromSetting) ? "setting" : "os",
        });
    }

    private async Task<string?> TryGetSettingDateFormatAsync(CancellationToken ct)
    {
        try
        {
            var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"SELECT CASE WHEN OBJECT_ID(N'dbo.Setting', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct));
            if (exists == 0) return null;

            var val = await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
                @"SELECT TOP 1 Value FROM dbo.Setting
                  WHERE Code = N'DateFormat' AND NULLIF(LTRIM(RTRIM(Value)), N'') IS NOT NULL",
                cancellationToken: ct));
            return string.IsNullOrWhiteSpace(val) ? null : val.Trim();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// d.MM.yyyy / dd.MM.yyyy / M/d/yyyy → tutarlı token'lı format (dd.MM.yyyy vb.)
    /// </summary>
    internal static string NormalizeDateFormat(string pattern)
    {
        var p = (pattern ?? "").Trim();
        if (string.IsNullOrEmpty(p)) return "dd.MM.yyyy";

        // Ayırıcı: ilk nokta noktalı virgül / - karakteri
        var sepMatch = Regex.Match(p, @"[^dMy]");
        var sep = sepMatch.Success ? sepMatch.Value[0].ToString() : ".";
        if (sep is not ("." or "/" or "-")) sep = ".";

        var tokens = Regex.Split(p, @"[^dMy]+")
            .Where(t => !string.IsNullOrEmpty(t))
            .Select(t => t[0] switch
            {
                'd' or 'D' => "dd",
                'M' => "MM",
                'y' or 'Y' => "yyyy",
                _ => "",
            })
            .Where(t => t.Length > 0)
            .Distinct()
            .ToList();

        if (tokens.Count != 3
            || !tokens.Contains("dd")
            || !tokens.Contains("MM")
            || !tokens.Contains("yyyy"))
        {
            return "dd.MM.yyyy";
        }

        return string.Join(sep, tokens);
    }
}
