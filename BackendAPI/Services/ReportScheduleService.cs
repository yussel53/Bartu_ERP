using System.Data;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text.Json;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class ReportScheduleDto
{
    public int Id { get; set; }
    public int ReportId { get; set; }
    public string? ReportName { get; set; }
    public string? Title { get; set; }
    public string Recipients { get; set; } = "";
    public int Frequency { get; set; } = 1;
    public int RunHour { get; set; } = 8;
    public int? WeekDay { get; set; }
    public int? MonthDay { get; set; }
    public string? ParamsJson { get; set; }
    public int? OwnerUserID { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastRunAt { get; set; }
    public string? LastStatus { get; set; }
    public DateTime? NextRunAt { get; set; }
}

/// <summary>
/// Y-13: zamanlanmış rapor e-postası (SYS_SqlReportSchedule, SqlUpdates/89). Raporu filtre öndeğerleri + zamanlama parametreleriyle
/// çalıştırır, Excel olarak ekler ve sahibinin SMTP tanımıyla gönderir. Saatler Türkiye saatidir.
/// </summary>
public sealed class ReportScheduleService
{
    private static readonly TimeZoneInfo Tz = FindTz();
    private readonly IDbConnection _db;
    private readonly SqlReportsRepository _reports;
    private readonly CrmMailService _mail;

    public ReportScheduleService(IDbConnection db, SqlReportsRepository reports, CrmMailService mail)
    {
        _db = db;
        _reports = reports;
        _mail = mail;
    }

    private static TimeZoneInfo FindTz()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time"); }
        catch
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"); }
            catch { return TimeZoneInfo.Local; }
        }
    }

    public static DateTime NowTr() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz);

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<bool> ReadyAsync() =>
        await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID('dbo.SYS_SqlReportSchedule') IS NULL THEN 0 ELSE 1 END") == 1;

    /// <summary>Bir sonraki çalışma (Türkiye saati) — «after» anından sonraki ilk uygun an</summary>
    public static DateTime NextRun(ReportScheduleDto s, DateTime after)
    {
        var hour = Math.Clamp(s.RunHour, 0, 23);
        var d = after.Date.AddHours(hour);
        for (var i = 0; i < 400; i++, d = d.AddDays(1))
        {
            if (d <= after) continue;
            var ok = s.Frequency switch
            {
                2 => ((int)d.DayOfWeek + 6) % 7 + 1 == Math.Clamp(s.WeekDay ?? 1, 1, 7),
                3 => d.Day == Math.Clamp(s.MonthDay ?? 1, 1, 28),
                _ => true,
            };
            if (ok) return d;
        }
        return after.AddDays(1);
    }

    /// <summary>Tarih anahtarı → yyyy-MM-dd (boş: bugün · -N days · year_start · month_start · prev_month_start · prev_month_end)</summary>
    public static string ResolveDate(string? raw, DateTime today)
    {
        var v = (raw ?? "").Trim().ToLowerInvariant();
        DateTime d;
        if (v == "") d = today;
        else if (v == "year_start") d = new DateTime(today.Year, 1, 1);
        else if (v == "month_start") d = new DateTime(today.Year, today.Month, 1);
        else if (v == "prev_month_start") d = new DateTime(today.Year, today.Month, 1).AddMonths(-1);
        else if (v == "prev_month_end") d = new DateTime(today.Year, today.Month, 1).AddDays(-1);
        else if (System.Text.RegularExpressions.Regex.Match(v, @"^(-?\d+)\s*days?$") is { Success: true } m) d = today.AddDays(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture));
        else return raw!.Trim();
        return d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private sealed class FilterDef
    {
        public string? var_name { get; set; }
        public string? type { get; set; }
        public string? default_val { get; set; }
    }

    private async Task<(string Name, Dictionary<string, string> Params)> BuildParamsAsync(int reportId, string? paramsJson)
    {
        var r = await _db.QueryFirstOrDefaultAsync<(string Name, string? Filters)?>(
            "SELECT Name, FiltersConfig FROM dbo.SYS_SqlReport WHERE Id = @reportId", new { reportId })
            ?? throw new InvalidOperationException("Rapor bulunamadı.");
        var today = NowTr().Date;
        var overrides = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(paramsJson))
            foreach (var (k, v) in JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(paramsJson) ?? new())
                overrides[k] = v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : v.ToString();
        var p = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        List<FilterDef> defs;
        try { defs = JsonSerializer.Deserialize<List<FilterDef>>(r.Filters ?? "[]") ?? new(); }
        catch { defs = new(); }
        foreach (var f in defs.Where(f => !string.IsNullOrWhiteSpace(f.var_name)))
        {
            var raw = overrides.TryGetValue(f.var_name!, out var o) ? o : f.default_val ?? "";
            p[f.var_name!] = f.type == "date" ? ResolveDate(raw, today) : raw;
        }
        foreach (var (k, v) in overrides.Where(x => !p.ContainsKey(x.Key)))
            p[k] = k.EndsWith("_date", StringComparison.OrdinalIgnoreCase) ? ResolveDate(v, today) : v;
        return (r.Name, p);
    }

    public async Task<List<ReportScheduleDto>> ListAsync()
    {
        Open();
        return (await _db.QueryAsync<ReportScheduleDto>(
            @"SELECT s.Id, s.ReportId, r.Name AS ReportName, s.Title, s.Recipients, s.Frequency, s.RunHour, s.WeekDay, s.MonthDay, s.ParamsJson,
  s.OwnerUserID, s.IsActive, s.LastRunAt, s.LastStatus, s.NextRunAt
FROM dbo.SYS_SqlReportSchedule s LEFT JOIN dbo.SYS_SqlReport r ON r.Id = s.ReportId ORDER BY s.Id")).ToList();
    }

    public async Task<int> SaveAsync(ReportScheduleDto s, int? userId)
    {
        Open();
        if (string.IsNullOrWhiteSpace(s.Recipients)) throw new InvalidOperationException("Alıcı e-posta adresi girin.");
        if (!string.IsNullOrWhiteSpace(s.ParamsJson))
        {
            try { JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(s.ParamsJson); }
            catch { throw new InvalidOperationException("Parametreler geçerli JSON olmalı, ör. {\"start_date\":\"prev_month_start\"}."); }
        }
        var next = NextRun(s, NowTr());
        if (s.Id > 0)
        {
            await _db.ExecuteAsync(
                @"UPDATE dbo.SYS_SqlReportSchedule SET ReportId = @ReportId, Title = @Title, Recipients = @Recipients, Frequency = @Frequency,
  RunHour = @RunHour, WeekDay = @WeekDay, MonthDay = @MonthDay, ParamsJson = @ParamsJson, IsActive = @IsActive, NextRunAt = @next
WHERE Id = @Id", new { s.ReportId, s.Title, s.Recipients, s.Frequency, s.RunHour, s.WeekDay, s.MonthDay, s.ParamsJson, s.IsActive, next, s.Id });
            return s.Id;
        }
        return await _db.ExecuteScalarAsync<int>(
            @"INSERT INTO dbo.SYS_SqlReportSchedule (ReportId, Title, Recipients, Frequency, RunHour, WeekDay, MonthDay, ParamsJson, OwnerUserID, IsActive, NextRunAt)
OUTPUT INSERTED.Id VALUES (@ReportId, @Title, @Recipients, @Frequency, @RunHour, @WeekDay, @MonthDay, @ParamsJson, @userId, @IsActive, @next)",
            new { s.ReportId, s.Title, s.Recipients, s.Frequency, s.RunHour, s.WeekDay, s.MonthDay, s.ParamsJson, userId, s.IsActive, next });
    }

    public async Task DeleteAsync(int id)
    {
        Open();
        await _db.ExecuteAsync("DELETE FROM dbo.SYS_SqlReportSchedule WHERE Id = @id", new { id });
    }

    /// <summary>Raporu çalıştırır; send = false ise yalnız dosyayı üretir (önizleme / indirme).</summary>
    public async Task<(bool Ok, string Message, byte[]? File, string? FileName)> RunAsync(int id, bool send, CancellationToken ct = default)
    {
        Open();
        var s = (await ListAsync()).FirstOrDefault(x => x.Id == id) ?? throw new InvalidOperationException("Zamanlama bulunamadı.");
        string status;
        byte[]? file = null;
        string? fileName = null;
        var ok = false;
        try
        {
            var (name, p) = await BuildParamsAsync(s.ReportId, s.ParamsJson);
            var res = await _reports.RunAsync(new SqlReportRunRequest { ReportId = s.ReportId, Parameters = p, MaxRows = 50000, IsAdmin = true }, ct);
            if (!res.Success) throw new InvalidOperationException(res.Message ?? "Rapor çalışmadı.");
            var rows = res.Rows.Select(r => (IReadOnlyList<string?>)res.Columns.Select(c => Cell(r.GetValueOrDefault(c))).ToList());
            file = SpreadsheetWriter.Write(Safe(name, 31), await HeadersAsync(s.ReportId, res.Columns), rows);
            fileName = $"{Safe(name, 80)}_{NowTr():yyyyMMdd}.xlsx";
            var title = string.IsNullOrWhiteSpace(s.Title) ? name : s.Title!;
            if (send)
            {
                var body = $"{title}\n\nÇalışma: {NowTr():dd.MM.yyyy HH:mm} · {res.RowCount} satır\nParametreler: " +
                           string.Join(", ", p.Select(x => $"{x.Key} = {x.Value}")) + "\n\nBu e-posta KaviSoft zamanlanmış rapor görevi ile gönderildi.";
                await SendAsync(s.OwnerUserID ?? 0, s.Recipients, title, body, file, fileName);
                status = $"Gönderildi ({res.RowCount} satır)";
            }
            else status = $"Hazırlandı ({res.RowCount} satır)";
            ok = true;
        }
        catch (Exception ex)
        {
            status = "Hata: " + ex.Message;
        }
        if (send)
            await _db.ExecuteAsync(
                "UPDATE dbo.SYS_SqlReportSchedule SET LastRunAt = SYSDATETIME(), LastStatus = @status, NextRunAt = @next WHERE Id = @id",
                new { status = status.Length > 500 ? status[..500] : status, next = NextRun(s, NowTr()), id });
        return (ok, status, file, fileName);
    }

    /// <summary>Zamanı gelen etkin görevler (görev servisinden)</summary>
    public async Task<int> RunDueAsync(CancellationToken ct)
    {
        Open();
        if (!await ReadyAsync()) return 0;
        var now = NowTr();
        var due = (await _db.QueryAsync<int>(
            "SELECT Id FROM dbo.SYS_SqlReportSchedule WHERE IsActive = 1 AND NextRunAt IS NOT NULL AND NextRunAt <= @now", new { now })).ToList();
        foreach (var id in due) await RunAsync(id, true, ct);
        return due.Count;
    }

    private async Task SendAsync(int userId, string recipients, string subject, string body, byte[] file, string fileName)
    {
        var prof = (await _mail.ResolveProfileAsync(userId)).Profile;
        var host = prof?.SmtpHost?.Trim();
        if (prof == null || string.IsNullOrWhiteSpace(host))
            throw new InvalidOperationException("SMTP tanımı yok (CRM → Mail tanımları ya da genel SMTP ayarı).");
        var from = string.IsNullOrWhiteSpace(prof.FromAddress) ? prof.SmtpUser : prof.FromAddress;
        if (string.IsNullOrWhiteSpace(from)) throw new InvalidOperationException("SMTP gönderen adresi yok.");
        using var msg = new MailMessage { From = new MailAddress(from!.Trim()), Subject = subject, Body = body };
        foreach (var to in recipients.Split([',', ';', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            msg.To.Add(to);
        if (msg.To.Count == 0) throw new InvalidOperationException("Geçerli alıcı yok.");
        msg.Attachments.Add(new Attachment(new MemoryStream(file), fileName,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        using var client = new SmtpClient(host, prof.SmtpPort ?? 587) { EnableSsl = prof.SmtpSsl, DeliveryMethod = SmtpDeliveryMethod.Network };
        if (!string.IsNullOrWhiteSpace(prof.SmtpUser))
            client.Credentials = new NetworkCredential(prof.SmtpUser!.Trim(), prof.SmtpPassword ?? "");
        await client.SendMailAsync(msg);
    }

    /// <summary>Sütun başlıkları: raporun sütun biçimlerindeki etiket (yoksa sütun adı)</summary>
    private async Task<List<string>> HeadersAsync(int reportId, List<string> cols)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var json = await _db.ExecuteScalarAsync<string?>("SELECT ColumnFormats FROM dbo.SYS_SqlReport WHERE Id = @reportId", new { reportId });
            foreach (var e in JsonSerializer.Deserialize<List<JsonElement>>(json ?? "[]") ?? new())
                if (e.TryGetProperty("col", out var c) && e.TryGetProperty("label", out var l) && !string.IsNullOrWhiteSpace(l.GetString()))
                    map[c.GetString() ?? ""] = l.GetString()!;
        }
        catch
        {
            /* biçim yoksa sütun adları */
        }
        return cols.Select(c => map.GetValueOrDefault(c) ?? c).ToList();
    }

    private static string? Cell(object? v) => v switch
    {
        null => null,
        DateTime d => d.TimeOfDay == TimeSpan.Zero ? d.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture) : d.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => v.ToString(),
    };

    private static string Safe(string s, int max)
    {
        var x = new string(s.Select(ch => Path.GetInvalidFileNameChars().Contains(ch) || ch is '[' or ']' or ':' or '*' or '?' or '/' or '\\' ? '_' : ch).ToArray()).Trim();
        return x.Length > max ? x[..max] : x.Length == 0 ? "Rapor" : x;
    }
}

/// <summary>Zamanlanmış raporlar — 5 dakikada bir, sunucudaki her Bartu veritabanında zamanı gelenleri gönderir.</summary>
public sealed class ReportScheduleJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly DbConnectionStore _store;
    private readonly ILogger<ReportScheduleJob> _log;

    public ReportScheduleJob(IServiceScopeFactory scopes, DbConnectionStore store, ILogger<ReportScheduleJob> log)
    {
        _scopes = scopes;
        _store = store;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(75), stoppingToken); }
        catch (OperationCanceledException) { return; }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var dbs = _store.GetSettings().HasMinimumInfo()
                    ? _scopes.CreateScope().ServiceProvider.GetRequiredService<TenantDbRegistry>().List()
                    : Array.Empty<string>();
                foreach (var name in dbs)
                {
                    try
                    {
                        using var scope = _scopes.CreateScope();
                        scope.ServiceProvider.GetRequiredService<CurrentDatabase>().Name = name;
                        var n = await scope.ServiceProvider.GetRequiredService<ReportScheduleService>().RunDueAsync(stoppingToken);
                        if (n > 0) _log.LogInformation("Zamanlanmış rapor: {Db} — {Count} görev çalıştı", name, n);
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                    {
                        _log.LogWarning(ex, "Zamanlanmış rapor görevi hatası: {Db}", name);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _log.LogWarning(ex, "Zamanlanmış rapor görevi hatası");
            }
            try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
