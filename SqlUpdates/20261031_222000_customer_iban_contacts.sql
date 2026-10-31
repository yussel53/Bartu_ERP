-- Cari: N IBAN hesabı (CustomerIban) + iletişim tipi netleştirme
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.CustomerIban', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomerIban (
    CustomerIbanID INT IDENTITY(1, 1) NOT NULL,
    CustomerCardID INT NOT NULL,
    BankName NVARCHAR(120) NULL,
    IbanNO NVARCHAR(34) NULL,
    AccountNO NVARCHAR(40) NULL,
    Currency INT NULL,
    IsDefault BIT NOT NULL
      CONSTRAINT DF_CustomerIban_IsDefault DEFAULT (0),
    IsActive BIT NOT NULL
      CONSTRAINT DF_CustomerIban_IsActive DEFAULT (1),
    Description NVARCHAR(200) NULL,
    CONSTRAINT PK_CustomerIban PRIMARY KEY CLUSTERED (CustomerIbanID ASC)
  );
END
GO

IF OBJECT_ID(N'dbo.CustomerIban', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerIban_CustomerCardID'
      AND object_id = OBJECT_ID(N'dbo.CustomerIban')
  )
    CREATE NONCLUSTERED INDEX IX_CustomerIban_CustomerCardID
      ON dbo.CustomerIban (CustomerCardID);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerIban_IbanNO'
      AND object_id = OBJECT_ID(N'dbo.CustomerIban')
  )
    CREATE NONCLUSTERED INDEX IX_CustomerIban_IbanNO
      ON dbo.CustomerIban (IbanNO)
      WHERE IbanNO IS NOT NULL;
END
GO

-- İletişim satırında tip yoksa ekle (1 Telefon · 2 E-posta · 3 Fax · 4 Diğer)
IF OBJECT_ID(N'dbo.CustomerContact', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerContact', N'ContactType') IS NULL
  ALTER TABLE dbo.CustomerContact ADD ContactType TINYINT NULL;
GO
