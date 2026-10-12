-- Cari adres: e-Fatura posta kutusu etiketleri (Gelen / Giden)

IF OBJECT_ID(N'dbo.CustomerAdress', N'U') IS NOT NULL
BEGIN
  -- Gelen posta kutusu (PK — alıcı)
  IF COL_LENGTH(N'dbo.CustomerAdress', N'PostLabel') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD PostLabel NVARCHAR(150) NULL;

  -- Giden birim etiketi (GB — gönderici)
  IF COL_LENGTH(N'dbo.CustomerAdress', N'SenderLabel') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD SenderLabel NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.CustomerAdress', N'EinvoiceEmailAdress') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD EinvoiceEmailAdress NVARCHAR(100) NULL;
END
GO
