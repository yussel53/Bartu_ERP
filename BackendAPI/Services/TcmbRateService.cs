using System.Data;
using System.Globalization;
using System.Net;
using System.Xml.Linq;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class TcmbCurrencyRate
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public int Unit { get; set; } = 1;
    public double? ForexBuying { get; set; }
    public double? ForexSelling { get; set; }
    public double? BanknoteBuying { get; set; }
    public double? BanknoteSelling { get; set; }
}

public sealed class TcmbBulletin
{
    public DateTime Date { get; set; }
    public string? BulletinNo { get; set; }
    public List<TcmbCurrencyRate> Rates { get; set; } = new();
}

public sealed class CurrencyRateDownloadResult
{
    public bool Success { get; set; }
    public DateTime? RateDate { get; set; }
    public string? BulletinNo { get; set; }
    public int RateCount { get; set; }
    public string Message { get; set; } = "";
}

/// <summary>
/// TCMB gösterge niteliğindeki kurlar (https://www.tcmb.gov.tr/kurlar/today.xml).
/// Kurlar iş günleri ~15:30'da yayımlanır; tatil / hafta sonu dosyası yoktur (404).
/// Saklama: SYS_CurrencyRate (1 birim için; JPY gibi 100 birimlik kurlar bölünür) — SqlUpdates/74.
/// </summary>
public sealed class TcmbRateService
{
    public const string BaseUrl = "https://www.tcmb.gov.tr/kurlar/";

    private readonly IHttpClientFactory _http;
    private readonly IDbConnection _db;
    private readonly ILogger<TcmbRateService> _log;

    public TcmbRateService(IHttpClientFactory http, IDbConnection db, ILogger<TcmbRateService> log)
    {
        _http = http;
        _db = db;
        _log = log;
    }

    // ── TCMB ────────────────────────────────────────────────────────────

    /// <summary>date null → today.xml (son yayımlanan bülten); tarih → arşiv. Dosya yoksa (tatil) null.</summary>
    public async Task<TcmbBulletin?> FetchAsync(DateTime? date, CancellationToken ct = default)
    {
        var url = date is DateTime d
            ? $"{BaseUrl}{d:yyyyMM}/{d:ddMMyyyy}.xml"
            : $"{BaseUrl}today.xml";
        var client = _http.CreateClient("Tcmb");
        using var resp = await client.GetAsync(url, ct);
        if (resp.StatusCode == HttpStatusCode.NotFound) return null;
        resp.EnsureSuccessStatusCode();
        var xml = await resp.Content.ReadAsStringAsync(ct);
        return Parse(xml);
    }

