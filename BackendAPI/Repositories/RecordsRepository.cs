using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

public sealed class RecordListResult
{
    public string TableName { get; set; } = "";
    public string PrimaryKeyColumn { get; set; } = "";
    public int Total { get; set; }
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public string? Warning { get; set; }
}

public sealed class RecordGetResult
{
    public string TableName { get; set; } = "";
    public string PrimaryKeyColumn { get; set; } = "";
    public int RecordId { get; set; }
    public Dictionary<string, object?> StandardFields { get; set; } = new();
    public Dictionary<string, object?> AdditionalFields { get; set; } = new();
    public List<Dictionary<string, object?>>? Addresses { get; set; }
    public List<Dictionary<string, object?>>? Contacts { get; set; }
    public List<Dictionary<string, object?>>? Accounts { get; set; }
    public List<Dictionary<string, object?>>? Barcodes { get; set; }
    public List<Dictionary<string, object?>>? UnitConvs { get; set; }
    public List<Dictionary<string, object?>>? ProductSubs { get; set; }
    public List<Dictionary<string, object?>>? CustomerAliases { get; set; }
    public List<Dictionary<string, object?>>? Variants { get; set; }
    public List<Dictionary<string, object?>>? SerialGroups { get; set; }
    public List<Dictionary<string, object?>>? Serials { get; set; }
    public List<Dictionary<string, object?>>? Lots { get; set; }
    public List<Dictionary<string, object?>>? AccountLinks { get; set; }
    public List<Dictionary<string, object?>>? Lines { get; set; }
    public List<Dictionary<string, object?>>? Workplaces { get; set; }
    public List<Dictionary<string, object?>>? Whouses { get; set; }
    public List<Dictionary<string, object?>>? PaymentPlans { get; set; }
    public List<Dictionary<string, object?>>? Distributions { get; set; }
    public List<Dictionary<string, object?>>? AuxilCodes { get; set; }
    public List<Dictionary<string, object?>>? AuxilValues { get; set; }
}

public sealed class SerialLotOptionDto
{
    public int ProductSerialLotID { get; set; }
    public string Code { get; set; } = "";
    public byte Kind { get; set; }
    public byte Status { get; set; }
    public int? WhouseID { get; set; }
    public double? Qty { get; set; }
    /// <summary>Seri grubunun seri numaraları (virgül).</summary>
    public string? Serials { get; set; }
    public DateTime? ExpireDate { get; set; }
    public string? Description { get; set; }
    public int? StockLocationID { get; set; }
}

public sealed class RecordSaveRequest
{
    public int RecordId { get; set; }
    public Dictionary<string, object?>? StandardFields { get; set; }
    public Dictionary<string, object?>? AdditionalFields { get; set; }
    public List<Dictionary<string, object?>>? Addresses { get; set; }
    public List<Dictionary<string, object?>>? Contacts { get; set; }
    public List<Dictionary<string, object?>>? Accounts { get; set; }
    public List<Dictionary<string, object?>>? Barcodes { get; set; }
    public List<Dictionary<string, object?>>? UnitConvs { get; set; }
    public List<Dictionary<string, object?>>? ProductSubs { get; set; }
    public List<Dictionary<string, object?>>? CustomerAliases { get; set; }
    public List<Dictionary<string, object?>>? Variants { get; set; }
    public List<Dictionary<string, object?>>? SerialGroups { get; set; }
    public List<Dictionary<string, object?>>? Serials { get; set; }
    public List<Dictionary<string, object?>>? Lots { get; set; }
    public List<Dictionary<string, object?>>? AccountLinks { get; set; }
    public List<Dictionary<string, object?>>? Lines { get; set; }
    public List<Dictionary<string, object?>>? Workplaces { get; set; }
    public List<Dictionary<string, object?>>? Whouses { get; set; }
    public List<Dictionary<string, object?>>? PaymentPlans { get; set; }
    public List<Dictionary<string, object?>>? Distributions { get; set; }
    public List<Dictionary<string, object?>>? AuxilCodes { get; set; }
    public List<Dictionary<string, object?>>? AuxilValues { get; set; }
    /** Form kodu — SYS_FormPostSave + şema postSave birleşimi */
    public string? FormCode { get; set; }
    /** Şemadan gelen kaydet-sonrası komutlar */
    public List<PostSaveActionDto>? PostSave { get; set; }
    /** Yeni fişte numara kayıtta verilir (Y-05) — RecordsController */
    public AutoNumberRequest? AutoNumber { get; set; }
    /// <summary>Y-12: risk limiti aşımını yönetici onayladı (RiskAction 2)</summary>
    public bool RiskApproved { get; set; }
}

internal sealed class NestedChildSpec
{
    public string PayloadKey { get; init; } = "";
    public string TableName { get; init; } = "";
    public string ParentFkColumn { get; init; } = "";
    public string PrimaryKeyColumn { get; init; } = "";
    /** Extra fixed columns on every insert (e.g. Module) */
    public Dictionary<string, object?>? FixedColumns { get; init; }
    /** Extra WHERE when deleting/loading (column = value) */
    public Dictionary<string, object?>? FilterColumns { get; init; }
}

public sealed class RecordsRepository
{
    private static readonly Regex SafeIdent = new(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);
    private readonly IDbConnection _db;

