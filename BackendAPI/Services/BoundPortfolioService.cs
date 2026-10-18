using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class BoundRollLineInput
{
    /// <summary>Var olan çek / senet (portföyden işlem). Giriş bordrolarında (1, 9) boş — kart satırdan açılır.</summary>
    public int? BoundCardID { get; set; }
    public int? Type_ { get; set; }
    public string? DocumentNr { get; set; }
    public DateTime? DueDate { get; set; }
    public double? Amount { get; set; }
    public string? Debtor { get; set; }
    public string? BankName { get; set; }
    public string? BranchName { get; set; }
    public string? AccountNo { get; set; }
    public string? Description { get; set; }
    public int? Currency { get; set; }
    public double? CurrencyRate { get; set; }
}

public sealed class BoundRollInput
{
    public int Type_ { get; set; }
    public DateTime RollDate { get; set; }
    public string? DocumentNumber { get; set; }
    public int? CustomerID { get; set; }
    public int? BankAccountCardID { get; set; }
    public int? SafeCardID { get; set; }
    public string? Description { get; set; }
    public string? AuthCode { get; set; }
    public List<BoundRollLineInput> Lines { get; set; } = new();
}

public sealed class BoundPortfolioRow
{
    public int BoundCardID { get; set; }
    public int? Type_ { get; set; }
    public int? Status_ { get; set; }
    public string? DocumentNr { get; set; }
    public DateTime? TransDate { get; set; }
    public DateTime? DueDate { get; set; }
    public double? Amount { get; set; }
    public int? Currency { get; set; }
    public bool IsOwn { get; set; }
    public string? Debtor { get; set; }
    public string? BankName { get; set; }
    public int? CustomerID { get; set; }
    public string? CustomerTitle { get; set; }
    /// <summary>Şu an bulunduğu yer: ciro edilen cari / tahsile-teminata verilen banka hesabı</summary>
    public string? Location { get; set; }
}

/// <summary>
/// Y-11: çek / senet portföy bordroları. Her bordro satırı bir BoundTrans hareketi yazar (kartın geçmişi) ve kartın konumunu
/// (BoundCard.Status_) değiştirir; yalnız izin verilen konumdan geçiş yapılır. Bordro silinirse kartlar önceki konumlarına döner
/// (kartın daha sonraki bir hareketi varsa silinemez). Türler ve konumlar: SqlUpdates/86_fin_bound_roll.sql.
/// </summary>
public sealed class BoundPortfolioService
{
    public static readonly Dictionary<int, string> RollTypes = new()
    {
        [1] = "Müşteriden giriş", [2] = "Cariye ciro", [3] = "Bankaya tahsile", [4] = "Bankaya teminata", [5] = "Bankadan tahsil",
        [6] = "Elden / kasaya tahsil", [7] = "Karşılıksız", [8] = "Müşteriye iade", [9] = "Borç çeki / senedi çıkışı",
        [10] = "Borç çeki / senedi ödemesi", [11] = "Portföye geri alma",
    };

    public static readonly Dictionary<int, string> Positions = new()
    {
        [1] = "Portföyde", [2] = "Ciro edildi", [3] = "Tahsilde", [4] = "Teminatta", [5] = "Tahsil edildi", [6] = "Karşılıksız",
        [7] = "İade edildi", [8] = "Verildi", [9] = "Ödendi",
    };

    /// <summary>Bordro türü → (kabul edilen konumlar, yeni konum). Boş kaynak: yeni kart açılır.</summary>
    private static readonly Dictionary<int, (int[] From, int To)> Moves = new()
    {
        [1] = ([], 1), [2] = ([1], 2), [3] = ([1], 3), [4] = ([1], 4), [5] = ([3, 4], 5), [6] = ([1], 5),
        [7] = ([1, 2, 3, 4], 6), [8] = ([1], 7), [9] = ([], 8), [10] = ([8], 9), [11] = ([3, 4], 1),
    };

    private readonly IDbConnection _db;

