using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EGovConsoleKindTotal
{
    /// <summary>1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye</summary>
    public byte DocKind { get; set; }
    /// <summary>1 Gelen · 2 Giden</summary>
    public byte Direction { get; set; }
    public int Count { get; set; }
    /// <summary>TL belgelerin vergiler dahil tutarı (döviz belgeler ForeignCount'ta)</summary>
    public decimal AmountTry { get; set; }
    public int ForeignCount { get; set; }
}

public sealed class EGovConsoleDay
{
    public DateTime Day { get; set; }
    public int Incoming { get; set; }
    public int Outgoing { get; set; }
}

public sealed class EGovConsoleAttention
{
    public int EGovDocumentID { get; set; }
    public byte DocKind { get; set; }
    public byte Direction { get; set; }
    public string? DocumentNo { get; set; }
    public string? CustomerTitle { get; set; }
    public decimal? Amount { get; set; }
    public string? CurrencyCode { get; set; }
    public DateTime? DocDate { get; set; }
    /// <summary>new · pending · approved · rejected · error</summary>
    public string Stage { get; set; } = "";
    public string? Status { get; set; }
    public string? PendingRoleName { get; set; }
    public string? Comment { get; set; }
    /// <summary>Onaya gönderildiğinden (yoksa belge tarihinden) bu yana gün</summary>
    public int AgeDays { get; set; }
}

public sealed class EGovConsoleSummary
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    /// <summary>Onay süreci (76) kurulu mu — değilse aşamalar yalnız yeni / kaydedildi</summary>
    public bool ApprovalReady { get; set; }
    public List<EGovConsoleKindTotal> Kinds { get; set; } = new();
    /// <summary>Gelen e-Fatura / e-Arşiv onay aşamaları: new · pending · approved · saved · rejected</summary>
    public Dictionary<string, int> Stages { get; set; } = new();
    /// <summary>GİB / entegratör durumu hatalı ya da reddedilmiş belgeler (Status metni)</summary>
    public int StatusErrors { get; set; }
    public List<EGovConsoleDay> Daily { get; set; } = new();
    public List<EGovConsoleAttention> Attention { get; set; } = new();
}

/// <summary>
/// e-Belge konsolu: seçilen dönemde gelen / giden e-Fatura · e-Arşiv · e-İrsaliye sayıları ve tutarları,
/// gelen fatura onay aşamaları, günlük dağılım ve dikkat bekleyen belgeler. Yalnız okuma.
/// Belge tarihi: IssueDate, yoksa DocumentDate, yoksa CreatedAt. Silinmiş (IsActive = 0) belgeler hariç.
/// </summary>
public sealed class EGovConsoleRepository
{
    /// <summary>Status metninde hata / ret sayılan ifadeler (e-Logo ve GİB durum metinleri)</summary>
    private const string ErrorStatusSql =
        "(e.Status LIKE N'%hata%' OR e.Status LIKE N'%red%' OR e.Status LIKE N'%iptal%' OR e.Status LIKE N'%başarısız%' OR e.Status LIKE N'%error%')";

    private readonly IDbConnection _db;

    public EGovConsoleRepository(IDbConnection db) => _db = db;

