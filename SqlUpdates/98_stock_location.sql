-- 98: Stok yeri kodları (raf / göz). Malzeme Yönetimi ana kayıt.
-- WhouseID boşsa yer tüm depolar için geçerlidir. Kod depo içinde tektir.

IF OBJECT_ID(N'dbo.StockLocation', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.StockLocation (
    StockLocationID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_StockLocation PRIMARY KEY,
    Code            NVARCHAR(30)   NOT NULL,
    Title           NVARCHAR(200)  NOT NULL,
    WhouseID        INT            NULL,
    IsActive        BIT            NOT NULL CONSTRAINT DF_StockLocation_IsActive DEFAULT 1,
    Description     NVARCHAR(500)  NULL,
    CreatedAt       DATETIME2      NOT NULL CONSTRAINT DF_StockLocation_CreatedAt DEFAULT SYSDATETIME()
  );
  CREATE UNIQUE INDEX UX_StockLocation_Code ON dbo.StockLocation (WhouseID, Code);
END
GO