    public BoundPortfolioService(IDbConnection db)
    {
        _db = db;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private static string? Need(BoundRollInput r) => r.Type_ switch
    {
        1 or 2 or 8 or 9 when r.CustomerID is not > 0 => "Cari seçin.",
        3 or 4 or 5 or 10 when r.BankAccountCardID is not > 0 => "Banka hesabı seçin.",
        6 when r.SafeCardID is not > 0 => "Kasa seçin.",
        _ => null,
    };

    public async Task<(bool Ok, string Message, int Id)> CreateAsync(BoundRollInput input, int? userId, CancellationToken ct = default)
    {
        if (!Moves.TryGetValue(input.Type_, out var move)) return (false, "Geçersiz bordro türü.", 0);
        if (input.Lines.Count == 0) return (false, "Bordroda satır yok.", 0);
        if (Need(input) is { } need) return (false, need, 0);
        var isNew = move.From.Length == 0;

        Open();
        using var tx = _db.BeginTransaction();
        try
        {
            var rollId = await _db.ExecuteScalarAsync<int>(
                @"INSERT INTO dbo.BoundRoll (Type_, RollDate, DocumentNumber, CustomerID, BankAccountCardID, SafeCardID, Description, AuthCode, CreatedBy)
OUTPUT INSERTED.BoundRollID VALUES (@Type_, @RollDate, @DocumentNumber, @CustomerID, @BankAccountCardID, @SafeCardID, @Description, @AuthCode, @userId)",
                new { input.Type_, RollDate = input.RollDate.Date, input.DocumentNumber, input.CustomerID, input.BankAccountCardID, input.SafeCardID, input.Description, input.AuthCode, userId }, tx);

            var nextTrans = await _db.ExecuteScalarAsync<int>(
                "SELECT ISNULL(MAX(CASE WHEN BoundTransID > 0 THEN BoundTransID END), 0) FROM dbo.BoundTrans WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
            var nextCard = isNew
                ? await _db.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(CASE WHEN BoundCardID > 0 THEN BoundCardID END), 0) FROM dbo.BoundCard WITH (UPDLOCK, HOLDLOCK)", transaction: tx)
                : 0;
            double total = 0;
            var lineNo = 0;
            var seen = new HashSet<int>();
            foreach (var l in input.Lines)
            {
                lineNo++;
                int cardId;
                double amount;
                int? prev;
                if (isNew)
                {
                    if (string.IsNullOrWhiteSpace(l.DocumentNr) || (l.Amount ?? 0) <= 0 || l.DueDate == null)
                        throw new InvalidOperationException($"Satır {lineNo}: belge no, vade ve tutar zorunlu.");
                    cardId = ++nextCard;
                    amount = l.Amount!.Value;
                    prev = null;
                    await _db.ExecuteAsync(
                        @"INSERT INTO dbo.BoundCard (BoundCardID, Type_, Status_, DocumentNr, TransDate, DueDate, Amount, Currency, CurrencyRate, CustomerID, AuthCode,
  Debtor, BankName, BranchName, AccountNo, IsOwn, Description)
VALUES (@cardId, @type, @status, @DocumentNr, @date, @DueDate, @amount, @Currency, @CurrencyRate, @CustomerID, @AuthCode,
  @Debtor, @BankName, @BranchName, @AccountNo, @own, @Description)",
                        new
                        {
                            cardId, type = l.Type_ is 2 ? 2 : 1, status = move.To, l.DocumentNr, date = input.RollDate.Date, l.DueDate, amount,
                            l.Currency, l.CurrencyRate, input.CustomerID, input.AuthCode, l.Debtor, l.BankName, l.BranchName, l.AccountNo,
                            own = input.Type_ == 9, l.Description,
                        }, tx);
                }
                else
                {
                    if (l.BoundCardID is not int id) throw new InvalidOperationException($"Satır {lineNo}: çek / senet seçin.");
                    if (!seen.Add(id)) throw new InvalidOperationException($"Satır {lineNo}: aynı çek / senet iki kez seçilmiş.");
                    var card = await _db.QueryFirstOrDefaultAsync<(int? Status, double? Amount, string? Doc)>(
                        "SELECT Status_, Amount, DocumentNr FROM dbo.BoundCard WITH (UPDLOCK) WHERE BoundCardID = @id", new { id }, tx);
                    if (card == default) throw new InvalidOperationException($"Satır {lineNo}: çek / senet bulunamadı.");
                    var st = card.Status ?? 1;
                    if (!move.From.Contains(st))
                        throw new InvalidOperationException(
                            $"{card.Doc}: «{Positions.GetValueOrDefault(st, st.ToString())}» konumundaki belgeye «{RollTypes[input.Type_]}» yapılamaz.");
                    cardId = id;
                    amount = card.Amount ?? 0;
                    prev = st;
                    await _db.ExecuteAsync("UPDATE dbo.BoundCard SET Status_ = @to WHERE BoundCardID = @id", new { to = move.To, id }, tx);
                }
                total += amount;
                await _db.ExecuteAsync(
                    @"INSERT INTO dbo.BoundTrans (BoundTransID, CheckID, Type_, Status_, CustomerID, BankAccountID, LineNr, TransDate, DocumentNumber, BoundRollID, Amount, PrevStatus)
VALUES (@tid, @cardId, @type, 0, @CustomerID, @BankAccountCardID, @lineNo, @date, @DocumentNumber, @rollId, @amount, @prev)",
                    new
                    {
                        tid = ++nextTrans, cardId, type = input.Type_, input.CustomerID, input.BankAccountCardID, lineNo, date = input.RollDate.Date,
                        input.DocumentNumber, rollId, amount, prev,
                    }, tx);
            }
            await _db.ExecuteAsync("UPDATE dbo.BoundRoll SET Amount = @total WHERE BoundRollID = @rollId", new { total, rollId }, tx);
            tx.Commit();
            return (true, $"{RollTypes[input.Type_]} bordrosu kaydedildi ({input.Lines.Count} belge, {total:N2}).", rollId);
        }
        catch (InvalidOperationException ex)
        {
            tx.Rollback();
            return (false, ex.Message, 0);
        }
    }

