-- Sıralama / bozuk encoding tablosunu ASCII Siralama adına taşı
-- Create_DB CP1254 "Sıralama" UTF-8 ile okununca bozuk isim oluşabiliyordu

IF OBJECT_ID(N'dbo.Siralama', N'U') IS NULL
BEGIN
  DECLARE @src SYSNAME = NULL;

  IF OBJECT_ID(N'dbo.Sıralama', N'U') IS NOT NULL
    SET @src = N'Sıralama';
  ELSE
    SELECT TOP (1) @src = t.name
    FROM sys.tables t
    WHERE t.schema_id = SCHEMA_ID(N'dbo')
      AND t.name LIKE N'S%ralama'
      AND t.name <> N'Siralama';

  IF @src IS NOT NULL
  BEGIN
    DECLARE @qualified NVARCHAR(258) = QUOTENAME(N'dbo') + N'.' + QUOTENAME(@src);
    EXEC sys.sp_rename @objname = @qualified, @newname = N'Siralama', @objtype = N'OBJECT';
  END
END
GO
