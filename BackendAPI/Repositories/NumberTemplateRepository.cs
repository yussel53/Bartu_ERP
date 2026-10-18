using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

public sealed class NumberAllocateRequest
{
    public string? FormCode { get; set; }
    public string? TableName { get; set; }
    public string? CompanyId { get; set; }
    public string? WorkplaceId { get; set; }
    public string? WhouseId { get; set; }
    public string? UserId { get; set; }
    public string? CompanyCode { get; set; }
    public string? WorkplaceCode { get; set; }
    public string? WhouseCode { get; set; }
    public string? UserName { get; set; }
    /** Fiş tarihi — geçerlilik aralığı kontrolü (yyyy-MM-dd) */
    public string? DocumentDate { get; set; }
    /** Yalnız önizleme: sayaç artırılmaz (yeni fiş açılınca gösterilen «Otomatik: …») — Y-05 */
    public bool Peek { get; set; }
}

/// <summary>Kayıtta numara ver (Y-05): alan boşsa kaydetmeden hemen önce şablondan numara alınır</summary>
public sealed class AutoNumberRequest
{
    public string Field { get; set; } = "";
    public NumberAllocateRequest Request { get; set; } = new();
}

public sealed class NumberAllocateResult
{
    public bool Success { get; set; }
    public string? Number { get; set; }
    public int? TemplateId { get; set; }
    public string? TemplateCode { get; set; }
    public string? Pattern { get; set; }
    public string? Message { get; set; }
}

public sealed class NumberTemplateRow
{
    public int TemplateId { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string? FormCode { get; set; }
    public string? TableName { get; set; }
    public byte ScopeType { get; set; }
    public string Pattern { get; set; } = "";
    public int SeqPad { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; }
    public string? Notes { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }
    public long StartNumber { get; set; } = 1;
    public long? EndNumber { get; set; }
    public string? FilterCompanyID { get; set; }
    public string? FilterWorkplaceID { get; set; }
    public string? FilterWhouseID { get; set; }
    public string? FilterUserId { get; set; }
    public byte PeriodKind { get; set; }
    public string? CardCode { get; set; }
}

public sealed class NumberTemplateRepository
{
    private readonly IDbConnection _db;

    public NumberTemplateRepository(IDbConnection db)
    {
        _db = db;
    }

    private SqlConnection Conn =>
        _db as SqlConnection
        ?? throw new InvalidOperationException("SQL bağlantısı gerekli");

    public async Task<bool> TableReadyAsync(CancellationToken ct = default)
    {
        await EnsureOpenAsync(ct);
        await using var cmd = Conn.CreateCommand();
        cmd.CommandText = "SELECT OBJECT_ID(N'dbo.SYS_NumberTemplate', N'U')";
        var o = await cmd.ExecuteScalarAsync(ct);
        return o != null && o != DBNull.Value;
    }

    private async Task<bool> HasColumnAsync(string col, CancellationToken ct)
    {
        await using var cmd = Conn.CreateCommand();
        cmd.CommandText = "SELECT COL_LENGTH(N'dbo.SYS_NumberTemplate', @c)";
        cmd.Parameters.AddWithValue("@c", col);
        var o = await cmd.ExecuteScalarAsync(ct);
        return o != null && o != DBNull.Value;
    }

    public async Task<List<NumberTemplateRow>> ListAsync(CancellationToken ct = default)
    {
        if (!await TableReadyAsync(ct)) return new List<NumberTemplateRow>();
        var ext = await HasColumnAsync("ValidFrom", ct);
        await using var cmd = Conn.CreateCommand();
        cmd.CommandText = ext
            ? @"
SELECT TemplateId, Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes,
       ValidFrom, ValidTo, StartNumber, EndNumber, FilterCompanyID, FilterWorkplaceID, FilterWhouseID, FilterUserId,
       PeriodKind, CardCode
FROM dbo.SYS_NumberTemplate
ORDER BY Priority DESC, ScopeType DESC, Code"
            : @"
SELECT TemplateId, Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes
FROM dbo.SYS_NumberTemplate
ORDER BY Priority DESC, ScopeType DESC, Code";
        var list = new List<NumberTemplateRow>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(ReadRow(r, ext));
        return list;
    }

