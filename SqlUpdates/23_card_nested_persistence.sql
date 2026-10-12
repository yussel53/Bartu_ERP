-- Kart nested kayıt: eksik kolonlar (CustomerCard / CustomerAdress / CustomerContact / ProductCard)

-- ProductCard: UDF JSON
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'AdditionalFields') IS NULL
    ALTER TABLE dbo.ProductCard ADD AdditionalFields NVARCHAR(MAX) NULL;
END
GO

-- CustomerCard: UDF + cari tür + öndeğer döviz
IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerCard', N'AdditionalFields') IS NULL
    ALTER TABLE dbo.CustomerCard ADD AdditionalFields NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'Type_') IS NULL
    ALTER TABLE dbo.CustomerCard ADD Type_ TINYINT NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'DefaultCurrency') IS NULL
    ALTER TABLE dbo.CustomerCard ADD DefaultCurrency INT NULL;
END
GO

-- CustomerAdress: adres tipi / adı (form alanları)
IF OBJECT_ID(N'dbo.CustomerAdress', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerAdress', N'AdressType') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD AdressType INT NULL;

  IF COL_LENGTH(N'dbo.CustomerAdress', N'Title') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD Title NVARCHAR(100) NULL;
END
GO

-- CustomerContact: formdaki Ad / Telefon / E-posta
IF OBJECT_ID(N'dbo.CustomerContact', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerContact', N'Name') IS NULL
    ALTER TABLE dbo.CustomerContact ADD Name NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.CustomerContact', N'Phone') IS NULL
    ALTER TABLE dbo.CustomerContact ADD Phone NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.CustomerContact', N'Email') IS NULL
    ALTER TABLE dbo.CustomerContact ADD Email NVARCHAR(100) NULL;
END
GO
