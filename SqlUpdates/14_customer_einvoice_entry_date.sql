-- Cari kart: e-Faturaya geçiş tarihi (Create_DB: CustomerEinvoiceDetail.EinvoiceEntryDate)

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerCard', N'EinvoiceEntryDate') IS NULL
    ALTER TABLE dbo.CustomerCard ADD EinvoiceEntryDate DATETIME NULL;
END
GO
