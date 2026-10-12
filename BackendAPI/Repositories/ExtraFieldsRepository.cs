using System.Data;
using System.Text.RegularExpressions;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class ExtraFieldDef
{
    public int ExtraFieldID { get; set; }
    public string TableName { get; set; } = "";
    public string FieldName { get; set; } = "";
    public string Label { get; set; } = "";
    /** text | date | float */
    public string DataType { get; set; } = "text";
    public int? TextLength { get; set; }
    public string? FormulaText { get; set; }
    public bool IsRequired { get; set; }
    public int ColSpan { get; set; } = 6;
    public int OrderIndex { get; set; }
    public bool IsActive { get; set; } = true;
    public string? CreatedBy { get; set; }
}

public sealed class ExtraFieldTarget
{
    public string TableName { get; init; } = "";
    public string Title { get; init; } = "";
    /** card | line */
    public string Kind { get; init; } = "card";
    public string Group { get; init; } = "";
}

/// <summary>
/// Ek alanlar: tanım SYS_ExtraFields'ta, değer hedef tabloda gerçek U_ kolonunda tutulur.
/// </summary>
public sealed class ExtraFieldsRepository
{
    private static readonly Regex FieldNamePattern = new(@"^U_[A-Za-z0-9_]{1,60}$", RegexOptions.Compiled);
    private readonly IDbConnection _db;

    public ExtraFieldsRepository(IDbConnection db) => _db = db;

    /// <summary>Ek alan açılabilen kart ve hareket tabloları (Create_DB şeması)</summary>
    public static readonly ExtraFieldTarget[] Targets =
    [
        new() { TableName = "ProductCard", Title = "Malzeme / Hizmet Kartı", Kind = "card", Group = "Malzeme" },
        new() { TableName = "VariantCard", Title = "Varyant Kartı", Kind = "card", Group = "Malzeme" },
        new() { TableName = "ProductVoucher", Title = "Malzeme Fişi / İrsaliye (başlık)", Kind = "card", Group = "Malzeme" },
        new() { TableName = "ProductTrans", Title = "Malzeme Fişi / İrsaliye / Fatura (satır)", Kind = "line", Group = "Malzeme" },
        new() { TableName = "CustomerCard", Title = "Cari Kart", Kind = "card", Group = "Finans" },
        new() { TableName = "CustomerVoucher", Title = "Cari Fiş (başlık)", Kind = "card", Group = "Finans" },
        new() { TableName = "CustomerTrans", Title = "Cari Hareket (satır)", Kind = "line", Group = "Finans" },
        new() { TableName = "BankCard", Title = "Banka Kartı", Kind = "card", Group = "Finans" },
        new() { TableName = "SafeCard", Title = "Kasa Kartı", Kind = "card", Group = "Finans" },
        new() { TableName = "BoundCard", Title = "Çek / Senet Kartı", Kind = "card", Group = "Finans" },
        new() { TableName = "Invoice", Title = "Fatura (başlık)", Kind = "card", Group = "Satış / Satınalma" },
        new() { TableName = "OrderVoucher", Title = "Sipariş (başlık)", Kind = "card", Group = "Satış / Satınalma" },
        new() { TableName = "OrderTrans", Title = "Sipariş (satır)", Kind = "line", Group = "Satış / Satınalma" },
        new() { TableName = "AccountCard", Title = "Muhasebe Hesap Kartı", Kind = "card", Group = "Genel Muhasebe" },
        new() { TableName = "AccountVoucher", Title = "Muhasebe Fişi (başlık)", Kind = "card", Group = "Genel Muhasebe" },
        new() { TableName = "AccountTrans", Title = "Muhasebe Fişi (satır)", Kind = "line", Group = "Genel Muhasebe" },
        new() { TableName = "PersonCard", Title = "Personel Kartı", Kind = "card", Group = "Personel" },
    ];

    public static ExtraFieldTarget? GetTarget(string tableName) =>
        Targets.FirstOrDefault(t => t.TableName.Equals(tableName, StringComparison.OrdinalIgnoreCase));

    public static string NormalizeFieldName(string raw)
    {
        var name = (raw ?? "").Trim().Replace(' ', '_');
        name = Regex.Replace(name, @"[^A-Za-z0-9_]", "");
        if (!name.StartsWith("U_", StringComparison.OrdinalIgnoreCase)) name = "U_" + name;
        return name;
    }

    private static string SqlTypeOf(string dataType, int? textLength) => dataType.ToLowerInvariant() switch
    {
        "date" => "DATETIME NULL",
        "float" => "FLOAT NULL",
        _ => $"NVARCHAR({Math.Clamp(textLength ?? 200, 1, 4000)}) NULL",
    };