    public async Task<EGovConsoleSummary> GetAsync(DateTime from, DateTime to, byte? docKind, CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var r = new EGovConsoleSummary { From = from.Date, To = to.Date };
        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.EGovDocument', N'U') IS NULL THEN 0 ELSE 1 END", cancellationToken: ct)) == 0)
            return r;

        var hasProcess = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ProcessInstance', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_ProcessTask', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_Role', N'U') IS NOT NULL THEN 1 ELSE 0 END",
            cancellationToken: ct)) == 1;
        r.ApprovalReady = hasProcess;
        var apply = hasProcess ? EGovIncomingRepository.StageApplySql(await EGovIncomingRepository.HasGroupsAsync(_db, ct)) : "";
        var stageExpr = hasProcess ? EGovIncomingRepository.StageExprSql : "CASE WHEN e.InvoiceID IS NOT NULL THEN 'saved' ELSE 'new' END";
        var extra = hasProcess
            ? "pt.RoleName AS PendingRoleName, ap.LastComment AS Comment, (SELECT StartedAt FROM dbo.SYS_ProcessInstance WHERE ProcessInstanceID = ap.ProcessInstanceID) AS SentAt"
            : "CAST(NULL AS nvarchar(150)) AS PendingRoleName, CAST(NULL AS nvarchar(max)) AS Comment, CAST(NULL AS datetime2) AS SentAt";

        // Ortak taban: dönem + tür süzgeci, belge tarihi ve onay aşaması
        var baseSql = $"""
            WITH d AS (
              SELECT e.EGovDocumentID, e.DocKind, e.Direction, e.DocumentNo, e.CustomerTitle, e.Status,
                     ISNULL(e.Amount, 0) AS Amount, NULLIF(LTRIM(RTRIM(e.CurrencyCode)), N'') AS CurrencyCode,
                     CAST(COALESCE(e.IssueDate, e.DocumentDate, e.CreatedAt) AS date) AS DocDate,
                     ({stageExpr}) AS Stage,
                     CASE WHEN {ErrorStatusSql} THEN 1 ELSE 0 END AS IsError,
                     {extra}
              FROM dbo.EGovDocument e
              {apply}
              WHERE ISNULL(e.IsActive, 1) = 1
                AND (@docKind IS NULL OR e.DocKind = @docKind)
                AND CAST(COALESCE(e.IssueDate, e.DocumentDate, e.CreatedAt) AS date) BETWEEN @from AND @to
            )
            """;
        var args = new { from = r.From, to = r.To, docKind };

        r.Kinds = (await _db.QueryAsync<EGovConsoleKindTotal>(new CommandDefinition(baseSql + """
            SELECT DocKind, Direction, COUNT(*) AS [Count],
                   SUM(CASE WHEN CurrencyCode IS NULL OR CurrencyCode IN (N'TRY', N'TL') THEN Amount ELSE 0 END) AS AmountTry,
                   SUM(CASE WHEN CurrencyCode IS NULL OR CurrencyCode IN (N'TRY', N'TL') THEN 0 ELSE 1 END) AS ForeignCount
            FROM d GROUP BY DocKind, Direction
            """, args, cancellationToken: ct))).ToList();

        // Onay aşamaları yalnız gelen fatura (e-Fatura / e-Arşiv) için anlamlı
        var stages = await _db.QueryAsync<(string Stage, int N)>(new CommandDefinition(baseSql + """
            SELECT Stage, COUNT(*) FROM d WHERE Direction = 1 AND DocKind IN (1, 2) GROUP BY Stage
            """, args, cancellationToken: ct));
        foreach (var s in new[] { "new", "pending", "approved", "saved", "rejected" }) r.Stages[s] = 0;
        foreach (var (stage, n) in stages) r.Stages[stage] = n;

        r.StatusErrors = await _db.ExecuteScalarAsync<int>(new CommandDefinition(baseSql + "SELECT COUNT(*) FROM d WHERE IsError = 1",
            args, cancellationToken: ct));

        var days = (await _db.QueryAsync<EGovConsoleDay>(new CommandDefinition(baseSql + """
            SELECT DocDate AS Day,
                   SUM(CASE WHEN Direction = 1 THEN 1 ELSE 0 END) AS Incoming,
                   SUM(CASE WHEN Direction = 2 THEN 1 ELSE 0 END) AS Outgoing
            FROM d GROUP BY DocDate
            """, args, cancellationToken: ct))).ToDictionary(x => x.Day.Date);
        for (var day = r.From; day <= r.To; day = day.AddDays(1))
            r.Daily.Add(days.TryGetValue(day, out var x) ? x : new EGovConsoleDay { Day = day });

        // Dikkat bekleyenler: onayda / onaylanıp kaydedilmemiş / reddedilmiş gelen faturalar + hatalı durumlar — en eskisi önce
        r.Attention = (await _db.QueryAsync<EGovConsoleAttention>(new CommandDefinition(baseSql + """
            SELECT TOP 15 EGovDocumentID, DocKind, Direction, DocumentNo, CustomerTitle, Amount, CurrencyCode, DocDate,
                   CASE WHEN IsError = 1 THEN 'error' ELSE Stage END AS Stage, Status, PendingRoleName, Comment,
                   DATEDIFF(DAY, COALESCE(SentAt, DocDate), SYSDATETIME()) AS AgeDays
            FROM d
            WHERE IsError = 1 OR (Direction = 1 AND DocKind IN (1, 2) AND Stage IN ('pending', 'approved', 'rejected'))
            ORDER BY CASE WHEN IsError = 1 THEN 0 WHEN Stage = 'rejected' THEN 1 ELSE 2 END, COALESCE(SentAt, DocDate)
            """, args, cancellationToken: ct))).ToList();
        return r;
    }
}
