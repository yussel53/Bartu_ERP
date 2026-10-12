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

    /// <summary>Excel (.xlsx) veya CSV dosyasını başlık + satır olarak döner; kayıt yapmaz.</summary>
    [HttpPost("parse")]
    [RequestSizeLimit(30_000_000)]
    public IActionResult Parse(IFormFile? file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { message = "Dosya seçilmedi" });
        try
        {
            using var s = file.OpenReadStream();
            var data = SpreadsheetReader.Read(s, file.FileName);
            if (data.Headers.Count == 0) return BadRequest(new { message = "Dosyada başlık satırı bulunamadı" });
            return Ok(new
            {
                fileName = file.FileName,
                data.SheetName,
                data.Headers,
                data.Rows,
                truncated = data.Rows.Count >= SpreadsheetReader.MaxRows,
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
    public IActionResult Template(string kind)
    {
        var def = ImportRepository.GetTarget(kind);
        if (def == null) return NotFound(new { message = $"Bilinmeyen tür: {kind}" });
        var headers = def.Fields.Select(f => f.Label).ToList();
        var sample = def.Fields.Select(f => f.Sample).ToList();
        var bytes = SpreadsheetWriter.Write(def.Title.Length > 31 ? def.Title[..31] : def.Title, headers, new[] { sample });
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"{def.TableName}_sablon.xlsx");
    }

    /// <summary>Eşlenmiş satırları doğrular (dryRun) veya kaydeder.</summary>
    [HttpPost("{kind}/apply")]
    [RequestSizeLimit(60_000_000)]
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
