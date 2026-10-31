-- Malzeme kartı: AuxTrans slot seed · İzleme bayrakları · ProductUnit Logo · ProductSub alternatif · satır LineType
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ── ProductCard izleme / ihtiyaç ───────────────────────────────────────────
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'LotUnitsDistributable') IS NULL
    ALTER TABLE dbo.ProductCard ADD LotUnitsDistributable BIT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'LotUnitsCombinable') IS NULL
    ALTER TABLE dbo.ProductCard ADD LotUnitsCombinable BIT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'LotUnitsDistributable') IS NOT NULL
BEGIN
  UPDATE dbo.ProductCard
  SET LotUnitsDistributable = ISNULL(LotUnitsDistributable, 0),
      LotUnitsCombinable = ISNULL(LotUnitsCombinable, 0)
  WHERE ProductCardID = -1 OR LotUnitsDistributable IS NULL OR LotUnitsCombinable IS NULL;
END
GO

-- ── ProductUnit Logo alanları ──────────────────────────────────────────────
IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductUnit', N'Divisible') IS NULL
    ALTER TABLE dbo.ProductUnit ADD Divisible BIT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'DecimalPlaces') IS NULL
    ALTER TABLE dbo.ProductUnit ADD DecimalPlaces TINYINT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'PriorityMaterial') IS NULL
    ALTER TABLE dbo.ProductUnit ADD PriorityMaterial INT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'PrioritySales') IS NULL
    ALTER TABLE dbo.ProductUnit ADD PrioritySales INT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'PriorityPurchase') IS NULL
    ALTER TABLE dbo.ProductUnit ADD PriorityPurchase INT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'Area') IS NULL
    ALTER TABLE dbo.ProductUnit ADD Area FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'NetVolume') IS NULL
    ALTER TABLE dbo.ProductUnit ADD NetVolume FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'GrossVolume') IS NULL
    ALTER TABLE dbo.ProductUnit ADD GrossVolume FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'GrossWeight') IS NULL
    ALTER TABLE dbo.ProductUnit ADD GrossWeight FLOAT NULL;
END
GO

-- ── ProductSub alternatif ──────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.ProductSub', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductSub', N'Priority') IS NULL
    ALTER TABLE dbo.ProductSub ADD Priority INT NULL;
  IF COL_LENGTH(N'dbo.ProductSub', N'EndDate') IS NULL
    ALTER TABLE dbo.ProductSub ADD EndDate DATETIME NULL;
  IF COL_LENGTH(N'dbo.ProductSub', N'MaxQty') IS NULL
    ALTER TABLE dbo.ProductSub ADD MaxQty FLOAT NULL;
END
GO

-- ── Ticaret satır türü (Malzeme / İndirim) ─────────────────────────────────
IF OBJECT_ID(N'dbo.OrderTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.OrderTrans', N'LineType') IS NULL
  ALTER TABLE dbo.OrderTrans ADD LineType TINYINT NULL;
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductTrans', N'LineType') IS NULL
  ALTER TABLE dbo.ProductTrans ADD LineType TINYINT NULL;
GO

IF OBJECT_ID(N'dbo.OrderTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.OrderTrans', N'Description2') IS NULL
  ALTER TABLE dbo.OrderTrans ADD Description2 NVARCHAR(200) NULL;
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductTrans', N'Description2') IS NULL
  ALTER TABLE dbo.ProductTrans ADD Description2 NVARCHAR(200) NULL;
GO

-- ── AuxilCodes: ProductCard SlotNo 1..5 (çakışanları 10+ kaydır) ───────────
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AuxilCodes', N'SlotNo') IS NOT NULL
BEGIN
  UPDATE dbo.AuxilCodes
  SET SlotNo = SlotNo + 10
  WHERE TargetTable = N'ProductCard'
    AND SlotNo BETWEEN 1 AND 5
    AND Code NOT LIKE N'OZEL%';

  DECLARE @maxId int = ISNULL((SELECT MAX(AuxilCodesID) FROM dbo.AuxilCodes), 0);
  DECLARE @slot int = 1;
  WHILE @slot <= 5
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.AuxilCodes
      WHERE TargetTable = N'ProductCard' AND SlotNo = @slot AND Code = N'OZEL' + CAST(@slot AS nvarchar(2))
    )
    BEGIN
      SET @maxId = @maxId + 1;
      IF COL_LENGTH(N'dbo.AuxilCodes', N'HasDate') IS NOT NULL
        INSERT INTO dbo.AuxilCodes (AuxilCodesID, Code, Title, TargetTable, SlotNo, ModuleNr, IsActive, HasDate)
        VALUES (
          @maxId,
          N'OZEL' + CAST(@slot AS nvarchar(2)),
          CASE WHEN @slot = 1 THEN N'Özel Kod' ELSE N'Özel Kod ' + CAST(@slot AS nvarchar(2)) END,
          N'ProductCard', @slot, 1, 1, 0
        );
      ELSE
        INSERT INTO dbo.AuxilCodes (AuxilCodesID, Code, Title, TargetTable, SlotNo, ModuleNr, IsActive)
        VALUES (
          @maxId,
          N'OZEL' + CAST(@slot AS nvarchar(2)),
          CASE WHEN @slot = 1 THEN N'Özel Kod' ELSE N'Özel Kod ' + CAST(@slot AS nvarchar(2)) END,
          N'ProductCard', @slot, 1, 1
        );
    END
    SET @slot = @slot + 1;
  END
END
GO
