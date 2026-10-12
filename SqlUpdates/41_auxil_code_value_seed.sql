-- 41: Özel kod değer seed (mevcut MARKA / DOGUM tanımları için)

-- MARKA başlığını netleştir
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.AuxilCodes WHERE Code = N'MARKA')
BEGIN
  UPDATE dbo.AuxilCodes
  SET Title = N'Kullanıldığı Marka',
      TargetTable = ISNULL(NULLIF(TargetTable, N''), N'ProductCard'),
      ModuleNr = ISNULL(ModuleNr, 1)
  WHERE Code = N'MARKA';
END
GO

-- MARKA kod/açıklama değerleri yoksa ekle
IF OBJECT_ID(N'dbo.AuxilCodeValue', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
BEGIN
  DECLARE @markaId int = (SELECT TOP 1 AuxilCodesID FROM dbo.AuxilCodes WHERE Code = N'MARKA');
  IF @markaId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.AuxilCodeValue WHERE AuxilCodesID = @markaId)
  BEGIN
    INSERT INTO dbo.AuxilCodeValue (AuxilCodesID, ValueKind, Code, Title, SortOrder, IsActive)
    VALUES
      (@markaId, 1, N'MERCEDES', N'Mercedes', 10, 1),
      (@markaId, 1, N'BMW',      N'BMW',      20, 1),
      (@markaId, 1, N'AUDI',     N'Audi',     30, 1),
      (@markaId, 2, N'OEM',      N'Orijinal parça', 10, 1),
      (@markaId, 2, N'AFTER',    N'Aftermarket',    20, 1);
  END
END
GO

-- DOGUM: tarihli tanım yoksa
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.AuxilCodes WHERE Code = N'DOGUM')
BEGIN
  DECLARE @cid int = ISNULL((SELECT MAX(AuxilCodesID) FROM dbo.AuxilCodes), 0) + 1;
  INSERT INTO dbo.AuxilCodes (AuxilCodesID, Code, Title, TargetTable, SlotNo, ModuleNr, IsActive, HasDate)
  VALUES (@cid, N'DOGUM', N'Doğum Tarihi', N'CustomerCard', 20, 2, 1, 1);
END
ELSE IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.AuxilCodes SET HasDate = 1, Title = N'Doğum Tarihi', TargetTable = N'CustomerCard'
  WHERE Code = N'DOGUM';
END
GO
