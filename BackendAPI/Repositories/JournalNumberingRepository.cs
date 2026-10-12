using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class JournalNumberingRequest
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int StartNumber { get; set; } = 1;
    /** true: sadece yevmiye no boş fişler; false: aralıktaki tüm fişler yeniden numaralanır */
    public bool OnlyUnnumbered { get; set; }
    public int? CompanyId { get; set; }
    public string? Note { get; set; }
    public string? AppliedBy { get; set; }
}

public sealed class JournalNumberingRow
{
    public int AccountVoucherID { get; set; }
    public string? DocumentNumber { get; set; }
    public DateTime? VoucherDate { get; set; }
    public string? VoucherTime { get; set; }
    public string? OldJournalNo { get; set; }
    public int NewJournalNo { get; set; }
    public double? SumDebit { get; set; }
    public double? SumCredit { get; set; }
}

public sealed class JournalNumberingResult
{
    public int Count { get; set; }
    public int StartNumber { get; set; }
    public int? EndNumber { get; set; }
    public bool Applied { get; set; }
    public List<JournalNumberingRow> Rows { get; set; } = new();
}

public sealed class JournalNumberingLogRow
{
    public int Id { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int StartNumber { get; set; }
    public int? EndNumber { get; set; }
    public int VoucherCount { get; set; }
    public bool OnlyUnnumbered { get; set; }
    public string? Note { get; set; }
    public string? AppliedBy { get; set; }
    public DateTime AppliedAt { get; set; }
}

/// <summary>
/// Yevmiye madde no: fiş tarihi → fiş saati → fiş ID sırasıyla ardışık verilir.
/// İptal (Status=3) ve e-Deftere gönderilmeyecek (ELedgerExclude=1) fişler atlanır.
/// </summary>
public sealed class JournalNumberingRepository
{
    private readonly IDbConnection _db;

    public JournalNumberingRepository(IDbConnection db)
    {
        _db = db;
    }

