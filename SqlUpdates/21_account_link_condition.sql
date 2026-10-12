-- AccountLinkDetail: fiş türü/koşul açıklaması (Muhasebe Bağlantıları ekranı)

IF OBJECT_ID(N'dbo.AccountLinkDetail', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AccountLinkDetail', N'ConditionTitle') IS NULL
    ALTER TABLE dbo.AccountLinkDetail ADD ConditionTitle NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.AccountLinkDetail', N'ConditionJson') IS NULL
    ALTER TABLE dbo.AccountLinkDetail ADD ConditionJson NVARCHAR(MAX) NULL;
END
GO
