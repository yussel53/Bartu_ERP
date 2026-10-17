using System.Data;
using Dapper;
using BartuERP.Backend.Services;

namespace BartuERP.Backend.Repositories;

public sealed class EGovIncomingState
{
    public int EGovDocumentID { get; set; }
    public byte DocKind { get; set; }
    public byte Direction { get; set; }
    public string? DocumentNo { get; set; }
    public string? CustomerTitle { get; set; }
    public int? InvoiceID { get; set; }
    /// <summary>new · pending · approved · rejected · saved</summary>
    public string Stage { get; set; } = "new";
    public int? ApprovalInstanceID { get; set; }
    public int? PendingTaskID { get; set; }
    public int? PendingRoleId { get; set; }
    public int? PendingUserId { get; set; }
    public int? PendingGroupId { get; set; }
}

public sealed class EGovIncomingPreviewLine
{
    public int LineNo { get; set; }
    public string? SellerCode { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; }
    public string? UnitCode { get; set; }
    public decimal Price { get; set; }
    public decimal Discount { get; set; }
    public decimal LineAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    /// <summary>
    /// Fatura toplamına dahil olmayan bilgi satırı (ör. «Kartlı Ödeme Hizmetine Konu Toplam Tutar»):
    /// kayıtta varsayılan olarak dışarıda bırakılır, kullanıcı dahil edebilir.
    /// </summary>
    public bool IsInfoLine { get; set; }
    public string? InfoReason { get; set; }
    /// <summary>Malzeme–cari bağlantısından bulunan malzeme</summary>
    public int? ProductCardID { get; set; }
    public string? ProductCode { get; set; }
    public string? ProductTitle { get; set; }
}

public sealed class EGovIncomingPreview
{
    public string? InvoiceNo { get; set; }
    public string? Uuid { get; set; }
    public DateTime? IssueDate { get; set; }
    public string? ProfileId { get; set; }
    public string? TypeCode { get; set; }
    public string? Currency { get; set; }
    public string? SupplierTaxNr { get; set; }
    public string? SupplierName { get; set; }
    public int? SupplierCardID { get; set; }
    public string? SupplierCode { get; set; }
    public string? SupplierTitle { get; set; }
    public decimal LineExtensionAmount { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal PayableAmount { get; set; }
    /// <summary>Invoice.InvoiceType: 2 Alış Faturası · 3 Satış İade (gelen IADE faturası)</summary>
    public int InvoiceType { get; set; }
    /// <summary>Satırların mal/hizmet tutarı toplamı (LineExtensionAmount toplamı)</summary>
    public decimal LinesTotal { get; set; }
    /// <summary>Satır toplamı fatura toplamını tutmuyor ve bilgi satırlarıyla açıklanamıyor</summary>
    public bool TotalsMismatch { get; set; }
    public List<EGovIncomingPreviewLine> Lines { get; set; } = new();
}

public sealed class EGovIncomingSaveLine
{
    public int LineNo { get; set; }
    public int ProductCardID { get; set; }
    /// <summary>true: satır faturaya yazılmaz (bilgi satırı), eşleme gerekmez</summary>
    public bool Exclude { get; set; }
}

public sealed class EGovIncomingSaveRequest
{
    public int UserId { get; set; }
    public int? CompanyId { get; set; }
    public int? WhouseId { get; set; }
    public string? Description { get; set; }
    public List<EGovIncomingSaveLine> Lines { get; set; } = new();
}

/// <summary>
/// Gelen e-Fatura onay akışı: Gelen → Onaya Gönder → Onay Bekleyenler → Onaylananlar → ERP'ye Kaydet.
/// Onay SYS_Process* altyapısındaki EGOV_GELEN_FATURA_ONAY süreciyle yürür (SqlUpdates/76_egov_incoming_approval.sql).
/// Aşama ayrı kolonda tutulmaz: InvoiceID doluysa «saved», değilse sürecin son örneğinin durumu.
/// Satır eşlemesi ProductCustomerAlias (malzeme kartı → cari bağlantısı) üzerinden yapılır ve kayıtta oraya yazılır.
/// </summary>
public sealed class EGovIncomingRepository
{
    public const string ProcessCode = "EGOV_GELEN_FATURA_ONAY";
    public const string MissingSetupMessage =
        "Gelen e-fatura onay süreci tanımlı değil — Veritabanı Güncelleme ekranından 76_egov_incoming_approval.sql uygulayın.";

