-- 72: Müşteri / Cari ayrımı + CRM teklif → sipariş bağlantısı
-- CustomerCard.CardKind: 1 = Müşteri (aday, henüz cari değil) · 2 = Cari
--   Cari aynı zamanda müşteridir; müşteri ise satış yapılınca ya da
--   «Cariye Dönüştür» ile cari olur. Bilgiler aynı tabloda tutulur.
--   (Type_ = Alıcı / Satıcı ayrımı olarak kalır.)
-- CRM_Offer.OrderVoucherID: tekliften oluşturulan satış siparişi

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CustomerCard', N'CardKind') IS NULL
BEGIN
  ALTER TABLE dbo.CustomerCard ADD CardKind TINYINT NOT NULL
    CONSTRAINT DF_CustomerCard_CardKind DEFAULT (2) WITH VALUES;
END
GO

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CustomerCard', N'CardKindChangedAt') IS NULL
BEGIN
  ALTER TABLE dbo.CustomerCard ADD CardKindChangedAt DATETIME2 NULL;
END
GO

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = N'IX_CustomerCard_CardKind' AND object_id = OBJECT_ID(N'dbo.CustomerCard')
   )
BEGIN
  CREATE NONCLUSTERED INDEX IX_CustomerCard_CardKind ON dbo.CustomerCard (CardKind);
END
GO

IF OBJECT_ID(N'dbo.CRM_Offer', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.CRM_Offer', N'OrderVoucherID') IS NULL
BEGIN
  ALTER TABLE dbo.CRM_Offer ADD OrderVoucherID INT NULL;
END
GO