    public async Task<NumberAllocateResult> AllocateAsync(NumberAllocateRequest req, CancellationToken ct = default)
    {
        if (!await TableReadyAsync(ct))
        {
            return new NumberAllocateResult
            {
                Success = false,
                Message = "SYS_NumberTemplate yok — SqlUpdates/30_number_template.sql uygulayın",
            };
        }

        var formCode = (req.FormCode ?? "").Trim();
        var tableName = (req.TableName ?? "").Trim();
        if (string.IsNullOrEmpty(formCode) && string.IsNullOrEmpty(tableName))
        {
            return new NumberAllocateResult { Success = false, Message = "FormCode veya TableName gerekli" };
        }

        var docDate = ParseDocDate(req.DocumentDate) ?? DateTime.Today;
        var ext = await HasColumnAsync("ValidFrom", ct);

        await using var tx = (SqlTransaction)await Conn.BeginTransactionAsync(ct);
        try
        {
            var tpl = await PickTemplateAsync(tx, formCode, tableName, req, docDate, ext, ct);
            if (tpl == null)
            {
                await tx.RollbackAsync(ct);
                return new NumberAllocateResult
                {
                    Success = false,
                    Message = "Uygun fiş numarası şablonu bulunamadı (form/tablo · geçerlilik · org filtresi)",
                };
            }

            var scopeKey = ResolveScopeKey(tpl.ScopeType, req);
            var periodKey = ResolvePeriodKey(tpl.Pattern, tpl.PeriodKind, docDate);
            var next = req.Peek
                ? await PeekSeqAsync(tx, tpl.TemplateId, scopeKey, periodKey, tpl.StartNumber, ct)
                : await NextSeqAsync(tx, tpl.TemplateId, scopeKey, periodKey, tpl.StartNumber, ct);
            if (req.Peek)
            {
                // Önizleme: sayaç değişmez
                await tx.RollbackAsync(ct);
                var padP = tpl.SeqPad > 0 ? tpl.SeqPad : 6;
                return new NumberAllocateResult
                {
                    Success = true,
                    Number = RenderPattern(tpl.Pattern, padP, next, req, docDate),
                    TemplateId = tpl.TemplateId,
                    TemplateCode = tpl.Code,
                    Pattern = tpl.Pattern,
                    Message = "Önizleme — numara kayıtta verilir",
                };
            }

            if (tpl.EndNumber is > 0 && next > tpl.EndNumber.Value)
            {
                await tx.RollbackAsync(ct);
                return new NumberAllocateResult
                {
                    Success = false,
                    Message = $"Şablon bitiş numarasına ulaşıldı ({tpl.EndNumber})",
                };
            }

            var pad = tpl.SeqPad > 0 ? tpl.SeqPad : 6;
            var number = RenderPattern(tpl.Pattern, pad, next, req, docDate);

            await tx.CommitAsync(ct);
            return new NumberAllocateResult
            {
                Success = true,
                Number = number,
                TemplateId = tpl.TemplateId,
                TemplateCode = tpl.Code,
                Pattern = tpl.Pattern,
            };
        }
        catch (Exception ex)
        {
            try { await tx.RollbackAsync(ct); } catch { /* ignore */ }
            return new NumberAllocateResult { Success = false, Message = ex.Message };
        }
    }

    private async Task<NumberTemplateRow?> PickTemplateAsync(
        SqlTransaction tx,
        string formCode,
        string tableName,
        NumberAllocateRequest req,
        DateTime docDate,
        bool ext,
        CancellationToken ct)
    {
        await using var cmd = Conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = ext
            ? @"
SELECT TemplateId, Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes,
       ValidFrom, ValidTo, StartNumber, EndNumber, FilterCompanyID, FilterWorkplaceID, FilterWhouseID, FilterUserId,
       PeriodKind, CardCode
FROM dbo.SYS_NumberTemplate
WHERE IsActive = 1
  AND (
        (@form <> N'' AND FormCode = @form)
     OR ( (FormCode IS NULL OR FormCode = N'') AND @table <> N'' AND TableName = @table )
     OR ( (FormCode IS NULL OR FormCode = N'') AND (TableName IS NULL OR TableName = N'') )
      )
ORDER BY
  CASE WHEN @form <> N'' AND FormCode = @form THEN 0 ELSE 1 END,
  ScopeType DESC,
  Priority DESC,
  TemplateId DESC"
            : @"
SELECT TemplateId, Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes
FROM dbo.SYS_NumberTemplate
WHERE IsActive = 1
  AND (
        (@form <> N'' AND FormCode = @form)
     OR ( (FormCode IS NULL OR FormCode = N'') AND @table <> N'' AND TableName = @table )
     OR ( (FormCode IS NULL OR FormCode = N'') AND (TableName IS NULL OR TableName = N'') )
      )
ORDER BY ScopeType DESC, Priority DESC, TemplateId DESC";
        cmd.Parameters.AddWithValue("@form", formCode);
        cmd.Parameters.AddWithValue("@table", tableName);

        var candidates = new List<NumberTemplateRow>();
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            while (await r.ReadAsync(ct))
                candidates.Add(ReadRow(r, ext));
        }