    /// <summary>
    /// EGovDocument e için onay aşaması (alias: ap, pt). Süreç tabloları yoksa kullanılmaz.
    /// groups: 78_approval_groups.sql uygulanmışsa görevin onay grubu da okunur (pt.RoleName = grup adı, yoksa rol adı).
    /// </summary>
    public static string StageApplySql(bool groups) => $"""
        OUTER APPLY (
          SELECT TOP 1 pi.ProcessInstanceID, pi.Status, pi.LastComment
          FROM dbo.SYS_ProcessInstance pi
          JOIN dbo.SYS_ProcessDef pd ON pd.ProcessDefID = pi.ProcessDefID
          WHERE pd.Code = N'{ProcessCode}' AND pi.SourceTable = N'EGovDocument' AND pi.SourceId = e.EGovDocumentID
          ORDER BY pi.ProcessInstanceID DESC
        ) ap
        OUTER APPLY (
          SELECT TOP 1 t.ProcessTaskID, t.AssignedRoleId, t.AssignedUserId,
                 {(groups ? "t.AssignedGroupId, COALESCE(g.Name, r.Name)" : "CAST(NULL AS int) AS AssignedGroupId, r.Name")} AS RoleName
          FROM dbo.SYS_ProcessTask t
          LEFT JOIN dbo.SYS_Role r ON r.Id = t.AssignedRoleId
          {(groups ? "LEFT JOIN dbo.SYS_ApprovalGroup g ON g.ApprovalGroupID = t.AssignedGroupId" : "")}
          WHERE t.ProcessInstanceID = ap.ProcessInstanceID AND t.Status = N'Pending'
          ORDER BY t.ProcessTaskID DESC
        ) pt
        """;

