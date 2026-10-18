-- 81: Stok parametreleri — eksi stok kontrolü ve maliyet yöntemi (Setting, ModuleKey = 'malzeme')
-- STK_NEG_CTRL: 0 izin ver · 1 uyar (kayıt yapılır, mesajda uyarı) · 2 engelle
-- STK_COST_SCOPE: ağırlıklı ortalama maliyet 0 firma geneli · 1 ambar bazında
-- Ağırlıklı ortalama maliyet ProductTransCostCalc'a yazılır (Type = 1, MtransID = ProductTransID, Amount = satır toplam maliyeti).

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(50), Value nvarchar(50), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'STK_NEG_CTRL', N'Eksi Stok Kontrolü (0/1/2)', N'0', N'malzeme'),
    (N'STK_COST_SCOPE', N'Maliyet Kapsamı (0 firma/1 ambar)', N'0', N'malzeme');

  DECLARE @code nvarchar(50), @title nvarchar(50), @val nvarchar(50), @mod nvarchar(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Code, Title, Value, ModuleKey FROM @seed;
  OPEN c;
  FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Setting WHERE Code = @code)
    BEGIN
      DECLARE @nextId int = ISNULL((SELECT MAX(SettingID) FROM dbo.Setting), 0) + 1;
      IF COL_LENGTH(N'dbo.Setting', N'ModuleKey') IS NOT NULL
        EXEC sp_executesql N'INSERT INTO dbo.Setting (SettingID, Code, Title, Value, ModuleKey) VALUES (@id, @c, @t, @v, @m)',
          N'@id int, @c nvarchar(50), @t nvarchar(50), @v nvarchar(50), @m nvarchar(20)', @nextId, @code, @title, @val, @mod;
      ELSE
        INSERT INTO dbo.Setting (SettingID, Code, Title, Value) VALUES (@nextId, @code, @title, @val);
    END
    FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  END
  CLOSE c;
  DEALLOCATE c;
END
GO

IF OBJECT_ID(N'dbo.ProductTransCostCalc', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProductTransCostCalc_Mtrans' AND object_id = OBJECT_ID(N'dbo.ProductTransCostCalc'))
  CREATE INDEX IX_ProductTransCostCalc_Mtrans ON dbo.ProductTransCostCalc (MtransID, Type);
GO