    /// <summary>
    /// Genel kayıt ucunda (liste / tek kayıt / alt satır) asla dönmeyen gizli kolonlar.
    /// Yanıtta değer yerine "{Kolon}Set" (dolu mu) bayrağı döner; kayıtta boş gelirse mevcut değer korunur.
    /// </summary>
    private static readonly Dictionary<string, string[]> SecretColumnsByTable =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["SYS_Companies"] = ["IntegratorPassword", "IntegratorApiKey"],
            ["SYS_Workplace"] = ["IntegratorPassword", "IntegratorApiKey"],
            ["SystemUser"] = ["Password"],
            ["SYS_Users"] = ["PasswordHash"],
            ["CRM_MailProfile"] = ["SmtpPassword"],
        };

    /// <summary>Ana kart → nested çocuk tablolar</summary>
    private static readonly Dictionary<string, NestedChildSpec[]> NestedByParent =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["CustomerCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "addresses",
                    TableName = "CustomerAdress",
                    ParentFkColumn = "CustomerCardID",
                    PrimaryKeyColumn = "CustomerAdressID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "contacts",
                    TableName = "CustomerContact",
                    ParentFkColumn = "CustomerCardID",
                    PrimaryKeyColumn = "CustomerContactID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "accountLinks",
                    TableName = "AccountLinkDetail",
                    ParentFkColumn = "SourceCardID",
                    PrimaryKeyColumn = "AccountLinkDetailID",
                    FixedColumns = new Dictionary<string, object?> { ["Module"] = 2 },
                    FilterColumns = new Dictionary<string, object?> { ["Module"] = 2 },
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 2 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 2 },
                },
            ],
            ["ProductCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "unitConvs",
                    TableName = "ProductUnit",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "ProductUnitID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "barcodes",
                    TableName = "ProductBarcode",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "ProductBarcodeID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "productSubs",
                    TableName = "ProductSub",
                    ParentFkColumn = "MainProductCardID",
                    PrimaryKeyColumn = "ProductSubID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "customerAliases",
                    TableName = "ProductCustomerAlias",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "ProductCustomerAliasID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "variants",
                    TableName = "VariantCard",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "VariantCardID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "serialGroups",
                    TableName = "ProductSerialGroup",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "ProductSerialGroupID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "serials",
                    TableName = "ProductSerial",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "ProductSerialID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "lots",
                    TableName = "ProductLot",
                    ParentFkColumn = "ProductCardID",
                    PrimaryKeyColumn = "ProductLotID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "accountLinks",
                    TableName = "AccountLinkDetail",
                    ParentFkColumn = "SourceCardID",
                    PrimaryKeyColumn = "AccountLinkDetailID",
                    FixedColumns = new Dictionary<string, object?> { ["Module"] = 1 },
                    FilterColumns = new Dictionary<string, object?> { ["Module"] = 1 },
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 1 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 1 },
                },
            ],
            ["BankCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "accounts",
                    TableName = "BankAccountCard",
                    ParentFkColumn = "BankCardID",
                    PrimaryKeyColumn = "BankAccountCardID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 3 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 3 },
                },
            ],
            ["BankAccountCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "accountLinks",
                    TableName = "AccountLinkDetail",
                    ParentFkColumn = "SourceCardID",
                    PrimaryKeyColumn = "AccountLinkDetailID",
                    FixedColumns = new Dictionary<string, object?> { ["Module"] = 3 },
                    FilterColumns = new Dictionary<string, object?> { ["Module"] = 3 },
                },
            ],
            ["SafeCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "accountLinks",
                    TableName = "AccountLinkDetail",
                    ParentFkColumn = "SourceCardID",
                    PrimaryKeyColumn = "AccountLinkDetailID",
                    FixedColumns = new Dictionary<string, object?> { ["Module"] = 4 },
                    FilterColumns = new Dictionary<string, object?> { ["Module"] = 4 },
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 4 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 4 },
                },
            ],
            ["SYS_Companies"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "workplaces",
                    TableName = "SYS_Workplace",
                    ParentFkColumn = "CompanyID",
                    PrimaryKeyColumn = "WorkplaceID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "whouses",
                    TableName = "SYS_Whouse",
                    ParentFkColumn = "CompanyId",
                    PrimaryKeyColumn = "WhouseId",
                },
            ],
            ["TaxCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "accountLinks",
                    TableName = "AccountLinkDetail",
                    ParentFkColumn = "SourceCardID",
                    PrimaryKeyColumn = "AccountLinkDetailID",
                    FixedColumns = new Dictionary<string, object?> { ["Module"] = 6 },
                    FilterColumns = new Dictionary<string, object?> { ["Module"] = 6 },
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 6 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 6 },
                },
            ],
            ["CustomerVoucher"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "CustomerTrans",
                    ParentFkColumn = "CustomerVoucherID",
                    PrimaryKeyColumn = "CustomerTransID",
                    FixedColumns = new Dictionary<string, object?> { ["Type"] = 1, ["Status"] = 1 },
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 14 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 14 },
                },
            ],
            ["ProductVoucher"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "ProductTrans",
                    ParentFkColumn = "ProductVoucherID",
                    PrimaryKeyColumn = "ProductTransID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "paymentPlans",
                    TableName = "VoucherPaymentLine",
                    ParentFkColumn = "ProductVoucherID",
                    PrimaryKeyColumn = "VoucherPaymentLineID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 12 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 12 },
                },
            ],
            ["OrderVoucher"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "OrderTrans",
                    ParentFkColumn = "OrderVoucherID",
                    PrimaryKeyColumn = "OrderTransID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "paymentPlans",
                    TableName = "VoucherPaymentLine",
                    ParentFkColumn = "OrderVoucherID",
                    PrimaryKeyColumn = "VoucherPaymentLineID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 10 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 10 },
                },
            ],
            ["SafeVoucher"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "SafeTrans",
                    ParentFkColumn = "SafeVoucherID",
                    PrimaryKeyColumn = "SafeTransID",
                },
            ],
            ["BankVoucher"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "BankTrans",
                    ParentFkColumn = "BankVoucherID",
                    PrimaryKeyColumn = "BankTtansID",
                    FixedColumns = new Dictionary<string, object?> { ["Type_"] = 1, ["Status_"] = 1 },
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 13 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 13 },
                },
            ],
            ["Invoice"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "ProductTrans",
                    ParentFkColumn = "InvoiceID",
                    PrimaryKeyColumn = "ProductTransID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "paymentPlans",
                    TableName = "VoucherPaymentLine",
                    ParentFkColumn = "InvoiceID",
                    PrimaryKeyColumn = "VoucherPaymentLineID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 11 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 11 },
                },
            ],
            ["AccountVoucher"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "AccountTrans",
                    ParentFkColumn = "AccountVoucherID",
                    // Create_DB: AccountTrasnID (yazım); 36 script AccountTransID de ekleyebilir
                    PrimaryKeyColumn = "AccountTrasnID",
                },
                new NestedChildSpec
                {
                    // Satır dağıtımı (masraf merkezi / proje) — TransLineNo ile fiş satırına bağlı
                    PayloadKey = "distributions",
                    TableName = "AccountTransDetail",
                    ParentFkColumn = "AccountVoucherID",
                    PrimaryKeyColumn = "AccountTransDetailID",
                },
                new NestedChildSpec
                {
                    PayloadKey = "auxilCodes",
                    TableName = "AuxilCodeTrans",
                    ParentFkColumn = "MainCardID",
                    PrimaryKeyColumn = "AuxilCodeTransID",
                    FixedColumns = new Dictionary<string, object?> { ["ModuleNr"] = 15 },
                    FilterColumns = new Dictionary<string, object?> { ["ModuleNr"] = 15 },
                },
            ],
            ["PaidPlanCard"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "lines",
                    TableName = "PaidPlanLine",
                    ParentFkColumn = "PaidPlanID",
                    PrimaryKeyColumn = "PaidPlanLineID",
                },
            ],
            ["AuxilCodes"] =
            [
                new NestedChildSpec
                {
                    PayloadKey = "auxilValues",
                    TableName = "AuxilCodeValue",
                    ParentFkColumn = "AuxilCodesID",
                    PrimaryKeyColumn = "AuxilCodeValueID",
                },
            ],
        };

    public RecordsRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<RecordListResult> ListAsync(
        string tableName,
        string? primaryKeyHint,
        string? filterColumn,
        string? filterValue,
        int take = 500,
        CancellationToken ct = default,
        bool includeTemplates = false,
        int skip = 0,
        string? search = null)
    {
        EnsureSafe(tableName);
        if (!string.IsNullOrWhiteSpace(filterColumn)) EnsureSafe(filterColumn);

        if (_db.State != ConnectionState.Open)
            _db.Open();

        if (!await TableExistsAsync(tableName))
        {
            return new RecordListResult
            {
                TableName = tableName,
                Warning = $"Tablo bulunamadı: {tableName}",
            };
        }

        var pk = await ResolvePrimaryKeyAsync(tableName, primaryKeyHint);
        var cols = await GetColumnsAsync(tableName);
        if (cols.Count == 0)
        {
            return new RecordListResult { TableName = tableName, PrimaryKeyColumn = pk, Warning = "Kolon yok" };
        }

        take = Math.Clamp(take, 1, 2000);
        skip = Math.Max(0, skip);
        var selectList = BuildSelectList(tableName, cols);
        var sql = $"SELECT {selectList} FROM [{tableName}]";
        var parameters = new DynamicParameters();
        var whereParts = new List<string>();

        if (!string.IsNullOrWhiteSpace(filterColumn) && filterValue != null && cols.Contains(filterColumn, StringComparer.OrdinalIgnoreCase)
            && !IsSecretColumn(tableName, filterColumn))
        {
            var realCol = cols.First(c => c.Equals(filterColumn, StringComparison.OrdinalIgnoreCase));
            whereParts.Add($"[{realCol}] = @FilterValue");
            parameters.Add("FilterValue", filterValue);
        }

        // ID < 0 şablon / öndeğer kayıtları normal listede gizlenir
        if (!includeTemplates
            && !string.IsNullOrWhiteSpace(pk)
            && cols.Contains(pk, StringComparer.OrdinalIgnoreCase))
        {
            whereParts.Add($"[{pk}] > 0");
        }

        // Y-15: sunucuda arama — tablonun metin kolonlarında (en çok 12, gizli kolonlar hariç) içerir araması
        if (!string.IsNullOrWhiteSpace(search))
        {
            var textCols = (await _db.QueryAsync<string>(new CommandDefinition(
                @"SELECT TOP 12 c.name FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
                  WHERE t.name = @table AND SCHEMA_NAME(t.schema_id) = N'dbo'
                    AND TYPE_NAME(c.user_type_id) IN (N'nvarchar', N'varchar', N'nchar', N'char') AND (c.max_length = -1 OR c.max_length <= 1000)
                  ORDER BY c.column_id", new { table = tableName }, cancellationToken: ct)))
                .Where(c => !IsSecretColumn(tableName, c)).ToList();
            var idCol = !string.IsNullOrWhiteSpace(pk) && cols.Contains(pk, StringComparer.OrdinalIgnoreCase) && int.TryParse(search.Trim(), out _)
                ? $"[{pk}] = @SearchId" : null;
            var ors = textCols.Select(c => $"[{c}] LIKE @Search").Concat(idCol != null ? new[] { idCol } : Array.Empty<string>()).ToList();
            if (ors.Count > 0)
            {
                whereParts.Add("(" + string.Join(" OR ", ors) + ")");
                parameters.Add("Search", "%" + search.Trim().Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]") + "%");
                if (idCol != null) parameters.Add("SearchId", int.Parse(search.Trim()));
            }
        }

        var where = whereParts.Count > 0 ? " WHERE " + string.Join(" AND ", whereParts) : "";
        sql += where;
        var total = await _db.ExecuteScalarAsync<int>(new CommandDefinition($"SELECT COUNT(1) FROM [{tableName}]{where}", parameters, cancellationToken: ct));

        sql += !string.IsNullOrWhiteSpace(pk) && cols.Contains(pk, StringComparer.OrdinalIgnoreCase)
            ? $" ORDER BY [{pk}] DESC"
            : " ORDER BY (SELECT NULL)";
        sql += $" OFFSET {skip} ROWS FETCH NEXT {take} ROWS ONLY";

        var raw = await _db.QueryAsync(new CommandDefinition(sql, parameters, cancellationToken: ct));
        var rows = new List<Dictionary<string, object?>>();
        foreach (var row in raw)
        {
            var dict = (IDictionary<string, object>)row;
            var mapped = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in dict)
            {
                mapped[kv.Key] = NormalizeValue(kv.Value);
                mapped[ToCamel(kv.Key)] = NormalizeValue(kv.Value);
            }

            if (!string.IsNullOrWhiteSpace(pk) && mapped.TryGetValue(pk, out var idVal))
            {
                mapped["id"] = idVal;
                mapped["Id"] = idVal;
            }

            if (mapped.TryGetValue("IsActive", out var ia) || mapped.TryGetValue("Active", out ia))
            {
                mapped["status"] = ToActiveLabel(ia);
            }
            else if (mapped.TryGetValue("Status_", out var st) || mapped.TryGetValue("Status", out st))
            {
                mapped["status"] = st;
            }

            rows.Add(mapped);
        }

        if (tableName.Equals("ProductCard", StringComparison.OrdinalIgnoreCase))
        {
            var ids = rows
                .Select(r => ToInt(r.TryGetValue("ProductCardID", out var a) ? a
                    : r.TryGetValue("id", out var b) ? b : null))
                .Where(id => id is > 0)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();
            var stats = await RefreshProductCardStatsAsync(ids, ct);
            ApplyProductCardStatsToRows(rows, stats);
        }

        return new RecordListResult
        {
            TableName = tableName,
            PrimaryKeyColumn = pk,
            Total = Math.Max(total, skip + rows.Count),
            Rows = rows,
        };
    }

    private sealed class ProductCardStats
    {
        public double StockQty { get; set; }
        public double SalesOrderQty { get; set; }
        public double PurchaseOrderQty { get; set; }
        public string MainUnitName { get; set; } = "";
    }

    /// <summary>
    /// Malzeme stok / sipariş / ana birim özetini hesaplar ve ProductCard kolonlarına yazar.
    /// </summary>
    private async Task<Dictionary<int, ProductCardStats>> RefreshProductCardStatsAsync(
        IReadOnlyList<int> productIds,
        CancellationToken ct = default)
    {
        var result = new Dictionary<int, ProductCardStats>();
        if (productIds.Count == 0) return result;
        if (!await TableExistsAsync("ProductCard")) return result;

        var pcCols = await GetColumnsAsync("ProductCard");
        var hasStock = pcCols.Contains("StockQty", StringComparer.OrdinalIgnoreCase);
        var hasSales = pcCols.Contains("SalesOrderQty", StringComparer.OrdinalIgnoreCase);
        var hasPurch = pcCols.Contains("PurchaseOrderQty", StringComparer.OrdinalIgnoreCase);
        var hasUnitName = pcCols.Contains("MainUnitName", StringComparer.OrdinalIgnoreCase);
        if (!hasStock && !hasSales && !hasPurch && !hasUnitName) return result;

        var ids = productIds.Where(id => id > 0).Distinct().ToList();
        if (ids.Count == 0) return result;

        foreach (var id in ids)
            result[id] = new ProductCardStats();

        // Ana birim
        if (await TableExistsAsync("ProductUnit"))
        {
            var unitRows = await _db.QueryAsync<(int ProductCardID, int? UnitID)>(new CommandDefinition(
                @"
SELECT ProductCardID, UnitID
FROM dbo.ProductUnit
WHERE ProductCardID IN @ids AND UnitID IS NOT NULL
ORDER BY CASE WHEN IsMain = 1 THEN 0 ELSE 1 END, LineNr, ProductUnitID",
                new { ids },
                cancellationToken: ct));
            foreach (var u in unitRows)
            {
                if (!result.TryGetValue(u.ProductCardID, out var st)) continue;
                if (!string.IsNullOrEmpty(st.MainUnitName)) continue;
                st.MainUnitName = UnitCatalogLabel(u.UnitID);
            }
        }
        var defRows = await _db.QueryAsync<(int ProductCardID, int? DefaultUnitID)>(new CommandDefinition(
            @"SELECT ProductCardID, DefaultUnitID FROM dbo.ProductCard WHERE ProductCardID IN @ids",
            new { ids },
            cancellationToken: ct));
        foreach (var d in defRows)
        {
            if (!result.TryGetValue(d.ProductCardID, out var st)) continue;
            if (!string.IsNullOrEmpty(st.MainUnitName) || d.DefaultUnitID is null or <= 0) continue;
            st.MainUnitName = UnitCatalogLabel(d.DefaultUnitID);
        }

        // Stok
        if (await TableExistsAsync("ProductTrans") && await TableExistsAsync("ProductVoucher"))
        {
            var ptCols = await GetColumnsAsync("ProductTrans");
            var hasMainQty = ptCols.Contains("MainUnitQuantity", StringComparer.OrdinalIgnoreCase);
            var qtyExpr = hasMainQty
                ? "ISNULL(NULLIF(pt.MainUnitQuantity, 0), ISNULL(pt.Quantity, 0))"
                : "ISNULL(pt.Quantity, 0)";
            var hasPtVt = ptCols.Contains("VoucherType", StringComparer.OrdinalIgnoreCase);
            var vtExpr = hasPtVt
                ? "COALESCE(pt.VoucherType, pv.VoucherType)"
                : "pv.VoucherType";

            var stockRows = await _db.QueryAsync<(int ProductCardID, double Qty)>(new CommandDefinition(
                $@"
SELECT
  pt.ProductCardID,
  SUM(
    CASE {vtExpr}
      WHEN 1 THEN 1
      WHEN 2 THEN 1
      WHEN 3 THEN -1
      WHEN 4 THEN -1
      WHEN 5 THEN 1
      WHEN 8 THEN -1
      WHEN 9 THEN 1
      WHEN 10 THEN -1
      ELSE 0
    END * ({qtyExpr})
  ) AS Qty
FROM dbo.ProductTrans pt
INNER JOIN dbo.ProductVoucher pv ON pv.ProductVoucherID = pt.ProductVoucherID
WHERE pt.ProductCardID IN @ids
  AND pt.ProductVoucherID IS NOT NULL
  AND ISNULL(pv.Status_, 1) <> 3
GROUP BY pt.ProductCardID",
                new { ids },
                cancellationToken: ct));
            foreach (var s in stockRows)
            {
                if (result.TryGetValue(s.ProductCardID, out var st))
                    st.StockQty = Math.Round(s.Qty, 4);
            }
        }

        // Sipariş
        if (await TableExistsAsync("OrderTrans") && await TableExistsAsync("OrderVoucher"))
        {
            var otCols = await GetColumnsAsync("OrderTrans");
            var hasOvFk = otCols.Contains("OrderVoucherID", StringComparer.OrdinalIgnoreCase);
            var joinOn = hasOvFk
                ? "v.OrderVoucherID = COALESCE(t.OrderVoucherID, t.OrderSlipID)"
                : "v.OrderVoucherID = t.OrderSlipID";

            var ordRows = await _db.QueryAsync<(int ProductCardID, int Type_, double Qty)>(new CommandDefinition(
                $@"
SELECT
  t.ItemsID AS ProductCardID,
  CAST(v.Type_ AS int) AS Type_,
  SUM(ISNULL(t.Quantity, 0)) AS Qty
FROM dbo.OrderTrans t
INNER JOIN dbo.OrderVoucher v ON {joinOn}
WHERE t.ItemsID IN @ids
  AND ISNULL(v.Status_, 1) = 1
  AND v.Type_ IN (1, 2)
GROUP BY t.ItemsID, v.Type_",
                new { ids },
                cancellationToken: ct));
            foreach (var o in ordRows)
            {
                if (!result.TryGetValue(o.ProductCardID, out var st)) continue;
                var q = Math.Round(o.Qty, 4);
                if (o.Type_ == 1) st.SalesOrderQty = q;
                else if (o.Type_ == 2) st.PurchaseOrderQty = q;
            }
        }

        // DB'ye yaz
        foreach (var id in ids)
        {
            var st = result[id];
            var sets = new List<string>();
            var p = new DynamicParameters();
            p.Add("id", id);
            if (hasStock)
            {
                sets.Add("StockQty = @stock");
                p.Add("stock", st.StockQty);
            }
            if (hasSales)
            {
                sets.Add("SalesOrderQty = @sales");
                p.Add("sales", st.SalesOrderQty);
            }
            if (hasPurch)
            {
                sets.Add("PurchaseOrderQty = @purch");
                p.Add("purch", st.PurchaseOrderQty);
            }
            if (hasUnitName)
            {
                sets.Add("MainUnitName = @unit");
                p.Add("unit", string.IsNullOrWhiteSpace(st.MainUnitName) ? null : st.MainUnitName);
            }
            if (sets.Count == 0) continue;
            await _db.ExecuteAsync(new CommandDefinition(
                $"UPDATE dbo.ProductCard SET {string.Join(", ", sets)} WHERE ProductCardID = @id",
                p,
                cancellationToken: ct));
        }

        return result;
    }

    private static void ApplyProductCardStatsToRows(
        List<Dictionary<string, object?>> rows,
        Dictionary<int, ProductCardStats> stats)
    {
        foreach (var row in rows)
        {
            var id = ToInt(row.TryGetValue("ProductCardID", out var a) ? a
                : row.TryGetValue("id", out var b) ? b : null);
            if (id is null or <= 0) continue;
            stats.TryGetValue(id.Value, out var st);
            st ??= new ProductCardStats();

            var unit = !string.IsNullOrWhiteSpace(st.MainUnitName)
                ? st.MainUnitName
                : (row.TryGetValue("MainUnitName", out var mu) ? Convert.ToString(mu) ?? "" : "");

            row["stockQty"] = st.StockQty;
            row["StockQty"] = st.StockQty;
            row["mainUnit"] = unit;
            row["MainUnit"] = unit;
            row["MainUnitName"] = unit;
            row["mainUnitName"] = unit;
            row["salesOrderQty"] = st.SalesOrderQty;
            row["SalesOrderQty"] = st.SalesOrderQty;
            row["purchaseOrderQty"] = st.PurchaseOrderQty;
            row["PurchaseOrderQty"] = st.PurchaseOrderQty;
        }
    }

    private static HashSet<int> CollectProductIdsFromSave(RecordSaveRequest data)
    {
        var ids = new HashSet<int>();
        void Add(object? v)
        {
            var n = ToInt(v);
            if (n is > 0) ids.Add(n.Value);
        }
        foreach (var line in data.Lines ?? Enumerable.Empty<Dictionary<string, object?>>())
        {
            if (line.TryGetValue("ProductCardID", out var p)) Add(p);
            if (line.TryGetValue("ItemsID", out var i)) Add(i);
        }
        if (data.StandardFields != null)
        {
            if (data.StandardFields.TryGetValue("ProductCardID", out var p)) Add(p);
            if (data.StandardFields.TryGetValue("ItemsID", out var i)) Add(i);
        }
        return ids;
    }

    /// <summary>
    /// ProductVoucher başlık alanlarını ProductTrans satırlarına işler (VoucherType, depo, tarih, ana birim miktarı).
    /// </summary>
    private static void StampProductTransLinesFromHeader(
        List<Dictionary<string, object?>> lines,
        Dictionary<string, object?> header)
    {
        object? Pick(params string[] keys)
        {
            foreach (var k in keys)
            {
                if (header.TryGetValue(k, out var v) && v != null && Convert.ToString(v)?.Trim() != "")
                    return v;
            }
            // case-insensitive
            foreach (var kv in header)
            {
                if (keys.Any(k => k.Equals(kv.Key, StringComparison.OrdinalIgnoreCase))
                    && kv.Value != null
                    && Convert.ToString(kv.Value)?.Trim() != "")
                    return kv.Value;
            }
            return null;
        }

        var voucherType = Pick("VoucherType");
        var whouse = Pick("WhouseID");
        var aimWhouse = Pick("AimWhouseID");
        var status = Pick("Status_", "Status");
        var dept = Pick("DepartmentID");
        var voucherDate = Pick("VoucherDate");
        var lineNo = 0;

        foreach (var line in lines)
        {
            lineNo++;
            void SetIfEmpty(string key, object? val)
            {
                if (val == null) return;
                if (line.TryGetValue(key, out var cur) && cur != null && Convert.ToString(cur)?.Trim() != "")
                    return;
                line[key] = val;
            }

            SetIfEmpty("VoucherType", voucherType);
            SetIfEmpty("WhouseID", whouse);
            SetIfEmpty("AimWhouseID", aimWhouse);
            SetIfEmpty("Status_", status);
            SetIfEmpty("DepartmentID", dept);
            SetIfEmpty("TransDate", voucherDate);
            SetIfEmpty("TransLineNo", lineNo);

            // Ana birim miktarı yoksa Quantity ile doldur (stok hesabı için)
            if ((!line.TryGetValue("MainUnitQuantity", out var muq) || muq == null || Convert.ToString(muq)?.Trim() == "")
                && line.TryGetValue("Quantity", out var qty)
                && qty != null)
            {
                line["MainUnitQuantity"] = qty;
            }
        }
    }

    private static int? ToInt(object? v)
    {
        if (v is null or DBNull) return null;
        if (v is int i) return i;
        if (v is long l) return (int)l;
        if (v is short s) return s;
        if (v is byte b) return b;
        if (int.TryParse(Convert.ToString(v), out var n)) return n;
        return null;
    }

    private static string UnitCatalogLabel(int? unitId) => unitId switch
    {
        1 => "Adet",
        2 => "Koli",
        3 => "Paket",
        4 => "Kg",
        5 => "Litre",
        6 => "Metre",
        7 => "Saat",
        8 => "Gün",
        _ => unitId?.ToString() ?? "",
    };

    public async Task<RecordGetResult?> GetAsync(
        string tableName,
        string? primaryKeyHint,
        int recordId,
        CancellationToken ct = default)
    {
        EnsureSafe(tableName);
        if (_db.State != ConnectionState.Open) _db.Open();
        if (!await TableExistsAsync(tableName)) return null;

        var pk = await ResolvePrimaryKeyAsync(tableName, primaryKeyHint);
        if (string.IsNullOrWhiteSpace(pk)) return null;

        var cols = await GetColumnsAsync(tableName);
        var selectList = BuildSelectList(tableName, cols);
        var sql = $"SELECT TOP 1 {selectList} FROM [{tableName}] WHERE [{pk}] = @Id";
        var row = await _db.QuerySingleOrDefaultAsync(new CommandDefinition(sql, new { Id = recordId }, cancellationToken: ct));
        if (row == null) return null;

        var dict = (IDictionary<string, object>)row;
        var standard = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var additional = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        foreach (var kv in dict)
        {
            if (kv.Key.Equals("AdditionalFields", StringComparison.OrdinalIgnoreCase))
            {
                if (kv.Value is string json && !string.IsNullOrWhiteSpace(json))
                {
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<Dictionary<string, object?>>(json);
                        if (parsed != null)
                        {
                            foreach (var p in parsed)
                                additional[p.Key] = NormalizeJsonElement(p.Value);
                        }
                    }
                    catch { /* ignore bad json */ }
                }
                continue;
            }
            standard[kv.Key] = NormalizeValue(kv.Value);
        }

        var result = new RecordGetResult
        {
            TableName = tableName,
            PrimaryKeyColumn = pk,
            RecordId = recordId,
            StandardFields = standard,
            AdditionalFields = additional,
        };

        await AttachNestedChildrenAsync(result, tableName, recordId, ct);
        return result;
    }

    public async Task<(bool Ok, int RecordId, string Message)> SaveAsync(
        string tableName,
        string? primaryKeyHint,
        RecordSaveRequest data,
        CancellationToken ct = default)
    {
        EnsureSafe(tableName);
        if (_db.State != ConnectionState.Open) _db.Open();
        if (!await TableExistsAsync(tableName))
            return (false, 0, $"Tablo bulunamadı: {tableName}");

        var pk = await ResolvePrimaryKeyAsync(tableName, primaryKeyHint);
        var cols = await GetColumnsAsync(tableName);
        var colSet = new HashSet<string>(cols, StringComparer.OrdinalIgnoreCase);
        var hasAdditional = colSet.Contains("AdditionalFields");

        var incoming = data.StandardFields ?? new Dictionary<string, object?>();

        // Hesap kartı: kodda '.' varsa üst hesap = son noktadan önceki kod (her zaman)
        if (tableName.Equals("AccountCard", StringComparison.OrdinalIgnoreCase)
            && colSet.Contains("MainAccountID"))
        {
            await ApplyAccountParentLinkAsync(incoming, data.RecordId, ct);
        }

        if (tableName.Equals("AccountVoucher", StringComparison.OrdinalIgnoreCase))
        {
            // Yevmiye no yalnızca Yevmiye Madde Numaralandırma işlemiyle verilir
            foreach (var key in incoming.Keys.Where(k => k.Equals("journalNO", StringComparison.OrdinalIgnoreCase)).ToList())
                incoming.Remove(key);
            var ruleError = AccountVoucherRules.Apply(data, incoming);
            if (ruleError != null) return (false, data.RecordId, ruleError);
        }

        var colTypes = await GetColumnTypesAsync(tableName);
        // Aynı kolon Code ve code diye iki kez gelirse şema adı (Code) kazansın
        var pending = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var stagedExact = new HashSet<string>(StringComparer.Ordinal);

        void Stage(string key, object? raw)
        {
            if (string.IsNullOrWhiteSpace(key) || !SafeIdent.IsMatch(key)) return;
            if (key.Equals("AdditionalFields", StringComparison.OrdinalIgnoreCase)) return;
            if (key.Equals(pk, StringComparison.OrdinalIgnoreCase)) return;
            if (!colSet.Contains(key)) return;
            var real = cols.First(c => c.Equals(key, StringComparison.OrdinalIgnoreCase));
            var exact = key.Equals(real, StringComparison.Ordinal);
            if (stagedExact.Contains(real) && !exact) return;
            if (pending.ContainsKey(real) && !exact) return;
            if (data.RecordId != 0 && IsSecretColumn(tableName, real) && IsBlank(raw)) return;
            colTypes.TryGetValue(real, out var sqlType);
            pending[real] = CoerceForColumn(sqlType, raw);
            if (exact) stagedExact.Add(real);
        }

        foreach (var kv in incoming)
            Stage(kv.Key, kv.Value);

        // NOT NULL AccountGroupID vb. için öndeğer
        if (colSet.Contains("AccountGroupID") && !pending.ContainsKey("AccountGroupID"))
            pending["AccountGroupID"] = 1;

        // Ek alanlar: tabloda gerçek U_ kolonu varsa oraya yaz, yoksa JSON'da kalsın
        var leftoverAdditional = new Dictionary<string, object?>();
        foreach (var kv in data.AdditionalFields ?? new Dictionary<string, object?>())
        {
            if (string.IsNullOrWhiteSpace(kv.Key) || !SafeIdent.IsMatch(kv.Key)) continue;
            if (!colSet.Contains(kv.Key) || kv.Key.Equals(pk, StringComparison.OrdinalIgnoreCase))
            {
                leftoverAdditional[kv.Key] = kv.Value;
                continue;
            }
            Stage(kv.Key, kv.Value);
        }

        var writeCols = pending.Keys.ToList();
        var parameters = new DynamicParameters();
        foreach (var col in writeCols)
            parameters.Add(col, pending[col]);

        if (hasAdditional)
        {
            var json = JsonSerializer.Serialize(leftoverAdditional);
            var addCol = cols.First(c => c.Equals("AdditionalFields", StringComparison.OrdinalIgnoreCase));
            writeCols.Add(addCol);
            parameters.Add(addCol, json);
        }

        if (writeCols.Count == 0)
            return (false, data.RecordId, "Yazılacak kolon bulunamadı (şema ↔ tablo uyumsuz)");

        // Yeni firma: boşsa 0-Merkez işyeri + 0-Merkez ambar (şablon ID=-1 hariç)
        if (tableName.Equals("SYS_Companies", StringComparison.OrdinalIgnoreCase) && data.RecordId == 0)
            EnsureDefaultCompanyOrg(data);

        // Fiş öndeğeri (ID < 0): yalnız başlık — satır / ödeme planı / dağıtım / özel kod yazılmaz (stok ve cari etkilenmez)
        var headerOnlyTemplate = data.RecordId < 0 && TemplateHeaderOnlyTables.Contains(tableName);
        var hasNested = !headerOnlyTemplate && NestedByParent.ContainsKey(tableName) && HasAnyNestedPayload(data);
        IDbTransaction? tx = null;
        if (hasNested && _db is SqlConnection)
            tx = _db.BeginTransaction();

        try
        {
            int savedId;
            // Negatif ID = öndeğer / şablon kart (upsert, IDENTITY_INSERT gerekebilir)
            if (data.RecordId < 0)
            {
                if (string.IsNullOrWhiteSpace(pk))
                    return (false, data.RecordId, "Primary key bulunamadı");

                savedId = await UpsertTemplateAsync(tableName, pk, data.RecordId, writeCols, parameters, tx, ct);
            }
            else if (data.RecordId == 0)
            {
                var isIdentity = !string.IsNullOrWhiteSpace(pk) && await IsIdentityColumnAsync(tableName, pk, tx);
                if (!isIdentity && !string.IsNullOrWhiteSpace(pk))
                {
                    var nextId = await NextIdAsync(tableName, pk, tx, ct);
                    writeCols.Insert(0, pk);
                    parameters.Add(pk, nextId);
                    var insertSql = $@"
INSERT INTO [{tableName}] ({string.Join(", ", writeCols.Select(c => $"[{c}]"))})
VALUES ({string.Join(", ", writeCols.Select(c => "@" + c))});";
                    await _db.ExecuteAsync(new CommandDefinition(insertSql, parameters, tx, cancellationToken: ct));
                    savedId = nextId;
                }
                else
                {
                    var sql = $@"
INSERT INTO [{tableName}] ({string.Join(", ", writeCols.Select(c => $"[{c}]"))})
VALUES ({string.Join(", ", writeCols.Select(c => "@" + c))});
SELECT CAST(SCOPE_IDENTITY() AS INT);";
                    var newId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(sql, parameters, tx, cancellationToken: ct));
                    if (newId is > 0)
                    {
                        savedId = newId.Value;
                    }
                    else if (!string.IsNullOrWhiteSpace(pk) && incoming.TryGetValue(pk, out var manualPk))
                    {
                        savedId = Convert.ToInt32(manualPk);
                    }
                    else if (!string.IsNullOrWhiteSpace(pk))
                    {
                        var last = await _db.ExecuteScalarAsync<int?>(
                            new CommandDefinition($"SELECT MAX([{pk}]) FROM [{tableName}]", transaction: tx, cancellationToken: ct));
                        savedId = last ?? 0;
                    }
                    else
                    {
                        savedId = 0;
                    }
                }
            }
            else
            {
                if (string.IsNullOrWhiteSpace(pk))
                    return (false, data.RecordId, "Primary key bulunamadı");

                parameters.Add("__pk", data.RecordId);
                var sets = string.Join(", ", writeCols.Select(c => $"[{c}] = @{c}"));
                var upd = $"UPDATE [{tableName}] SET {sets} WHERE [{pk}] = @__pk";
                var affected = await _db.ExecuteAsync(new CommandDefinition(upd, parameters, tx, cancellationToken: ct));
                if (affected == 0)
                {
                    tx?.Rollback();
                    return (false, data.RecordId, "Kayıt bulunamadı");
                }
                savedId = data.RecordId;
            }

            if (savedId != 0 && !headerOnlyTemplate && NestedByParent.TryGetValue(tableName, out var specs))
            {
                // Malzeme / irsaliye: satırları ProductTrans'a yazmadan önce fiş başlığından tip/depo/tarih aktar
                if (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase)
                    && data.Lines != null)
                {
                    StampProductTransLinesFromHeader(data.Lines, incoming);
                }

                foreach (var spec in specs)
                {
                    var rows = GetNestedPayload(data, spec.PayloadKey);
                    if (rows == null) continue; // null = dokunma; [] = hepsini sil
                    if (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase)
                        && spec.PayloadKey == "lines"
                        && savedId > 0)
                    {
                        await ReleaseSerialLotsForVoucherAsync(savedId, tx, ct);
                    }
                    if (tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase)
                        && spec.PayloadKey == "lines"
                        && savedId > 0)
                    {
                        await ReleaseSerialLotsForInvoiceAsync(savedId, tx, ct);
                    }
                    await ReplaceChildrenAsync(spec, savedId, rows, tx, ct);
                }

                if (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase)
                    && data.Lines != null
                    && savedId > 0)
                {
                    await ApplySerialLotsAsync(savedId, tx, ct);
                }
                if (tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase)
                    && data.Lines != null
                    && savedId > 0)
                {
                    await ApplySerialLotsForInvoiceAsync(savedId, tx, ct);
                }
            }

            tx?.Commit();

            // Malzeme stok / sipariş özet kolonlarını güncelle
            try
            {
                var touchProducts = CollectProductIdsFromSave(data);
                if (tableName.Equals("ProductCard", StringComparison.OrdinalIgnoreCase) && savedId > 0)
                    touchProducts.Add(savedId);
                if (touchProducts.Count == 0
                    && (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase)
                        || tableName.Equals("OrderVoucher", StringComparison.OrdinalIgnoreCase)
                        || tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase))
                    && savedId > 0)
                {
                    foreach (var id in await LoadProductIdsForVoucherAsync(tableName, savedId, ct))
                        touchProducts.Add(id);
                }
                if (touchProducts.Count > 0)
                    await RefreshProductCardStatsAsync(touchProducts.ToList(), ct);
            }
            catch
            {
                /* özet güncellemesi kayıt başarısını bozmasın */
            }

            return (true, savedId, data.RecordId == 0 ? "Kayıt eklendi" : "Kayıt güncellendi");
        }
        catch (Exception ex)
        {
            try { tx?.Rollback(); } catch { /* ignore */ }
            return (false, data.RecordId, ex.Message);
        }
        finally
        {
            tx?.Dispose();
        }
    }

    private async Task<List<int>> LoadProductIdsForVoucherAsync(string tableName, int voucherId, CancellationToken ct)
    {
        if (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase)
            && await TableExistsAsync("ProductTrans"))
        {
            var rows = await _db.QueryAsync<int>(new CommandDefinition(
                @"SELECT DISTINCT ProductCardID FROM dbo.ProductTrans
                  WHERE ProductVoucherID = @id AND ProductCardID IS NOT NULL AND ProductCardID > 0",
                new { id = voucherId },
                cancellationToken: ct));
            return rows.ToList();
        }
        if (tableName.Equals("OrderVoucher", StringComparison.OrdinalIgnoreCase)
            && await TableExistsAsync("OrderTrans"))
        {
            var otCols = await GetColumnsAsync("OrderTrans");
            var hasOvFk = otCols.Contains("OrderVoucherID", StringComparer.OrdinalIgnoreCase);
            var sql = hasOvFk
                ? @"SELECT DISTINCT ItemsID FROM dbo.OrderTrans
                    WHERE (OrderVoucherID = @id OR OrderSlipID = @id) AND ItemsID IS NOT NULL AND ItemsID > 0"
                : @"SELECT DISTINCT ItemsID FROM dbo.OrderTrans
                    WHERE OrderSlipID = @id AND ItemsID IS NOT NULL AND ItemsID > 0";
            var rows = await _db.QueryAsync<int>(new CommandDefinition(sql, new { id = voucherId }, cancellationToken: ct));
            return rows.ToList();
        }
        if (tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase)
            && await TableExistsAsync("ProductTrans"))
        {
            var rows = await _db.QueryAsync<int>(new CommandDefinition(
                @"SELECT DISTINCT ProductCardID FROM dbo.ProductTrans
                  WHERE InvoiceID = @id AND ProductCardID IS NOT NULL AND ProductCardID > 0",
                new { id = voucherId },
                cancellationToken: ct));
            return rows.ToList();
        }
        return new List<int>();
    }

    public async Task<(bool Ok, string Message)> DeleteAsync(
        string tableName,
        string? primaryKeyHint,
        int recordId,
        CancellationToken ct = default)
    {
        EnsureSafe(tableName);
        if (_db.State != ConnectionState.Open) _db.Open();
        if (!await TableExistsAsync(tableName))
            return (false, $"Tablo bulunamadı: {tableName}");

        var pk = await ResolvePrimaryKeyAsync(tableName, primaryKeyHint);
        if (string.IsNullOrWhiteSpace(pk))
            return (false, "Primary key bulunamadı");

        var refreshProducts = new List<int>();
        if (tableName.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase)
            || tableName.Equals("OrderVoucher", StringComparison.OrdinalIgnoreCase)
            || tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase))
        {
            refreshProducts = await LoadProductIdsForVoucherAsync(tableName, recordId, ct);
        }
        else if (tableName.Equals("ProductCard", StringComparison.OrdinalIgnoreCase))
        {
            refreshProducts = new List<int>(); // kart silindi — özet yok
        }

        IDbTransaction? tx = null;
        if (NestedByParent.ContainsKey(tableName) && _db is SqlConnection)
            tx = _db.BeginTransaction();

        try
        {
            if (NestedByParent.TryGetValue(tableName, out var specs))
            {
                foreach (var spec in specs)
                {
                    if (!await TableExistsAsync(spec.TableName, tx)) continue;
                    await DeleteChildrenAsync(spec, recordId, tx, ct);
                }
            }

            var n = await _db.ExecuteAsync(new CommandDefinition(
                $"DELETE FROM [{tableName}] WHERE [{pk}] = @Id",
                new { Id = recordId },
                tx,
                cancellationToken: ct));
            tx?.Commit();

            if (n > 0 && refreshProducts.Count > 0)
            {
                try { await RefreshProductCardStatsAsync(refreshProducts, ct); }
                catch { /* ignore */ }
            }

            return n > 0 ? (true, "Silindi") : (false, "Kayıt bulunamadı");
        }
        catch (Exception ex)
        {
            try { tx?.Rollback(); } catch { /* ignore */ }
            return (false, ex.Message);
        }
        finally
        {
            tx?.Dispose();
        }
    }

    private async Task AttachNestedChildrenAsync(RecordGetResult result, string tableName, int recordId, CancellationToken ct)
    {
        if (!NestedByParent.TryGetValue(tableName, out var specs)) return;

        foreach (var spec in specs)
        {
            if (!await TableExistsAsync(spec.TableName)) continue;
            var rows = await LoadChildrenAsync(spec, recordId, ct);
            switch (spec.PayloadKey)
            {
                case "addresses": result.Addresses = rows; break;
                case "contacts": result.Contacts = rows; break;
                case "accounts": result.Accounts = rows; break;
                case "barcodes": result.Barcodes = rows; break;
                case "unitConvs": result.UnitConvs = rows; break;
                case "productSubs": result.ProductSubs = rows; break;
                case "customerAliases": result.CustomerAliases = rows; break;
                case "variants": result.Variants = rows; break;
                case "serialGroups": result.SerialGroups = rows; break;
                case "serials": result.Serials = rows; break;
                case "lots": result.Lots = rows; break;
                case "accountLinks": result.AccountLinks = rows; break;
                case "lines": result.Lines = rows; break;
                case "workplaces": result.Workplaces = rows; break;
                case "paymentPlans": result.PaymentPlans = rows; break;
                case "distributions": result.Distributions = rows; break;
                case "auxilCodes": result.AuxilCodes = rows; break;
                case "auxilValues": result.AuxilValues = rows; break;
                case "whouses":
                    await EnrichWhouseWorkplaceCodesAsync(rows, recordId, ct);
                    result.Whouses = rows;
                    break;
            }
        }
    }

    private async Task<List<Dictionary<string, object?>>> LoadChildrenAsync(
        NestedChildSpec spec,
        int parentId,
        CancellationToken ct)
    {
        EnsureSafe(spec.TableName);
        EnsureSafe(spec.ParentFkColumn);
        var cols = await GetColumnsAsync(spec.TableName);
        if (cols.Count == 0) return new();

        var selectList = BuildSelectList(spec.TableName, cols);
        var sql = $"SELECT {selectList} FROM [{spec.TableName}] WHERE [{spec.ParentFkColumn}] = @ParentId";
        var p = new DynamicParameters();
        p.Add("ParentId", parentId);

        if (spec.FilterColumns != null)
        {
            var i = 0;
            foreach (var fv in spec.FilterColumns)
            {
                if (!cols.Contains(fv.Key, StringComparer.OrdinalIgnoreCase)) continue;
                var real = cols.First(c => c.Equals(fv.Key, StringComparison.OrdinalIgnoreCase));
                var pname = $"f{i++}";
                sql += $" AND [{real}] = @{pname}";
                p.Add(pname, CoerceDbValue(fv.Value));
            }
        }

        if (!string.IsNullOrWhiteSpace(spec.PrimaryKeyColumn)
            && cols.Contains(spec.PrimaryKeyColumn, StringComparer.OrdinalIgnoreCase))
        {
            sql += $" ORDER BY [{spec.PrimaryKeyColumn}]";
        }

        var raw = await _db.QueryAsync(new CommandDefinition(sql, p, cancellationToken: ct));
        var list = new List<Dictionary<string, object?>>();
        foreach (var row in raw)
        {
            var dict = (IDictionary<string, object>)row;
            var mapped = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in dict)
                mapped[kv.Key] = NormalizeValue(kv.Value);
            list.Add(mapped);
        }
        return list;
    }

    private async Task EnrichWhouseWorkplaceCodesAsync(
        List<Dictionary<string, object?>> rows,
        int companyId,
        CancellationToken ct)
    {
        if (rows.Count == 0) return;
        if (!await TableExistsAsync("SYS_Workplace")) return;

        var map = (await _db.QueryAsync<(int WorkplaceID, string Code)>(new CommandDefinition(
            @"SELECT WorkplaceID, Code FROM dbo.SYS_Workplace WHERE CompanyID = @cid",
            new { cid = companyId },
            cancellationToken: ct))).ToDictionary(x => x.WorkplaceID, x => x.Code);

        foreach (var row in rows)
        {
            if (!row.TryGetValue("WorkplaceID", out var widObj) || widObj == null) continue;
            if (!int.TryParse(Convert.ToString(widObj), out var wid)) continue;
            if (map.TryGetValue(wid, out var code))
                row["WorkplaceCode"] = code;
        }
    }

    private async Task ReplaceChildrenAsync(
        NestedChildSpec spec,
        int parentId,
        List<Dictionary<string, object?>> rows,
        IDbTransaction? tx,
        CancellationToken ct)
    {
        EnsureSafe(spec.TableName);
        EnsureSafe(spec.ParentFkColumn);
        EnsureSafe(spec.PrimaryKeyColumn);

        if (!await TableExistsAsync(spec.TableName, tx)) return;

        var cols = await GetColumnsAsync(spec.TableName, tx);
        var colSet = new HashSet<string>(cols, StringComparer.OrdinalIgnoreCase);
        if (!colSet.Contains(spec.ParentFkColumn)) return;

        var pkCol = ResolveNestedPk(spec.PrimaryKeyColumn, colSet);
        if (string.IsNullOrWhiteSpace(pkCol)) return;

        // Satırlar silinip yeniden yazılır: boş gelen gizli kolonlar eski satırdan (PK → Code) taşınır
        var secretCols = cols.Where(c => IsSecretColumn(spec.TableName, c)).ToList();
        if (secretCols.Count > 0)
            await CarryOverChildSecretsAsync(spec, parentId, pkCol, colSet, secretCols, rows, tx, ct);

        await DeleteChildrenAsync(spec, parentId, tx, ct);

        var isIdentity = await IsIdentityColumnAsync(spec.TableName, pkCol, tx);

        foreach (var rawRow in rows)
        {
            if (IsEmptyChildRow(rawRow, spec)) continue;

            var row = new Dictionary<string, object?>(rawRow, StringComparer.OrdinalIgnoreCase);

            // CustomerTrans: Amount → LocalAmount yedek
            // Satır sırası: LineNo (form) → TransLineNo (AccountTrans, AccountTransDetail)
            if (colSet.Contains("TransLineNo")
                && !colSet.Contains("LineNo")
                && !row.ContainsKey("TransLineNo")
                && row.TryGetValue("LineNo", out var lineNo))
            {
                row["TransLineNo"] = lineNo;
            }

            if (spec.TableName.Equals("CustomerTrans", StringComparison.OrdinalIgnoreCase)
                && colSet.Contains("LocalAmount")
                && row.TryGetValue("Amount", out var amt)
                && !row.ContainsKey("LocalAmount"))
            {
                row["LocalAmount"] = amt;
            }

            // Ambar → İşyeri: WorkplaceCode (form) → WorkplaceID (DB)
            if (spec.TableName.Equals("SYS_Whouse", StringComparison.OrdinalIgnoreCase)
                && colSet.Contains("WorkplaceID"))
            {
                var wpCode = row.TryGetValue("WorkplaceCode", out var wc) ? wc?.ToString()?.Trim() : null;
                if (string.IsNullOrWhiteSpace(wpCode) && row.TryGetValue("WorkplaceID", out var widRaw))
                {
                    // ID yerine kod yazılmış olabilir
                    wpCode = widRaw?.ToString()?.Trim();
                    if (wpCode != null && int.TryParse(wpCode, out _))
                        wpCode = null;
                }

                if (!string.IsNullOrWhiteSpace(wpCode))
                {
                    var wpId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                        @"SELECT TOP 1 WorkplaceID FROM dbo.SYS_Workplace
                          WHERE CompanyID = @cid AND Code = @code",
                        new { cid = parentId, code = wpCode },
                        tx,
                        cancellationToken: ct));
                    if (wpId is > 0)
                        row["WorkplaceID"] = wpId.Value;
                }
                row.Remove("WorkplaceCode");
            }

            var writeCols = new List<string>();
            var parameters = new DynamicParameters();

            // Parent FK
            writeCols.Add(cols.First(c => c.Equals(spec.ParentFkColumn, StringComparison.OrdinalIgnoreCase)));
            parameters.Add(spec.ParentFkColumn, parentId);

            // OrderTrans: eski kolon adı OrderSlipID
            if (spec.TableName.Equals("OrderTrans", StringComparison.OrdinalIgnoreCase)
                && colSet.Contains("OrderSlipID")
                && !writeCols.Contains("OrderSlipID", StringComparer.OrdinalIgnoreCase))
            {
                writeCols.Add(cols.First(c => c.Equals("OrderSlipID", StringComparison.OrdinalIgnoreCase)));
                parameters.Add("OrderSlipID", parentId);
            }

            if (spec.FixedColumns != null)
            {
                foreach (var fc in spec.FixedColumns)
                {
                    if (!colSet.Contains(fc.Key)) continue;
                    var real = cols.First(c => c.Equals(fc.Key, StringComparison.OrdinalIgnoreCase));
                    if (writeCols.Contains(real, StringComparer.OrdinalIgnoreCase)) continue;
                    writeCols.Add(real);
                    parameters.Add(real, CoerceDbValue(fc.Value));
                }
            }

            foreach (var kv in row)
            {
                if (string.IsNullOrWhiteSpace(kv.Key) || !SafeIdent.IsMatch(kv.Key)) continue;
                if (kv.Key.Equals(pkCol, StringComparison.OrdinalIgnoreCase)) continue;
                if (kv.Key.Equals(spec.PrimaryKeyColumn, StringComparison.OrdinalIgnoreCase)) continue;
                if (kv.Key.Equals(spec.ParentFkColumn, StringComparison.OrdinalIgnoreCase)) continue;
                if (!colSet.Contains(kv.Key)) continue;
                var real = cols.First(c => c.Equals(kv.Key, StringComparison.OrdinalIgnoreCase));
                if (writeCols.Contains(real, StringComparer.OrdinalIgnoreCase)) continue;
                writeCols.Add(real);
                parameters.Add(real, CoerceDbValue(kv.Value));
            }

            if (!isIdentity && colSet.Contains(pkCol))
            {
                var nextId = await NextIdAsync(spec.TableName, pkCol, tx, ct);
                writeCols.Insert(0, cols.First(c => c.Equals(pkCol, StringComparison.OrdinalIgnoreCase)));
                parameters.Add(pkCol, nextId);
            }

            if (writeCols.Count <= 1) continue; // sadece FK

            var insertSql = $@"