        // En spesifik org filtresi önce
        var ranked = candidates
            .Where(t => ScopeAvailable(t.ScopeType, req))
            .Where(t => InValidity(t, docDate))
            .Where(t => OrgFilterMatch(t, req))
            .OrderByDescending(SpecificityScore)
            .ThenByDescending(t => t.Priority)
            .ThenByDescending(t => t.ScopeType)
            .ToList();

        return ranked.FirstOrDefault();
    }

    private static bool InValidity(NumberTemplateRow t, DateTime docDate)
    {
        var d = docDate.Date;
        if (t.ValidFrom is DateTime vf && d < vf.Date) return false;
        if (t.ValidTo is DateTime vt && d > vt.Date) return false;
        return true;
    }

    private static bool OrgFilterMatch(NumberTemplateRow t, NumberAllocateRequest req)
    {
        if (!FilterOk(t.FilterCompanyID, req.CompanyId)) return false;
        if (!FilterOk(t.FilterWorkplaceID, req.WorkplaceId)) return false;
        if (!FilterOk(t.FilterWhouseID, req.WhouseId)) return false;
        if (!FilterOk(t.FilterUserId, req.UserId) && !FilterOk(t.FilterUserId, req.UserName))
            return false;
        return true;
    }

    /** Boş / * / Genel = tümü; aksi halde tam eşleşme */
    private static bool FilterOk(string? filter, string? value)
    {
        var f = (filter ?? "").Trim();
        if (f.Length == 0 || f == "*" || f.Equals("Genel", StringComparison.OrdinalIgnoreCase)
            || f.Equals("[Genel]", StringComparison.OrdinalIgnoreCase))
            return true;
        return string.Equals(f, (value ?? "").Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static int SpecificityScore(NumberTemplateRow t)
    {
        var s = 0;
        if (!IsGenel(t.FilterUserId)) s += 8;
        if (!IsGenel(t.FilterWhouseID)) s += 4;
        if (!IsGenel(t.FilterWorkplaceID)) s += 2;
        if (!IsGenel(t.FilterCompanyID)) s += 1;
        return s;
    }

    private static bool IsGenel(string? filter)
    {
        var f = (filter ?? "").Trim();
        return f.Length == 0 || f == "*" || f.Equals("Genel", StringComparison.OrdinalIgnoreCase)
               || f.Equals("[Genel]", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ScopeAvailable(byte scopeType, NumberAllocateRequest req) =>
        scopeType switch
        {
            1 => !string.IsNullOrWhiteSpace(req.CompanyId),
            2 => !string.IsNullOrWhiteSpace(req.WorkplaceId),
            3 => !string.IsNullOrWhiteSpace(req.WhouseId),
            4 => !string.IsNullOrWhiteSpace(req.UserId) || !string.IsNullOrWhiteSpace(req.UserName),
            _ => true,
        };

    private static string ResolveScopeKey(byte scopeType, NumberAllocateRequest req) =>
        scopeType switch
        {
            1 => (req.CompanyId ?? "").Trim(),
            2 => (req.WorkplaceId ?? "").Trim(),
            3 => (req.WhouseId ?? "").Trim(),
            4 => !string.IsNullOrWhiteSpace(req.UserId)
                ? req.UserId!.Trim()
                : (req.UserName ?? "").Trim(),
            _ => "",
        };

    private static string ResolvePeriodKey(string pattern, byte periodKind, DateTime docDate)
    {
        // PeriodKind: 0 otomatik (pattern), 1 Yıl, 2 Ay, 3 Hafta, 4 Gün, 5 Çeyrek
        if (periodKind == 1) return docDate.ToString("yyyy");
        if (periodKind == 2) return docDate.ToString("yyyyMM");
        if (periodKind == 3)
        {
            var week = ISOWeek.GetWeekOfYear(docDate);
            return $"{docDate:yyyy}-W{week:00}";
        }
        if (periodKind == 4) return docDate.ToString("yyyyMMdd");
        if (periodKind == 5)
        {
            var q = (docDate.Month - 1) / 3 + 1;
            return $"{docDate:yyyy}-Q{q}";
        }

        var p = pattern ?? "";
        var hasY = p.Contains("{YYYY}", StringComparison.OrdinalIgnoreCase)
                   || p.Contains("{YY}", StringComparison.OrdinalIgnoreCase);
        var hasM = p.Contains("{MM}", StringComparison.OrdinalIgnoreCase)
                   || p.Contains("{AY}", StringComparison.OrdinalIgnoreCase);
        var hasW = p.Contains("{WW}", StringComparison.OrdinalIgnoreCase)
                   || p.Contains("{HAFTA}", StringComparison.OrdinalIgnoreCase);
        var hasD = p.Contains("{DD}", StringComparison.OrdinalIgnoreCase)
                   || p.Contains("{GUN}", StringComparison.OrdinalIgnoreCase);
        var hasQ = p.Contains("{Q}", StringComparison.OrdinalIgnoreCase)
                   || p.Contains("{CEYREK}", StringComparison.OrdinalIgnoreCase);

        if (hasD) return docDate.ToString("yyyyMMdd");
        if (hasW)
        {
            var week = ISOWeek.GetWeekOfYear(docDate);
            return $"{docDate:yyyy}-W{week:00}";
        }
        if (hasQ)
        {
            var q = (docDate.Month - 1) / 3 + 1;
            return $"{docDate:yyyy}-Q{q}";
        }
        if (hasY && hasM) return docDate.ToString("yyyyMM");
        if (hasY) return docDate.ToString("yyyy");
        return "";
    }

    /// <summary>Sıradaki numara (sayaç artırılmadan)</summary>
    private async Task<long> PeekSeqAsync(
        SqlTransaction tx,
        int templateId,
        string scopeKey,
        string periodKey,
        long startNumber,
        CancellationToken ct)
    {
        await using var cmd = Conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "SELECT LastValue FROM dbo.SYS_NumberCounter WHERE TemplateId = @tid AND ScopeKey = @sk AND PeriodKey = @pk";
        cmd.Parameters.AddWithValue("@tid", templateId);
        cmd.Parameters.AddWithValue("@sk", scopeKey ?? "");
        cmd.Parameters.AddWithValue("@pk", periodKey ?? "");
        var o = await cmd.ExecuteScalarAsync(ct);
        return o != null && o != DBNull.Value ? Convert.ToInt64(o) + 1 : (startNumber > 0 ? startNumber : 1);
    }

    private async Task<long> NextSeqAsync(
        SqlTransaction tx,
        int templateId,
        string scopeKey,
        string periodKey,
        long startNumber,
        CancellationToken ct)
    {
        var start = startNumber > 0 ? startNumber : 1;

        await using var upd = Conn.CreateCommand();
        upd.Transaction = tx;
        upd.CommandText = @"
UPDATE dbo.SYS_NumberCounter
SET LastValue = LastValue + 1, UpdatedAt = GETDATE()
OUTPUT INSERTED.LastValue
WHERE TemplateId = @tid AND ScopeKey = @sk AND PeriodKey = @pk";
        upd.Parameters.AddWithValue("@tid", templateId);
        upd.Parameters.AddWithValue("@sk", scopeKey ?? "");
        upd.Parameters.AddWithValue("@pk", periodKey ?? "");
        var o = await upd.ExecuteScalarAsync(ct);
        if (o != null && o != DBNull.Value)
            return Convert.ToInt64(o);

        await using var ins = Conn.CreateCommand();
        ins.Transaction = tx;
        ins.CommandText = @"
INSERT INTO dbo.SYS_NumberCounter (TemplateId, ScopeKey, PeriodKey, LastValue)
VALUES (@tid, @sk, @pk, @start);
SELECT @start;";
        ins.Parameters.AddWithValue("@tid", templateId);
        ins.Parameters.AddWithValue("@sk", scopeKey ?? "");
        ins.Parameters.AddWithValue("@pk", periodKey ?? "");
        ins.Parameters.AddWithValue("@start", start);
        try
        {
            var n = await ins.ExecuteScalarAsync(ct);
            return n != null && n != DBNull.Value ? Convert.ToInt64(n) : start;
        }
        catch (SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
        {
            o = await upd.ExecuteScalarAsync(ct);
            return o != null && o != DBNull.Value ? Convert.ToInt64(o) : start;
        }
    }

    private static DateTime? ParseDocDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var d))
            return d.Date;
        if (DateTime.TryParse(s, new CultureInfo("tr-TR"), DateTimeStyles.AssumeLocal, out d))
            return d.Date;
        return null;
    }

    private static string RenderPattern(
        string pattern,
        int pad,
        long seq,
        NumberAllocateRequest req,
        DateTime docDate)
    {
        var seqStr = seq.ToString().PadLeft(Math.Clamp(pad, 1, 18), '0');
        var text = pattern ?? "";
        var week = ISOWeek.GetWeekOfYear(docDate);
        var quarter = (docDate.Month - 1) / 3 + 1;

        text = Regex.Replace(text, @"\{SEQ:(\d+)\}", m =>
        {
            var n = int.Parse(m.Groups[1].Value);
            return seq.ToString().PadLeft(Math.Clamp(n, 1, 18), '0');
        }, RegexOptions.IgnoreCase);

        text = Regex.Replace(text, @"\{SEQ\}", seqStr, RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{YYYY\}", docDate.ToString("yyyy"), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{YY\}", docDate.ToString("yy"), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{MM\}|\{AY\}", docDate.ToString("MM"), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{DD\}|\{GUN\}", docDate.ToString("dd"), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{WW\}|\{HAFTA\}", week.ToString("00"), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{Q\}|\{CEYREK\}", quarter.ToString(), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{CO\}|\{FIRMA\}", Sanitize(req.CompanyCode), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{WP\}|\{ISYERI\}", Sanitize(req.WorkplaceCode), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{WH\}|\{AMBAR\}", Sanitize(req.WhouseCode), RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\{USR\}|\{KULLANICI\}", Sanitize(req.UserName ?? req.UserId), RegexOptions.IgnoreCase);
        return text;
    }

    private static string Sanitize(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "X";
        var t = s.Trim();
        return Regex.Replace(t, @"[^\w\-]", "");
    }

    private static NumberTemplateRow ReadRow(SqlDataReader r, bool ext)
    {
        var row = new NumberTemplateRow
        {
            TemplateId = r.GetInt32(0),
            Code = r.GetString(1),
            Title = r.GetString(2),
            FormCode = r.IsDBNull(3) ? null : r.GetString(3),
            TableName = r.IsDBNull(4) ? null : r.GetString(4),
            ScopeType = r.GetByte(5),
            Pattern = r.GetString(6),
            SeqPad = r.GetInt32(7),
            Priority = r.GetInt32(8),
            IsActive = r.GetBoolean(9),
            Notes = r.IsDBNull(10) ? null : r.GetString(10),
        };
        if (!ext) return row;
        row.ValidFrom = r.IsDBNull(11) ? null : r.GetDateTime(11);
        row.ValidTo = r.IsDBNull(12) ? null : r.GetDateTime(12);
        row.StartNumber = r.IsDBNull(13) ? 1 : Convert.ToInt64(r.GetValue(13));
        row.EndNumber = r.IsDBNull(14) ? null : Convert.ToInt64(r.GetValue(14));
        row.FilterCompanyID = r.IsDBNull(15) ? null : r.GetString(15);
        row.FilterWorkplaceID = r.IsDBNull(16) ? null : r.GetString(16);
        row.FilterWhouseID = r.IsDBNull(17) ? null : r.GetString(17);
        row.FilterUserId = r.IsDBNull(18) ? null : r.GetString(18);
        row.PeriodKind = r.IsDBNull(19) ? (byte)0 : r.GetByte(19);
        row.CardCode = r.IsDBNull(20) ? null : r.GetString(20);
        return row;
    }

    private async Task EnsureOpenAsync(CancellationToken ct)
    {
        if (Conn.State != ConnectionState.Open)
            await Conn.OpenAsync(ct);
    }
}
