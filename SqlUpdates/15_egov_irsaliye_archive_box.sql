-- E-Devlet: e-İrsaliye (DocKind=3) + Arşiv kutusu (IsArchived)
-- DocKind: 1 e-Fatura, 2 e-Arşiv, 3 e-İrsaliye
-- Direction: 1 Gelen, 2 Giden
-- IsArchived: 0 aktif kutu, 1 arşiv kutusu (e-Arşiv grubunda kullanılmaz)

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.EGovDocument', N'IsArchived') IS NULL
    ALTER TABLE dbo.EGovDocument ADD IsArchived BIT NOT NULL
      CONSTRAINT DF_EGovDocument_IsArchived DEFAULT (0);
END
GO
