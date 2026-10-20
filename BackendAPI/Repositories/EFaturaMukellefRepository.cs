using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EFaturaMukellefRow
{
    public int EFaturaMukellefID { get; set; }
    public string TaxNr { get; set; } = "";
    public string? Title { get; set; }
    public string Alias { get; set; } = "";
    public string? AliasType { get; set; }
    public string? UnitType { get; set; }
    public DateTime? FirstCreateDate { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class EFaturaMukellefQueryResult
{
    public string TaxNr { get; set; } = "";
    public bool Found { get; set; }
    public string Message { get; set; } = "";
    public string? Title { get; set; }
    public List<EFaturaMukellefRow> Rows { get; set; } = new();
    public string? SuggestedPostLabel { get; set; }
    public string? SuggestedSenderLabel { get; set; }
    public string? SuggestedUnitType { get; set; }
    /** Yerel tablodaki toplam aktif kayıt */
    public int LocalListCount { get; set; }
    /** Local | GibExternal | GibAuthoritative */
    public string Source { get; set; } = "Local";
    public bool CheckedExternal { get; set; }
    public string? ExternalMessage { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

public sealed class EFaturaMukellefImportResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public int TotalLines { get; set; }
}

public sealed class EFaturaMukellefRepository
{
    private readonly IDbConnection _db;

    public EFaturaMukellefRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<EFaturaMukellefQueryResult> QueryByTaxNrAsync(string taxNr, CancellationToken ct = default)
    {
        var normalized = NormalizeTaxNr(taxNr);
        var result = new EFaturaMukellefQueryResult { TaxNr = normalized };

        if (string.IsNullOrWhiteSpace(normalized) || normalized.Length < 10)
        {
            result.Message = "VKN / TCKN en az 10 haneli olmalıdır";
            return result;
        }

        if (_db.State != ConnectionState.Open)
            _db.Open();

        var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct));
        if (exists == 0)
        {
            result.Message = "EFaturaMukellef tablosu yok — Veritabanı Güncelleme ile 25_efatura_mukellef.sql uygulayın";
            return result;
        }

        var total = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1",
            cancellationToken: ct));
        result.LocalListCount = total;

        var rows = (await _db.QueryAsync<EFaturaMukellefRow>(new CommandDefinition(
            @"SELECT EFaturaMukellefID, TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive
              FROM dbo.EFaturaMukellef
              WHERE IsActive = 1 AND TaxNr = @tax
              ORDER BY
                CASE WHEN UnitType LIKE N'%Fatura%' THEN 0 ELSE 1 END,
                CASE UPPER(ISNULL(AliasType, N''))
                  WHEN N'PK' THEN 0
                  WHEN N'GB' THEN 1
                  ELSE 2 END,
                Alias",
            new { tax = normalized },
            cancellationToken: ct))).ToList();

        result.Rows = rows;
        result.Found = rows.Count > 0;
        if (!result.Found)
        {
            result.Message = $"VKN/TCKN {normalized} yerel mükellef tablosunda yok.";
            return result;
        }

        result.Title = rows.Select(r => r.Title).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t));
        result.SuggestedPostLabel = PickAlias(rows, "PK");
        result.SuggestedSenderLabel = PickAlias(rows, "GB");
        result.SuggestedUnitType = rows
            .Select(r => r.UnitType)
            .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u));
        result.Message =
            $"{rows.Count} alias bulundu" +
            (string.IsNullOrWhiteSpace(result.Title) ? "" : $" — {result.Title}");
        return result;
    }

    /// <summary>
    /// GİB Kayıtlı Kullanıcılar CSV (veya ; / , / tab ayracı).
    /// Beklenen kolonlar (sıra veya başlık): Identifier/TaxNr, Alias, Title, Type, FirstCreationTime
    /// </summary>
    public async Task<EFaturaMukellefImportResult> ImportCsvAsync(string csvText, CancellationToken ct = default)
    {
        var result = new EFaturaMukellefImportResult();
        if (string.IsNullOrWhiteSpace(csvText))
        {
            result.Message = "Boş dosya";
            return result;
        }

        if (_db.State != ConnectionState.Open)
            _db.Open();

        var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct));
        if (exists == 0)
        {
            result.Message = "EFaturaMukellef tablosu yok";
            return result;
        }

        var lines = csvText
            .Replace("\r\n", "\n")
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (lines.Length == 0)
        {
            result.Message = "Satır yok";
            return result;
        }

        var sep = DetectSeparator(lines[0]);
        var header = SplitCsvLine(lines[0], sep);
        var hasHeader = header.Any(h =>
            h.Contains("Identifier", StringComparison.OrdinalIgnoreCase)
            || h.Contains("TaxNr", StringComparison.OrdinalIgnoreCase)
            || h.Contains("VKN", StringComparison.OrdinalIgnoreCase)
            || h.Equals("Alias", StringComparison.OrdinalIgnoreCase)
            || h.Contains("Unvan", StringComparison.OrdinalIgnoreCase)
            || h.Contains("Title", StringComparison.OrdinalIgnoreCase));

        int idxTax = 0, idxAlias = 1, idxTitle = 2, idxType = 3, idxDate = 4;
        if (hasHeader)
        {
            idxTax = IndexOfHeader(header, "Identifier", "TaxNr", "VKN", "Vergi");
            idxAlias = IndexOfHeader(header, "Alias", "Etiket", "Posta");
            idxTitle = IndexOfHeader(header, "Title", "Unvan", "Ünvan", "Ad");
            idxType = IndexOfHeader(header, "Type", "Tip", "AliasType");
            idxDate = IndexOfHeader(header, "FirstCreationTime", "FirstCreateDate", "Kayit", "Tarih");
        }

        var start = hasHeader ? 1 : 0;
        for (var i = start; i < lines.Length; i++)
        {
            result.TotalLines++;
            var cols = SplitCsvLine(lines[i], sep);
            if (cols.Count == 0) { result.Skipped++; continue; }

            string Cell(int idx) => idx >= 0 && idx < cols.Count ? cols[idx].Trim().Trim('"') : "";

            var tax = NormalizeTaxNr(Cell(idxTax >= 0 ? idxTax : 0));
            var alias = Cell(idxAlias >= 0 ? idxAlias : 1);
            if (string.IsNullOrWhiteSpace(tax) || string.IsNullOrWhiteSpace(alias))
            {
                result.Skipped++;
                continue;
            }

            var title = idxTitle >= 0 ? Cell(idxTitle) : "";
            var typeRaw = idxType >= 0 ? Cell(idxType) : "";
            var aliasType = GuessAliasType(alias, typeRaw);
            DateTime? firstDate = null;
            if (idxDate >= 0 && DateTime.TryParse(Cell(idxDate), out var dt))
                firstDate = dt;

            var (ok, msg, _) = await UpsertAsync(new EFaturaMukellefRow
            {
                TaxNr = tax,
                Title = string.IsNullOrWhiteSpace(title) ? null : title,
                Alias = alias,
                AliasType = aliasType,
                UnitType = "e-Fatura",
                FirstCreateDate = firstDate,
                IsActive = true,
            }, ct);

            if (!ok) { result.Skipped++; continue; }
            if (msg.Contains("Güncellendi", StringComparison.OrdinalIgnoreCase)) result.Updated++;
            else result.Inserted++;
        }

        result.Success = result.Inserted + result.Updated > 0;
        result.Message = result.Success
            ? $"İçe aktarıldı: {result.Inserted} yeni, {result.Updated} güncelleme, {result.Skipped} atlandı (toplam satır {result.TotalLines})"
            : $"Kayıt eklenemedi (atlanan {result.Skipped}). GİB CSV formatını kontrol edin.";
        return result;
    }

    public async Task<int> CountAsync(CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var exists = await _db.ExecuteScalarAsync<int>(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL THEN 0 ELSE 1 END");
        if (exists == 0) return 0;
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1",
            cancellationToken: ct));
    }

    private static string GuessAliasType(string alias, string typeRaw)
    {
        var fromType = NormalizeAliasType(typeRaw);
        if (fromType is "PK" or "GB") return fromType;
        if (alias.Contains("defaultpk", StringComparison.OrdinalIgnoreCase)
            || alias.Contains(":pk@", StringComparison.OrdinalIgnoreCase)
            || alias.Contains("pk@", StringComparison.OrdinalIgnoreCase))
            return "PK";
        if (alias.Contains("defaultgb", StringComparison.OrdinalIgnoreCase)
            || alias.Contains(":gb@", StringComparison.OrdinalIgnoreCase)
            || alias.Contains("gb@", StringComparison.OrdinalIgnoreCase))
            return "GB";
        return fromType ?? "PK";
    }

    private static char DetectSeparator(string line)
    {
        var semi = line.Count(c => c == ';');
        var comma = line.Count(c => c == ',');
        var tab = line.Count(c => c == '\t');
        if (tab >= semi && tab >= comma && tab > 0) return '\t';
        if (semi >= comma) return ';';
        return ',';
    }

    private static List<string> SplitCsvLine(string line, char sep)
    {
        var list = new List<string>();
        var cur = new System.Text.StringBuilder();
        var inQuotes = false;
        foreach (var ch in line)
        {
            if (ch == '"') { inQuotes = !inQuotes; continue; }
            if (ch == sep && !inQuotes)
            {
                list.Add(cur.ToString());
                cur.Clear();
                continue;
            }
            cur.Append(ch);
        }
        list.Add(cur.ToString());
        return list;
    }

    private static int IndexOfHeader(List<string> header, params string[] names)
    {
        for (var i = 0; i < header.Count; i++)
        {
            var h = header[i].Trim().Trim('"');
            foreach (var n in names)
            {
                if (h.Equals(n, StringComparison.OrdinalIgnoreCase)
                    || h.Contains(n, StringComparison.OrdinalIgnoreCase))
                    return i;
            }
        }
        return -1;
    }

    public async Task<(bool Ok, string Message, int Id)> UpsertAsync(EFaturaMukellefRow row, CancellationToken ct = default)
    {
        var tax = NormalizeTaxNr(row.TaxNr);
        if (string.IsNullOrWhiteSpace(tax) || string.IsNullOrWhiteSpace(row.Alias))
            return (false, "TaxNr ve Alias zorunlu", 0);

        if (_db.State != ConnectionState.Open)
            _db.Open();

        var id = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            @"SELECT TOP 1 EFaturaMukellefID FROM dbo.EFaturaMukellef WHERE TaxNr = @tax AND Alias = @alias",
            new { tax, alias = row.Alias.Trim() },
            cancellationToken: ct));

        if (id is > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.EFaturaMukellef
                  SET Title = @Title, AliasType = @AliasType, UnitType = @UnitType, IsActive = @IsActive
                  WHERE EFaturaMukellefID = @id",
                new
                {
                    id = id.Value,
                    Title = row.Title,
                    AliasType = NormalizeAliasType(row.AliasType),
                    UnitType = row.UnitType,
                    IsActive = row.IsActive,
                },
                cancellationToken: ct));
            return (true, "Güncellendi", id.Value);
        }

        var newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.EFaturaMukellef (TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive)
              VALUES (@tax, @Title, @Alias, @AliasType, @UnitType, @FirstCreateDate, @IsActive);
              SELECT CAST(SCOPE_IDENTITY() AS INT);",
            new
            {
                tax,
                Title = row.Title,
                Alias = row.Alias.Trim(),
                AliasType = NormalizeAliasType(row.AliasType),
                UnitType = row.UnitType,
                FirstCreateDate = row.FirstCreateDate ?? DateTime.Now,
                IsActive = row.IsActive,
            },
            cancellationToken: ct));
        return (true, "Eklendi", newId);
    }

    private static string? PickAlias(List<EFaturaMukellefRow> rows, string type)
    {
        var match = rows.FirstOrDefault(r =>
            string.Equals(r.AliasType, type, StringComparison.OrdinalIgnoreCase));
        if (match != null) return match.Alias;

        // AliasType boşsa isimden tahmin
        var guess = rows.FirstOrDefault(r =>
            r.Alias.Contains(type, StringComparison.OrdinalIgnoreCase)
            || (type == "PK" && r.Alias.Contains("defaultpk", StringComparison.OrdinalIgnoreCase))
            || (type == "GB" && r.Alias.Contains("defaultgb", StringComparison.OrdinalIgnoreCase)));
        return guess?.Alias;
    }

    private static string NormalizeTaxNr(string? taxNr)
    {
        if (string.IsNullOrWhiteSpace(taxNr)) return "";
        var digits = new string(taxNr.Where(char.IsDigit).ToArray());
        return digits;
    }

    private static string? NormalizeAliasType(string? t)
    {
        if (string.IsNullOrWhiteSpace(t)) return null;
        var u = t.Trim().ToUpperInvariant();
        if (u is "PK" or "GB") return u;
        if (u.Contains("GELEN") || u.Contains("POST")) return "PK";
        if (u.Contains("GIDEN") || u.Contains("SEND")) return "GB";
        return u.Length <= 10 ? u : u[..10];
    }
}
