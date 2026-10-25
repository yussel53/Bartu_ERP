using System.Data;
using System.Text;
using Dapper;

namespace BartuERP.Backend.Repositories;

/// <summary>
/// Süreçteki Banka Entegrasyonu işi. Bağlantı BankAccountCard.Integ* kolonlarından okunur.
/// Hareketler Veri Çek ile aynı kolon listesine yazılır.
/// </summary>
public static class ProcessBank
{
    public static readonly string[] AccountFields = ["HesapKodu", "HesapAdi", "Banka", "Iban"];

    public sealed class Request
    {
        public int BankAccountCardId { get; set; }
        public int Gun { get; set; } = 7;
        public string? JsonPath { get; set; }
    }

    public sealed class Pull
    {
        public List<Dictionary<string, object?>> Rows { get; } = new();
        public List<string> Messages { get; } = new();
    }

    public static async Task<Pull> PullAsync(IDbConnection db, Request req, CancellationToken ct)
    {
        var pull = new Pull();
        var accounts = await LoadAccountsAsync(db, req.BankAccountCardId, ct);
        if (accounts.Count == 0)
        {
            pull.Messages.Add(req.BankAccountCardId > 0
                ? "Seçilen hesapta entegrasyon açık değil."
                : "Entegrasyonu açık banka hesabı yok.");
            return pull;
        }

        var start = DateTime.Today.AddDays(-Math.Clamp(req.Gun <= 0 ? 7 : req.Gun, 1, 366));
        var end = DateTime.Today;
        foreach (var account in accounts)
        {
            if (pull.Rows.Count >= 200) break;
            if (string.IsNullOrWhiteSpace(account.IntegEndpoint))
            {
                pull.Messages.Add($"{account.Code}: servis adresi yok.");
                continue;
            }
            try
            {
                var source = new ProcessSourceRequest
                {
                    SourceType = 3,
                    ApiUrl = ApplyDates(account.IntegEndpoint, start, end),
                    ApiMethod = "GET",
                    ApiHeaders = AuthHeader(account.IntegUser, account.IntegSecret),
                    JsonPath = req.JsonPath,
                };
                foreach (var row in await ProcessSource.RowsAsync(source, ct))
                {
                    row["HesapKodu"] = account.Code;
                    row["HesapAdi"] = account.Title;
                    row["Banka"] = account.IntegBank;
                    row["Iban"] = account.IbanNO;
                    pull.Rows.Add(row);
                    if (pull.Rows.Count >= 200) break;
                }
            }
            catch (Exception ex)
            {
                pull.Messages.Add($"{account.Code}: {ex.Message}");
            }
        }
        return pull;
    }

    public static async Task<IReadOnlyList<string>> ColumnsAsync(IDbConnection db, Request req, CancellationToken ct)
    {
        var sample = req.BankAccountCardId > 0
            ? req
            : new Request { BankAccountCardId = await FirstEnabledIdAsync(db, ct), Gun = req.Gun, JsonPath = req.JsonPath };
        var pull = await PullAsync(db, sample, ct);
        if (pull.Rows.Count == 0)
            throw new InvalidOperationException(pull.Messages.FirstOrDefault() ?? "Hareket gelmedi.");
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in AccountFields)
            if (seen.Add(key)) names.Add(key);
        foreach (var row in pull.Rows)
        {
            foreach (var key in row.Keys)
                if (seen.Add(key)) names.Add(key);
        }
        return names;
    }

    private static async Task<int> FirstEnabledIdAsync(IDbConnection db, CancellationToken ct)
    {
        await EnsureColumnsAsync(db, ct);
        var id = await db.ExecuteScalarAsync<int?>(new CommandDefinition("""
            SELECT TOP (1) BankAccountCardID
            FROM dbo.BankAccountCard
            WHERE ISNULL(IntegEnabled, 0) = 1
            ORDER BY BankAccountCardID
            """, cancellationToken: ct));
        return id ?? 0;
    }

    private static async Task<List<AccountRow>> LoadAccountsAsync(IDbConnection db, int accountId, CancellationToken ct)
    {
        await EnsureColumnsAsync(db, ct);
        var rows = await db.QueryAsync<AccountRow>(new CommandDefinition("""
            SELECT BankAccountCardID, Code, Title, IbanNO, IntegBank, IntegUser, IntegSecret, IntegEndpoint
            FROM dbo.BankAccountCard
            WHERE ISNULL(IntegEnabled, 0) = 1
              AND (@id = 0 OR BankAccountCardID = @id)
            ORDER BY BankAccountCardID
            """, new { id = accountId }, cancellationToken: ct));
        return rows.ToList();
    }

    private static async Task EnsureColumnsAsync(IDbConnection db, CancellationToken ct)
    {
        var ok = await db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.BankAccountCard', N'IntegEndpoint') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct));
        if (ok == 0)
            throw new InvalidOperationException("Banka hesabında entegrasyon alanları yok. 104_bank_account_integration.sql uygulayın.");
    }

    private static string ApplyDates(string endpoint, DateTime start, DateTime end)
    {
        var a = start.ToString("yyyy-MM-dd");
        var b = end.ToString("yyyy-MM-dd");
        var url = endpoint.Trim()
            .Replace("{baslangic}", a, StringComparison.OrdinalIgnoreCase)
            .Replace("{bitis}", b, StringComparison.OrdinalIgnoreCase);
        if (url.Contains("baslangic", StringComparison.OrdinalIgnoreCase)) return url;
        return url + (url.Contains('?') ? "&" : "?") + $"baslangic={a}&bitis={b}";
    }

    private static string? AuthHeader(string? user, string? secret)
    {
        if (string.IsNullOrWhiteSpace(secret) && string.IsNullOrWhiteSpace(user)) return null;
        if (string.IsNullOrWhiteSpace(user))
            return "Authorization: Bearer " + secret!.Trim();
        var token = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{user.Trim()}:{secret ?? ""}"));
        return "Authorization: Basic " + token;
    }

    private sealed class AccountRow
    {
        public int BankAccountCardID { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
        public string? IbanNO { get; set; }
        public string? IntegBank { get; set; }
        public string? IntegUser { get; set; }
        public string? IntegSecret { get; set; }
        public string? IntegEndpoint { get; set; }
    }
}
