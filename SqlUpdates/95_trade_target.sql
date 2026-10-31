-- 95: Alım / satış hedeflemesi. Direction 1 satış, 2 alım.
-- M1..M12 aylık hedef tutar, Q1..Q12 aylık hedef miktar. Cari ve malzeme boşsa genel hedef.

IF OBJECT_ID(N'dbo.TradeTarget', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TradeTarget (
    TradeTargetID  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TradeTarget PRIMARY KEY,
    Direction      TINYINT        NOT NULL,
    TargetYear     SMALLINT       NOT NULL,
    Code           NVARCHAR(30)   NULL,
    Title          NVARCHAR(200)  NOT NULL,
    CustomerCardID INT            NULL,
    ProductCardID  INT            NULL,
    IsActive       BIT            NOT NULL CONSTRAINT DF_TradeTarget_IsActive DEFAULT 1,
    Description    NVARCHAR(500)  NULL,
    M1  DECIMAL(19,2) NULL, M2  DECIMAL(19,2) NULL, M3  DECIMAL(19,2) NULL, M4  DECIMAL(19,2) NULL,
    M5  DECIMAL(19,2) NULL, M6  DECIMAL(19,2) NULL, M7  DECIMAL(19,2) NULL, M8  DECIMAL(19,2) NULL,
    M9  DECIMAL(19,2) NULL, M10 DECIMAL(19,2) NULL, M11 DECIMAL(19,2) NULL, M12 DECIMAL(19,2) NULL,
    Q1  DECIMAL(19,4) NULL, Q2  DECIMAL(19,4) NULL, Q3  DECIMAL(19,4) NULL, Q4  DECIMAL(19,4) NULL,
    Q5  DECIMAL(19,4) NULL, Q6  DECIMAL(19,4) NULL, Q7  DECIMAL(19,4) NULL, Q8  DECIMAL(19,4) NULL,
    Q9  DECIMAL(19,4) NULL, Q10 DECIMAL(19,4) NULL, Q11 DECIMAL(19,4) NULL, Q12 DECIMAL(19,4) NULL,
    CreatedAt      DATETIME2      NOT NULL CONSTRAINT DF_TradeTarget_CreatedAt DEFAULT SYSDATETIME()
  );
  CREATE INDEX IX_TradeTarget_Year ON dbo.TradeTarget (Direction, TargetYear, IsActive);
END
GO