INSERT INTO [{spec.TableName}] ({string.Join(", ", writeCols.Select(c => $"[{c}]"))})
VALUES ({string.Join(", ", writeCols.Select(c => "@" + c))});";
            await _db.ExecuteAsync(new CommandDefinition(insertSql, parameters, tx, cancellationToken: ct));
        }
    }

    private async Task CarryOverChildSecretsAsync(
        NestedChildSpec spec,
        int parentId,
        string pkCol,
        HashSet<string> colSet,
        List<string> secretCols,
        List<Dictionary<string, object?>> rows,
        IDbTransaction? tx,
        CancellationToken ct)
    {
        var hasCode = colSet.Contains("Code");
        var selectCols = new List<string> { pkCol };
        if (hasCode) selectCols.Add("Code");
        selectCols.AddRange(secretCols);
        var sql = $"SELECT {string.Join(", ", selectCols.Select(c => $"[{c}]"))} FROM [{spec.TableName}] WHERE [{spec.ParentFkColumn}] = @ParentId";
        var existing = (await _db.QueryAsync(new CommandDefinition(sql, new { ParentId = parentId }, tx, cancellationToken: ct)))
            .Select(r => (IDictionary<string, object>)r)
            .ToList();
        if (existing.Count == 0) return;

        foreach (var row in rows)
        {
            var pkVal = Convert.ToString(NormalizeJsonElement(GetCI(row, pkCol)))?.Trim();
            var codeVal = hasCode ? Convert.ToString(NormalizeJsonElement(GetCI(row, "Code")))?.Trim() : null;
            var match =
                (!string.IsNullOrEmpty(pkVal) ? existing.FirstOrDefault(e => Convert.ToString(e[pkCol]) == pkVal) : null)
                ?? (!string.IsNullOrEmpty(codeVal) ? existing.FirstOrDefault(e => Convert.ToString(e["Code"])?.Trim() == codeVal) : null);
            if (match == null) continue;

            foreach (var sc in secretCols)
            {
                if (!IsBlank(GetCI(row, sc))) continue;
                if (match[sc] is string old && !string.IsNullOrEmpty(old))
                    SetIncoming(row, sc, old);
            }
        }
    }

    private static object? GetCI(Dictionary<string, object?> row, string key)
    {
        var k = row.Keys.FirstOrDefault(x => x.Equals(key, StringComparison.OrdinalIgnoreCase));
        return k == null ? null : row[k];
    }

    private static bool IsSecretColumn(string tableName, string column) =>
        SecretColumnsByTable.TryGetValue(tableName, out var secrets)
        && secrets.Contains(column, StringComparer.OrdinalIgnoreCase);

    private static bool IsBlank(object? v) =>
        string.IsNullOrWhiteSpace(Convert.ToString(NormalizeJsonElement(v)));

    /// <summary>SELECT listesi: gizli kolonlar yerine "{Kolon}Set" (bit) bayrağı</summary>
    private static string BuildSelectList(string tableName, List<string> cols) =>
        string.Join(", ", cols.Select(c => IsSecretColumn(tableName, c)
            ? $"CAST(CASE WHEN NULLIF([{c}], N'') IS NULL THEN 0 ELSE 1 END AS bit) AS [{c}Set]"
            : $"[{c}]"));

    private async Task DeleteChildrenAsync(
        NestedChildSpec spec,
        int parentId,
        IDbTransaction? tx,
        CancellationToken ct)
    {
        EnsureSafe(spec.TableName);
        EnsureSafe(spec.ParentFkColumn);
        var cols = await GetColumnsAsync(spec.TableName, tx);
        var sql = $"DELETE FROM [{spec.TableName}] WHERE [{spec.ParentFkColumn}] = @ParentId";
        var p = new DynamicParameters();
        p.Add("ParentId", parentId);

        if (spec.FilterColumns != null)
        {
            var i = 0;
            foreach (var fv in spec.FilterColumns)
            {
                if (!cols.Contains(fv.Key, StringComparer.OrdinalIgnoreCase)) continue;
                var real = cols.First(c => c.Equals(fv.Key, StringComparison.OrdinalIgnoreCase));
                var pname = $"f{i++}";
                sql += $" AND [{real}] = @{pname}";
                p.Add(pname, CoerceDbValue(fv.Value));
            }
        }

        await _db.ExecuteAsync(new CommandDefinition(sql, p, tx, cancellationToken: ct));
    }

    /// <summary>Öndeğer şablonu yalnız başlık olarak saklanan fiş tabloları (ID &lt; 0).</summary>
    private static readonly HashSet<string> TemplateHeaderOnlyTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "OrderVoucher",
        "ProductVoucher",
        "Invoice",
    };

    private static bool HasAnyNestedPayload(RecordSaveRequest data) =>
        data.Addresses != null
        || data.Contacts != null
        || data.Accounts != null
        || data.Barcodes != null
        || data.UnitConvs != null
        || data.ProductSubs != null
        || data.CustomerAliases != null
        || data.Variants != null
        || data.SerialGroups != null
        || data.Serials != null
        || data.Lots != null
        || data.AccountLinks != null
        || data.Lines != null
        || data.Workplaces != null
        || data.Whouses != null
        || data.PaymentPlans != null
        || data.Distributions != null
        || data.AuxilCodes != null
        || data.AuxilValues != null;

    private static string ResolveNestedPk(string preferred, HashSet<string> colSet)
    {
        if (colSet.Contains(preferred)) return preferred;
        // AccountTrans: Create_DB AccountTrasnID / script AccountTransID
        if (preferred.Equals("AccountTrasnID", StringComparison.OrdinalIgnoreCase)
            && colSet.Contains("AccountTransID"))
            return "AccountTransID";
        if (preferred.Equals("AccountTransID", StringComparison.OrdinalIgnoreCase)
            && colSet.Contains("AccountTrasnID"))
            return "AccountTrasnID";
        return colSet.Contains(preferred) ? preferred : "";
    }

    /// <summary>
    /// Hesap kodunda '.' varsa üst hesap = son noktadan önceki kod (her zaman zorlanır).
    /// Noktasız kodlarda MainAccountID kullanıcı seçimine bırakılır (1 ← 10 ← 100).
    /// </summary>
    private async Task ApplyAccountParentLinkAsync(
        Dictionary<string, object?> incoming,
        int recordId,
        CancellationToken ct)
    {
        object? codeRaw = null;
        foreach (var key in incoming.Keys)
        {
            if (key.Equals("Code", StringComparison.OrdinalIgnoreCase))
            {
                codeRaw = incoming[key];
                break;
            }
        }

        var code = NormalizeJsonElement(codeRaw)?.ToString()?.Trim();
        if (string.IsNullOrWhiteSpace(code)) return;

        var lastDot = code.LastIndexOf('.');
        if (lastDot <= 0) return; // manuel üst hesap

        var parentCode = code[..lastDot].Trim();
        if (string.IsNullOrWhiteSpace(parentCode)) return;

        var parentId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            @"SELECT TOP (1) AccountCardID
              FROM dbo.AccountCard
              WHERE Code = @parentCode
                AND (@selfId <= 0 OR AccountCardID <> @selfId)",
            new { parentCode, selfId = recordId },
            cancellationToken: ct));

        SetIncoming(incoming, "MainAccountID", parentId is > 0 ? parentId.Value : null);
        SetIncoming(incoming, "MainAccount", false);

        // Noktalı kod = detay hesap
        var hasType = incoming.Keys.Any(k => k.Equals("Type_", StringComparison.OrdinalIgnoreCase));
        if (!hasType || IsIncomingEmpty(incoming, "Type_"))
            SetIncoming(incoming, "Type_", (byte)2);
    }

    private static void SetIncoming(Dictionary<string, object?> incoming, string key, object? value)
    {
        var existing = incoming.Keys.FirstOrDefault(k => k.Equals(key, StringComparison.OrdinalIgnoreCase));
        if (existing != null) incoming[existing] = value;
        else incoming[key] = value;
    }

    private static bool IsIncomingEmpty(Dictionary<string, object?> incoming, string key)
    {
        var existing = incoming.Keys.FirstOrDefault(k => k.Equals(key, StringComparison.OrdinalIgnoreCase));
        if (existing == null) return true;
        var v = NormalizeJsonElement(incoming[existing]);
        if (v is null) return true;
        var s = v.ToString();
        return string.IsNullOrWhiteSpace(s);
    }

    /// <summary>Yeni firma kaydında 0-Merkez işyeri ve 0-Merkez ambar öndeğerleri.</summary>
    private static void EnsureDefaultCompanyOrg(RecordSaveRequest data)
    {
        var hasWp = data.Workplaces != null
            && data.Workplaces.Any(r =>
                !string.IsNullOrWhiteSpace(r.TryGetValue("Code", out var c) ? c?.ToString() : null)
                || !string.IsNullOrWhiteSpace(r.TryGetValue("Title", out var t) ? t?.ToString() : null));

        if (!hasWp)
        {
            data.Workplaces =
            [
                new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["Code"] = "0",
                    ["Title"] = "Merkez",
                    ["IsActive"] = true,
                },
            ];
        }

        var hasWh = data.Whouses != null
            && data.Whouses.Any(r =>
                !string.IsNullOrWhiteSpace(r.TryGetValue("WhouseCode", out var c) ? c?.ToString() : null)
                || !string.IsNullOrWhiteSpace(r.TryGetValue("Name", out var n) ? n?.ToString() : null));

        if (!hasWh)
        {
            var wpCode = "0";
            if (data.Workplaces is { Count: > 0 })
            {
                var first = data.Workplaces[0];
                var code = first.TryGetValue("Code", out var c) ? c?.ToString()?.Trim() : null;
                if (!string.IsNullOrWhiteSpace(code)) wpCode = code;
            }

            data.Whouses =
            [
                new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["WhouseCode"] = "0",
                    ["Name"] = "Merkez",
                    ["WorkplaceCode"] = wpCode,
                    ["IsActive"] = true,
                },
            ];
        }
    }

    private static List<Dictionary<string, object?>>? GetNestedPayload(RecordSaveRequest data, string key) =>
        key switch
        {
            "addresses" => data.Addresses,
            "contacts" => data.Contacts,
            "accounts" => data.Accounts,
            "barcodes" => data.Barcodes,
            "unitConvs" => data.UnitConvs,
            "productSubs" => data.ProductSubs,
            "customerAliases" => data.CustomerAliases,
            "variants" => data.Variants,
            "serialGroups" => data.SerialGroups,
            "serials" => data.Serials,
            "lots" => data.Lots,
            "accountLinks" => data.AccountLinks,
            "lines" => data.Lines,
            "workplaces" => data.Workplaces,
            "whouses" => data.Whouses,
            "paymentPlans" => data.PaymentPlans,
            "distributions" => data.Distributions,
            "auxilCodes" => data.AuxilCodes,
            "auxilValues" => data.AuxilValues,
            _ => null,
        };

    private static bool IsEmptyChildRow(Dictionary<string, object?> row, NestedChildSpec spec)
    {
        // Sadece meta / boş satırlar
        var meaningful = row
            .Where(kv =>
                !kv.Key.Equals(spec.PrimaryKeyColumn, StringComparison.OrdinalIgnoreCase)
                && !kv.Key.Equals(spec.ParentFkColumn, StringComparison.OrdinalIgnoreCase)
                && (spec.FixedColumns == null || !spec.FixedColumns.ContainsKey(kv.Key)))
            .Select(kv => kv.Value)
            .Where(v => v != null && !(v is string s && string.IsNullOrWhiteSpace(s)))
            .ToList();
        return meaningful.Count == 0;
    }

    private static void EnsureSafe(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || !SafeIdent.IsMatch(name))
            throw new ArgumentException($"Geçersiz tanımlayıcı: {name}");
    }

    public async Task<IReadOnlyList<SerialLotOptionDto>> ListAvailableSerialLotsAsync(
        int productCardId, byte kind, CancellationToken ct)
    {
        if (productCardId <= 0 || kind is not (1 or 2 or 3)) return Array.Empty<SerialLotOptionDto>();
        if (!await TableExistsAsync("ProductSerialLot")) return Array.Empty<SerialLotOptionDto>();
        var serials = await TableExistsAsync("ProductSerialLotItem")
            ? "(SELECT STRING_AGG(i.SerialNo, ',') FROM dbo.ProductSerialLotItem i WHERE i.ProductSerialLotID = l.ProductSerialLotID)"
            : "CAST(NULL AS nvarchar(400))";
        var detail = await LotDetailColumnsAsync(null, ct)
            ? "l.ExpireDate, l.Description, l.StockLocationID"
            : "CAST(NULL AS date) AS ExpireDate, CAST(NULL AS nvarchar(250)) AS Description, CAST(NULL AS int) AS StockLocationID";
        var rows = await _db.QueryAsync<SerialLotOptionDto>(new CommandDefinition($@"
SELECT l.ProductSerialLotID, l.Code, l.Kind, l.Status_ AS Status, l.WhouseID, l.Qty,
  {serials} AS Serials, {detail}
FROM dbo.ProductSerialLot l
WHERE l.ProductCardID = @pid AND l.Kind = @kind AND l.Status_ = 1
ORDER BY l.Code",
            new { pid = productCardId, kind },
            cancellationToken: ct));
        return rows.ToList();
    }

    /// <summary>Fiş yeniden yazılmadan önce bu fişin lot/seri etkisini geri alır.</summary>
    private async Task ReleaseSerialLotsForVoucherAsync(int voucherId, IDbTransaction? tx, CancellationToken ct)
    {
        if (!await TableExistsAsync("ProductSerialLot", tx)) return;

        var blocked = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT COUNT(1) FROM dbo.ProductSerialLot
WHERE SourceVoucherID = @id AND Status_ = 2 AND ISNULL(OutVoucherID, 0) <> @id",
            new { id = voucherId }, tx, cancellationToken: ct));
        if (blocked > 0)
            throw new InvalidOperationException("Bu giriş fişindeki lot/seri çıkışta kullanılmış. Önce çıkış fişini değiştirin.");

        var vtype = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT CAST(ISNULL(VoucherType, 0) AS int) FROM dbo.ProductVoucher WHERE ProductVoucherID = @id",
            new { id = voucherId }, tx, cancellationToken: ct));
        if (SerialLotDirection(vtype ?? 0) == 2)
        {
            var outs = await _db.QueryAsync<(int ProductCardID, int LotId, double? Quantity, string? SerialLotNo)>(
                new CommandDefinition(@"
SELECT ProductCardID, ProductSerialLotID AS LotId, Quantity, SerialLotNo
FROM dbo.ProductTrans
WHERE ProductVoucherID = @id AND ISNULL(ProductSerialLotID, 0) > 0",
                    new { id = voucherId }, tx, cancellationToken: ct));
            await RestorePartialLotsAsync(outs, tx, ct);
        }

        await _db.ExecuteAsync(new CommandDefinition(@"
UPDATE dbo.ProductSerialLot
SET Status_ = 1, OutVoucherID = NULL, OutTransID = NULL
WHERE OutVoucherID = @id",
            new { id = voucherId }, tx, cancellationToken: ct));

        if (await TableExistsAsync("ProductSerialLotItem", tx))
        {
            await _db.ExecuteAsync(new CommandDefinition(@"
DELETE i FROM dbo.ProductSerialLotItem i
INNER JOIN dbo.ProductSerialLot l ON l.ProductSerialLotID = i.ProductSerialLotID
WHERE l.SourceVoucherID = @id AND l.Status_ = 1 AND l.OutVoucherID IS NULL",
                new { id = voucherId }, tx, cancellationToken: ct));
        }

        await _db.ExecuteAsync(new CommandDefinition(@"
DELETE FROM dbo.ProductSerialLot
WHERE SourceVoucherID = @id AND Status_ = 1 AND OutVoucherID IS NULL",
            new { id = voucherId }, tx, cancellationToken: ct));
    }

    /// <summary>
    /// Lot: bir numara, miktar birden çok olabilir (bölme kapalıysa tamamı çıkar).
    /// Seri: her numara 1 adet; satır miktarı kadar numara.
    /// Seri grubu: birden çok seri no = 1 adet; miktar kadar grup.
    /// </summary>
    private async Task ApplySerialLotsAsync(int voucherId, IDbTransaction? tx, CancellationToken ct)
    {
        if (!await TableExistsAsync("ProductSerialLot", tx)) return;
        if (!await TableExistsAsync("ProductTrans", tx) || !await TableExistsAsync("ProductCard", tx)) return;
        var hasNo = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductTrans', N'SerialLotNo') IS NULL THEN 0 ELSE 1 END",
            transaction: tx, cancellationToken: ct));
        if (hasNo != 1) return;
        var hasMode = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductCard', N'TrackingMode') IS NULL THEN 0 ELSE 1 END",
            transaction: tx, cancellationToken: ct));
        if (hasMode != 1) return;

        var header = await _db.QueryFirstOrDefaultAsync<(int VoucherType, int? WhouseID, int? AimWhouseID)>(
            new CommandDefinition(@"
SELECT CAST(ISNULL(VoucherType, 0) AS int) AS VoucherType, WhouseID, AimWhouseID
FROM dbo.ProductVoucher WHERE ProductVoucherID = @id",
                new { id = voucherId }, tx, cancellationToken: ct));
        if (header.VoucherType == 0 && header.WhouseID is null) return;

        var dir = SerialLotDirection(header.VoucherType);
        if (dir == 0) return;

        var lines = (await _db.QueryAsync<(int ProductTransID, int ProductCardID, string? SerialLotNo, double? Quantity)>(
            new CommandDefinition(@"
SELECT ProductTransID, ISNULL(ProductCardID, 0) AS ProductCardID, SerialLotNo, Quantity
FROM dbo.ProductTrans
WHERE ProductVoucherID = @id AND ISNULL(ProductCardID, 0) > 0",
                new { id = voucherId }, tx, cancellationToken: ct))).ToList();

        foreach (var line in lines)
        {
            var card = await _db.QueryFirstOrDefaultAsync<(byte Mode, bool AllowSplit)>(new CommandDefinition(@"
SELECT CAST(ISNULL(TrackingMode, 0) AS tinyint) AS Mode,
       CAST(CASE WHEN COL_LENGTH(N'dbo.ProductCard', N'AllowLotSplit') IS NULL THEN 0 ELSE ISNULL(AllowLotSplit, 0) END AS bit) AS AllowSplit
FROM dbo.ProductCard WHERE ProductCardID = @id",
                new { id = line.ProductCardID }, tx, cancellationToken: ct));
            if (card.Mode is not (1 or 2 or 3)) continue;

            if (dir == 1)
                await ApplySerialLotInboundAsync(voucherId, header.WhouseID, line, card.Mode, tx, ct);
            else
                await ApplySerialLotOutboundAsync(voucherId, header, dir, line, card.Mode, card.AllowSplit, tx, ct);
        }
    }

    private static int InvoiceSerialDirection(int invoiceType) => invoiceType switch
    {
        2 or 3 => 1,
        1 or 4 => 2,
        _ => 0,
    };

    /// <summary>Alış / satış faturası satırındaki lot ve seriyi stoka işler.</summary>
    private async Task ApplySerialLotsForInvoiceAsync(int invoiceId, IDbTransaction? tx, CancellationToken ct)
    {
        if (!await TableExistsAsync("ProductSerialLot", tx)) return;
        if (!await TableExistsAsync("ProductTrans", tx) || !await TableExistsAsync("ProductCard", tx)) return;
        var hasInv = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductSerialLot', N'SourceInvoiceID') IS NULL THEN 0 ELSE 1 END",
            transaction: tx, cancellationToken: ct));
        if (hasInv != 1) return;
        var hasNo = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductTrans', N'SerialLotNo') IS NULL THEN 0 ELSE 1 END",
            transaction: tx, cancellationToken: ct));
        if (hasNo != 1) return;

        var header = await _db.QueryFirstOrDefaultAsync<(int InvoiceType, int? WhouseID)>(new CommandDefinition(@"
SELECT CAST(ISNULL(InvoiceType, 0) AS int) AS InvoiceType, WhouseID
FROM dbo.Invoice WHERE InvoiceID = @id",
            new { id = invoiceId }, tx, cancellationToken: ct));
        var dir = InvoiceSerialDirection(header.InvoiceType);
        if (dir == 0) return;

        var lines = (await _db.QueryAsync<(int ProductTransID, int ProductCardID, string? SerialLotNo, double? Quantity)>(
            new CommandDefinition(@"
SELECT ProductTransID, ISNULL(ProductCardID, 0) AS ProductCardID, SerialLotNo, Quantity
FROM dbo.ProductTrans
WHERE InvoiceID = @id AND ISNULL(ProductCardID, 0) > 0",
                new { id = invoiceId }, tx, cancellationToken: ct))).ToList();

        var voucherHeader = (header.InvoiceType, header.WhouseID, (int?)null);
        foreach (var line in lines)
        {
            var card = await _db.QueryFirstOrDefaultAsync<(byte Mode, bool AllowSplit)>(new CommandDefinition(@"
SELECT CAST(ISNULL(TrackingMode, 0) AS tinyint) AS Mode,
       CAST(CASE WHEN COL_LENGTH(N'dbo.ProductCard', N'AllowLotSplit') IS NULL THEN 0 ELSE ISNULL(AllowLotSplit, 0) END AS bit) AS AllowSplit
FROM dbo.ProductCard WHERE ProductCardID = @id",
                new { id = line.ProductCardID }, tx, cancellationToken: ct));
            if (card.Mode is not (1 or 2 or 3)) continue;
            if (dir == 1)
                await ApplySerialLotInboundAsync(invoiceId, header.WhouseID, line, card.Mode, tx, ct, true);
            else
                await ApplySerialLotOutboundAsync(invoiceId, voucherHeader, dir, line, card.Mode, card.AllowSplit, tx, ct, true);
        }
    }

    private async Task ReleaseSerialLotsForInvoiceAsync(int invoiceId, IDbTransaction? tx, CancellationToken ct)
    {
        if (!await TableExistsAsync("ProductSerialLot", tx)) return;
        var hasInv = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductSerialLot', N'SourceInvoiceID') IS NULL THEN 0 ELSE 1 END",
            transaction: tx, cancellationToken: ct));
        if (hasInv != 1) return;

        var blocked = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT COUNT(1) FROM dbo.ProductSerialLot
