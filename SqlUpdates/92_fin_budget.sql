-- 92: Bütçe (Y-17) — yıl bazında muhasebe hesabı ya da malzeme / hizmet kartı için aylık bütçe.
-- Kind: 1 Gider (alış faturaları / hesabın borç bakiyesi) · 2 Gelir (satış faturaları / hesabın alacak bakiyesi)
-- Hedef: AccountCardID (alt hesaplar dahil, gerçekleşen muhasebe fişlerinden) ya da ProductCardID (gerçekleşen faturalardan, KDV hariç)
-- OverAction: 0 yalnız göster · 1 uyar · 2 engelle (aylık bütçe aşılırsa faturada). M1..M12: Ocak..Aralık tutarları.

IF OBJECT_ID(N'dbo.Budget', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Budget (
    BudgetID      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Budget PRIMARY KEY,
    BudgetYear    SMALLINT       NOT NULL,
    Code          NVARCHAR(30)   NULL,
    Title         NVARCHAR(200)  NOT NULL,
    Kind          TINYINT        NOT NULL CONSTRAINT DF_Budget_Kind DEFAULT 1,
    AccountCardID INT            NULL,
    ProductCardID INT            NULL,
    OverAction    TINYINT        NOT NULL CONSTRAINT DF_Budget_OverAction DEFAULT 1,
    IsActive      BIT            NOT NULL CONSTRAINT DF_Budget_IsActive DEFAULT 1,
    Description   NVARCHAR(500)  NULL,
    AuthCode      NVARCHAR(50)   NULL,
    M1  DECIMAL(19,2) NULL, M2  DECIMAL(19,2) NULL, M3  DECIMAL(19,2) NULL, M4  DECIMAL(19,2) NULL,
    M5  DECIMAL(19,2) NULL, M6  DECIMAL(19,2) NULL, M7  DECIMAL(19,2) NULL, M8  DECIMAL(19,2) NULL,
    M9  DECIMAL(19,2) NULL, M10 DECIMAL(19,2) NULL, M11 DECIMAL(19,2) NULL, M12 DECIMAL(19,2) NULL,
    CreatedAt     DATETIME2      NOT NULL CONSTRAINT DF_Budget_CreatedAt DEFAULT SYSDATETIME()
  );
  CREATE INDEX IX_Budget_Year ON dbo.Budget (BudgetYear, IsActive);
END
GO
