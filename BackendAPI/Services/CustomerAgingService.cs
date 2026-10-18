using System.Data;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class OpenItem
{
    public int CustomerCardID { get; set; }
    public string? Source { get; set; }
    public int? SourceId { get; set; }
    public string? DocNo { get; set; }
    public DateTime? Date { get; set; }
    public DateTime DueDate { get; set; }
    /// <summary>Kalemin tutarı (taksitse taksit tutarı)</summary>
    public decimal Amount { get; set; }
    /// <summary>Kapanmamış kısım — pozitif borç (alacağımız), negatif alacak (borcumuz / avans)</summary>
    public decimal Open { get; set; }
    /// <summary>Vadeden bu yana gün (negatif: vadesine kalan gün)</summary>
    public int DaysOverdue { get; set; }
}

public sealed class AgingRow
{
    public int CustomerCardID { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public decimal Balance { get; set; }
    public decimal NotDue { get; set; }
    public decimal D1_30 { get; set; }
    public decimal D31_60 { get; set; }
    public decimal D61_90 { get; set; }
    public decimal D90Plus { get; set; }
    public decimal Overdue { get; set; }
    /// <summary>En eski açık kalemin gecikme günü</summary>
    public int MaxDays { get; set; }
    /// <summary>Tutar ağırlıklı ortalama gecikme (vadesi geçmiş kalemler)</summary>
    public int AvgDays { get; set; }
}

/// <summary>
/// Y-10: açık kalemler ve vade yaşlandırma. Hareketler cari ekstresiyle aynı kaynaklardan gelir; kapama FIFO'dur:
/// borçlu carinin toplam alacak hareketi en eski vadeli borç kalemlerinden başlayarak düşülür (alacaklı caride tersi).
/// Vade: hareketin vadesi; fatura için ödeme planı (PaidPlanLine taksitleri ya da PaidPlanCard.DayCount); yoksa belge tarihi.
/// </summary>
public sealed class CustomerAgingService
{
    private readonly CardStatementRepository _statement;
    private readonly IDbConnection _db;

    public CustomerAgingService(CardStatementRepository statement, IDbConnection db)
    {
        _statement = statement;
        _db = db;
    }

    private sealed record Plan(int DayCount, List<(int Offset, decimal Rate)> Lines);