    /// <summary>Bordroyu siler; kartlar önceki konumuna döner, giriş bordrosunda açılan kartlar silinir.</summary>
    public async Task<(bool Ok, string Message)> DeleteAsync(int rollId, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        var lines = (await _db.QueryAsync<(int TransId, int CardId, int? Prev)>(
            "SELECT BoundTransID, CheckID, PrevStatus FROM dbo.BoundTrans WHERE BoundRollID = @rollId", new { rollId }, tx)).ToList();
        if (lines.Count == 0 && await _db.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM dbo.BoundRoll WHERE BoundRollID = @rollId", new { rollId }, tx) == 0)
        {
            tx.Rollback();
            return (false, "Bordro bulunamadı.");
        }
        foreach (var l in lines)
        {
            var later = await _db.ExecuteScalarAsync<string?>(
                @"SELECT TOP 1 c.DocumentNr FROM dbo.BoundTrans t JOIN dbo.BoundCard c ON c.BoundCardID = t.CheckID
WHERE t.CheckID = @CardId AND t.BoundTransID > @TransId AND ISNULL(t.BoundRollID, 0) <> @rollId", new { l.CardId, l.TransId, rollId }, tx);
            if (later != null)
            {
                tx.Rollback();
                return (false, $"{later}: bu bordrodan sonra başka bir bordroda işlem görmüş — önce o bordroyu silin.");
            }
        }
        foreach (var l in lines)
        {
            if (l.Prev is int p)
                await _db.ExecuteAsync("UPDATE dbo.BoundCard SET Status_ = @p WHERE BoundCardID = @CardId", new { p, l.CardId }, tx);
            else
                await _db.ExecuteAsync("DELETE FROM dbo.BoundCard WHERE BoundCardID = @CardId", new { l.CardId }, tx);
        }
        await _db.ExecuteAsync("DELETE FROM dbo.BoundTrans WHERE BoundRollID = @rollId", new { rollId }, tx);
        await _db.ExecuteAsync("DELETE FROM dbo.BoundRoll WHERE BoundRollID = @rollId", new { rollId }, tx);
        tx.Commit();
        return (true, "Bordro silindi; belgeler önceki konumlarına döndü.");
    }

    /// <summary>Çek / senetler (konum filtresi: null → hepsi). Yer: son ciro / banka bordrosunun karşı tarafı.</summary>
    public async Task<List<BoundPortfolioRow>> PortfolioAsync(int[]? statuses, CancellationToken ct = default)
    {
        Open();
        return (await _db.QueryAsync<BoundPortfolioRow>(
            @"SELECT c.BoundCardID, c.Type_, c.Status_, c.DocumentNr, c.TransDate, c.DueDate, c.Amount, c.Currency, ISNULL(c.IsOwn, 0) AS IsOwn,
  c.Debtor, c.BankName, c.CustomerID, cc.Title AS CustomerTitle,
  CASE WHEN c.Status_ IN (2, 8) THEN lc.Title WHEN c.Status_ IN (3, 4, 5, 9) THEN ba.Title END AS Location
FROM dbo.BoundCard c
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = c.CustomerID
OUTER APPLY (SELECT TOP 1 r.CustomerID, r.BankAccountCardID FROM dbo.BoundTrans t JOIN dbo.BoundRoll r ON r.BoundRollID = t.BoundRollID
             WHERE t.CheckID = c.BoundCardID ORDER BY t.BoundTransID DESC) last
LEFT JOIN dbo.CustomerCard lc ON lc.CustomerCardID = last.CustomerID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = last.BankAccountCardID
WHERE (@all = 1 OR c.Status_ IN @statuses)
ORDER BY c.DueDate, c.BoundCardID",
            new { all = statuses == null || statuses.Length == 0 ? 1 : 0, statuses = statuses ?? [0] })).ToList();
    }

    public async Task<IEnumerable<dynamic>> RollsAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        Open();
        return await _db.QueryAsync(
            @"SELECT r.BoundRollID, r.Type_, r.RollDate, r.DocumentNumber, r.Amount, r.Description, cc.Title AS CustomerTitle, ba.Title AS BankAccountTitle,
  sc.Defintion AS SafeTitle, (SELECT COUNT(1) FROM dbo.BoundTrans t WHERE t.BoundRollID = r.BoundRollID) AS Lines
FROM dbo.BoundRoll r
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = r.CustomerID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = r.BankAccountCardID
LEFT JOIN dbo.SafeCard sc ON sc.SafeCardID = r.SafeCardID
WHERE (@from IS NULL OR r.RollDate >= @from) AND (@to IS NULL OR r.RollDate < DATEADD(day, 1, @to))
ORDER BY r.RollDate DESC, r.BoundRollID DESC", new { from, to });
    }

    /// <summary>Kartın hareket geçmişi</summary>
    public async Task<IEnumerable<dynamic>> HistoryAsync(int cardId, CancellationToken ct = default)
    {
        Open();
        return await _db.QueryAsync(
            @"SELECT t.TransDate, r.Type_, r.DocumentNumber, t.PrevStatus, cc.Title AS CustomerTitle, ba.Title AS BankAccountTitle, sc.Defintion AS SafeTitle
FROM dbo.BoundTrans t JOIN dbo.BoundRoll r ON r.BoundRollID = t.BoundRollID
LEFT JOIN dbo.CustomerCard cc ON cc.CustomerCardID = r.CustomerID
LEFT JOIN dbo.BankAccountCard ba ON ba.BankAccountCardID = r.BankAccountCardID
LEFT JOIN dbo.SafeCard sc ON sc.SafeCardID = r.SafeCardID
WHERE t.CheckID = @cardId ORDER BY t.BoundTransID", new { cardId });
    }
}
