-- 77: Malzeme barkodu benzersizdir (aynı barkod ikinci kez kullanılamaz) + birim barkodu (miktar gömülü)
-- Type: 1 EAN-13 · 2 İç Kod · 3 QR · 4 Code128 · 5 Birim Barkodu
-- Birim barkodu (Type 5): Barcode = örnek tam barkod (ör. 27000000500); son QtyDigits hane miktardır
--   (27000000|500 → 500). QtyDivisor: okunan sayı / bölen (1 adet · 1000 gram→kg). HasCheckDigit: sonda
--   EAN kontrol hanesi varsa miktar ondan önceki hanelerdir.
-- Benzersizlik veritabanında TR_ProductBarcode_Unique tetikleyicisiyle sağlanır (boş olmayan barkodlar).
--   Filtreli benzersiz indeks KULLANILMAZ: QUOTED_IDENTIFIER kapalı bağlanan araçlar (sqlcmd, eski
--   entegrasyonlar) tabloya hiç yazamaz hale gelirdi. Tetikleyici her bağlantı ayarında çalışır.
-- Kayıt ucu (RecordsController) tekrarı önceden, hangi malzemede kullanıldığını söyleyerek reddeder.

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductBarcode', N'QtyDigits') IS NULL
    ALTER TABLE dbo.ProductBarcode ADD QtyDigits TINYINT NULL;
  IF COL_LENGTH(N'dbo.ProductBarcode', N'QtyDivisor') IS NULL
    ALTER TABLE dbo.ProductBarcode ADD QtyDivisor INT NULL;
  IF COL_LENGTH(N'dbo.ProductBarcode', N'HasCheckDigit') IS NULL
    ALTER TABLE dbo.ProductBarcode ADD HasCheckDigit BIT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
BEGIN
  -- Baştaki / sondaki boşluklar benzersizliği bozmasın
  UPDATE dbo.ProductBarcode SET Barcode = LTRIM(RTRIM(Barcode))
  WHERE Barcode IS NOT NULL AND Barcode <> LTRIM(RTRIM(Barcode));

  -- Önceki deneme sürümündeki filtreli indeks (varsa) kaldırılır
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_ProductBarcode_Barcode' AND object_id = OBJECT_ID(N'dbo.ProductBarcode'))
    DROP INDEX UX_ProductBarcode_Barcode ON dbo.ProductBarcode;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProductBarcode_Barcode' AND object_id = OBJECT_ID(N'dbo.ProductBarcode'))
    CREATE NONCLUSTERED INDEX IX_ProductBarcode_Barcode ON dbo.ProductBarcode (Barcode);
END
GO

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
  EXEC (N'
CREATE OR ALTER TRIGGER dbo.TR_ProductBarcode_Unique
ON dbo.ProductBarcode
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM inserted WHERE Barcode IS NOT NULL AND LTRIM(RTRIM(Barcode)) <> N'''') RETURN;

  DECLARE @dup NVARCHAR(200) = (
    SELECT TOP 1 LTRIM(RTRIM(b.Barcode))
    FROM dbo.ProductBarcode b
    WHERE LTRIM(RTRIM(b.Barcode)) IN (
      SELECT LTRIM(RTRIM(i.Barcode)) FROM inserted i
      WHERE i.Barcode IS NOT NULL AND LTRIM(RTRIM(i.Barcode)) <> N''''
    )
    GROUP BY LTRIM(RTRIM(b.Barcode))
    HAVING COUNT(1) > 1
  );
  IF @dup IS NOT NULL
  BEGIN
    DECLARE @msg NVARCHAR(400) = N''Barkod benzersiz olmalı: '' + @dup + N'' başka bir malzemede zaten kayıtlı.'';
    THROW 51077, @msg, 1;
  END
END');
GO
