-- Kasa fişi (SafeVoucher) fiş numarası şablonu — diğer hareketlerle aynı otomatik numara akışı

IF OBJECT_ID(N'dbo.SYS_NumberTemplate', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'KS-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (
      N'KS-GENEL',
      N'Kasa fişi genel',
      N'SafeVoucherForm',
      N'SafeVoucher',
      0,
      N'KS-{YYYY}{SEQ:6}',
      6,
      10,
      1,
      N'DocumentFormEngine otomatik fiş no'
    );
END
GO