    private async Task EnsureMetaTableAsync(CancellationToken ct)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var exists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.SYS_ExtraFields', N'U')", cancellationToken: ct));
        if (exists is null)
            throw new InvalidOperationException(
                "SYS_ExtraFields tablosu yok. Sistem Yönetimi → Veritabanı Güncelleme ekranından 64_sys_extra_fields.sql çalıştırın.");
    }

    public async Task<List<ExtraFieldDef>> ListAsync(string? tableName, bool includeInactive, CancellationToken ct)
    {
        await EnsureMetaTableAsync(ct);
        var rows = await _db.QueryAsync<ExtraFieldDef>(new CommandDefinition(
            @"SELECT ExtraFieldID, TableName, FieldName, Label, DataType, TextLength, FormulaText,
                     IsRequired, ColSpan, OrderIndex, IsActive, CreatedBy
              FROM dbo.SYS_ExtraFields
              WHERE (@table IS NULL OR TableName = @table)
                AND (@all = 1 OR IsActive = 1)
              ORDER BY TableName, OrderIndex, Label",
            new { table = string.IsNullOrWhiteSpace(tableName) ? null : tableName, all = includeInactive ? 1 : 0 },
            cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<(bool Ok, string Message, ExtraFieldDef? Field)> SaveAsync(ExtraFieldDef def, CancellationToken ct)
    {
        await EnsureMetaTableAsync(ct);

        var target = GetTarget(def.TableName);
        if (target == null) return (false, $"Ek alan eklenemeyen tablo: {def.TableName}", null);

        def.FieldName = NormalizeFieldName(def.FieldName);
        if (!FieldNamePattern.IsMatch(def.FieldName))
            return (false, "Alan adı U_ ile başlamalı ve yalnız harf, rakam, alt çizgi içermeli", null);

        var dataType = (def.DataType ?? "text").ToLowerInvariant();
        if (dataType is not ("text" or "date" or "float"))
            return (false, "Tip yalnızca metin, tarih veya ondalık olabilir", null);
        def.DataType = dataType;

        var tableExists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(@t, N'U')", new { t = $"dbo.{target.TableName}" }, cancellationToken: ct));
        if (tableExists is null) return (false, $"Tablo veritabanında yok: {target.TableName}", null);

        var existing = await _db.QuerySingleOrDefaultAsync<ExtraFieldDef>(new CommandDefinition(
            "SELECT TOP 1 * FROM dbo.SYS_ExtraFields WHERE TableName = @t AND FieldName = @f",
            new { t = target.TableName, f = def.FieldName }, cancellationToken: ct));

        if (existing != null && def.ExtraFieldID == 0) def.ExtraFieldID = existing.ExtraFieldID;
        // Kolon tipi sonradan değiştirilmez — veri kaybı riski
        if (existing != null && !existing.DataType.Equals(def.DataType, StringComparison.OrdinalIgnoreCase))
            return (false, $"{def.FieldName} kolonu zaten {existing.DataType} tipinde. Tip değiştirilemez; yeni alan açın.", null);

        var colExists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT COL_LENGTH(@t, @c)", new { t = $"dbo.{target.TableName}", c = def.FieldName }, cancellationToken: ct));
        if (colExists is null)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                $"ALTER TABLE [dbo].[{target.TableName}] ADD [{def.FieldName}] {SqlTypeOf(def.DataType, def.TextLength)}",
                cancellationToken: ct));
        }

        if (def.ExtraFieldID > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.SYS_ExtraFields
                     SET Label = @Label, FormulaText = @FormulaText, IsRequired = @IsRequired,
                         ColSpan = @ColSpan, OrderIndex = @OrderIndex, IsActive = @IsActive
                   WHERE ExtraFieldID = @ExtraFieldID", def, cancellationToken: ct));
        }
        else
        {
            def.ExtraFieldID = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"INSERT INTO dbo.SYS_ExtraFields
                      (TableName, FieldName, Label, DataType, TextLength, FormulaText, IsRequired, ColSpan, OrderIndex, IsActive, CreatedBy)
                  VALUES (@TableName, @FieldName, @Label, @DataType, @TextLength, @FormulaText, @IsRequired, @ColSpan, @OrderIndex, @IsActive, @CreatedBy);
                  SELECT CAST(SCOPE_IDENTITY() AS INT);", def, cancellationToken: ct));
        }

        return (true, colExists is null ? $"{def.FieldName} kolonu eklendi" : "Ek alan güncellendi", def);
    }

    /// <summary>dropColumn = true ise kolon ve içindeki veri de silinir.</summary>
    public async Task<(bool Ok, string Message)> DeleteAsync(int id, bool dropColumn, CancellationToken ct)
    {
        await EnsureMetaTableAsync(ct);
        var def = await _db.QuerySingleOrDefaultAsync<ExtraFieldDef>(new CommandDefinition(
            "SELECT TOP 1 * FROM dbo.SYS_ExtraFields WHERE ExtraFieldID = @id", new { id }, cancellationToken: ct));
        if (def == null) return (false, "Ek alan bulunamadı");

        if (dropColumn && GetTarget(def.TableName) != null && FieldNamePattern.IsMatch(def.FieldName))
        {
            var colExists = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                "SELECT COL_LENGTH(@t, @c)", new { t = $"dbo.{def.TableName}", c = def.FieldName }, cancellationToken: ct));
            if (colExists is not null)
            {
                await _db.ExecuteAsync(new CommandDefinition(
                    $"ALTER TABLE [dbo].[{def.TableName}] DROP COLUMN [{def.FieldName}]", cancellationToken: ct));
            }
            await _db.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.SYS_ExtraFields WHERE ExtraFieldID = @id", new { id }, cancellationToken: ct));
            return (true, $"{def.FieldName} kolonu ve tanımı silindi");
        }

        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_ExtraFields SET IsActive = 0 WHERE ExtraFieldID = @id", new { id }, cancellationToken: ct));
        return (true, $"{def.FieldName} formlardan kaldırıldı (kolon ve veri korunuyor)");
    }

    /// <summary>Formülde kullanılabilecek kolonlar — hedef tablonun gerçek kolonları.</summary>
    public async Task<List<string>> ColumnsAsync(string tableName, CancellationToken ct)
    {
        if (GetTarget(tableName) == null) return new List<string>();
        if (_db.State != ConnectionState.Open) _db.Open();
        var rows = await _db.QueryAsync<string>(new CommandDefinition(
            @"SELECT c.name FROM sys.columns c
              WHERE c.object_id = OBJECT_ID(@t) ORDER BY c.column_id",
            new { t = $"dbo.{tableName}" }, cancellationToken: ct));
        return rows.ToList();
    }
}
