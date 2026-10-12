-- 45: Birim çevirimi iki yönlü oran — MainQty ana birim = UnitQty çevrim birimi
-- Örn: 12 Adet = 1 Koli  veya  1 Koli = 12 Adet (ana birime göre)

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductUnit', N'MainQty') IS NULL
    ALTER TABLE dbo.ProductUnit ADD MainQty float NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'UnitQty') IS NULL
    ALTER TABLE dbo.ProductUnit ADD UnitQty float NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductUnit', N'MainQty') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductUnit', N'UnitQty') IS NOT NULL
BEGIN
  -- Eski ConvFactor: 1 çevrim birimi = ConvFactor ana birim → MainQty=ConvFactor, UnitQty=1
  IF COL_LENGTH(N'dbo.ProductUnit', N'ConvFactor') IS NOT NULL
  BEGIN
    UPDATE dbo.ProductUnit
    SET
      MainQty = CASE WHEN IsMain = 1 THEN 1 ELSE ISNULL(NULLIF(ConvFactor, 0), 1) END,
      UnitQty = 1
    WHERE MainQty IS NULL OR UnitQty IS NULL;
  END
  ELSE
  BEGIN
    UPDATE dbo.ProductUnit
    SET MainQty = 1, UnitQty = 1
    WHERE MainQty IS NULL OR UnitQty IS NULL;
  END
END
GO
