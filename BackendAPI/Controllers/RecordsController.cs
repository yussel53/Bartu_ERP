using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/records")]
public sealed class RecordsController : ControllerBase
{
    private static readonly HashSet<string> VoucherTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "OrderVoucher", "ProductVoucher", "Invoice", "CustomerVoucher",
        "BankVoucher", "AccountVoucher", "BoundTrans"
    };

    private static readonly HashSet<string> CardTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "ProductCard", "CustomerCard", "BankCard", "SafeCard",
        "PersonCard", "AccountCard", "BankAccountCard"
    };

    private readonly RecordsRepository _repo;
    private readonly PostSaveRepository _postSave;
    private readonly ProcessRepository _process;
    private readonly CustomerKindRepository _customerKind;
    private readonly BarcodeRepository _barcodes;

    public RecordsController(
        RecordsRepository repo,
        PostSaveRepository postSave,
        ProcessRepository process,
        CustomerKindRepository customerKind,
        BarcodeRepository barcodes)
    {
        _repo = repo;
        _postSave = postSave;
        _process = process;
        _customerKind = customerKind;
        _barcodes = barcodes;
    }

    [HttpGet("{tableName}")]
    public async Task<ActionResult<RecordListResult>> List(
        string tableName,
        [FromQuery] string? pk = null,
        [FromQuery] string? filterColumn = null,
        [FromQuery] string? filterValue = null,
        [FromQuery] int take = 500,
        [FromQuery] bool includeTemplates = false,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _repo.ListAsync(tableName, pk, filterColumn, filterValue, take, ct, includeTemplates);
            if (!string.IsNullOrEmpty(result.Warning) && result.Rows.Count == 0 && result.Total == 0
                && result.Warning.StartsWith("Tablo", StringComparison.OrdinalIgnoreCase))
            {
                return NotFound(result);
            }
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{tableName}/{id:int}")]
    public async Task<ActionResult<RecordGetResult>> Get(
        string tableName,
        int id,
        [FromQuery] string? pk = null,
        CancellationToken ct = default)
    {
        try
        {
            var row = await _repo.GetAsync(tableName, pk, id, ct);
            if (row == null) return NotFound(new { message = "Kayıt bulunamadı" });
            return Ok(row);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{tableName}")]
    public async Task<IActionResult> Save(
        string tableName,
        [FromBody] RecordSaveRequest body,
        [FromQuery] string? pk = null,
        CancellationToken ct = default)
    {
        try
        {
            // Malzeme barkodu benzersizdir (SqlUpdates/77) — kayıttan önce anlaşılır mesajla reddet
            var barcodeRows = tableName.Equals("ProductCard", StringComparison.OrdinalIgnoreCase)
                ? body.Barcodes
                : tableName.Equals("ProductBarcode", StringComparison.OrdinalIgnoreCase) && body.StandardFields != null
                    ? new List<Dictionary<string, object?>> { body.StandardFields }
                    : null;
            if (barcodeRows is { Count: > 0 })
            {
                var productId = tableName.Equals("ProductCard", StringComparison.OrdinalIgnoreCase)
                    ? body.RecordId
                    : int.TryParse(Convert.ToString(body.StandardFields!.FirstOrDefault(kv =>
                        kv.Key.Equals("ProductCardID", StringComparison.OrdinalIgnoreCase)).Value), out var pcid) ? pcid : 0;
                var conflicts = await _barcodes.ValidateAsync(productId, barcodeRows);
                if (conflicts.Count > 0)
                    return BadRequest(new { success = false, message = BarcodeRepository.Describe(conflicts), barcodeConflicts = conflicts });
            }

            var (ok, id, message) = await _repo.SaveAsync(tableName, pk, body, ct);
            // Veritabanı tetikleyicisi (TR_ProductBarcode_Unique, hata 51077) — eşzamanlı kayıtta son güvence
            if (!ok && message != null && message.Contains("TR_ProductBarcode_Unique", StringComparison.OrdinalIgnoreCase))
                message = "Barkod benzersiz olmalı — girilen barkod başka bir malzemede kayıtlı.";
            if (!ok) return BadRequest(new { success = false, message, recordId = id });

            var actions = new List<PostSaveActionDto>();
            if (!string.IsNullOrWhiteSpace(body.FormCode))
                actions.AddRange(await _postSave.LoadFromDbAsync(body.FormCode, ct));
            if (body.PostSave != null)
                actions.AddRange(body.PostSave);

            List<PostSaveRunResult>? postResults = null;
            if (actions.Count > 0)
            {
                var fields = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                if (body.StandardFields != null)
                {
                    foreach (var kv in body.StandardFields)
                        fields[kv.Key] = kv.Value;
                }
                fields["recId"] = id;
                postResults = await _postSave.RunAsync(actions, id, fields, ct);
                var failed = postResults.FirstOrDefault(r => !r.Success);
                if (failed != null)
                {
                    return Ok(new
                    {
                        success = true,
                        message = $"{message} · PostSave hata: {failed.Message}",
                        recordId = id,
                        postSave = postResults,
                        postSaveOk = false,
                    });
                }
            }

            // Satış belgesi → müşteri cariye döner (hata kaydı bozmaz)
            bool customerPromoted = false;
            try
            {
                customerPromoted = await _customerKind.PromoteOnSaleAsync(tableName, id, ct);
            }
            catch
            {
                /* dönüşüm kayıt kaydını etkilemez */
            }

            // Onay Tanımları: fiş / kart kaydı tetikleyicileri (hata kaydı bozmaz)
            int processStarted = 0;
            try
            {
                processStarted = await TryStartProcessOnSaveAsync(tableName, id, body, ct);
            }
            catch
            {
                /* süreç başlatma kayıt kaydını etkilemez */
            }

            return Ok(new
            {
                success = true,
                message,
                recordId = id,
                postSave = postResults,
                postSaveOk = true,
                processStarted,
                customerPromoted,
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    private async Task<int> TryStartProcessOnSaveAsync(
        string tableName,
        int id,
        RecordSaveRequest body,
        CancellationToken ct)
    {
        if (id <= 0 || string.IsNullOrWhiteSpace(tableName)) return 0;

        byte? trigger = null;
        if (VoucherTables.Contains(tableName)) trigger = 2; // OnVoucherSave
        else if (CardTables.Contains(tableName)) trigger = 5; // OnCardSave
        if (trigger is null) return 0;

        var ctx = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(body.FormCode))
            ctx["formCode"] = body.FormCode;

        string? typeVal = null;
        if (body.StandardFields != null)
        {
            foreach (var key in new[] { "Type_", "VoucherType", "InvoiceType", "ProductType" })
            {
                var hit = body.StandardFields.FirstOrDefault(kv =>
                    kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrEmpty(hit.Key) && hit.Value is not null)
                {
                    typeVal = hit.Value.ToString();
                    ctx["typeFilter"] = typeVal;
                    break;
                }
            }
        }

        var started = await _process.StartByTriggerAsync(new ProcessTriggerStartRequest
        {
            TriggerType = trigger.Value,
            SourceTable = tableName,
            SourceId = id,
            Title = null,
            StartedBy = null,
            Context = ctx
        }, ct);
        return started.Count;
    }

    [HttpPost("{tableName}/{id:int}/post-save")]
    public async Task<IActionResult> RunPostSave(
        string tableName,
        int id,
        [FromBody] RecordSaveRequest body,
        [FromQuery] string? pk = null,
        CancellationToken ct = default)
    {
        try
        {
            var actions = new List<PostSaveActionDto>();
            if (!string.IsNullOrWhiteSpace(body.FormCode))
                actions.AddRange(await _postSave.LoadFromDbAsync(body.FormCode, ct));
            if (body.PostSave != null)
                actions.AddRange(body.PostSave);

            var fields = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            if (body.StandardFields != null)
            {
                foreach (var kv in body.StandardFields)
                    fields[kv.Key] = kv.Value;
            }

            var row = await _repo.GetAsync(tableName, pk, id, ct);
            if (row != null)
            {
                foreach (var kv in row.StandardFields)
                    fields[kv.Key] = kv.Value;
            }

            var results = await _postSave.RunAsync(actions, id, fields, ct);
            return Ok(new { success = results.All(r => r.Success), recordId = id, postSave = results });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpDelete("{tableName}/{id:int}")]
    public async Task<IActionResult> Delete(
        string tableName,
        int id,
        [FromQuery] string? pk = null,
        CancellationToken ct = default)
    {
        try
        {
            var (ok, message) = await _repo.DeleteAsync(tableName, pk, id, ct);
            if (!ok) return BadRequest(new { success = false, message });
            return Ok(new { success = true, message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }
}
