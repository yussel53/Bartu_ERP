using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
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
    private readonly DataScopeService _scope;
    private readonly NumberTemplateRepository _numbers;
    private readonly StockService _stock;
    private readonly AccountingPostService _accounting;
    private readonly RiskService _risk;
    private readonly AuditService _audit;

    public RecordsController(
        RecordsRepository repo,
        PostSaveRepository postSave,
        ProcessRepository process,
        CustomerKindRepository customerKind,
        BarcodeRepository barcodes,
        DataScopeService scope,
        NumberTemplateRepository numbers,
        StockService stock,
        AccountingPostService accounting,
        RiskService risk,
        AuditService audit)
    {
        _audit = audit;
        _stock = stock;
        _accounting = accounting;
        _risk = risk;
        _scope = scope;
        _numbers = numbers;
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
        [FromQuery] int skip = 0,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        try
        {
            // Y-15: sunucu tarafı sayfalama (skip) ve arama (search); Total süzme öncesi toplam kayıt sayısıdır
            var result = await _repo.ListAsync(tableName, pk, filterColumn, filterValue, take, ct, includeTemplates, skip, search);
            // Y-02: yetki kodu + firma / işyeri / ambar süzmesi sunucuda
            var scope = await _scope.GetAsync(ct);
            if (!scope.Unrestricted)
            {
                var before = result.Rows.Count;
                result.Rows = result.Rows.Where(r => _scope.CanSee(scope, tableName, r)).ToList();
                result.Total = Math.Max(0, result.Total - (before - result.Rows.Count));
            }
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
            if (!_scope.CanSee(await _scope.GetAsync(ct), tableName, row.StandardFields))
                return StatusCode(403, new { message = "Bu kayda yetkiniz yok." });
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

    /// <summary>Kullanıcı / rol / yetki / firma (entegratör şifresi) kartları: kayıt ve silme yalnız yönetici</summary>
    private static readonly HashSet<string> AdminOnlyTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "SystemUser", "SYS_Users", "SYS_Role", "SYS_UserRole", "SYS_UserAuthCode", "SYS_UserOrgAuth",
        "SYS_Companies", "SYS_Workplace", "SYS_SqlReportAuth", "SYS_SqlReportRoleAuth", "SYS_DbUpdates",
    };

    /// <summary>Kullanıcı kartında girilen şifre özetlenerek saklanır (düz metin asla yazılmaz); kilit açılır</summary>
    private static string? HashUserPassword(Dictionary<string, object?> fields)
    {
        var key = fields.Keys.FirstOrDefault(k => k.Equals("Password", StringComparison.OrdinalIgnoreCase));
        var value = key == null ? null : Convert.ToString(fields[key]);
        if (key == null || string.IsNullOrEmpty(value) || AuthService.IsHashed(value)) return null;
        if (AuthService.PasswordPolicyError(value) is { } err) return err;
        fields[key] = AuthService.HashPassword(value);
        fields["PasswordChangedAt"] = DateTime.Now;
        fields["FailedLoginCount"] = 0;
        fields["LockedUntil"] = null;
        return null;
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
            if (AdminOnlyTables.Contains(tableName) && !User.IsAdmin())
                return StatusCode(403, new { success = false, message = "Bu kartı yalnızca yönetici değiştirebilir." });
            if (tableName.Equals("SystemUser", StringComparison.OrdinalIgnoreCase) && body.StandardFields != null
                && HashUserPassword(body.StandardFields) is { } pwdError)
                return BadRequest(new { success = false, message = pwdError });

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

            // Y-02: yetkisiz kaydı değiştiremez; yeni / değişen kayıt da kullanıcının kapsamında olmalı
            var dataScope = await _scope.GetAsync(ct);
            if (!dataScope.Unrestricted)
            {
                if (body.RecordId > 0 && await _repo.GetAsync(tableName, pk, body.RecordId, ct) is { } existing
                    && !_scope.CanSee(dataScope, tableName, existing.StandardFields))
                    return StatusCode(403, new { success = false, message = "Bu kayda yetkiniz yok." });
                if (body.StandardFields != null && !_scope.CanSee(dataScope, tableName, body.StandardFields))
                    return StatusCode(403, new { success = false, message = "Kayıt yetki kodu / firma / işyeri / ambar kapsamınızın dışında." });
            }

            // Y-06: eksi stok kontrolü (Setting STK_NEG_CTRL: 0 izin · 1 uyar · 2 engelle) — malzeme fişi / irsaliye çıkışları
            string? stockWarning = null;
            if (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase) && body.Lines is { Count: > 0 } && body.StandardFields != null)
            {
                static int? IntOf(object? v) => int.TryParse(Convert.ToString(v), out var i) && i > 0 ? i : null;
                var vtRaw = body.StandardFields.FirstOrDefault(kv => kv.Key.Equals("VoucherType", StringComparison.OrdinalIgnoreCase)).Value;
                var whRaw = body.StandardFields.FirstOrDefault(kv => kv.Key.Equals("WhouseID", StringComparison.OrdinalIgnoreCase)).Value;
                if (IntOf(vtRaw) is int vt)
                {
                    var (mode, problems) = await _stock.CheckNegativeAsync(body.RecordId, vt, IntOf(whRaw), body.Lines, ct);
                    if (problems.Count > 0 && mode == "2")
                        return BadRequest(new { success = false, message = "Eksi stok — kayıt engellendi: " + string.Join(" · ", problems) });
                    if (problems.Count > 0) stockWarning = "Eksi stok uyarısı: " + string.Join(" · ", problems);
                }
            }

            // Y-12: risk limiti (satış siparişi / irsaliyesi / faturası) — 1 uyar · 2 yönetici onayı · 3 engelle
            string? riskWarning = null;
            if (body.StandardFields != null)
            {
                var risk = await _risk.CheckAsync(tableName, body.RecordId, body.StandardFields, body.Lines, ct);
                if (risk.Action == 3)
                    return BadRequest(new { success = false, message = risk.Message + " Kayıt engellendi." });
                if (risk.Action == 2 && !(body.RiskApproved && User.IsAdmin()))
                    return StatusCode(409, new
                    {
                        success = false,
                        riskApprovalRequired = true,
                        canApprove = User.IsAdmin(),
                        message = risk.Message + (User.IsAdmin() ? " Onaylayarak kaydedebilirsiniz." : " Yönetici onayı gerekir."),
                    });
                if (risk.Action is 1 or 2) riskWarning = risk.Message + (risk.Action == 2 ? " (yönetici onayıyla)" : "");
            }

            // Y-05: yeni fişte numara kayıtta verilir (açılıp vazgeçilen fiş sayaç tüketmez); elle yazılmışsa dokunulmaz
            string? autoNumber = null;
            if (body.RecordId == 0 && body.AutoNumber is { Field.Length: > 0 } an && body.StandardFields != null)
            {
                var cur = body.StandardFields.FirstOrDefault(kv => kv.Key.Equals(an.Field, StringComparison.OrdinalIgnoreCase));
                if (string.IsNullOrWhiteSpace(Convert.ToString(cur.Value)))
                {
                    an.Request.Peek = false;
                    var alloc = await _numbers.AllocateAsync(an.Request, ct);
                    if (!alloc.Success || string.IsNullOrEmpty(alloc.Number))
                        return BadRequest(new { success = false, message = "Fiş numarası alınamadı: " + alloc.Message });
                    body.StandardFields[cur.Key ?? an.Field] = alloc.Number;
                    autoNumber = alloc.Number;
                }
            }

            // Y-15: değişiklik geçmişi için kaydın önceki hali
            var auditBefore = body.RecordId > 0 ? await _repo.GetAsync(tableName, pk, body.RecordId, ct) : null;
            var (ok, id, message) = await _repo.SaveAsync(tableName, pk, body, ct);
            // Veritabanı tetikleyicisi (TR_ProductBarcode_Unique, hata 51077) — eşzamanlı kayıtta son güvence
            if (!ok && message != null && message.Contains("TR_ProductBarcode_Unique", StringComparison.OrdinalIgnoreCase))
                message = "Barkod benzersiz olmalı — girilen barkod başka bir malzemede kayıtlı.";
            if (!ok) return BadRequest(new { success = false, message, recordId = id });
            await _audit.LogAsync(tableName, id, body.RecordId > 0 ? 'U' : 'I', auditBefore, await _repo.GetAsync(tableName, pk, id, ct), User.UserId(), User.Identity?.Name);

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

            // Y-09: fatura / kasa fişi → muhasebe fişi (ACC_AUTO_POST «Otomatik Mahsup» = 1; bağlantı eksikse kayıt yapılır, uyarı döner)
            string? accountingWarning = null;
            if (tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase) || tableName.Equals("SafeVoucher", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    if (await _accounting.AutoPostEnabledAsync())
                    {
                        var acc = await _accounting.PostAsync(tableName, id, ct);
                        if (!acc.Success) accountingWarning = "Muhasebeleştirilmedi: " + acc.Message;
                    }
                }
                catch (Exception ex)
                {
                    accountingWarning = "Muhasebeleştirilmedi: " + ex.Message;
                }
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
                message = string.Join(" · ", new[] { message, autoNumber != null ? $"Fiş no: {autoNumber}" : null, stockWarning, riskWarning, accountingWarning }
                    .Where(x => !string.IsNullOrEmpty(x))),
                recordId = id,
                autoNumber,
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
            if (AdminOnlyTables.Contains(tableName) && !User.IsAdmin())
                return StatusCode(403, new { success = false, message = "Bu kartı yalnızca yönetici silebilir." });
            var toDelete = await _repo.GetAsync(tableName, pk, id, ct);
            if (toDelete != null && !_scope.CanSee(await _scope.GetAsync(ct), tableName, toDelete.StandardFields))
                return StatusCode(403, new { success = false, message = "Bu kayda yetkiniz yok." });
            // Y-09: belgenin muhasebe fişi de silinir (yevmiye numarası almışsa belge silinmez)
            if (tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase) || tableName.Equals("SafeVoucher", StringComparison.OrdinalIgnoreCase))
            {
                var locked = await _accounting.UnpostAsync(tableName, id);
                if (locked != null) return BadRequest(new { success = false, message = locked });
            }
            var (ok, message) = await _repo.DeleteAsync(tableName, pk, id, ct);
            if (!ok) return BadRequest(new { success = false, message });
            await _audit.LogAsync(tableName, id, 'D', toDelete, null, User.UserId(), User.Identity?.Name);
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
