using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using System.Data;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/import")]
public sealed class ImportController : ControllerBase
{
    private readonly ImportRepository _repo;
    private readonly ImportProfileService _profiles;
    private readonly IDbConnection _db;

    public ImportController(ImportRepository repo, ImportProfileService profiles, IDbConnection db)
    {
        _repo = repo;
        _profiles = profiles;
        _db = db;
    }

    [HttpGet("targets")]
    public IActionResult Targets() => Ok(ImportRepository.Targets);

    [HttpGet("sources")]
    public IActionResult Sources() => Ok(ImportSources.All);

    /// <summary>Excel (.xlsx) veya CSV dosyasını başlık + satır olarak döner; kayıt yapmaz.</summary>
    [HttpPost("parse")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    public IActionResult Parse(IFormFile? file, [FromQuery] string? kind)
    {
        if (file == null || file.Length == 0) return BadRequest(new { message = "Dosya seçilmedi" });
        try
        {
            using var s = file.OpenReadStream();
            using var ms = new MemoryStream();
            s.CopyTo(ms);
            var bytes = ms.ToArray();
            SpreadsheetData data;
            if (YevmiyeReader.TryRead(bytes, file.FileName, out var yevmiye, out var yerr))
            {
                if (!string.Equals(kind, "account-voucher", StringComparison.OrdinalIgnoreCase))
                    return BadRequest(new { message = "e-Defter yevmiye yalnız Muhasebe Fişi aktarımında kullanılır." });
                if (yerr != null) return BadRequest(new { message = yerr });
                data = yevmiye!;
            }
            else
            {
                data = SpreadsheetReader.Read(new MemoryStream(bytes), file.FileName);
            }
            if (data.Headers.Count == 0) return BadRequest(new { message = "Dosyada başlık satırı bulunamadı" });
            return Ok(new
            {
                fileName = file.FileName,
                data.SheetName,
                data.Headers,
                data.Rows,
                truncated = false,
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Dosya okunamadı: {ex.Message}" });
        }
    }

    [HttpGet("{kind}/fields")]
    public async Task<IActionResult> Fields(string kind, CancellationToken ct)
    {
        if (ImportRepository.GetTarget(kind) == null) return NotFound(new { message = $"Bilinmeyen tür: {kind}" });
        try
        {
            return Ok(await _repo.CatalogAsync(kind, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("profiles")]
    public async Task<IActionResult> Profiles(CancellationToken ct)
    {
        try { return Ok(await _profiles.ListAsync(ct)); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("profiles/{id:int}")]
    public async Task<IActionResult> Profile(int id, CancellationToken ct)
    {
        try
        {
            var dto = await _profiles.GetAsync(id, ct);
            return dto == null ? NotFound(new { message = "Aktarım yok." }) : Ok(dto);
        }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("profiles")]
    public async Task<IActionResult> SaveProfile([FromBody] ImportProfileDto dto, CancellationToken ct)
    {
        try { return Ok(await _profiles.SaveAsync(dto, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    public sealed class ImportLogFlag
    {
        public bool KeepLog { get; set; }
    }

    [HttpPost("profiles/{id:int}/log")]
    public async Task<IActionResult> SetProfileLog(int id, [FromBody] ImportLogFlag body, CancellationToken ct)
    {
        try
        {
            await _profiles.SetKeepLogAsync(id, body.KeepLog, ct);
            return Ok(new { ok = true });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpDelete("profiles/{id:int}")]
    public async Task<IActionResult> DeleteProfile(int id, CancellationToken ct)
    {
        try
        {
            await _profiles.DeleteAsync(id, ct);
            return Ok(new { ok = true });
        }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("profiles/{id:int}/run")]
    public async Task<IActionResult> RunProfile(int id, [FromQuery] bool dryRun, CancellationToken ct)
    {
        try { return Ok(await _profiles.RunAsync(id, dryRun, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("source/test")]
    public async Task<IActionResult> SourceTest([FromBody] ProcessSourceRequest req, CancellationToken ct)
    {
        try
        {
            if (req.SourceType == 0)
            {
                if (_db.State != ConnectionState.Open) _db.Open();
                await _db.ExecuteScalarAsync<int>(new CommandDefinition("SELECT 1", cancellationToken: ct));
                return Ok(new ProcessSourceTest { Ok = true, Message = "Bu veritabanına bağlanıldı." });
            }
            return Ok(await ProcessSource.TestAsync(req, ct));
        }
        catch (Exception ex)
        {
            return Ok(new ProcessSourceTest { Ok = false, Message = ex.InnerException?.Message ?? ex.Message });
        }
    }

    [HttpPost("source/columns")]
    public async Task<IActionResult> SourceColumns([FromBody] ProcessSourceRequest req, CancellationToken ct)
    {
        try { return Ok(await _profiles.ColumnsAsync(req, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("source/rows")]
    public async Task<IActionResult> SourceRows([FromBody] ProcessSourceRequest req, CancellationToken ct)
    {
        try { return Ok(await _profiles.PullAsync(req, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("{kind}/template")]
    public async Task<IActionResult> Template(string kind, [FromQuery] string? source, [FromQuery] string? fields, CancellationToken ct)
    {
        var def = ImportRepository.GetTarget(kind);
        if (def == null) return NotFound(new { message = $"Bilinmeyen tür: {kind}" });
        var profile = ImportSources.Find(source) ?? ImportSources.All[0];
        HashSet<string>? picked = null;
        if (!string.IsNullOrWhiteSpace(fields))
            picked = new HashSet<string>(fields.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), StringComparer.OrdinalIgnoreCase);
        var catalog = await _repo.CatalogAsync(kind, ct);
        var use = catalog.Where(f => f.Required || (picked == null ? f.DefaultOn : picked.Contains(f.Key))).ToList();
        var headers = use.Select(f => ImportSources.Header(profile, def.Kind, f)).ToList();
        var sample = use.Select(f => f.Sample).ToList();
        var sheet = def.Title.Length > 31 ? def.Title[..31] : def.Title;
        var bytes = SpreadsheetWriter.Write(sheet, headers, new[] { sample });
        var suffix = profile.Id == "bartu" ? "" : $"_{profile.Id}";
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"{def.TableName}{suffix}_sablon.xlsx");
    }

    /// <summary>Eşlenmiş satırları doğrular (dryRun) veya kaydeder.</summary>
    [HttpPost("{kind}/apply")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Apply(string kind, [FromBody] ImportApplyRequest req, CancellationToken ct)
    {
        if (ImportRepository.GetTarget(kind) == null) return NotFound(new { message = $"Bilinmeyen tür: {kind}" });
        if (req.Rows.Count == 0) return BadRequest(new { message = "Aktarılacak satır yok" });
        try
        {
            var result = await _repo.ApplyAsync(kind, req, ct);
            if (!req.DryRun && !string.IsNullOrWhiteSpace(req.AfterSql))
                await _profiles.MarkSourceAsync(req.Source ?? new ProcessSourceRequest(), req.AfterSql, result, req.Rows, req.SourceRows, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] int take = 30, [FromQuery] int? profileId = null, CancellationToken ct = default)
    {
        try
        {
            if (_db.State != ConnectionState.Open) _db.Open();
            var exists = await _db.ExecuteScalarAsync<int?>("SELECT OBJECT_ID(N'dbo.SYS_ImportLog', N'U')");
            if (exists is null) return Ok(Array.Empty<object>());
            var hasProfile = await _db.ExecuteScalarAsync<int?>("SELECT COL_LENGTH(N'dbo.SYS_ImportLog', N'ImportProfileID')");
            var sql = hasProfile is > 0
                ? @"SELECT TOP (@take) ImportLogID, Kind, TableName, FileName, Mode, TotalRows, Inserted, Updated,
                         Skipped, Failed, ImportedBy, ImportedAt, ImportProfileID
                  FROM dbo.SYS_ImportLog
                  WHERE @profileId IS NULL OR ImportProfileID = @profileId
                  ORDER BY ImportLogID DESC"
                : @"SELECT TOP (@take) ImportLogID, Kind, TableName, FileName, Mode, TotalRows, Inserted, Updated,
                         Skipped, Failed, ImportedBy, ImportedAt
                  FROM dbo.SYS_ImportLog ORDER BY ImportLogID DESC";
            var rows = await _db.QueryAsync(new CommandDefinition(
                sql, new { take = Math.Clamp(take, 1, 200), profileId }, cancellationToken: ct));
            return Ok(rows);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
