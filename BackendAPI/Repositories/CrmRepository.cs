using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

// ═══════════════════════════════════════════════════════════════════════════
//  CRM / Teklif Yönetimi — Fırsat → Aksiyon → Teklif · Görüşme · Mail
//  Tablolar: SqlUpdates/70_crm_offer_management.sql
// ═══════════════════════════════════════════════════════════════════════════

public sealed class CrmOpportunityDto
{
    public int OpportunityID { get; set; }
    public int? CustomerCardID { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerTitle { get; set; }
    public int? CustomerContactID { get; set; }
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? OppType { get; set; }
    public string? Source { get; set; }
    public byte Priority { get; set; } = 2;
    public byte Status { get; set; }
    public int? Probability { get; set; }
    public decimal? ExpectedAmount { get; set; }
    public int? CurrencyID { get; set; }
    public string? CurrencyCode { get; set; }
    public DateTime? ExpectedCloseDate { get; set; }
    public DateTime? ReminderDate { get; set; }
    public DateTime? CloseDate { get; set; }
    public string? CloseNote { get; set; }
    public int? OwnerUserID { get; set; }
    public string? OwnerName { get; set; }
    public int? CreateUserID { get; set; }
    public string? CreateUserName { get; set; }
    public DateTime CreateDate { get; set; }
    public DateTime? UpdateDate { get; set; }
    // sayaçlar (liste)
    public int ActionCount { get; set; }
    public int OpenActionCount { get; set; }
    public int OfferCount { get; set; }
    public int MeetingCount { get; set; }
    public int MailCount { get; set; }
    public decimal? LastOfferTotal { get; set; }
    public DateTime? NextDueDate { get; set; }
}

public sealed class CrmActionDto
{
    public int ActionID { get; set; }
    public int OpportunityID { get; set; }
    public int? ActionTypeID { get; set; }
    public string? ActionTypeTitle { get; set; }
    public string? ActionTypeIcon { get; set; }
    public byte CloseKind { get; set; }
    public DateTime ActionDate { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Description { get; set; }
    public int? CustomerContactID { get; set; }
    public string? ContactName { get; set; }
    public int? AssignedUserID { get; set; }
    public string? AssignedUserName { get; set; }
    public bool IsDone { get; set; }
    public DateTime? DoneDate { get; set; }
    public bool IsActive { get; set; } = true;
    public int? CreateUserID { get; set; }
    public string? CreateUserName { get; set; }
    public DateTime CreateDate { get; set; }
    public int OfferCount { get; set; }
    /// <summary>Kayıtta birlikte teklif açılsın (Nova "Teklif Ekle" kutusu).</summary>
    public CrmOfferDto? NewOffer { get; set; }
}

public sealed class CrmOfferLineDto
{
    public int OfferLineID { get; set; }
    public int OfferID { get; set; }
    public int LineNr { get; set; }
    public int? ProductCardID { get; set; }
    public string? ProductCode { get; set; }
    public string? Description { get; set; }
    public decimal Quantity { get; set; } = 1;
    public string? UnitName { get; set; }
    public decimal Price { get; set; }
    public decimal DiscountRate { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal VatRate { get; set; } = 20;
    public decimal NetTotal { get; set; }
}

public sealed class CrmOfferDto
{
    public int OfferID { get; set; }
    public int OpportunityID { get; set; }
    public int? ActionID { get; set; }
    public int DocNum { get; set; }
    public int RevisionNo { get; set; }
    public int? ParentOfferID { get; set; }
    public DateTime OfferDate { get; set; }
    public DateTime? ValidityDate { get; set; }
    public string? Description { get; set; }
    public int? CurrencyID { get; set; }
    public string? CurrencyCode { get; set; }
    public decimal GeneralDiscount { get; set; }
    public decimal SubTotal { get; set; }
    public decimal VatTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public string? PaymentTerms { get; set; }
    public string? DeliveryTerms { get; set; }
    public string? Notes { get; set; }
    public byte Status { get; set; }
    public bool IsActive { get; set; } = true;
    public int? CreateUserID { get; set; }
    public string? CreateUserName { get; set; }
    public DateTime CreateDate { get; set; }
    public DateTime? UpdateDate { get; set; }
    public int MailCount { get; set; }
    public List<CrmOfferLineDto> Lines { get; set; } = new();
}

public sealed class CrmMeetingDto
{
    public int MeetingID { get; set; }
    public int OpportunityID { get; set; }
    public int? ActionID { get; set; }
    public DateTime MeetingDate { get; set; }
    public string Channel { get; set; } = "Telefon";
    public byte Direction { get; set; } = 2;
    public string? ContactName { get; set; }
    public string? Subject { get; set; }
    public string? Notes { get; set; }
    public int? DurationMin { get; set; }
    public string? NextStep { get; set; }
    public DateTime? NextStepDate { get; set; }
    public int? CreateUserID { get; set; }
    public string? CreateUserName { get; set; }
    public DateTime CreateDate { get; set; }
}

public sealed class CrmMailLogDto
{
    public int MailLogID { get; set; }
    public int? OpportunityID { get; set; }
    public int? ActionID { get; set; }
    public int? OfferID { get; set; }
    public byte Direction { get; set; }
    public byte Status { get; set; }
    public string Channel { get; set; } = "";
    public string? TagCode { get; set; }
    public string? Subject { get; set; }
    public string? MailFrom { get; set; }
    public string? MailTo { get; set; }
    public string? MailCc { get; set; }
    public string? Body { get; set; }
    public bool IsHtml { get; set; }
    public string? AttachmentNames { get; set; }
    public string? MessageId { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? MailDate { get; set; }
    public DateTime CreateDate { get; set; }
    public int? CreateUserID { get; set; }
    public string? Source { get; set; }
    public string? RawFileName { get; set; }
    public bool HasRaw { get; set; }
    public int? OfferDocNum { get; set; }
}

public sealed class CrmActionTypeDto
{
    public int ActionTypeID { get; set; }
    public string Title { get; set; } = "";
    public string? Icon { get; set; }
    public byte CloseKind { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CrmLookupItem
{
    public int Id { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public string? Extra { get; set; }
}

public sealed class CrmContactDto
{
    public int CustomerContactID { get; set; }
    public int? CustomerCardID { get; set; }
    public string? Name { get; set; }
    public string? ContactTitle { get; set; }
    public string? Contact { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool? IsDefault { get; set; }
}

public sealed class CrmProductDto
{
    public int ProductCardID { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public string? UnitName { get; set; }
    public decimal VatRate { get; set; }
    public decimal Price { get; set; }
    public int? PriceCurrencyID { get; set; }
}

public sealed class CrmUserDto
{
    public int SystemUserID { get; set; }
    public string? NickName { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
}

public sealed class CrmPagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Total { get; set; }
}

public sealed class CrmNeedsUpdateException : Exception
{
    public CrmNeedsUpdateException()
        : base("CRM tabloları bulunamadı. Sistem Yönetimi → Veritabanı Güncelleme ekranından 70_crm_offer_management.sql scriptini uygulayın.") { }
}

public sealed class CrmRepository
{
    private readonly IDbConnection _db;
    public CrmRepository(IDbConnection db) => _db = db;

    public IDbConnection Connection => _db;

    private const string UserNameExpr = "LTRIM(RTRIM(ISNULL(u.Name,'') + ' ' + ISNULL(u.Surname,'')))";

    /// <summary>Tablo yoksa (208) anlaşılır hata.</summary>
    public static async Task<T> Guard<T>(Func<Task<T>> fn)
    {
        try { return await fn(); }
        catch (SqlException ex) when (ex.Number == 208 && ex.Message.Contains("CRM_", StringComparison.OrdinalIgnoreCase))
        {
            throw new CrmNeedsUpdateException();
        }
    }

    private void EnsureOpen()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    // ─── Ayarlar ──────────────────────────────────────────────────────────
    public Task<Dictionary<string, string?>> GetSettingsAsync() => Guard(async () =>
    {
        var rows = await _db.QueryAsync<(string Key, string? Value)>("SELECT SettingKey, SettingValue FROM dbo.CRM_Setting");
        return rows.ToDictionary(r => r.Key, r => r.Value, StringComparer.OrdinalIgnoreCase);
    });

    public async Task<string?> GetSettingAsync(string key)
    {
        try
        {
            return await _db.ExecuteScalarAsync<string?>("SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey=@key", new { key });
        }
        catch (SqlException) { return null; }
    }

    public Task<int> SaveSettingsAsync(Dictionary<string, string?> values) => Guard(async () =>
    {
        var n = 0;
        foreach (var kv in values)
        {
            n += await _db.ExecuteAsync(@"
IF EXISTS (SELECT 1 FROM dbo.CRM_Setting WHERE SettingKey=@k)
  UPDATE dbo.CRM_Setting SET SettingValue=@v, UpdatedAt=SYSDATETIME() WHERE SettingKey=@k
ELSE
  INSERT INTO dbo.CRM_Setting (SettingKey, SettingValue) VALUES (@k, @v);", new { k = kv.Key, v = kv.Value });
        }
        return n;
    });

    // ─── Lookup'lar ───────────────────────────────────────────────────────
    public Task<List<CrmActionTypeDto>> ListActionTypesAsync(bool includeInactive = false) => Guard(async () =>
        (await _db.QueryAsync<CrmActionTypeDto>(
            "SELECT * FROM dbo.CRM_ActionType WHERE (@all=1 OR IsActive=1) ORDER BY SortOrder, Title",
            new { all = includeInactive ? 1 : 0 })).ToList());

    public Task<int> SaveActionTypeAsync(CrmActionTypeDto t) => Guard(async () =>
    {
        if (t.ActionTypeID > 0)
        {
            await _db.ExecuteAsync(@"UPDATE dbo.CRM_ActionType SET Title=@Title, Icon=@Icon, CloseKind=@CloseKind, SortOrder=@SortOrder, IsActive=@IsActive
WHERE ActionTypeID=@ActionTypeID", t);
            return t.ActionTypeID;
        }
        return await _db.ExecuteScalarAsync<int>(@"INSERT INTO dbo.CRM_ActionType (Title, Icon, CloseKind, SortOrder, IsActive)
OUTPUT INSERTED.ActionTypeID VALUES (@Title, @Icon, @CloseKind, @SortOrder, @IsActive)", t);
    });

    public async Task<List<CrmUserDto>> ListUsersAsync()
    {
        var hasEmail = await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN COL_LENGTH('dbo.SystemUser','Email') IS NULL THEN 0 ELSE 1 END") == 1;
        var sql = $@"SELECT SystemUserID, NickName, {UserNameExpr} AS FullName, {(hasEmail ? "u.Email" : "CAST(NULL AS NVARCHAR(320))")} AS Email
FROM dbo.SystemUser u WHERE u.IsActive = 1 ORDER BY u.Name, u.Surname";
        return (await _db.QueryAsync<CrmUserDto>(sql)).ToList();
    }

    public async Task SaveUserEmailAsync(int userId, string? email)
    {
        await _db.ExecuteAsync("UPDATE dbo.SystemUser SET Email=@email WHERE SystemUserID=@userId", new { userId, email });
    }

    public async Task<List<CrmLookupItem>> ListCurrenciesAsync()
    {
        try
        {
            return (await _db.QueryAsync<CrmLookupItem>(
                "SELECT CurrencyID AS Id, Code, Title, CAST(IsLocal AS NVARCHAR(5)) AS Extra FROM dbo.SYS_Currency WHERE IsActive=1 ORDER BY IsLocal DESC, Code")).ToList();
        }
        catch (SqlException) { return new() { new CrmLookupItem { Id = 1, Code = "TRY", Title = "Türk Lirası", Extra = "1" } }; }
    }

    public async Task<List<CrmLookupItem>> SearchCustomersAsync(string? q, int take = 30)
    {
        q = (q ?? "").Trim();
        return (await _db.QueryAsync<CrmLookupItem>(@"
SELECT TOP (@take) CustomerCardID AS Id, Code, Title, TaxNr AS Extra
FROM dbo.CustomerCard
WHERE CustomerCardID > 0 AND ISNULL(Active,1) = 1
  AND (@q = '' OR Code LIKE '%' + @q + '%' OR Title LIKE '%' + @q + '%' OR TaxNr LIKE @q + '%')
ORDER BY Title", new { q, take })).ToList();
    }

    public async Task<List<CrmContactDto>> ListContactsAsync(int customerId)
    {
        return (await _db.QueryAsync<CrmContactDto>(@"
SELECT CustomerContactID, CustomerCardID, Name, ContactTitle, Contact, Phone, Email, IsDefault
FROM dbo.CustomerContact WHERE CustomerCardID = @customerId
ORDER BY ISNULL(IsDefault,0) DESC, Name", new { customerId })).ToList();
    }

    public async Task<List<CrmProductDto>> SearchProductsAsync(string? q, int? customerId, int take = 30)
    {
        q = (q ?? "").Trim();
        return (await _db.QueryAsync<CrmProductDto>(@"
SELECT TOP (@take) p.ProductCardID, p.Code, p.Title,
       p.MainUnitName AS UnitName,
       CAST(ISNULL(t.Rate, 20) AS DECIMAL(9,4)) AS VatRate,
       CAST(ISNULL(pr.Price, 0) AS DECIMAL(18,4)) AS Price,
       pr.CurrencyID AS PriceCurrencyID
FROM dbo.ProductCard p
LEFT JOIN dbo.TaxCard t ON t.TaxCardID = p.TaxCardID
OUTER APPLY (
    SELECT TOP 1 x.Price, x.CurrencyID FROM dbo.ProductPrice x
    WHERE x.ProductCardID = p.ProductCardID AND x.Type_ = 1 AND ISNULL(x.IsActive,1) = 1
      AND (x.CustomerCardID IS NULL OR x.CustomerCardID = 0 OR x.CustomerCardID = @customerId)
      AND (x.ValidFrom IS NULL OR x.ValidFrom <= CAST(GETDATE() AS DATE))
      AND (x.ValidTo IS NULL OR x.ValidTo >= CAST(GETDATE() AS DATE))
    ORDER BY CASE WHEN x.CustomerCardID = @customerId THEN 0 ELSE 1 END, x.ValidFrom DESC
) pr
WHERE p.ProductCardID > 0 AND ISNULL(p.IsActive,1) = 1
  AND (@q = '' OR p.Code LIKE '%' + @q + '%' OR p.Title LIKE '%' + @q + '%')
ORDER BY p.Code", new { q, take, customerId = customerId ?? -1 })).ToList();
    }

    // ─── Fırsatlar ────────────────────────────────────────────────────────
    private const string OppSelect = @"
SELECT o.*, c.Code AS CustomerCode, c.Title AS CustomerTitle, cur.Code AS CurrencyCode,
       LTRIM(RTRIM(ISNULL(ow.Name,'') + ' ' + ISNULL(ow.Surname,''))) AS OwnerName,
       LTRIM(RTRIM(ISNULL(cu.Name,'') + ' ' + ISNULL(cu.Surname,''))) AS CreateUserName,
       (SELECT COUNT(*) FROM dbo.CRM_Action a WHERE a.OpportunityID = o.OpportunityID AND a.IsActive = 1) AS ActionCount,
       (SELECT COUNT(*) FROM dbo.CRM_Action a WHERE a.OpportunityID = o.OpportunityID AND a.IsActive = 1 AND a.IsDone = 0) AS OpenActionCount,
       (SELECT COUNT(*) FROM dbo.CRM_Offer f WHERE f.OpportunityID = o.OpportunityID AND f.IsActive = 1) AS OfferCount,
       (SELECT COUNT(*) FROM dbo.CRM_Meeting m WHERE m.OpportunityID = o.OpportunityID) AS MeetingCount,
       (SELECT COUNT(*) FROM dbo.CRM_MailLog l WHERE l.OpportunityID = o.OpportunityID) AS MailCount,
       (SELECT TOP 1 f.GrandTotal FROM dbo.CRM_Offer f WHERE f.OpportunityID = o.OpportunityID AND f.IsActive = 1 ORDER BY f.OfferDate DESC, f.OfferID DESC) AS LastOfferTotal,
       (SELECT MIN(a.DueDate) FROM dbo.CRM_Action a WHERE a.OpportunityID = o.OpportunityID AND a.IsActive = 1 AND a.IsDone = 0) AS NextDueDate
FROM dbo.CRM_Opportunity o
LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = o.CustomerCardID
LEFT JOIN dbo.SYS_Currency cur ON cur.CurrencyID = o.CurrencyID
LEFT JOIN dbo.SystemUser ow ON ow.SystemUserID = o.OwnerUserID
LEFT JOIN dbo.SystemUser cu ON cu.SystemUserID = o.CreateUserID";

    public Task<CrmPagedResult<CrmOpportunityDto>> ListOpportunitiesAsync(int? status, string? q, int? ownerId, int? customerId, int page, int pageSize) => Guard(async () =>
    {
        q = (q ?? "").Trim();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 200);
        const string where = @"
WHERE (@status IS NULL OR (@status = 9 AND o.Status <> 0) OR o.Status = @status)
  AND (@ownerId IS NULL OR o.OwnerUserID = @ownerId)
  AND (@customerId IS NULL OR o.CustomerCardID = @customerId)
  AND (@q = '' OR o.Title LIKE '%' + @q + '%' OR c.Title LIKE '%' + @q + '%' OR c.Code LIKE '%' + @q + '%'
       OR o.ContactName LIKE '%' + @q + '%' OR CAST(o.OpportunityID AS NVARCHAR(20)) = @q
       OR EXISTS (SELECT 1 FROM dbo.CRM_Offer f WHERE f.OpportunityID = o.OpportunityID AND CAST(f.DocNum AS NVARCHAR(20)) = @q))";
        var p = new { status, q, ownerId, customerId, skip = (page - 1) * pageSize, take = pageSize };
        var total = await _db.ExecuteScalarAsync<int>(@"SELECT COUNT(*) FROM dbo.CRM_Opportunity o
LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = o.CustomerCardID" + where, p);
        var items = (await _db.QueryAsync<CrmOpportunityDto>(OppSelect + where + @"
ORDER BY CASE WHEN o.Status = 0 THEN 0 ELSE 1 END, o.Priority, ISNULL(o.UpdateDate, o.CreateDate) DESC
OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY", p)).ToList();
        return new CrmPagedResult<CrmOpportunityDto> { Items = items, Total = total };
    });

    public Task<CrmOpportunityDto?> GetOpportunityAsync(int id) => Guard(async () =>
        await _db.QueryFirstOrDefaultAsync<CrmOpportunityDto>(OppSelect + " WHERE o.OpportunityID = @id", new { id }));

    public Task<int> SaveOpportunityAsync(CrmOpportunityDto d, int userId) => Guard(async () =>
    {
        if (string.IsNullOrWhiteSpace(d.Title)) throw new ArgumentException("Fırsat başlığı zorunlu.");
        if (d.OpportunityID > 0)
        {
            await _db.ExecuteAsync(@"
UPDATE dbo.CRM_Opportunity SET
  CustomerCardID=@CustomerCardID, CustomerContactID=@CustomerContactID, ContactName=@ContactName, ContactEmail=@ContactEmail,
  ContactPhone=@ContactPhone, Title=@Title, Description=@Description, OppType=@OppType, Source=@Source, Priority=@Priority,
  Probability=@Probability, ExpectedAmount=@ExpectedAmount, CurrencyID=@CurrencyID, ExpectedCloseDate=@ExpectedCloseDate,
  ReminderDate=@ReminderDate, OwnerUserID=@OwnerUserID, UpdateDate=SYSDATETIME()
WHERE OpportunityID=@OpportunityID", d);
            return d.OpportunityID;
        }
        d.CreateUserID = userId > 0 ? userId : null;
        d.OwnerUserID ??= d.CreateUserID;
        return await _db.ExecuteScalarAsync<int>(@"
INSERT INTO dbo.CRM_Opportunity (CustomerCardID, CustomerContactID, ContactName, ContactEmail, ContactPhone, Title, Description,
  OppType, Source, Priority, Status, Probability, ExpectedAmount, CurrencyID, ExpectedCloseDate, ReminderDate, OwnerUserID, CreateUserID)
OUTPUT INSERTED.OpportunityID
VALUES (@CustomerCardID, @CustomerContactID, @ContactName, @ContactEmail, @ContactPhone, @Title, @Description,
  @OppType, @Source, @Priority, 0, @Probability, @ExpectedAmount, @CurrencyID, @ExpectedCloseDate, @ReminderDate, @OwnerUserID, @CreateUserID)", d);
    });

    public Task<int> CloseOpportunityAsync(int id, byte status, string? note) => Guard(async () =>
        await _db.ExecuteAsync(@"UPDATE dbo.CRM_Opportunity SET Status=@status,
  CloseDate = CASE WHEN @status = 0 THEN NULL ELSE SYSDATETIME() END,
  CloseNote = CASE WHEN @status = 0 THEN CloseNote ELSE @note END,
  Probability = CASE WHEN @status = 1 THEN 100 WHEN @status IN (2,3) THEN 0 ELSE Probability END,
  UpdateDate = SYSDATETIME()
WHERE OpportunityID=@id", new { id, status, note }));

    public Task<int> DeleteOpportunityAsync(int id) => Guard(async () =>
    {
        EnsureOpen();
        using var tx = _db.BeginTransaction();
        await _db.ExecuteAsync(@"
DELETE l FROM dbo.CRM_OfferLine l JOIN dbo.CRM_Offer f ON f.OfferID = l.OfferID WHERE f.OpportunityID = @id;
DELETE FROM dbo.CRM_Offer WHERE OpportunityID = @id;
DELETE FROM dbo.CRM_Action WHERE OpportunityID = @id;
DELETE FROM dbo.CRM_Meeting WHERE OpportunityID = @id;
UPDATE dbo.CRM_MailLog SET OpportunityID = NULL WHERE OpportunityID = @id;", new { id }, tx);
        var n = await _db.ExecuteAsync("DELETE FROM dbo.CRM_Opportunity WHERE OpportunityID = @id", new { id }, tx);
        tx.Commit();
        return n;
    });

    public Task<object> GetStatsAsync(int? ownerId) => Guard(async () =>
    {
        var row = await _db.QueryFirstAsync(@"
SELECT
  SUM(CASE WHEN Status = 0 THEN 1 ELSE 0 END) AS OpenCount,
  SUM(CASE WHEN Status = 1 THEN 1 ELSE 0 END) AS WonCount,
  SUM(CASE WHEN Status = 2 THEN 1 ELSE 0 END) AS LostCount,
  SUM(CASE WHEN Status = 0 THEN ISNULL(ExpectedAmount,0) ELSE 0 END) AS OpenAmount,
  SUM(CASE WHEN Status = 1 THEN ISNULL(ExpectedAmount,0) ELSE 0 END) AS WonAmount
FROM dbo.CRM_Opportunity WHERE (@ownerId IS NULL OR OwnerUserID = @ownerId);
", new { ownerId });
        var overdue = await _db.ExecuteScalarAsync<int>(@"SELECT COUNT(*) FROM dbo.CRM_Action a JOIN dbo.CRM_Opportunity o ON o.OpportunityID=a.OpportunityID
WHERE a.IsActive=1 AND a.IsDone=0 AND a.DueDate < CAST(GETDATE() AS DATE) AND o.Status=0 AND (@ownerId IS NULL OR o.OwnerUserID=@ownerId)", new { ownerId });
        var offersOpen = await _db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.CRM_Offer WHERE IsActive=1 AND Status IN (0,1)");
        return (object)new
        {
            openCount = (int?)row.OpenCount ?? 0,
            wonCount = (int?)row.WonCount ?? 0,
            lostCount = (int?)row.LostCount ?? 0,
            openAmount = (decimal?)row.OpenAmount ?? 0m,
            wonAmount = (decimal?)row.WonAmount ?? 0m,
            overdueActions = overdue,
            openOffers = offersOpen
        };
    });

    // ─── Aksiyonlar ───────────────────────────────────────────────────────
    private const string ActionSelect = @"
SELECT a.*, t.Title AS ActionTypeTitle, t.Icon AS ActionTypeIcon, ISNULL(t.CloseKind,0) AS CloseKind,
       LTRIM(RTRIM(ISNULL(au.Name,'') + ' ' + ISNULL(au.Surname,''))) AS AssignedUserName,
       LTRIM(RTRIM(ISNULL(cu.Name,'') + ' ' + ISNULL(cu.Surname,''))) AS CreateUserName,
       (SELECT COUNT(*) FROM dbo.CRM_Offer f WHERE f.ActionID = a.ActionID AND f.IsActive = 1) AS OfferCount
FROM dbo.CRM_Action a
LEFT JOIN dbo.CRM_ActionType t ON t.ActionTypeID = a.ActionTypeID
LEFT JOIN dbo.SystemUser au ON au.SystemUserID = a.AssignedUserID
LEFT JOIN dbo.SystemUser cu ON cu.SystemUserID = a.CreateUserID";

    public Task<List<CrmActionDto>> ListActionsAsync(int opportunityId) => Guard(async () =>
        (await _db.QueryAsync<CrmActionDto>(ActionSelect + " WHERE a.OpportunityID=@opportunityId AND a.IsActive=1 ORDER BY a.ActionDate DESC, a.ActionID DESC",
            new { opportunityId })).ToList());

    public Task<CrmActionDto?> GetActionAsync(int id) => Guard(async () =>
        await _db.QueryFirstOrDefaultAsync<CrmActionDto>(ActionSelect + " WHERE a.ActionID=@id", new { id }));

    public Task<int> SaveActionAsync(CrmActionDto a, int userId) => Guard(async () =>
    {
        if (a.OpportunityID <= 0) throw new ArgumentException("Fırsat seçilmedi.");
        if (a.ActionDate == default) a.ActionDate = DateTime.Now;
        if (a.ActionID > 0)
        {
            await _db.ExecuteAsync(@"UPDATE dbo.CRM_Action SET ActionTypeID=@ActionTypeID, ActionDate=@ActionDate, DueDate=@DueDate,
  Description=@Description, CustomerContactID=@CustomerContactID, ContactName=@ContactName, AssignedUserID=@AssignedUserID
WHERE ActionID=@ActionID", a);
        }
        else
        {
            a.CreateUserID = userId > 0 ? userId : null;
            a.AssignedUserID ??= a.CreateUserID;
            a.ActionID = await _db.ExecuteScalarAsync<int>(@"INSERT INTO dbo.CRM_Action
  (OpportunityID, ActionTypeID, ActionDate, DueDate, Description, CustomerContactID, ContactName, AssignedUserID, IsDone, CreateUserID)
OUTPUT INSERTED.ActionID
VALUES (@OpportunityID, @ActionTypeID, @ActionDate, @DueDate, @Description, @CustomerContactID, @ContactName, @AssignedUserID, @IsDone, @CreateUserID)", a);
        }
        await TouchOpportunityAsync(a.OpportunityID);
        return a.ActionID;
    });

    public Task<int> SetActionDoneAsync(int id, bool done) => Guard(async () =>
        await _db.ExecuteAsync("UPDATE dbo.CRM_Action SET IsDone=@done, DoneDate=CASE WHEN @done=1 THEN SYSDATETIME() ELSE NULL END WHERE ActionID=@id",
            new { id, done }));

    public Task<int> DeleteActionAsync(int id) => Guard(async () =>
    {
        EnsureOpen();
        using var tx = _db.BeginTransaction();
        await _db.ExecuteAsync(@"
DELETE l FROM dbo.CRM_OfferLine l JOIN dbo.CRM_Offer f ON f.OfferID = l.OfferID WHERE f.ActionID = @id;
DELETE FROM dbo.CRM_Offer WHERE ActionID = @id;
UPDATE dbo.CRM_Meeting SET ActionID = NULL WHERE ActionID = @id;", new { id }, tx);
        var n = await _db.ExecuteAsync("DELETE FROM dbo.CRM_Action WHERE ActionID=@id", new { id }, tx);
        tx.Commit();
        return n;
    });

    private Task TouchOpportunityAsync(int id) =>
        _db.ExecuteAsync("UPDATE dbo.CRM_Opportunity SET UpdateDate=SYSDATETIME() WHERE OpportunityID=@id", new { id });

    public Task<CrmActionTypeDto?> GetActionTypeAsync(int id) => Guard(async () =>
        await _db.QueryFirstOrDefaultAsync<CrmActionTypeDto>("SELECT * FROM dbo.CRM_ActionType WHERE ActionTypeID=@id", new { id }));

    // ─── Teklifler ────────────────────────────────────────────────────────
    private const string OfferSelect = @"
SELECT f.*, cur.Code AS CurrencyCode,
       LTRIM(RTRIM(ISNULL(cu.Name,'') + ' ' + ISNULL(cu.Surname,''))) AS CreateUserName,
       (SELECT COUNT(*) FROM dbo.CRM_MailLog l WHERE l.OfferID = f.OfferID) AS MailCount
FROM dbo.CRM_Offer f
LEFT JOIN dbo.SYS_Currency cur ON cur.CurrencyID = f.CurrencyID
LEFT JOIN dbo.SystemUser cu ON cu.SystemUserID = f.CreateUserID";

    public Task<List<CrmOfferDto>> ListOffersAsync(int opportunityId, int? actionId) => Guard(async () =>
    {
        var offers = (await _db.QueryAsync<CrmOfferDto>(OfferSelect + @"
WHERE f.OpportunityID=@opportunityId AND f.IsActive=1 AND (@actionId IS NULL OR f.ActionID=@actionId)
ORDER BY f.OfferDate DESC, f.OfferID DESC", new { opportunityId, actionId })).ToList();
        await AttachLinesAsync(offers);
        return offers;
    });

    public Task<CrmOfferDto?> GetOfferAsync(int id) => Guard(async () =>
    {
        var f = await _db.QueryFirstOrDefaultAsync<CrmOfferDto>(OfferSelect + " WHERE f.OfferID=@id", new { id });
        if (f != null) await AttachLinesAsync(new List<CrmOfferDto> { f });
        return f;
    });

    private async Task AttachLinesAsync(List<CrmOfferDto> offers)
    {
        if (offers.Count == 0) return;
        var ids = offers.Select(o => o.OfferID).ToArray();
        var lines = (await _db.QueryAsync<CrmOfferLineDto>(
            "SELECT * FROM dbo.CRM_OfferLine WHERE OfferID IN @ids ORDER BY OfferID, LineNr", new { ids })).ToList();
        foreach (var o in offers) o.Lines = lines.Where(l => l.OfferID == o.OfferID).ToList();
    }

    public static void Calculate(CrmOfferDto o)
    {
        decimal sub = 0, vat = 0;
        var nr = 1;
        foreach (var l in o.Lines)
        {
            l.LineNr = nr++;
            var gross = Math.Round(l.Quantity * l.Price, 2);
            var disc = l.DiscountRate > 0 ? Math.Round(gross * l.DiscountRate / 100m, 2) : l.DiscountAmount;
            l.DiscountAmount = disc;
            l.NetTotal = gross - disc;
            sub += l.NetTotal;
        }
        // genel iskonto satırlara oransal dağıtılır (KDV hesabı için)
        var ratio = sub == 0 ? 0 : (sub - o.GeneralDiscount) / sub;
        foreach (var l in o.Lines) vat += Math.Round(l.NetTotal * ratio * l.VatRate / 100m, 2);
        o.SubTotal = sub;
        o.VatTotal = vat;
        o.GrandTotal = sub - o.GeneralDiscount + vat;
    }

    private async Task<int> NextDocNumAsync(IDbTransaction tx)
    {
        var start = 1000;
        var s = await _db.ExecuteScalarAsync<string?>("SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey='OfferDocStart'", transaction: tx);
        if (int.TryParse(s, out var st) && st > 0) start = st;
        var max = await _db.ExecuteScalarAsync<int?>("SELECT MAX(DocNum) FROM dbo.CRM_Offer WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
        return Math.Max(start, (max ?? (start - 1)) + 1);
    }

    public Task<int> SaveOfferAsync(CrmOfferDto o, int userId) => Guard(async () =>
    {
        if (o.OpportunityID <= 0) throw new ArgumentException("Fırsat seçilmedi.");
        o.Lines = o.Lines.Where(l => l.ProductCardID.HasValue || !string.IsNullOrWhiteSpace(l.Description)).ToList();
        if (o.Lines.Count == 0) throw new ArgumentException("Teklifte en az bir kalem olmalı.");
        if (o.OfferDate == default) o.OfferDate = DateTime.Today;
        Calculate(o);
        EnsureOpen();
        using var tx = _db.BeginTransaction();
        if (o.OfferID > 0)
        {
            await _db.ExecuteAsync(@"UPDATE dbo.CRM_Offer SET ActionID=@ActionID, OfferDate=@OfferDate, ValidityDate=@ValidityDate,
  Description=@Description, CurrencyID=@CurrencyID, GeneralDiscount=@GeneralDiscount, SubTotal=@SubTotal, VatTotal=@VatTotal,
  GrandTotal=@GrandTotal, PaymentTerms=@PaymentTerms, DeliveryTerms=@DeliveryTerms, Notes=@Notes, UpdateDate=SYSDATETIME()
WHERE OfferID=@OfferID", o, tx);
            await _db.ExecuteAsync("DELETE FROM dbo.CRM_OfferLine WHERE OfferID=@OfferID", new { o.OfferID }, tx);
        }
        else
        {
            o.CreateUserID = userId > 0 ? userId : null;
            if (o.DocNum <= 0) o.DocNum = await NextDocNumAsync(tx);
            o.OfferID = await _db.ExecuteScalarAsync<int>(@"INSERT INTO dbo.CRM_Offer
  (OpportunityID, ActionID, DocNum, RevisionNo, ParentOfferID, OfferDate, ValidityDate, Description, CurrencyID, GeneralDiscount,
   SubTotal, VatTotal, GrandTotal, PaymentTerms, DeliveryTerms, Notes, Status, CreateUserID)
OUTPUT INSERTED.OfferID
VALUES (@OpportunityID, @ActionID, @DocNum, @RevisionNo, @ParentOfferID, @OfferDate, @ValidityDate, @Description, @CurrencyID, @GeneralDiscount,
   @SubTotal, @VatTotal, @GrandTotal, @PaymentTerms, @DeliveryTerms, @Notes, @Status, @CreateUserID)", o, tx);
        }
        foreach (var l in o.Lines)
        {
            l.OfferID = o.OfferID;
            await _db.ExecuteAsync(@"INSERT INTO dbo.CRM_OfferLine
  (OfferID, LineNr, ProductCardID, ProductCode, Description, Quantity, UnitName, Price, DiscountRate, DiscountAmount, VatRate, NetTotal)
VALUES (@OfferID, @LineNr, @ProductCardID, @ProductCode, @Description, @Quantity, @UnitName, @Price, @DiscountRate, @DiscountAmount, @VatRate, @NetTotal)", l, tx);
        }
        await _db.ExecuteAsync("UPDATE dbo.CRM_Opportunity SET UpdateDate=SYSDATETIME(), ExpectedAmount=ISNULL(ExpectedAmount,@amt) WHERE OpportunityID=@id",
            new { id = o.OpportunityID, amt = o.GrandTotal }, tx);
        tx.Commit();
        return o.OfferID;
    });

    /// <summary>Revize: aynı DocNum, RevisionNo+1; eski teklif "Revize edildi" olur.</summary>
    public Task<int> ReviseOfferAsync(int id, int userId) => Guard(async () =>
    {
        var src = await GetOfferAsync(id) ?? throw new ArgumentException("Teklif bulunamadı.");
        var maxRev = await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(RevisionNo),0) FROM dbo.CRM_Offer WHERE DocNum=@d", new { d = src.DocNum });
        src.ParentOfferID = src.OfferID;
        src.OfferID = 0;
        src.RevisionNo = maxRev + 1;
        src.OfferDate = DateTime.Today;
        src.Status = 0;
        foreach (var l in src.Lines) l.OfferLineID = 0;
        var newId = await SaveOfferAsync(src, userId);
        await _db.ExecuteAsync("UPDATE dbo.CRM_Offer SET Status=4, UpdateDate=SYSDATETIME() WHERE OfferID=@id", new { id });
        return newId;
    });

    /// <summary>Kopyala: yeni belge numarası ile (istenirse başka fırsata).</summary>
    public Task<int> CopyOfferAsync(int id, int? targetOpportunityId, int userId) => Guard(async () =>
    {
        var src = await GetOfferAsync(id) ?? throw new ArgumentException("Teklif bulunamadı.");
        src.OfferID = 0;
        src.DocNum = 0;
        src.RevisionNo = 0;
        src.ParentOfferID = null;
        src.OfferDate = DateTime.Today;
        src.Status = 0;
        if (targetOpportunityId is int t && t > 0 && t != src.OpportunityID)
        {
            src.OpportunityID = t;
            src.ActionID = null;
        }
        return await SaveOfferAsync(src, userId);
    });

    public Task<int> SetOfferStatusAsync(int id, byte status) => Guard(async () =>
        await _db.ExecuteAsync("UPDATE dbo.CRM_Offer SET Status=@status, UpdateDate=SYSDATETIME() WHERE OfferID=@id", new { id, status }));

    public Task<int> DeleteOfferAsync(int id) => Guard(async () =>
    {
        EnsureOpen();
        using var tx = _db.BeginTransaction();
        await _db.ExecuteAsync("DELETE FROM dbo.CRM_OfferLine WHERE OfferID=@id; UPDATE dbo.CRM_MailLog SET OfferID=NULL WHERE OfferID=@id;", new { id }, tx);
        var n = await _db.ExecuteAsync("DELETE FROM dbo.CRM_Offer WHERE OfferID=@id", new { id }, tx);
        tx.Commit();
        return n;
    });

    // ─── Görüşmeler ───────────────────────────────────────────────────────
    public Task<List<CrmMeetingDto>> ListMeetingsAsync(int opportunityId) => Guard(async () =>
        (await _db.QueryAsync<CrmMeetingDto>(@"
SELECT m.*, LTRIM(RTRIM(ISNULL(cu.Name,'') + ' ' + ISNULL(cu.Surname,''))) AS CreateUserName
FROM dbo.CRM_Meeting m LEFT JOIN dbo.SystemUser cu ON cu.SystemUserID = m.CreateUserID
WHERE m.OpportunityID=@opportunityId ORDER BY m.MeetingDate DESC, m.MeetingID DESC", new { opportunityId })).ToList());

    public Task<int> SaveMeetingAsync(CrmMeetingDto m, int userId) => Guard(async () =>
    {
        if (m.OpportunityID <= 0) throw new ArgumentException("Fırsat seçilmedi.");
        if (m.MeetingDate == default) m.MeetingDate = DateTime.Now;
        if (m.MeetingID > 0)
        {
            await _db.ExecuteAsync(@"UPDATE dbo.CRM_Meeting SET ActionID=@ActionID, MeetingDate=@MeetingDate, Channel=@Channel, Direction=@Direction,
  ContactName=@ContactName, Subject=@Subject, Notes=@Notes, DurationMin=@DurationMin, NextStep=@NextStep, NextStepDate=@NextStepDate
WHERE MeetingID=@MeetingID", m);
        }
        else
        {
            m.CreateUserID = userId > 0 ? userId : null;
            m.MeetingID = await _db.ExecuteScalarAsync<int>(@"INSERT INTO dbo.CRM_Meeting
  (OpportunityID, ActionID, MeetingDate, Channel, Direction, ContactName, Subject, Notes, DurationMin, NextStep, NextStepDate, CreateUserID)
OUTPUT INSERTED.MeetingID
VALUES (@OpportunityID, @ActionID, @MeetingDate, @Channel, @Direction, @ContactName, @Subject, @Notes, @DurationMin, @NextStep, @NextStepDate, @CreateUserID)", m);
        }
        await TouchOpportunityAsync(m.OpportunityID);
        return m.MeetingID;
    });

    public Task<int> DeleteMeetingAsync(int id) => Guard(async () =>
        await _db.ExecuteAsync("DELETE FROM dbo.CRM_Meeting WHERE MeetingID=@id", new { id }));

    // ─── Mail kaydı ───────────────────────────────────────────────────────
    private const string MailSelect = @"
SELECT l.MailLogID, l.OpportunityID, l.ActionID, l.OfferID, l.Direction, l.Status, l.Channel, l.TagCode, l.Subject,
       l.MailFrom, l.MailTo, l.MailCc, l.Body, l.IsHtml, l.AttachmentNames, l.MessageId, l.ErrorMessage, l.MailDate,
       l.CreateDate, l.CreateUserID, l.Source, l.RawFileName,
       CAST(CASE WHEN l.RawMessage IS NULL THEN 0 ELSE 1 END AS BIT) AS HasRaw,
       f.DocNum AS OfferDocNum
FROM dbo.CRM_MailLog l
LEFT JOIN dbo.CRM_Offer f ON f.OfferID = l.OfferID";

    public Task<List<CrmMailLogDto>> ListMailsAsync(int opportunityId, int? offerId) => Guard(async () =>
        (await _db.QueryAsync<CrmMailLogDto>(MailSelect + @"
WHERE l.OpportunityID=@opportunityId AND (@offerId IS NULL OR l.OfferID=@offerId OR l.OfferID IS NULL)
ORDER BY ISNULL(l.MailDate, l.CreateDate) DESC", new { opportunityId, offerId })).ToList());

    public Task<List<CrmMailLogDto>> ListMailsForOpportunitiesAsync(IEnumerable<int> ids, int take) => Guard(async () =>
    {
        var arr = ids.Distinct().ToArray();
        if (arr.Length == 0) return new List<CrmMailLogDto>();
        return (await _db.QueryAsync<CrmMailLogDto>(MailSelect.Replace("SELECT l.", $"SELECT TOP ({take}) l.") + @"
WHERE l.OpportunityID IN @arr ORDER BY ISNULL(l.MailDate, l.CreateDate) DESC", new { arr })).ToList();
    });

    public Task<CrmMailLogDto?> GetMailAsync(int id) => Guard(async () =>
        await _db.QueryFirstOrDefaultAsync<CrmMailLogDto>(MailSelect + " WHERE l.MailLogID=@id", new { id }));

    public Task<(byte[]? Raw, string? Name)> GetMailRawAsync(int id) => Guard(async () =>
    {
        var r = await _db.QueryFirstOrDefaultAsync<(byte[]? Raw, string? Name)>(
            "SELECT RawMessage, RawFileName FROM dbo.CRM_MailLog WHERE MailLogID=@id", new { id });
        return r;
    });

    public sealed class MailLogWrite
    {
        public int MailLogID { get; set; }
        public int? OpportunityID { get; set; }
        public int? ActionID { get; set; }
        public int? OfferID { get; set; }
        public byte Direction { get; set; }
        public byte Status { get; set; }
        public string Channel { get; set; } = "";
        public string? TagCode { get; set; }
        public string? Subject { get; set; }
        public string? MailFrom { get; set; }
        public string? MailTo { get; set; }
        public string? MailCc { get; set; }
        public string? Body { get; set; }
        public bool IsHtml { get; set; }
        public string? AttachmentNames { get; set; }
        public string? MessageId { get; set; }
        public byte[]? RawMessage { get; set; }
        public string? RawFileName { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime? MailDate { get; set; }
        public int? CreateUserID { get; set; }
        public string? Source { get; set; }
    }

    public Task<int> InsertMailAsync(MailLogWrite m) => Guard(async () =>
        await _db.ExecuteScalarAsync<int>(@"INSERT INTO dbo.CRM_MailLog
  (OpportunityID, ActionID, OfferID, Direction, Status, Channel, TagCode, Subject, MailFrom, MailTo, MailCc, Body, IsHtml,
   AttachmentNames, MessageId, RawMessage, RawFileName, ErrorMessage, MailDate, CreateUserID, Source)
OUTPUT INSERTED.MailLogID
VALUES (@OpportunityID, @ActionID, @OfferID, @Direction, @Status, @Channel, @TagCode, @Subject, @MailFrom, @MailTo, @MailCc, @Body, @IsHtml,
   @AttachmentNames, @MessageId, @RawMessage, @RawFileName, @ErrorMessage, @MailDate, @CreateUserID, @Source)", m));

    /// <summary>Outlook'tan gelen kayıt: mevcut taslağı günceller (Taslak → Gönderildi).</summary>
    public Task<int> UpdateMailFromOutlookAsync(MailLogWrite m) => Guard(async () =>
        await _db.ExecuteAsync(@"UPDATE dbo.CRM_MailLog SET
  Status=@Status, Channel=@Channel, TagCode=@TagCode, Subject=@Subject, MailFrom=@MailFrom,
  MailTo=ISNULL(@MailTo, MailTo), MailCc=ISNULL(@MailCc, MailCc),
  Body=ISNULL(@Body, Body), IsHtml=CASE WHEN @Body IS NULL THEN IsHtml ELSE @IsHtml END,
  AttachmentNames=ISNULL(@AttachmentNames, AttachmentNames), MessageId=ISNULL(@MessageId, MessageId),
  RawMessage=ISNULL(@RawMessage, RawMessage), RawFileName=ISNULL(@RawFileName, RawFileName),
  MailDate=@MailDate, Source=@Source
WHERE MailLogID=@MailLogID", m));

    public Task<int?> FindMailByMessageIdAsync(string messageId) => Guard(async () =>
        await _db.ExecuteScalarAsync<int?>("SELECT TOP 1 MailLogID FROM dbo.CRM_MailLog WHERE MessageId=@messageId AND Status<>0 ORDER BY MailLogID",
            new { messageId }));

    public Task<int?> FindDraftAsync(int opportunityId, string subject) => Guard(async () =>
        await _db.ExecuteScalarAsync<int?>(@"SELECT TOP 1 MailLogID FROM dbo.CRM_MailLog
WHERE OpportunityID=@opportunityId AND Status=0 AND Direction=1 AND Subject=@subject ORDER BY CreateDate DESC",
            new { opportunityId, subject }));

    public Task<int?> FindRecentSmtpCopyAsync(int opportunityId, string subject) => Guard(async () =>
        await _db.ExecuteScalarAsync<int?>(@"SELECT TOP 1 MailLogID FROM dbo.CRM_MailLog
WHERE OpportunityID=@opportunityId AND Channel='SMTP' AND Subject=@subject AND CreateDate > DATEADD(DAY,-2,SYSDATETIME())",
            new { opportunityId, subject }));

    public Task<(int? OfferID, int? ActionID)> LastOfferLinkAsync(int opportunityId) => Guard(async () =>
    {
        var r = await _db.QueryFirstOrDefaultAsync<(int? OfferID, int? ActionID)>(@"
SELECT TOP 1 OfferID, ActionID FROM (
  SELECT OfferID, ActionID, CreateDate FROM dbo.CRM_MailLog WHERE OpportunityID=@opportunityId AND OfferID IS NOT NULL
  UNION ALL
  SELECT OfferID, ActionID, CreateDate FROM dbo.CRM_Offer WHERE OpportunityID=@opportunityId AND IsActive=1
) x ORDER BY CreateDate DESC", new { opportunityId });
        return r;
    });

    public Task<bool> OpportunityExistsAsync(int id) => Guard(async () =>
        await _db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.CRM_Opportunity WHERE OpportunityID=@id", new { id }) > 0);

    public Task<List<CrmOpportunityDto>> ListCustomerOpportunitiesAsync(int customerId, int take = 100) => Guard(async () =>
        (await _db.QueryAsync<CrmOpportunityDto>(OppSelect.Replace("SELECT o.*", $"SELECT TOP ({take}) o.*") +
            " WHERE o.CustomerCardID=@customerId ORDER BY o.CreateDate DESC", new { customerId })).ToList());

    public async Task<CrmLookupItem?> GetCustomerAsync(int id) =>
        await _db.QueryFirstOrDefaultAsync<CrmLookupItem>(
            "SELECT CustomerCardID AS Id, Code, Title, TaxNr AS Extra FROM dbo.CustomerCard WHERE CustomerCardID=@id", new { id });

    public async Task<CrmUserDto?> GetUserAsync(int id) =>
        (await ListUsersAsync()).FirstOrDefault(u => u.SystemUserID == id);
}