    /// <summary>78_approval_groups.sql uygulanmış mı (grup tabloları + SYS_ProcessTask.AssignedGroupId)</summary>
    public static async Task<bool> HasGroupsAsync(IDbConnection db, CancellationToken ct) =>
        await db.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ApprovalGroup', N'U') IS NOT NULL
                         AND OBJECT_ID(N'dbo.SYS_ApprovalGroupMember', N'U') IS NOT NULL
                         AND COL_LENGTH(N'dbo.SYS_ProcessTask', N'AssignedGroupId') IS NOT NULL
                        THEN 1 ELSE 0 END
            """, cancellationToken: ct)) == 1;

    public const string StageExprSql = """
        CASE WHEN e.InvoiceID IS NOT NULL THEN 'saved'
             WHEN ap.Status IN (N'Pending', N'InProgress') THEN 'pending'
             WHEN ap.Status = N'Approved' THEN 'approved'
             WHEN ap.Status = N'Rejected' THEN 'rejected'
             ELSE 'new' END
        """;

    private readonly IDbConnection _db;
    private readonly ProcessRepository _process;
    private readonly RecordsRepository _records;
    private readonly ApprovalGroupRepository _groups;

    public EGovIncomingRepository(IDbConnection db, ProcessRepository process, RecordsRepository records, ApprovalGroupRepository groups)
    {
        _db = db;
        _process = process;
        _records = records;
        _groups = groups;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"""
            SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ProcessInstance', N'U') IS NOT NULL
                         AND EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'{ProcessCode}' AND IsActive = 1)
                        THEN 1 ELSE 0 END
            """, cancellationToken: ct)) == 1;
    }

    public async Task<EGovIncomingState?> GetStateAsync(int id, CancellationToken ct = default)
    {
        Open();
        var groups = await HasGroupsAsync(_db, ct);
        return await _db.QuerySingleOrDefaultAsync<EGovIncomingState>(new CommandDefinition(
            $"""
            SELECT e.EGovDocumentID, e.DocKind, e.Direction, e.DocumentNo, e.CustomerTitle, e.InvoiceID,
                   {StageExprSql} AS Stage,
                   ap.ProcessInstanceID AS ApprovalInstanceID,
                   pt.ProcessTaskID AS PendingTaskID, pt.AssignedRoleId AS PendingRoleId, pt.AssignedUserId AS PendingUserId,
                   pt.AssignedGroupId AS PendingGroupId
            FROM dbo.EGovDocument e
            {StageApplySql(groups)}
            WHERE e.EGovDocumentID = @id
            """, new { id }, cancellationToken: ct));
    }

    // ─── Onay ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Onaya gönderir. Onay açıklaması zorunlu. Onay grupları kuruluysa (78) görev seçilen gruba atanır —
    /// grubun herhangi bir üyesi sonuçlandırır; kurulu değilse süreç adımındaki role gider.
    /// </summary>
    public async Task<(bool Ok, string Message)> SendAsync(int id, int userId, string? note, int? groupId, CancellationToken ct = default)
    {
        if (!await ReadyAsync(ct)) return (false, MissingSetupMessage);
        if (string.IsNullOrWhiteSpace(note)) return (false, "Onay açıklaması zorunlu.");
        var groups = await HasGroupsAsync(_db, ct);
        string? groupName = null;
        if (groups)
        {
            if (groupId is not > 0) return (false, "Onay grubu seçin.");
            var (usable, name, error) = await _groups.CheckUsableAsync(groupId.Value, ct);
            if (!usable) return (false, error!);
            groupName = name;
        }
        var s = await GetStateAsync(id, ct);
        if (s is null) return (false, $"e-Belge #{id} bulunamadı.");
        if (s.Direction != 1 || s.DocKind is not (1 or 2)) return (false, "Yalnız gelen e-fatura / e-arşiv faturalar onaya gönderilir.");
        if (s.Stage is not ("new" or "rejected"))
            return (false, s.Stage switch
            {
                "pending" => "Belge zaten onayda.",
                "approved" => "Belge zaten onaylandı.",
                _ => "Belge zaten ERP'ye kaydedildi.",
            });

        var inst = await _process.StartAsync(new ProcessStartRequest
        {
            ProcessCode = ProcessCode,
            SourceTable = "EGovDocument",
            SourceId = id,
            TargetTable = "Invoice",
            Title = $"Gelen e-Fatura · {s.DocumentNo} · {s.CustomerTitle}",
            StartedBy = userId > 0 ? userId : null,
        }, ct);
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_ProcessInstance SET LastComment = @note WHERE ProcessInstanceID = @iid",
            new { note = note.Trim(), iid = inst.ProcessInstanceID }, cancellationToken: ct));
        if (groups)
        {
            // Görev role değil gruba: grubun herhangi bir üyesi onaylar / reddeder
            await _db.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.SYS_ProcessTask
                SET AssignedGroupId = @groupId, AssignedRoleId = NULL, AssignedUserId = NULL
                WHERE ProcessInstanceID = @iid AND Status = N'Pending'
                """, new { groupId, iid = inst.ProcessInstanceID }, cancellationToken: ct));
        }
        return (true, groupName is null ? "Onaya gönderildi." : $"«{groupName}» grubunun onayına gönderildi.");
    }

    /// <summary>approve=true onaylar, false reddeder (gerekçe zorunlu). Kullanıcı görevin rolünde ya da yönetici olmalı.</summary>
    public async Task<(bool Ok, int Status, string Message)> DecideAsync(int id, int userId, bool approve, string? comment, CancellationToken ct = default)
    {
        var s = await GetStateAsync(id, ct);
        if (s is null) return (false, 404, $"e-Belge #{id} bulunamadı.");
        if (s.Stage != "pending" || s.PendingTaskID is null) return (false, 400, "Belge onay beklemiyor.");
        if (!approve && string.IsNullOrWhiteSpace(comment)) return (false, 400, "Red gerekçesi zorunlu.");
        if (!await CanActAsync(userId, s.PendingRoleId, s.PendingUserId, s.PendingGroupId, ct))
            return (false, 403, s.PendingGroupId is not null
                ? "Bu onay grubunda değilsiniz."
                : "Bu onay sizin rolünüze atanmamış.");

        var req = new ProcessTaskActionRequest { UserId = userId, Comment = comment?.Trim() };
        if (approve) await _process.ApproveTaskAsync(s.PendingTaskID.Value, req, ct);
        else await _process.RejectTaskAsync(s.PendingTaskID.Value, req, ct);

        var after = await GetStateAsync(id, ct);
        var msg = !approve ? "Reddedildi."
            : after?.Stage == "approved" ? "Onaylandı — Onaylananlar listesinden ERP'ye kaydedilebilir."
            : "Onaylandı — sonraki onay adımına geçti.";
        return (true, 200, msg);
    }

    /// <summary>Atanan kullanıcı, atanan grubun üyesi, atanan rolün sahibi ya da yönetici (admin) sonuçlandırabilir.</summary>
    private async Task<bool> CanActAsync(int userId, int? roleId, int? assignedUserId, int? groupId, CancellationToken ct)
    {
        if (userId <= 0) return false;
        if (assignedUserId is int u && u == userId) return true;
        if (groupId is int g)
        {
            var member = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(*) FROM dbo.SYS_ApprovalGroupMember WHERE ApprovalGroupID = @g AND SystemUserID = @userId",
                new { g, userId }, cancellationToken: ct));
            if (member > 0) return true;
        }
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            SELECT CASE WHEN EXISTS (
              SELECT 1 FROM dbo.SYS_UserRole ur
              JOIN dbo.SYS_Role r ON r.Id = ur.RoleId
              WHERE ur.SystemUserID = @userId AND r.IsActive = 1
                AND (r.IsAdmin = 1 OR r.Code = N'ADMIN' OR (@roleId IS NOT NULL AND r.Id = @roleId))
            ) OR (@roleId IS NULL AND @assignedUserId IS NULL AND @groupId IS NULL) THEN 1 ELSE 0 END
            """, new { userId, roleId, assignedUserId, groupId }, cancellationToken: ct)) == 1;
    }

    // ─── Kayıt önizleme / eşleme ─────────────────────────────────────────────

    public async Task<(EGovIncomingPreview? Preview, string? Error)> PreviewAsync(int id, CancellationToken ct = default)
    {
        Open();
        var xml = await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT XmlContent FROM dbo.EGovDocument WHERE EGovDocumentID = @id", new { id }, cancellationToken: ct));
        if (string.IsNullOrWhiteSpace(xml))
            return (null, "Belgenin UBL/XML içeriği yok — e-Logo Belge Çekme ekranından XML ile birlikte yeniden çekin.");

        UblInvoice ubl;
        try
        {
            ubl = UblInvoiceReader.Read(xml);
        }
        catch (Exception ex)
        {
            return (null, $"UBL okunamadı: {ex.Message}");
        }

        var p = new EGovIncomingPreview
        {
            InvoiceNo = ubl.InvoiceNo,
            Uuid = ubl.Uuid,
            IssueDate = ubl.IssueDate,
            ProfileId = ubl.ProfileId,
            TypeCode = ubl.TypeCode,
            Currency = ubl.Currency,
            SupplierTaxNr = ubl.Supplier.TaxNr,
            SupplierName = ubl.Supplier.Name,
            LineExtensionAmount = ubl.LineExtensionAmount,
            TaxTotal = ubl.TaxTotal,
            PayableAmount = ubl.PayableAmount,
            // Gelen IADE faturası = bize sattığımız malın iadesi → Satış İade
            InvoiceType = string.Equals(ubl.TypeCode, "IADE", StringComparison.OrdinalIgnoreCase) ? 3 : 2,
        };

        if (!string.IsNullOrWhiteSpace(ubl.Supplier.TaxNr))
        {
            var sup = await _db.QueryFirstOrDefaultAsync<CardHit>(new CommandDefinition(
                "SELECT TOP 1 CustomerCardID AS Id, Code, Title FROM dbo.CustomerCard WHERE TaxNr = @tax ORDER BY CustomerCardID",
                new { tax = ubl.Supplier.TaxNr }, cancellationToken: ct));
            if (sup != null)
            {
                p.SupplierCardID = sup.Id;
                p.SupplierCode = sup.Code;
                p.SupplierTitle = sup.Title;
            }
        }

        foreach (var l in ubl.Lines)
        {
            var line = new EGovIncomingPreviewLine
            {
                LineNo = l.LineNo,
                SellerCode = l.SellerCode,
                Name = l.Name,
                Description = l.Description,
                Quantity = l.Quantity,
                UnitCode = l.UnitCode,
                Price = l.Price,
                Discount = l.Discount,
                LineAmount = l.LineAmount,
                TaxRate = l.TaxRate,
                TaxAmount = l.TaxAmount,
            };
            if (p.SupplierCardID is int supId)
            {
                var hit = await FindAliasAsync(supId, l.SellerCode, l.Name, ct);
                if (hit != null)
                {
                    line.ProductCardID = hit.Id;
                    line.ProductCode = hit.Code;
                    line.ProductTitle = hit.Title;
                }
            }
            p.Lines.Add(line);
        }
        MarkInfoLines(p, ubl);
        return (p, null);
    }

    /// <summary>
    /// Satır toplamı faturanın mal/hizmet toplamını (LegalMonetaryTotal/LineExtensionAmount) tutmuyorsa,
    /// tutarı olup KDV matrahı açıkça 0 olan satırlar farkı tam karşılıyorsa onları bilgi satırı sayar.
    /// Örn. TÜVTURK: «Kartlı Ödeme Hizmetine Konu Toplam Tutar» satırı toplama dahil değildir.
    /// </summary>
    private static void MarkInfoLines(EGovIncomingPreview p, UblInvoice ubl)
    {
        const decimal tol = 0.01m;
        p.LinesTotal = p.Lines.Sum(l => l.LineAmount);
        var diff = p.LinesTotal - p.LineExtensionAmount;
        if (Math.Abs(diff) <= tol || p.LineExtensionAmount == 0) return;

        var candidates = p.Lines
            .Where(l => l.LineAmount != 0 && l.TaxAmount == 0
                        && ubl.Lines.FirstOrDefault(u => u.LineNo == l.LineNo)?.TaxableAmount == 0)
            .ToList();
        if (candidates.Count > 0 && Math.Abs(candidates.Sum(l => l.LineAmount) - diff) <= tol)
        {
            foreach (var l in candidates)
            {
                l.IsInfoLine = true;
                l.InfoReason = "Fatura toplamına dahil değil (KDV matrahı 0) — bilgi satırı";
            }
            return;
        }
        p.TotalsMismatch = true;
    }

    /// <summary>Tedarikçinin kodu varsa kodla, yoksa malzeme adıyla eşleşen aktif bağlantı.</summary>
    private Task<CardHit?> FindAliasAsync(int customerId, string? code, string? name, CancellationToken ct) =>
        _db.QueryFirstOrDefaultAsync<CardHit?>(new CommandDefinition(
            """
            SELECT TOP 1 a.ProductCardID AS Id, p.Code, p.Title
            FROM dbo.ProductCustomerAlias a
            JOIN dbo.ProductCard p ON p.ProductCardID = a.ProductCardID
            WHERE a.CustomerCardID = @customerId AND a.IsActive = 1
              AND (   (@code IS NOT NULL AND a.CustomerCode = @code)
                   OR (@code IS NULL AND @name IS NOT NULL AND a.CustomerTitle = @name))
            ORDER BY a.ProductCustomerAliasID DESC
            """, new { customerId, code = Blank(code), name = Blank(name) }, cancellationToken: ct));

    // ─── ERP'ye kaydet ──────────────────────────────────────────────────────

    /// <summary>
    /// Onaylanmış belgeyi alış faturası olarak kaydeder: önce eşlemeleri ProductCustomerAlias'a yazar,
    /// sonra Invoice + ProductTrans kaydını genel kayıt yolu (RecordsRepository) ile oluşturur.
    /// Dönen RecordSaveRequest, çağıran tarafta kayıt sonrası adımlar (PostSave / süreç tetikleyici) için kullanılır.
    /// </summary>
    public async Task<(bool Ok, int InvoiceId, string Message, RecordSaveRequest? Body)> SaveAsync(
        int id, EGovIncomingSaveRequest req, CancellationToken ct = default)
    {
        var s = await GetStateAsync(id, ct);
        if (s is null) return (false, 0, $"e-Belge #{id} bulunamadı.", null);
        if (s.Stage == "saved") return (false, s.InvoiceID ?? 0, "Belge zaten ERP'ye kaydedildi.", null);
        if (s.Stage != "approved") return (false, 0, "Yalnız onaylanmış belgeler kaydedilebilir.", null);
        if (req.WhouseId is not > 0) return (false, 0, "Depo seçin.", null);

        var (p, error) = await PreviewAsync(id, ct);
        if (p is null) return (false, 0, error ?? "Belge okunamadı.", null);
        if (p.SupplierCardID is not int supplierId)
            return (false, 0, $"Tedarikçi cari kartı bulunamadı (VKN/TCKN {p.SupplierTaxNr}). Önce cari kartı açın.", null);
        // Kullanıcının dışarıda bıraktığı satırlar (bilgi satırları) faturaya yazılmaz, eşleme istemez
        var excluded = req.Lines.Where(l => l.Exclude).Select(l => l.LineNo).ToHashSet();
        p.Lines.RemoveAll(l => excluded.Contains(l.LineNo));
        if (p.Lines.Count == 0) return (false, 0, "Faturaya yazılacak satır yok.", null);

        var chosen = req.Lines.Where(l => !l.Exclude && l.ProductCardID > 0).ToDictionary(l => l.LineNo, l => l.ProductCardID);
        var missing = p.Lines.Where(l => !chosen.ContainsKey(l.LineNo)).Select(l => l.LineNo).ToList();
        if (missing.Count > 0) return (false, 0, $"Eşlenmemiş satır var: {string.Join(", ", missing)}.", null);

        // Malzeme bilgileri (birim, KDV kartı)
        var productIds = chosen.Values.Distinct().ToArray();
        var products = (await _db.QueryAsync<(int Id, int? UnitId)>(new CommandDefinition(
            "SELECT ProductCardID, DefaultUnitID FROM dbo.ProductCard WHERE ProductCardID IN @productIds",
            new { productIds }, cancellationToken: ct))).ToDictionary(x => x.Id, x => x.UnitId);
        var unknown = productIds.Where(pid => !products.ContainsKey(pid)).ToList();
        if (unknown.Count > 0) return (false, 0, $"Malzeme kartı bulunamadı: #{string.Join(", #", unknown)}.", null);

        // 1) Eşlemeleri malzeme–cari bağlantısına yaz
        foreach (var l in p.Lines)
            await UpsertAliasAsync(chosen[l.LineNo], supplierId, Blank(l.SellerCode), Blank(l.Name), ct);

        // 2) Alış faturası
        var taxCards = new Dictionary<decimal, int?>();
        var lines = new List<Dictionary<string, object?>>();
        foreach (var l in p.Lines)
        {
            if (!taxCards.TryGetValue(l.TaxRate, out var taxCardId))
            {
                taxCardId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                    "SELECT TOP 1 TaxCardID FROM dbo.TaxCard WHERE IsActive = 1 AND Rate = @rate ORDER BY TaxCardID",
                    new { rate = l.TaxRate }, cancellationToken: ct));
                taxCards[l.TaxRate] = taxCardId;
            }
            var pid = chosen[l.LineNo];
            lines.Add(new Dictionary<string, object?>
            {
                ["ProductCardID"] = pid,
                ["Description1"] = l.Name,
                ["Description2"] = l.Description,
                ["Quantity"] = l.Quantity,
                ["UnitID"] = products[pid],
                ["Price"] = l.Price,
                ["TotalDiscount"] = l.Discount,
                ["TaxCardID"] = taxCardId,
                ["TaxRate"] = l.TaxRate,
                ["TotalTax"] = l.TaxAmount,
                ["TotalPrice"] = l.LineAmount,
                ["NetTotal"] = l.LineAmount + l.TaxAmount,
                ["TransLineNo"] = l.LineNo,
            });
        }

        var currency = string.IsNullOrWhiteSpace(p.Currency) ? null
            : await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                "SELECT TOP 1 CurrencyID FROM dbo.SYS_Currency WHERE Code = @code",
                new { code = p.Currency }, cancellationToken: ct));

        var desc = string.IsNullOrWhiteSpace(req.Description)
            ? $"Gelen e-Fatura {p.InvoiceNo} · ETTN {p.Uuid}"
            : req.Description.Trim();
        var body = new RecordSaveRequest
        {
            RecordId = 0,
            FormCode = "PurchaseInvoiceForm",
            StandardFields = new Dictionary<string, object?>
            {
                ["InvoiceType"] = p.InvoiceType,
                ["InvoiceDate"] = p.IssueDate?.ToString("yyyy-MM-dd"),
                ["DocumentNumber"] = p.InvoiceNo,
                ["CustomerID"] = supplierId,
                ["CompanyID"] = req.CompanyId is > 0 ? req.CompanyId : null,
                ["WhouseID"] = req.WhouseId,
                ["Status_"] = 1,
                ["Currency"] = currency,
                ["CurrencyRate"] = 1,
                ["Description"] = desc,
            },
            Lines = lines,
        };

        var (ok, invoiceId, message) = await _records.SaveAsync("Invoice", "InvoiceID", body, ct);
        if (!ok) return (false, 0, message, null);

        Open();
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.EGovDocument SET InvoiceID = @invoiceId WHERE EGovDocumentID = @id AND InvoiceID IS NULL",
            new { invoiceId, id }, cancellationToken: ct));
        return (true, invoiceId, $"Alış faturası #{invoiceId} kaydedildi.", body);
    }

    /// <summary>
    /// Malzeme + cari için tek bağlantı (UX_ProductCustomerAlias_Product_Customer). Aynı tedarikçi kodu
    /// başka bir malzemede kayıtlıysa o eski bağlantı pasife alınır — kod tek malzemeyi göstersin.
    /// </summary>
    private async Task UpsertAliasAsync(int productId, int customerId, string? code, string? name, CancellationToken ct)
    {
        Open();
        if (code != null)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.ProductCustomerAlias SET IsActive = 0
                WHERE CustomerCardID = @customerId AND CustomerCode = @code AND ProductCardID <> @productId AND IsActive = 1
                """, new { customerId, code, productId }, cancellationToken: ct));
        }
        var updated = await _db.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.ProductCustomerAlias
            SET CustomerCode = COALESCE(@code, CustomerCode),
                CustomerTitle = COALESCE(@name, CustomerTitle),
                IsActive = 1
            WHERE ProductCardID = @productId AND CustomerCardID = @customerId
            """, new { productId, customerId, code, name }, cancellationToken: ct));
        if (updated == 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                """
                INSERT INTO dbo.ProductCustomerAlias (ProductCardID, CustomerCardID, CustomerCode, CustomerTitle, Note, IsActive)
                VALUES (@productId, @customerId, @code, @name, N'Gelen e-fatura eşlemesi', 1)
                """, new { productId, customerId, code, name }, cancellationToken: ct));
        }
    }

    private sealed class CardHit
    {
        public int Id { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
    }

    private static string? Blank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