WHERE SourceInvoiceID = @id AND Status_ = 2 AND ISNULL(OutInvoiceID, 0) <> @id",
            new { id = invoiceId }, tx, cancellationToken: ct));
        if (blocked > 0)
            throw new InvalidOperationException("Bu faturadaki lot/seri çıkışta kullanılmış. Önce çıkış belgesini değiştirin.");

        var invType = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT CAST(ISNULL(InvoiceType, 0) AS int) FROM dbo.Invoice WHERE InvoiceID = @id",
            new { id = invoiceId }, tx, cancellationToken: ct));
        if (InvoiceSerialDirection(invType ?? 0) == 2)
        {
            var outs = await _db.QueryAsync<(int ProductCardID, int LotId, double? Quantity, string? SerialLotNo)>(
                new CommandDefinition(@"
SELECT ProductCardID, ProductSerialLotID AS LotId, Quantity, SerialLotNo
FROM dbo.ProductTrans
WHERE InvoiceID = @id AND ISNULL(ProductSerialLotID, 0) > 0",
                    new { id = invoiceId }, tx, cancellationToken: ct));
            await RestorePartialLotsAsync(outs, tx, ct);
        }

        await _db.ExecuteAsync(new CommandDefinition(@"
UPDATE dbo.ProductSerialLot
SET Status_ = 1, OutInvoiceID = NULL, OutTransID = NULL
WHERE OutInvoiceID = @id",
            new { id = invoiceId }, tx, cancellationToken: ct));

        if (await TableExistsAsync("ProductSerialLotItem", tx))
        {
            await _db.ExecuteAsync(new CommandDefinition(@"
DELETE i FROM dbo.ProductSerialLotItem i
INNER JOIN dbo.ProductSerialLot l ON l.ProductSerialLotID = i.ProductSerialLotID
WHERE l.SourceInvoiceID = @id AND l.Status_ = 1 AND l.OutInvoiceID IS NULL",
                new { id = invoiceId }, tx, cancellationToken: ct));
        }

        await _db.ExecuteAsync(new CommandDefinition(@"
DELETE FROM dbo.ProductSerialLot
WHERE SourceInvoiceID = @id AND Status_ = 1 AND OutInvoiceID IS NULL",
            new { id = invoiceId }, tx, cancellationToken: ct));
    }

    private async Task ApplySerialLotInboundAsync(
        int voucherId,
        int? whouseId,
        (int ProductTransID, int ProductCardID, string? SerialLotNo, double? Quantity) line,
        byte mode,
        IDbTransaction? tx,
        CancellationToken ct,
        bool invoice = false)
    {
        var entries = ReadLotEntries(line.SerialLotNo);
        if (mode == 1)
        {
            if (entries.Count == 0)
                entries.Add(new LotEntry { q = line.Quantity });
            if (line.Quantity is null || line.Quantity <= 0)
                throw new InvalidOperationException("Lot satırında miktar girin.");
            var first = 0;
            foreach (var en in entries)
            {
                var code = (en.c ?? "").Trim();
                if (string.IsNullOrEmpty(code))
                    code = await NextSerialLotCodeAsync(line.ProductCardID, 1, tx, ct);
                en.c = code;
                var qty = en.q ?? (entries.Count == 1 ? line.Quantity : null);
                if (qty is null || qty <= 0)
                    throw new InvalidOperationException("Her lot satırında miktar girin.");
                en.q = qty;
                var id = await InsertSerialLotAsync(line.ProductCardID, 1, code, whouseId, qty, voucherId, line.ProductTransID, tx, ct, invoice, en);
                if (first == 0) first = id;
            }
            await WriteLineSerialAsync(line.ProductTransID, WriteLotEntries(entries), first, tx, ct);
            await SyncLineQuantityAsync(line.ProductTransID, entries.Sum(e => e.q ?? 0), tx, ct);
            return;
        }

        var pieces = PieceCount(line.Quantity)
            ?? throw new InvalidOperationException(mode == 2
                ? "Seri takibinde miktar tam sayı olmalı. Her seri 1 adettir."
                : "Seri grubunda miktar tam sayı olmalı. Her grup 1 adettir.");

        if (mode == 2)
        {
            if (entries.Count == 0)
            {
                foreach (var code in SplitCodes(line.SerialLotNo))
                    entries.Add(new LotEntry { c = code, q = 1 });
            }
            while (entries.Count < pieces)
                entries.Add(new LotEntry { q = 1 });
            if (entries.Count != pieces)
                throw new InvalidOperationException("Seri sayısı miktar kadar olmalı. Her seri 1 adettir.");
            var first = 0;
            foreach (var en in entries)
            {
                var code = (en.c ?? "").Trim();
                if (string.IsNullOrEmpty(code))
                    code = await NextSerialLotCodeAsync(line.ProductCardID, 2, tx, ct);
                en.c = code;
                en.q = 1;
                var id = await InsertSerialLotAsync(line.ProductCardID, 2, code, whouseId, 1, voucherId, line.ProductTransID, tx, ct, invoice, en);
                if (first == 0) first = id;
            }
            await WriteLineSerialAsync(line.ProductTransID, WriteLotEntries(entries), first, tx, ct);
            await SyncLineQuantityAsync(line.ProductTransID, entries.Count, tx, ct);
            return;
        }

        if (!await TableExistsAsync("ProductSerialLotItem", tx))
            throw new InvalidOperationException("Seri grubu için veritabanı güncellemesi 97 uygulanmalı.");

        if (entries.Count == 0)
        {
            foreach (var group in ParseSerialGroups(line.SerialLotNo))
                entries.Add(new LotEntry { c = group.Code, s = string.Join(',', group.Serials), q = 1 });
        }
        if (entries.Count == 0)
            throw new InvalidOperationException("Seri grubu için her adete birden çok seri no girin.");
        if (entries.Count != pieces)
            throw new InvalidOperationException("Seri grubu sayısı miktar kadar olmalı. Her grup 1 adettir.");

        var firstGroup = 0;
        foreach (var en in entries)
        {
            var serials = (en.s ?? "").Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim()).Where(s => s.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (serials.Count < 2)
                throw new InvalidOperationException("Seri grubunda birden çok seri no olmalı.");
            var code = (en.c ?? "").Trim();
            if (string.IsNullOrEmpty(code))
                code = await NextSerialLotCodeAsync(line.ProductCardID, 3, tx, ct);
            en.c = code;
            en.q = 1;
            en.s = string.Join(',', serials);
            var id = await InsertSerialLotAsync(line.ProductCardID, 3, code, whouseId, 1, voucherId, line.ProductTransID, tx, ct, invoice, en);
            if (firstGroup == 0) firstGroup = id;
            foreach (var sn in serials)
            {
                await _db.ExecuteAsync(new CommandDefinition(@"
INSERT INTO dbo.ProductSerialLotItem (ProductSerialLotID, SerialNo) VALUES (@lot, @sn)",
                    new { lot = id, sn }, tx, cancellationToken: ct));
            }
        }
        await WriteLineSerialAsync(line.ProductTransID, WriteLotEntries(entries), firstGroup, tx, ct);
        await SyncLineQuantityAsync(line.ProductTransID, entries.Count, tx, ct);
    }

    private async Task ApplySerialLotOutboundAsync(
        int voucherId,
        (int VoucherType, int? WhouseID, int? AimWhouseID) header,
        int dir,
        (int ProductTransID, int ProductCardID, string? SerialLotNo, double? Quantity) line,
        byte mode,
        bool allowSplit,
        IDbTransaction? tx,
        CancellationToken ct,
        bool invoice = false)
    {
        if (mode == 1)
        {
            var entries = ReadLotEntries(line.SerialLotNo);
            if (entries.Count == 0)
            {
                var only = FirstCode(line.SerialLotNo);
                if (!string.IsNullOrEmpty(only))
                    entries.Add(new LotEntry { c = only, q = line.Quantity });
            }
            if (entries.Count == 0)
                throw new InvalidOperationException($"Çıkış satırında lot seçin (malzeme #{line.ProductCardID}).");
            var lotFirst = 0;
            double issuedSum = 0;
            foreach (var en in entries)
            {
                var code = (en.c ?? "").Trim();
                if (string.IsNullOrEmpty(code))
                    throw new InvalidOperationException($"Çıkış satırında lot seçin (malzeme #{line.ProductCardID}).");
                var lot = await FindInStockAsync(line.ProductCardID, 1, code, tx, ct)
                    ?? throw new InvalidOperationException($"Stokta lot yok: {code}");
                var have = lot.Qty ?? 0;
                var issued = en.q ?? (entries.Count == 1 ? line.Quantity ?? 0 : 0);
                if (issued <= 0) throw new InvalidOperationException("Lot çıkışında miktar girin.");
                if (issued - have > 0.0001)
                    throw new InvalidOperationException($"Lot miktarı yetersiz: {code} (kalan {have})");
                if (dir == 3)
                {
                    if (Math.Abs(issued - have) > 0.0001)
                        throw new InvalidOperationException("Transferde lot bölünmez; miktar lot miktarına eşit olmalı.");
                    var wh = header.AimWhouseID is > 0 ? header.AimWhouseID : header.WhouseID;
                    await _db.ExecuteAsync(new CommandDefinition(
                        "UPDATE dbo.ProductSerialLot SET WhouseID = @wh WHERE ProductSerialLotID = @id",
                        new { wh, id = lot.ProductSerialLotID }, tx, cancellationToken: ct));
                }
                else if (!allowSplit && Math.Abs(issued - have) > 0.0001)
                {
                    throw new InvalidOperationException("Lot bölünemez; miktar lot miktarına eşit olmalı.");
                }
                else if (Math.Abs(issued - have) <= 0.0001)
                {
                    await MarkSerialOutAsync(lot.ProductSerialLotID, voucherId, line.ProductTransID, tx, ct, invoice);
                }
                else
                {
                    await _db.ExecuteAsync(new CommandDefinition(
                        "UPDATE dbo.ProductSerialLot SET Qty = ISNULL(Qty, 0) - @q WHERE ProductSerialLotID = @id",
                        new { q = issued, id = lot.ProductSerialLotID }, tx, cancellationToken: ct));
                }
                en.q = issued;
                issuedSum += issued;
                if (lotFirst == 0) lotFirst = lot.ProductSerialLotID;
            }
            await WriteLineSerialAsync(line.ProductTransID, WriteLotEntries(entries), lotFirst, tx, ct);
            await SyncLineQuantityAsync(line.ProductTransID, issuedSum, tx, ct);
            return;
        }

        var picked = ReadLotEntries(line.SerialLotNo);
        var codes = picked.Count > 0
            ? picked.Select(e => (e.c ?? "").Trim()).Where(s => s.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
            : (mode == 3 ? SplitGroupCodes(line.SerialLotNo) : SplitCodes(line.SerialLotNo));
        if (codes.Count == 0)
            throw new InvalidOperationException(mode == 2
                ? $"Çıkış satırında seri seçin (malzeme #{line.ProductCardID})."
                : $"Çıkış satırında seri grubu seçin (malzeme #{line.ProductCardID}).");
        var first = 0;
        foreach (var code in codes)
        {
            var lot = await FindInStockAsync(line.ProductCardID, mode, code, tx, ct)
                ?? throw new InvalidOperationException($"Stokta yok: {code}");
            if (first == 0) first = lot.ProductSerialLotID;
            if (dir == 3)
            {
                var wh = header.AimWhouseID is > 0 ? header.AimWhouseID : header.WhouseID;
                await _db.ExecuteAsync(new CommandDefinition(
                    "UPDATE dbo.ProductSerialLot SET WhouseID = @wh WHERE ProductSerialLotID = @id",
                    new { wh, id = lot.ProductSerialLotID }, tx, cancellationToken: ct));
            }
            else
            {
                await MarkSerialOutAsync(lot.ProductSerialLotID, voucherId, line.ProductTransID, tx, ct, invoice);
            }
        }

        var written = codes.Select(code =>
        {
            var src = picked.FirstOrDefault(e => string.Equals((e.c ?? "").Trim(), code, StringComparison.OrdinalIgnoreCase));
            return new LotEntry { c = code, q = 1, e = src?.e, n = src?.n, l = src?.l, s = src?.s };
        }).ToList();
        await WriteLineSerialAsync(line.ProductTransID, WriteLotEntries(written), first, tx, ct);
        await SyncLineQuantityAsync(line.ProductTransID, written.Count, tx, ct);
    }

    private async Task<bool> LotDetailColumnsAsync(IDbTransaction? tx, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT CASE WHEN COL_LENGTH(N'dbo.ProductSerialLot', N'ExpireDate') IS NULL THEN 0 ELSE 1 END
     + CASE WHEN COL_LENGTH(N'dbo.ProductSerialLot', N'Description') IS NULL THEN 0 ELSE 1 END
     + CASE WHEN COL_LENGTH(N'dbo.ProductSerialLot', N'StockLocationID') IS NULL THEN 0 ELSE 1 END",
            transaction: tx, cancellationToken: ct));
        return n == 3;
    }

    private sealed class LotEntry
    {
        public string? c { get; set; }
        public double? q { get; set; }
        public string? e { get; set; }
        public string? n { get; set; }
        public int? l { get; set; }
        public string? s { get; set; }
    }

    private static readonly JsonSerializerOptions LotEntryJson = new() { PropertyNameCaseInsensitive = true };

    private static List<LotEntry> ReadLotEntries(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<LotEntry>();
        var t = raw.Trim();
        if (!t.StartsWith('[')) return new List<LotEntry>();
        try
        {
            return JsonSerializer.Deserialize<List<LotEntry>>(t, LotEntryJson) ?? new List<LotEntry>();
        }
        catch
        {
            return new List<LotEntry>();
        }
    }

    private static string WriteLotEntries(IEnumerable<LotEntry> entries)
    {
        return JsonSerializer.Serialize(entries.Select(en => new LotEntry
        {
            c = en.c,
            q = en.q,
            e = string.IsNullOrWhiteSpace(en.e) ? null : en.e,
            n = string.IsNullOrWhiteSpace(en.n) ? null : en.n,
            l = en.l is > 0 ? en.l : null,
            s = string.IsNullOrWhiteSpace(en.s) ? null : en.s,
        }), LotEntryJson);
    }

    private async Task<int> InsertSerialLotAsync(
        int productId, byte kind, string code, int? whouseId, double? qty,
        int voucherId, int transId, IDbTransaction? tx, CancellationToken ct, bool invoice = false, LotEntry? detail = null)
    {
        DateTime? expire = null;
        if (DateTime.TryParse(detail?.e, out var parsed)) expire = parsed.Date;
        var note = string.IsNullOrWhiteSpace(detail?.n) ? null : detail!.n!.Trim();
        if (note != null && note.Length > 250) note = note[..250];
        int? location = detail?.l is > 0 ? detail.l : null;
        var detailCols = await LotDetailColumnsAsync(tx, ct);
        string sql;
        if (invoice && detailCols)
            sql = @"
INSERT INTO dbo.ProductSerialLot
  (ProductCardID, Kind, Code, Status_, WhouseID, Qty, SourceInvoiceID, SourceTransID, ExpireDate, Description, StockLocationID)
OUTPUT INSERTED.ProductSerialLotID
VALUES
  (@pid, @kind, @code, 1, @wh, @qty, @vid, @tid, @exp, @note, @loc)";
        else if (invoice)
            sql = @"
INSERT INTO dbo.ProductSerialLot
  (ProductCardID, Kind, Code, Status_, WhouseID, Qty, SourceInvoiceID, SourceTransID)
OUTPUT INSERTED.ProductSerialLotID
VALUES
  (@pid, @kind, @code, 1, @wh, @qty, @vid, @tid)";
        else if (detailCols)
            sql = @"
INSERT INTO dbo.ProductSerialLot
  (ProductCardID, Kind, Code, Status_, WhouseID, Qty, SourceVoucherID, SourceTransID, ExpireDate, Description, StockLocationID)
OUTPUT INSERTED.ProductSerialLotID
VALUES
  (@pid, @kind, @code, 1, @wh, @qty, @vid, @tid, @exp, @note, @loc)";
        else
            sql = @"
INSERT INTO dbo.ProductSerialLot
  (ProductCardID, Kind, Code, Status_, WhouseID, Qty, SourceVoucherID, SourceTransID)
OUTPUT INSERTED.ProductSerialLotID
VALUES
  (@pid, @kind, @code, 1, @wh, @qty, @vid, @tid)";
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(sql,
            new { pid = productId, kind, code, wh = whouseId, qty, vid = voucherId, tid = transId, exp = expire, note, loc = location },
            tx, cancellationToken: ct));
    }

    /// <summary>Kısmi lot çıkışı geri alınırken satır miktarı değil, seri/lot satırlarının kendi miktarı iade edilir.</summary>
    private async Task RestorePartialLotsAsync(
        IEnumerable<(int ProductCardID, int LotId, double? Quantity, string? SerialLotNo)> rows,
        IDbTransaction? tx,
        CancellationToken ct)
    {
        foreach (var row in rows)
        {
            var entries = ReadLotEntries(row.SerialLotNo);
            if (entries.Count == 0)
            {
                if (row.LotId <= 0) continue;
                await RestoreLotQtyAsync(row.LotId, row.Quantity ?? 0, tx, ct);
                continue;
            }
            foreach (var en in entries)
            {
                var q = en.q ?? 0;
                if (q <= 0) continue;
                var code = (en.c ?? "").Trim();
                if (code.Length == 0)
                {
                    if (row.LotId > 0) await RestoreLotQtyAsync(row.LotId, q, tx, ct);
                    continue;
                }
                var found = await _db.QueryFirstOrDefaultAsync<(int Id, byte Kind, byte Status)>(new CommandDefinition(@"
SELECT TOP 1 ProductSerialLotID AS Id, Kind, Status_ AS Status
FROM dbo.ProductSerialLot
WHERE ProductCardID = @pid AND Kind = 1 AND Code = @code",
                    new { pid = row.ProductCardID, code }, tx, cancellationToken: ct));
                if (found.Id > 0) await RestoreLotQtyAsync(found.Id, q, tx, ct);
            }
        }
    }

    private async Task RestoreLotQtyAsync(int lotId, double qty, IDbTransaction? tx, CancellationToken ct)
    {
        if (lotId <= 0 || qty <= 0) return;
        var lot = await _db.QueryFirstOrDefaultAsync<(byte Kind, byte Status)>(new CommandDefinition(@"
SELECT Kind, Status_ AS Status FROM dbo.ProductSerialLot WHERE ProductSerialLotID = @id",
            new { id = lotId }, tx, cancellationToken: ct));
        // Kısmi lot: miktar düşmüş, durum 1. Tam çıkışta miktar durur, durum 2.
        if (lot.Kind == 1 && lot.Status == 1)
        {
            await _db.ExecuteAsync(new CommandDefinition(@"
UPDATE dbo.ProductSerialLot SET Qty = ISNULL(Qty, 0) + @q WHERE ProductSerialLotID = @id",
                new { q = qty, id = lotId }, tx, cancellationToken: ct));
        }
    }

    /// <summary>Fiş satırı miktarı, seri/lot satırlarının toplamı kadar olur.</summary>
    private async Task SyncLineQuantityAsync(int transId, double qty, IDbTransaction? tx, CancellationToken ct)
    {
        if (transId <= 0 || qty <= 0) return;
        await _db.ExecuteAsync(new CommandDefinition(@"
UPDATE dbo.ProductTrans
SET MainUnitQuantity = CASE
      WHEN MainUnitQuantity IS NULL
        OR ABS(ISNULL(MainUnitQuantity, 0) - ISNULL(Quantity, 0)) < 0.0001 THEN @q
      ELSE MainUnitQuantity END,
    Quantity = @q
WHERE ProductTransID = @id",
            new { q = qty, id = transId }, tx, cancellationToken: ct));
    }

    private async Task WriteLineSerialAsync(int transId, string code, int lotId, IDbTransaction? tx, CancellationToken ct)
    {
        await _db.ExecuteAsync(new CommandDefinition(@"
UPDATE dbo.ProductTrans SET SerialLotNo = @code, ProductSerialLotID = @lot WHERE ProductTransID = @tid",
            new { code, lot = lotId, tid = transId }, tx, cancellationToken: ct));
    }

    private async Task MarkSerialOutAsync(int lotId, int voucherId, int transId, IDbTransaction? tx, CancellationToken ct, bool invoice = false)
    {
        var sql = invoice
            ? @"
UPDATE dbo.ProductSerialLot
SET Status_ = 2, OutInvoiceID = @vid, OutTransID = @tid
WHERE ProductSerialLotID = @id"
            : @"
UPDATE dbo.ProductSerialLot
SET Status_ = 2, OutVoucherID = @vid, OutTransID = @tid
WHERE ProductSerialLotID = @id";
        await _db.ExecuteAsync(new CommandDefinition(sql,
            new { vid = voucherId, tid = transId, id = lotId }, tx, cancellationToken: ct));
    }

    private async Task<(int ProductSerialLotID, double? Qty)?> FindInStockAsync(
        int productId, byte kind, string code, IDbTransaction? tx, CancellationToken ct)
    {
        var lot = await _db.QueryFirstOrDefaultAsync<(int ProductSerialLotID, double? Qty)>(new CommandDefinition(@"
SELECT TOP 1 ProductSerialLotID, Qty
FROM dbo.ProductSerialLot
WHERE ProductCardID = @pid AND Kind = @kind AND Code = @code AND Status_ = 1",
            new { pid = productId, kind, code }, tx, cancellationToken: ct));
        return lot.ProductSerialLotID == 0 ? null : lot;
    }

    private async Task<string> NextSerialLotCodeAsync(int productId, byte kind, IDbTransaction? tx, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT COUNT(1) FROM dbo.ProductSerialLot WHERE ProductCardID = @pid AND Kind = @kind",
            new { pid = productId, kind }, tx, cancellationToken: ct));
        var prefix = kind switch { 2 => "SR", 3 => "SG", _ => "LT" };
        return $"{prefix}{productId}-{n + 1:D4}";
    }

    private static string FirstCode(string? raw) =>
        SplitCodes(raw).FirstOrDefault() ?? "";

    private static List<string> SplitCodes(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        return raw.Split(new[] { '\n', '\r', ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s => s.Trim())
            .Where(s => s.Length > 0 && !s.Contains('|'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static List<string> SplitGroupCodes(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        return raw.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(s =>
            {
                var line = s.Trim();
                var bar = line.IndexOf('|');
                return (bar > 0 ? line[..bar] : line).Trim();
            })
            .Where(s => s.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private readonly record struct SerialGroup(string? Code, List<string> Serials);

    private static List<SerialGroup> ParseSerialGroups(string? raw)
    {
        var list = new List<SerialGroup>();
        if (string.IsNullOrWhiteSpace(raw)) return list;
        foreach (var row in raw.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var line = row.Trim();
            if (line.Length == 0) continue;
            string? code = null;
            var rest = line;
            var sep = line.IndexOf('|');
            if (sep < 0) sep = line.IndexOf('=');
            if (sep > 0)
            {
                code = line[..sep].Trim();
                rest = line[(sep + 1)..];
            }
            var serials = rest.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim())
                .Where(s => s.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            list.Add(new SerialGroup(string.IsNullOrEmpty(code) ? null : code, serials));
        }
        return list;
    }

    private static int? PieceCount(double? qty)
    {
        if (qty is null || qty <= 0) return null;
        var n = (int)Math.Round(qty.Value);
        return Math.Abs(qty.Value - n) > 0.0001 ? null : n;
    }

    /// <summary>1 giriş · 2 çıkış · 3 transfer · 0 izleme yok</summary>
    private static int SerialLotDirection(int voucherType) => voucherType switch
    {
        1 or 2 or 5 or 9 => 1,
        3 or 4 or 8 or 10 => 2,
        6 => 3,
        _ => 0,
    };

    private async Task<bool> TableExistsAsync(string tableName, IDbTransaction? tx = null)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT CASE WHEN OBJECT_ID(@name, N'U') IS NULL THEN 0 ELSE 1 END",
            new { name = "dbo." + tableName },
            tx));
        return n == 1;
    }

    private async Task<bool> IsIdentityColumnAsync(string tableName, string columnName, IDbTransaction? tx = null)
    {
        if (string.IsNullOrWhiteSpace(columnName)) return false;
        var n = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            @"SELECT COLUMNPROPERTY(OBJECT_ID(@t), @c, 'IsIdentity')",
            new { t = "dbo." + tableName, c = columnName },
            tx));
        return n == 1;
    }

    private async Task<int> NextIdAsync(string tableName, string pk, IDbTransaction? tx, CancellationToken ct)
    {
        // Şablon ID'leri (<0) yeni kayıt numarasına karışmasın
        var next = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            $"SELECT ISNULL(MAX(CASE WHEN [{pk}] > 0 THEN [{pk}] END), 0) + 1 FROM [{tableName}] WITH (UPDLOCK, HOLDLOCK)",
            transaction: tx,
            cancellationToken: ct));
        return next ?? 1;
    }

    /// <summary>Öndeğer kart (ID &lt; 0): varsa UPDATE, yoksa IDENTITY_INSERT ile INSERT.</summary>
    private async Task<int> UpsertTemplateAsync(
        string tableName,
        string pk,
        int templateId,
        List<string> writeCols,
        DynamicParameters parameters,
        IDbTransaction? tx,
        CancellationToken ct)
    {
        var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(1) FROM [{tableName}] WHERE [{pk}] = @id",
            new { id = templateId },
            tx,
            cancellationToken: ct));

        if (exists > 0)
        {
            parameters.Add("__pk", templateId);
            var sets = string.Join(", ", writeCols.Select(c => $"[{c}] = @{c}"));
            var upd = $"UPDATE [{tableName}] SET {sets} WHERE [{pk}] = @__pk";
            await _db.ExecuteAsync(new CommandDefinition(upd, parameters, tx, cancellationToken: ct));
            return templateId;
        }

        var colsWithPk = new List<string> { pk };
        colsWithPk.AddRange(writeCols);
        parameters.Add(pk, templateId);

        var isIdentity = await IsIdentityColumnAsync(tableName, pk, tx);
        if (isIdentity)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                $"SET IDENTITY_INSERT [{tableName}] ON",
                transaction: tx,
                cancellationToken: ct));
        }

        try
        {
            var insertSql = $@"
INSERT INTO [{tableName}] ({string.Join(", ", colsWithPk.Select(c => $"[{c}]"))})
VALUES ({string.Join(", ", colsWithPk.Select(c => "@" + c))});";
            await _db.ExecuteAsync(new CommandDefinition(insertSql, parameters, tx, cancellationToken: ct));
        }
        finally
        {
            if (isIdentity)
            {
                await _db.ExecuteAsync(new CommandDefinition(
                    $"SET IDENTITY_INSERT [{tableName}] OFF",
                    transaction: tx,
                    cancellationToken: ct));
            }
        }

        return templateId;
    }

    private async Task<List<string>> GetColumnsAsync(string tableName, IDbTransaction? tx = null)
    {
        var rows = await _db.QueryAsync<string>(new CommandDefinition(
            @"SELECT c.name
              FROM sys.columns c
              INNER JOIN sys.tables t ON c.object_id = t.object_id
              WHERE t.name = @table AND SCHEMA_NAME(t.schema_id) = N'dbo'
              ORDER BY c.column_id",
            new { table = tableName },
            tx));
        return rows.ToList();
    }

    private async Task<Dictionary<string, string>> GetColumnTypesAsync(string tableName, IDbTransaction? tx = null)
    {
        var rows = await _db.QueryAsync<(string Name, string Typ)>(new CommandDefinition(
            @"SELECT c.name AS Name, TYPE_NAME(c.user_type_id) AS Typ
              FROM sys.columns c
              INNER JOIN sys.tables t ON c.object_id = t.object_id
              WHERE t.name = @table AND SCHEMA_NAME(t.schema_id) = N'dbo'",
            new { table = tableName },
            tx));
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
            map[r.Name] = r.Typ;
        return map;
    }

    private static bool IsTextSqlType(string? sqlType) =>
        sqlType is "nvarchar" or "varchar" or "nchar" or "char" or "ntext" or "text" or "xml";

    /// <summary>Metin kolonuna sayı yazma: 150.10 ve 150.* kod olarak kalsın.</summary>
    private static object? CoerceForColumn(string? sqlType, object? value)
    {
        value = NormalizeJsonElement(value);
        if (IsTextSqlType(sqlType))
        {
            if (value is null) return null;
            var s = value as string ?? Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture);
            return string.IsNullOrWhiteSpace(s) ? null : s;
        }
        return CoerceDbValue(value);
    }

    private async Task<string> ResolvePrimaryKeyAsync(string tableName, string? hint, IDbTransaction? tx = null)
    {
        if (!string.IsNullOrWhiteSpace(hint) && SafeIdent.IsMatch(hint))
        {
            var cols = await GetColumnsAsync(tableName, tx);
            if (cols.Any(c => c.Equals(hint, StringComparison.OrdinalIgnoreCase)))
                return cols.First(c => c.Equals(hint, StringComparison.OrdinalIgnoreCase));
        }

        var pk = await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            @"SELECT TOP 1 c.name
              FROM sys.indexes i
              INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
              INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              INNER JOIN sys.tables t ON i.object_id = t.object_id
              WHERE i.is_primary_key = 1 AND t.name = @table AND SCHEMA_NAME(t.schema_id) = N'dbo'
              ORDER BY ic.key_ordinal",
            new { table = tableName },
            tx));

        if (!string.IsNullOrWhiteSpace(pk)) return pk!;

        var cols2 = await GetColumnsAsync(tableName, tx);
        var guess = cols2.FirstOrDefault(c => c.EndsWith("ID", StringComparison.OrdinalIgnoreCase)
                                              || c.EndsWith("Id", StringComparison.OrdinalIgnoreCase));
        return guess ?? cols2.FirstOrDefault() ?? "";
    }

    private static object? NormalizeValue(object? v)
    {
        if (v is null or DBNull) return null;
        if (v is DateTime dt)
        {
            // SQL boş/sentinel tarih → formda boş
            if (dt.Year <= 1900) return null;
            return dt.ToString("yyyy-MM-dd");
        }
        if (v is bool b) return b;
        if (v is byte[] bytes) return Convert.ToBase64String(bytes);
        return v;
    }

    private static object? NormalizeJsonElement(object? v)
    {
        if (v is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => je.GetString(),
                JsonValueKind.Number => je.TryGetInt64(out var l) ? l : je.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => je.ToString(),
            };
        }
        return v;
    }

    private static object? CoerceDbValue(object? v)
    {
        v = NormalizeJsonElement(v);
        if (v is null) return null;
        if (v is string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            // HTML date (yyyy-MM-dd) / ISO → DateTime (boş string SQL'de 1900-01-01 olmasın)
            if (DateTime.TryParse(s, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind
                    | System.Globalization.DateTimeStyles.AllowWhiteSpaces, out var dt)
                && (s.Contains('-') || s.Contains('/') || s.Contains('T')))
                return dt;
            if (bool.TryParse(s, out var b)) return b;
            if (int.TryParse(s, System.Globalization.NumberStyles.Integer,
                    System.Globalization.CultureInfo.InvariantCulture, out var i)
                && s == i.ToString())
                return i;
            if ((s.Contains('.') || s.Contains(','))
                && double.TryParse(s.Replace(',', '.'), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var d))
                return d;
            return s;
        }
        if (v is JsonElement) return NormalizeJsonElement(v);
        return v;
    }

    private static string ToCamel(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        if (name.Length == 1) return name.ToLowerInvariant();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }

    private static string ToActiveLabel(object? v)
    {
        if (v is bool b) return b ? "Aktif" : "Pasif";
        if (v is int i) return i != 0 ? "Aktif" : "Pasif";
        var s = Convert.ToString(v)?.Trim().ToLowerInvariant();
        if (s is "1" or "true" or "aktif" or "active") return "Aktif";
        if (s is "0" or "false" or "pasif" or "passive" or "inactive") return "Pasif";
        return Convert.ToString(v) ?? "";
    }
}
