-- 46: ProductUnit ölçü bilgileri — her birime ayrı ağırlık / en / boy / yükseklik

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductUnit', N'Weight') IS NULL
    ALTER TABLE dbo.ProductUnit ADD Weight float NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'Length') IS NULL
    ALTER TABLE dbo.ProductUnit ADD Length float NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'Width') IS NULL
    ALTER TABLE dbo.ProductUnit ADD Width float NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'Height') IS NULL
    ALTER TABLE dbo.ProductUnit ADD Height float NULL;
END
GO
