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
    private readonly IDbConnection _db;

    public ImportController(ImportRepository repo, IDbConnection db)
    {
        _repo = repo;
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
    public IActionResult Parse(IFormFile? file)
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

    [HttpGet("{kind}/template")]
    public IActionResult Template(string kind, [FromQuery] string? source)
    {
        var def = ImportRepository.GetTarget(kind);
        if (def == null) return NotFound(new { message = $"Bilinmeyen tür: {kind}" });
        var profile = ImportSources.Find(source) ?? ImportSources.All[0];
        var headers = def.Fields.Select(f => ImportSources.Header(profile, def.Kind, f)).ToList();
        var sample = def.Fields.Select(f => f.Sample).ToList();
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
            return Ok(await _repo.ApplyAsync(kind, req, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] int take = 30, CancellationToken ct = default)
    {
        try
        {
            if (_db.State != ConnectionState.Open) _db.Open();
            var exists = await _db.ExecuteScalarAsync<int?>("SELECT OBJECT_ID(N'dbo.SYS_ImportLog', N'U')");
            if (exists is null) return Ok(Array.Empty<object>());
            var rows = await _db.QueryAsync(new CommandDefinition(
                @"SELECT TOP (@take) ImportLogID, Kind, TableName, FileName, Mode, TotalRows, Inserted, Updated,
                         Skipped, Failed, ImportedBy, ImportedAt
                  FROM dbo.SYS_ImportLog ORDER BY ImportLogID DESC",
                new { take = Math.Clamp(take, 1, 200) }, cancellationToken: ct));
            return Ok(rows);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
