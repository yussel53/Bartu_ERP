-- E-03: fatura satırında KDV istisna ve tevkifat bilgisi — ek alan (U_ kolonu + SYS_ExtraFields tanımı)
-- Giden e-Fatura UBL'i bunları satırdan okur (eski kayıtlarda AdditionalFields JSON'u da okunur).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductTrans', N'U_TaxExemptionCode') IS NULL
    ALTER TABLE dbo.ProductTrans ADD U_TaxExemptionCode NVARCHAR(10) NULL;
GO
IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductTrans', N'U_TaxExemptionReason') IS NULL
    ALTER TABLE dbo.ProductTrans ADD U_TaxExemptionReason NVARCHAR(250) NULL;
GO
IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductTrans', N'U_WithholdingCode') IS NULL
    ALTER TABLE dbo.ProductTrans ADD U_WithholdingCode NVARCHAR(10) NULL;
GO
IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductTrans', N'U_WithholdingRate') IS NULL
    ALTER TABLE dbo.ProductTrans ADD U_WithholdingRate FLOAT NULL;
GO

-- Tanımlar: kolon varsa ve tanım yoksa eklenir; kullanıcının değiştirdiği etiket / sıra korunur
IF OBJECT_ID(N'dbo.SYS_ExtraFields', N'U') IS NOT NULL
    INSERT INTO dbo.SYS_ExtraFields (TableName, FieldName, Label, DataType, TextLength, OrderIndex, CreatedBy)
    SELECT N'ProductTrans', v.FieldName, v.Label, v.DataType, v.TextLength, v.OrderIndex, N'SqlUpdates'
    FROM (VALUES
        (N'U_TaxExemptionCode', N'KDV istisna kodu', N'text', 10, 910),
        (N'U_TaxExemptionReason', N'KDV istisna açıklaması', N'text', 250, 911),
        (N'U_WithholdingCode', N'Tevkifat kodu', N'text', 10, 912),
        (N'U_WithholdingRate', N'Tevkifat oranı (%)', N'float', NULL, 913)
    ) AS v (FieldName, Label, DataType, TextLength, OrderIndex)
    WHERE COL_LENGTH(N'dbo.ProductTrans', v.FieldName) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ExtraFields e WHERE e.TableName = N'ProductTrans' AND e.FieldName = v.FieldName);
GO