    public static TcmbBulletin Parse(string xml)
    {
        var doc = XDocument.Parse(xml);
        var root = doc.Root ?? throw new InvalidOperationException("TCMB yanıtı boş.");
        var b = new TcmbBulletin
        {
            Date = DateTime.ParseExact((string?)root.Attribute("Tarih") ?? "", "dd.MM.yyyy", CultureInfo.InvariantCulture),
            BulletinNo = (string?)root.Attribute("Bulten_No"),
        };
        static double? Num(XElement c, string n)
        {
            var s = (string?)c.Element(n);
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) && v > 0 ? v : null;
        }
        foreach (var c in root.Elements("Currency"))
        {
            var code = ((string?)c.Attribute("CurrencyCode") ?? (string?)c.Attribute("Kod") ?? "").Trim().ToUpperInvariant();
            if (code.Length == 0) continue;
            b.Rates.Add(new TcmbCurrencyRate
            {
                Code = code,
                Name = ((string?)c.Element("Isim") ?? code).Trim(),
                Unit = int.TryParse((string?)c.Element("Unit"), out var u) && u > 0 ? u : 1,
                ForexBuying = Num(c, "ForexBuying"),
                ForexSelling = Num(c, "ForexSelling"),
                BanknoteBuying = Num(c, "BanknoteBuying"),
                BanknoteSelling = Num(c, "BanknoteSelling"),
            });
        }
        return b;
    }

    // ── Veritabanı ──────────────────────────────────────────────────────

    public async Task<bool> ReadyAsync()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        return await _db.ExecuteScalarAsync<int>(@"
SELECT CASE WHEN COL_LENGTH(N'dbo.SYS_Currency', N'AutoRate') IS NULL
          OR COL_LENGTH(N'dbo.SYS_CurrencyRate', N'DownloadedAt') IS NULL
          OR OBJECT_ID(N'dbo.SYS_CurrencyRateLog', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
    }

    private async Task LogAsync(DateTime? requestDate, string trigger, CurrencyRateDownloadResult r)
    {
        try
        {
            await _db.ExecuteAsync(
                @"INSERT INTO dbo.SYS_CurrencyRateLog (RequestDate, RateDate, BulletinNo, Trigger_, Success, RateCount, Message)
                  VALUES (@requestDate, @RateDate, @BulletinNo, @trigger, @Success, @RateCount, @Message)",
                new { requestDate, r.RateDate, r.BulletinNo, trigger, r.Success, r.RateCount, Message = r.Message.Length > 1000 ? r.Message[..1000] : r.Message });
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Kur indirme günlüğü yazılamadı");
        }
    }

    /// <summary>Otomatik indirilecek dövizler (AutoRate = 1, aktif, yerel değil)</summary>
    public async Task<List<(int CurrencyID, string Code)>> AutoCurrenciesAsync() =>
        (await _db.QueryAsync<(int, string)>(
            "SELECT CurrencyID, UPPER(Code) FROM dbo.SYS_Currency WHERE AutoRate = 1 AND IsActive = 1 AND ISNULL(IsLocal, 0) = 0")).ToList();

    /// <summary>Bülten tarihi için otomatik dövizlerin hepsi kayıtlı mı?</summary>
    public async Task<bool> HasRatesForAsync(DateTime rateDate)
    {
        var missing = await _db.ExecuteScalarAsync<int>(@"
SELECT COUNT(1) FROM dbo.SYS_Currency c
WHERE c.AutoRate = 1 AND c.IsActive = 1 AND ISNULL(c.IsLocal, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM dbo.SYS_CurrencyRate r WHERE r.CurrencyID = c.CurrencyID AND r.RateDate = @d)",
            new { d = rateDate.Date });
        return missing == 0;
    }

    /// <summary>
    /// Kurları indir ve kaydet. date null → son yayımlanan bülten; tarih verilirse o günün bülteni
    /// (tatilse geriye doğru en yakın iş günü, en çok 10 gün). codes null → AutoRate=1 dövizler.
    /// </summary>
    public async Task<CurrencyRateDownloadResult> DownloadAsync(
        DateTime? date, string trigger, IEnumerable<string>? codes = null, bool skipIfPresent = false, CancellationToken ct = default)
    {
        var res = new CurrencyRateDownloadResult();
        if (!await ReadyAsync())
        {
            res.Message = "Kur tabloları hazır değil — Veritabanı Güncelleme ekranından 74_tcmb_currency_rates.sql uygulayın.";
            return res;
        }
        try
        {
            TcmbBulletin? b = null;
            if (date is DateTime d0)
            {
                for (var i = 0; i <= 10 && b == null; i++)
                    b = await FetchAsync(d0.Date.AddDays(-i), ct);
                if (b == null) throw new InvalidOperationException($"{d0:dd.MM.yyyy} ve önceki 10 gün için TCMB bülteni bulunamadı.");
            }
            else
            {
                b = await FetchAsync(null, ct) ?? throw new InvalidOperationException("TCMB today.xml okunamadı.");
            }
            res.RateDate = b.Date;
            res.BulletinNo = b.BulletinNo;

            if (skipIfPresent && await HasRatesForAsync(b.Date))
            {
                res.Success = true;
                res.Message = $"{b.Date:dd.MM.yyyy} kurları zaten kayıtlı.";
                return res; // otomatik görev: günlüğü kirletme
            }

            var wanted = codes?.Select(c => c.Trim().ToUpperInvariant()).Where(c => c.Length > 0).ToHashSet()
                         ?? (await AutoCurrenciesAsync()).Select(x => x.Code).ToHashSet();
            var currencies = (await _db.QueryAsync<(int CurrencyID, string Code)>(
                "SELECT CurrencyID, UPPER(Code) FROM dbo.SYS_Currency WHERE ISNULL(IsLocal, 0) = 0")).ToDictionary(x => x.Code, x => x.CurrencyID);

            var saved = new List<string>();
            var notInTcmb = wanted.Where(w => b.Rates.All(r => r.Code != w)).ToList();
            foreach (var r in b.Rates.Where(r => wanted.Contains(r.Code)))
            {
                if (!currencies.TryGetValue(r.Code, out var cid) || r.ForexBuying is null) continue;
                double? Per(double? v) => v is null ? null : Math.Round(v.Value / r.Unit, 6);
                await _db.ExecuteAsync(@"
MERGE dbo.SYS_CurrencyRate AS t
USING (SELECT @cid AS CurrencyID, @d AS RateDate) AS s
  ON t.CurrencyID = s.CurrencyID AND t.RateDate = s.RateDate
WHEN MATCHED THEN UPDATE SET
  BuyRate = @buy, SellRate = @sell, BanknoteBuyRate = @bbuy, BanknoteSellRate = @bsell,
  Unit = @unit, Source = N'TCMB', BulletinNo = @no, DownloadedAt = SYSDATETIME(), IsActive = 1
WHEN NOT MATCHED THEN INSERT
  (CurrencyID, RateDate, BuyRate, SellRate, BanknoteBuyRate, BanknoteSellRate, Unit, Source, BulletinNo, DownloadedAt, IsActive)
  VALUES (@cid, @d, @buy, @sell, @bbuy, @bsell, @unit, N'TCMB', @no, SYSDATETIME(), 1);",
                    new
                    {
                        cid,
                        d = b.Date.Date,
                        buy = Per(r.ForexBuying),
                        sell = Per(r.ForexSelling) ?? Per(r.ForexBuying),
                        bbuy = Per(r.BanknoteBuying),
                        bsell = Per(r.BanknoteSelling),
                        unit = r.Unit,
                        no = b.BulletinNo,
                    });
                // Kart üzerindeki güncel kur: en son tarihli döviz alış
                await _db.ExecuteAsync(@"
UPDATE c SET Rate = r.BuyRate
FROM dbo.SYS_Currency c
CROSS APPLY (SELECT TOP 1 BuyRate FROM dbo.SYS_CurrencyRate WHERE CurrencyID = c.CurrencyID ORDER BY RateDate DESC) r
WHERE c.CurrencyID = @cid", new { cid });
                saved.Add(r.Code);
            }

            res.Success = true;
            res.RateCount = saved.Count;
            res.Message = saved.Count > 0
                ? $"{b.Date:dd.MM.yyyy} ({b.BulletinNo}) · {string.Join(", ", saved)}"
                : "Kaydedilecek kur yok (otomatik indirilecek döviz seçili değil).";
            if (notInTcmb.Count > 0) res.Message += $" · TCMB'de yok: {string.Join(", ", notInTcmb)}";
        }
        catch (Exception ex)
        {
            res.Success = false;
            res.Message = ex.Message;
            _log.LogWarning(ex, "TCMB kur indirme hatası");
        }
        await LogAsync(date, trigger, res);
        return res;
    }
}
