-- 105: E-Devlet — GİB mükellef listesi küçültme
-- Tam GİB listesi (≈5,5 milyon etiket) yerine yalnız carilerin ve firmaların VKN/TCKN'lerine ait etiketler tutulur.
-- Gece senkronu listeyi geçici dosyaya indirip yalnız bu VKN'leri yazar; listede olmayan VKN e-Logo'dan anlık sorgulanır.
-- EFaturaMukellefCheck: VKN'nin en son ne zaman (gece listesi ya da e-Logo) kontrol edildiği — «mükellef değil» kararı buna dayanır.
-- EFaturaMukellef_Import (ara tablo) kaldırılır.
-- Not: Bu betik log dosyasını küçültmez; sonrasında log bir kez elle küçültülmelidir (DBCC SHRINKFILE).

IF OBJECT_ID(N'dbo.EFaturaMukellefCheck', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EFaturaMukellefCheck (
    TaxNr        NVARCHAR(11) NOT NULL CONSTRAINT PK_EFaturaMukellefCheck PRIMARY KEY,
    CheckedAt    DATETIME NOT NULL,
    IsMukellef   BIT NOT NULL,
    -- GibList · ELogo
    Source       NVARCHAR(20) NOT NULL
  );
END
GO

-- Ara tablo hâlâ duruyorsa küçültme yapılmamıştır: carilerin satırları ayrılır, tablo boşaltılıp (TRUNCATE — az log) geri yazılır
IF OBJECT_ID(N'dbo.EFaturaMukellef_Import', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NOT NULL
BEGIN
  DECLARE @tax TABLE (TaxNr NVARCHAR(20) NOT NULL PRIMARY KEY);
  INSERT @tax (TaxNr)
  SELECT DISTINCT t FROM (
    SELECT REPLACE(REPLACE(TaxNr, N' ', N''), N'-', N'') AS t FROM dbo.CustomerCard WHERE TaxNr IS NOT NULL
    UNION SELECT REPLACE(REPLACE(TaxNr, N' ', N''), N'-', N'') FROM dbo.CustomerAdress WHERE TaxNr IS NOT NULL
    UNION SELECT REPLACE(REPLACE(TaxNumber, N' ', N''), N'-', N'') FROM dbo.SYS_Companies WHERE TaxNumber IS NOT NULL
  ) x WHERE LEN(t) IN (10, 11);

  SELECT m.* INTO #keep FROM dbo.EFaturaMukellef m WHERE m.TaxNr IN (SELECT TaxNr FROM @tax);

  TRUNCATE TABLE dbo.EFaturaMukellef;

  SET IDENTITY_INSERT dbo.EFaturaMukellef ON;
  INSERT dbo.EFaturaMukellef (EFaturaMukellefID, TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive, CreatedAt)
  SELECT EFaturaMukellefID, TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive, CreatedAt FROM #keep;
  SET IDENTITY_INSERT dbo.EFaturaMukellef OFF;

  -- Son başarılı tam senkron, carilerin VKN'leri için kontrol sayılır (yoksa VKN'ler ilk kullanımda e-Logo'dan sorgulanır)
  DECLARE @lastOk DATETIME = NULL;
  IF OBJECT_ID(N'dbo.SYS_EFaturaMukellefSync', N'U') IS NOT NULL
    SELECT @lastOk = MAX(FinishedAt) FROM dbo.SYS_EFaturaMukellefSync WHERE Status = N'Ok';
  IF @lastOk IS NOT NULL
    INSERT dbo.EFaturaMukellefCheck (TaxNr, CheckedAt, IsMukellef, Source)
    SELECT t.TaxNr, @lastOk,
           CASE WHEN EXISTS (SELECT 1 FROM #keep k WHERE k.TaxNr = t.TaxNr AND k.IsActive = 1) THEN 1 ELSE 0 END, N'GibList'
    FROM @tax t
    WHERE LEN(t.TaxNr) <= 11 AND NOT EXISTS (SELECT 1 FROM dbo.EFaturaMukellefCheck c WHERE c.TaxNr = t.TaxNr);

  DROP TABLE #keep;
  DROP TABLE dbo.EFaturaMukellef_Import;
END
GO

-- TaxNr dizini UX_EFaturaMukellef_TaxNr_Alias ile örtüşüyor; küçük tabloda gereksiz
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EFaturaMukellef_TaxNr' AND object_id = OBJECT_ID(N'dbo.EFaturaMukellef'))
  DROP INDEX IX_EFaturaMukellef_TaxNr ON dbo.EFaturaMukellef;
GO