    private static string CandidatesSql(bool hasTime, bool hasExclude, bool hasLineTotals) => $@"
SELECT
  v.AccountVoucherID,
  v.DocumentNumber,
  v.VoucherDate,
  {(hasTime ? "CONVERT(varchar(8), v.VoucherTime, 108)" : "CAST(NULL AS varchar(8))")} AS VoucherTime,
  v.journalNO AS OldJournalNo,
  {(hasLineTotals ? "COALESCE(t.SumDebit, v.SumDebit)" : "v.SumDebit")} AS SumDebit,
  {(hasLineTotals ? "COALESCE(t.SumCredit, v.SumCredit)" : "v.SumCredit")} AS SumCredit
FROM dbo.AccountVoucher v
{(hasLineTotals ? @"OUTER APPLY (
  SELECT SUM(ISNULL(x.Debit, 0)) AS SumDebit, SUM(ISNULL(x.Credit, 0)) AS SumCredit
  FROM dbo.AccountTrans x WHERE x.AccountVoucherID = v.AccountVoucherID
) t" : "")}
WHERE v.VoucherDate >= @start AND v.VoucherDate < DATEADD(day, 1, @end)
  AND ISNULL(v.Status, 1) <> 3
  {(hasExclude ? "AND ISNULL(v.ELedgerExclude, 0) = 0" : "")}
  AND (@companyId IS NULL OR v.CompanyID = @companyId)
  AND (@onlyUnnumbered = 0 OR NULLIF(LTRIM(RTRIM(v.journalNO)), '') IS NULL)
ORDER BY CAST(v.VoucherDate AS date),
  {(hasTime ? "ISNULL(v.VoucherTime, CAST(v.VoucherDate AS time(0)))" : "CAST(v.VoucherDate AS time(0))")},
  v.AccountVoucherID";

    private async Task<(bool HasTime, bool HasExclude, bool HasNumberedAt, bool HasLineTotals)> ColumnsAsync(IDbTransaction? tx)
    {
        var cols = (await _db.QueryAsync<string>(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.AccountVoucher')",
            transaction: tx)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var lineCols = (await _db.QueryAsync<string>(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.AccountTrans')",
            transaction: tx)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hasLineTotals = lineCols.Contains("AccountVoucherID") && lineCols.Contains("Debit") && lineCols.Contains("Credit");
        return (cols.Contains("VoucherTime"), cols.Contains("ELedgerExclude"), cols.Contains("JournalNumberedAt"), hasLineTotals);
    }

    public async Task<JournalNumberingResult> RunAsync(JournalNumberingRequest req, bool apply, CancellationToken ct = default)
    {
        if (req.EndDate.Date < req.StartDate.Date)
            throw new ArgumentException("Bitiş tarihi başlangıçtan önce olamaz");
        if (req.StartNumber < 1)
            throw new ArgumentException("İlk yevmiye no en az 1 olmalı");

        if (_db.State != ConnectionState.Open) _db.Open();
        IDbTransaction? tx = apply ? _db.BeginTransaction() : null;
        try
        {
            var (hasTime, hasExclude, hasNumberedAt, hasLineTotals) = await ColumnsAsync(tx);
            var rows = (await _db.QueryAsync<JournalNumberingRow>(new CommandDefinition(
                CandidatesSql(hasTime, hasExclude, hasLineTotals),
                new
                {
                    start = req.StartDate.Date,
                    end = req.EndDate.Date,
                    companyId = req.CompanyId is > 0 ? req.CompanyId : null,
                    onlyUnnumbered = req.OnlyUnnumbered ? 1 : 0,
                },
                tx,
                cancellationToken: ct))).ToList();

            var no = req.StartNumber;
            foreach (var r in rows) r.NewJournalNo = no++;

            var result = new JournalNumberingResult
            {
                Count = rows.Count,
                StartNumber = req.StartNumber,
                EndNumber = rows.Count > 0 ? rows[^1].NewJournalNo : null,
                Rows = rows,
            };

            if (apply)
            {
                var upd = hasNumberedAt
                    ? "UPDATE dbo.AccountVoucher SET journalNO = @no, JournalNumberedAt = SYSUTCDATETIME() WHERE AccountVoucherID = @id"
                    : "UPDATE dbo.AccountVoucher SET journalNO = @no WHERE AccountVoucherID = @id";
                foreach (var r in rows)
                {
                    await _db.ExecuteAsync(new CommandDefinition(
                        upd,
                        new { no = r.NewJournalNo.ToString(), id = r.AccountVoucherID },
                        tx,
                        cancellationToken: ct));
                }

                if (await LogTableExistsAsync(tx))
                {
                    await _db.ExecuteAsync(new CommandDefinition(
                        @"INSERT INTO dbo.SYS_JournalNumberingLog
                            (StartDate, EndDate, StartNumber, EndNumber, VoucherCount, OnlyUnnumbered, CompanyID, Note, AppliedBy)
                          VALUES (@StartDate, @EndDate, @StartNumber, @EndNumber, @Count, @Only, @CompanyId, @Note, @AppliedBy)",
                        new
                        {
                            StartDate = req.StartDate.Date,
                            EndDate = req.EndDate.Date,
                            req.StartNumber,
                            result.EndNumber,
                            result.Count,
                            Only = req.OnlyUnnumbered,
                            CompanyId = req.CompanyId is > 0 ? req.CompanyId : null,
                            req.Note,
                            req.AppliedBy,
                        },
                        tx,
                        cancellationToken: ct));
                }

                tx!.Commit();
                result.Applied = true;
            }

            return result;
        }
        catch
        {
            try { tx?.Rollback(); } catch { /* ignore */ }
            throw;
        }
        finally
        {
            tx?.Dispose();
        }
    }

    /// <summary>Başlangıç tarihinden önceki en büyük yevmiye no + 1</summary>
    public async Task<int> SuggestStartNumberAsync(DateTime startDate, int? companyId, CancellationToken ct = default)
    {
        var max = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            @"SELECT MAX(TRY_CAST(journalNO AS int))
              FROM dbo.AccountVoucher
              WHERE VoucherDate < @start
                AND YEAR(VoucherDate) = YEAR(@start)
                AND (@companyId IS NULL OR CompanyID = @companyId)",
            new { start = startDate.Date, companyId = companyId is > 0 ? companyId : null },
            cancellationToken: ct));
        return (max ?? 0) + 1;
    }

    public async Task<List<JournalNumberingLogRow>> HistoryAsync(int take, CancellationToken ct = default)
    {
        if (!await LogTableExistsAsync(null)) return new();
        return (await _db.QueryAsync<JournalNumberingLogRow>(new CommandDefinition(
            $"SELECT TOP ({Math.Clamp(take, 1, 500)}) * FROM dbo.SYS_JournalNumberingLog ORDER BY Id DESC",
            cancellationToken: ct))).ToList();
    }

    private async Task<bool> LogTableExistsAsync(IDbTransaction? tx) =>
        await _db.ExecuteScalarAsync<int?>(
            "SELECT 1 WHERE OBJECT_ID(N'dbo.SYS_JournalNumberingLog', N'U') IS NOT NULL",
            transaction: tx) == 1;
}