    private async Task<Dictionary<int, Plan>> InvoicePlansAsync(IEnumerable<int> invoiceIds)
    {
        var ids = invoiceIds.Distinct().ToArray();
        var result = new Dictionary<int, Plan>();
        if (ids.Length == 0) return result;
        try
        {
            var heads = (await _db.QueryAsync<(int InvoiceID, int PaidPlanID, int? DayCount)>(
                @"SELECT i.InvoiceID, i.PaidPlanID, p.DayCount FROM dbo.Invoice i JOIN dbo.PaidPlanCard p ON p.PaidPlanID = i.PaidPlanID
WHERE i.InvoiceID IN @ids", new { ids })).ToList();
            if (heads.Count == 0) return result;
            var planIds = heads.Select(h => h.PaidPlanID).Distinct().ToArray();
            var lines = (await _db.QueryAsync<(int PaidPlanID, int? DayOffset, decimal? RatePercent)>(
                "SELECT PaidPlanID, DayOffset, RatePercent FROM dbo.PaidPlanLine WHERE PaidPlanID IN @planIds ORDER BY PaidPlanID, [LineNo]",
                new { planIds })).ToLookup(l => l.PaidPlanID);
            foreach (var h in heads)
            {
                var ls = lines[h.PaidPlanID].Where(l => (l.RatePercent ?? 0) > 0).Select(l => (l.DayOffset ?? 0, l.RatePercent ?? 0)).ToList();
                result[h.InvoiceID] = new Plan(h.DayCount ?? 0, ls);
            }
        }
        catch
        {
            /* ödeme planı tabloları yoksa vade = belge tarihi */
        }
        return result;
    }

    private sealed class Item
    {
        public required AgingMove Move { get; init; }
        public DateTime Due { get; init; }
        public decimal Amount { get; init; }
        public decimal Left { get; set; }
    }

    /// <summary>Açık kalemler — customerId null ise tüm cariler.</summary>
    public async Task<List<OpenItem>> OpenItemsAsync(int? customerId, DateTime? asOf = null, CancellationToken ct = default)
    {
        var today = (asOf ?? DateTime.Today).Date;
        var moves = (await _statement.CustomerMovesAsync(customerId, ct)).Where(m => m.Dt == null || m.Dt.Value.Date <= today).ToList();
        var plans = await InvoicePlansAsync(moves.Where(m => m.Source == "Invoice" && m.SourceId != null).Select(m => m.SourceId!.Value));

        var result = new List<OpenItem>();
        foreach (var g in moves.GroupBy(m => m.CustId))
        {
            var debits = new List<Item>();
            var credits = new List<Item>();
            foreach (var m in g)
            {
                var date = (m.Dt ?? today).Date;
                var baseDue = m.DueDate?.Date ?? date;
                if (m.Debit > 0)
                {
                    if (m.Source == "Invoice" && m.SourceId is int iid && plans.TryGetValue(iid, out var plan) && m.DueDate == null)
                    {
                        if (plan.Lines.Count > 0)
                        {
                            var totalRate = plan.Lines.Sum(l => l.Rate);
                            decimal used = 0;
                            for (var i = 0; i < plan.Lines.Count; i++)
                            {
                                var part = i == plan.Lines.Count - 1 ? m.Debit - used : Math.Round(m.Debit * plan.Lines[i].Rate / totalRate, 2);
                                used += part;
                                debits.Add(new Item { Move = m, Due = date.AddDays(plan.Lines[i].Offset), Amount = part, Left = part });
                            }
                            continue;
                        }
                        baseDue = date.AddDays(plan.DayCount);
                    }
                    debits.Add(new Item { Move = m, Due = baseDue, Amount = m.Debit, Left = m.Debit });
                }
                if (m.Credit > 0) credits.Add(new Item { Move = m, Due = baseDue, Amount = m.Credit, Left = m.Credit });
            }

            var totalDebit = debits.Sum(d => d.Amount);
            var totalCredit = credits.Sum(c => c.Amount);
            // Az olan taraf, çok olan tarafın en eski vadeli kalemlerini kapatır
            var (open, pool, sign) = totalDebit >= totalCredit ? (debits, totalCredit, 1m) : (credits, totalDebit, -1m);
            foreach (var it in open.OrderBy(x => x.Due).ThenBy(x => x.Move.Dt))
            {
                var take = Math.Min(pool, it.Left);
                it.Left -= take;
                pool -= take;
                if (it.Left <= 0.004m) continue;
                result.Add(new OpenItem
                {
                    CustomerCardID = g.Key,
                    Source = it.Move.Source,
                    SourceId = it.Move.SourceId,
                    DocNo = it.Move.DocNo,
                    Date = it.Move.Dt,
                    DueDate = it.Due,
                    Amount = it.Amount * sign,
                    Open = it.Left * sign,
                    DaysOverdue = (int)(today - it.Due).TotalDays,
                });
            }
        }
        return result.OrderBy(r => r.CustomerCardID).ThenBy(r => r.DueDate).ToList();
    }

    /// <summary>Cari bazında yaşlandırma (vadesi gelmemiş, 1-30, 31-60, 61-90, 90+).</summary>
    public async Task<List<AgingRow>> AgingAsync(DateTime? asOf = null, CancellationToken ct = default)
    {
        var items = await OpenItemsAsync(null, asOf, ct);
        if (_db.State != ConnectionState.Open) _db.Open();
        var cards = (await _db.QueryAsync<(int Id, string? Code, string? Title)>(
            "SELECT CustomerCardID, Code, Title FROM dbo.CustomerCard")).ToDictionary(c => c.Id);
        var rows = new List<AgingRow>();
        foreach (var g in items.GroupBy(i => i.CustomerCardID))
        {
            cards.TryGetValue(g.Key, out var c);
            var r = new AgingRow { CustomerCardID = g.Key, Code = c.Code, Title = c.Title };
            decimal weighted = 0;
            foreach (var i in g)
            {
                r.Balance += i.Open;
                var d = i.DaysOverdue;
                if (d <= 0) r.NotDue += i.Open;
                else if (d <= 30) r.D1_30 += i.Open;
                else if (d <= 60) r.D31_60 += i.Open;
                else if (d <= 90) r.D61_90 += i.Open;
                else r.D90Plus += i.Open;
                if (d > 0)
                {
                    r.Overdue += i.Open;
                    weighted += i.Open * d;
                    r.MaxDays = Math.Max(r.MaxDays, d);
                }
            }
            r.AvgDays = r.Overdue != 0 ? (int)Math.Round(weighted / r.Overdue) : 0;
            rows.Add(r);
        }
        return rows.OrderByDescending(r => r.Overdue).ThenByDescending(r => r.Balance).ToList();
    }

    /// <summary>Tek carinin vadesi geçmiş borcu ve en eski gecikme günü (e-Belge kuralı {Cari.GecikenVade}).</summary>
    public async Task<(decimal Overdue, int MaxDays)> OverdueAsync(int customerId, CancellationToken ct = default)
    {
        var items = (await OpenItemsAsync(customerId, null, ct)).Where(i => i.DaysOverdue > 0 && i.Open > 0).ToList();
        return (items.Sum(i => i.Open), items.Count == 0 ? 0 : items.Max(i => i.DaysOverdue));
    }
}
