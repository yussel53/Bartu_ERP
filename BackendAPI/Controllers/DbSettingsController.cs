using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

public sealed class DbSettingsDto
{
    public bool Configured { get; set; }
    public string Server { get; set; } = "";
    public string Database { get; set; } = "";
    public bool TrustedConnection { get; set; } = true;
    public string? UserId { get; set; }
    public string? Password { get; set; }
    public bool TrustServerCertificate { get; set; } = true;
    public bool PasswordSet { get; set; }
}

public sealed class DbSettingsStatusDto
{
    public bool NeedsSetup { get; set; }
    public bool Configured { get; set; }
    public bool CanConnect { get; set; }
    public string? Message { get; set; }
    public string? Server { get; set; }
    public string? Database { get; set; }
}

[ApiController]
[Route("api/db-settings")]
[AllowAnonymous]
[SetupOrAdmin]
public sealed class DbSettingsController : ControllerBase
{
    private readonly DbConnectionStore _store;

    public DbSettingsController(DbConnectionStore store)
    {
        _store = store;
    }

    [SkipSetupCheck]
    [HttpGet("status")]
    public async Task<ActionResult<DbSettingsStatusDto>> Status(CancellationToken ct)
    {
        var s = _store.GetSettings();
        var configured = _store.IsConfigured();
        var (ok, msg, dbExists) = configured
            ? await _store.TestDetailedAsync(ct: ct)
            : (false, "SQL bağlantı bilgileri tanımlı değil", false);

        return Ok(new DbSettingsStatusDto
        {
            Configured = configured,
            CanConnect = ok && dbExists,
            NeedsSetup = !configured || (configured && !dbExists),
            Message = msg,
            Server = string.IsNullOrWhiteSpace(s.Server) ? null : s.Server,
            Database = string.IsNullOrWhiteSpace(s.Database) ? null : s.Database,
        });
    }

    [HttpGet]
    public ActionResult<DbSettingsDto> Get()
    {
        var s = _store.GetSettings();
        return Ok(ToDto(s));
    }

    [HttpPost("test")]
    public async Task<ActionResult<object>> Test([FromBody] DbSettingsDto dto, CancellationToken ct)
    {
        var settings = FromDto(dto, _store.GetSettings());
        var (ok, msg, dbExists) = await _store.TestDetailedAsync(settings, ct);
        return Ok(new { success = ok, message = msg, databaseExists = dbExists });
    }

    [HttpPost]
    public async Task<ActionResult<object>> Save([FromBody] DbSettingsDto dto, CancellationToken ct)
    {
        var current = _store.GetSettings();
        var settings = FromDto(dto, current);

        if (!settings.HasMinimumInfo())
        {
            return BadRequest(new { message = "Sunucu ve veritabanı zorunlu. SQL Auth için kullanıcı adı gerekli." });
        }

        var (ok, msg, dbExists) = await _store.TestDetailedAsync(settings, ct);
        if (!ok)
        {
            return BadRequest(new { message = $"Bağlantı başarısız: {msg}" });
        }

        _store.Save(settings);
        return Ok(new
        {
            success = true,
            message = dbExists
                ? "Bağlantı kaydedildi"
                : "Bağlantı kaydedildi — veritabanı henüz yok, Sıfırdan Oluştur ile yaratın",
            databaseExists = dbExists,
            settings = ToDto(_store.GetSettings()),
        });
    }

    private static DbSettingsDto ToDto(DbConnectionSettings s) => new()
    {
        Configured = s.Configured,
        Server = s.Server,
        Database = s.Database,
        TrustedConnection = s.TrustedConnection,
        UserId = s.UserId,
        Password = null,
        TrustServerCertificate = s.TrustServerCertificate,
        PasswordSet = !string.IsNullOrEmpty(s.Password),
    };

    private static DbConnectionSettings FromDto(DbSettingsDto dto, DbConnectionSettings current)
    {
        var password = dto.Password;
        if (string.IsNullOrEmpty(password) && !string.IsNullOrEmpty(current.Password))
            password = current.Password;

        return new DbConnectionSettings
        {
            Configured = true,
            Server = dto.Server?.Trim() ?? "",
            Database = dto.Database?.Trim() ?? "",
            TrustedConnection = dto.TrustedConnection,
            UserId = dto.TrustedConnection ? null : dto.UserId?.Trim(),
            Password = dto.TrustedConnection ? null : password,
            TrustServerCertificate = dto.TrustServerCertificate,
        };
    }
}
