-- 48: Muhasebe fişi (AccountVoucher) kayıt numarası şablonları

IF OBJECT_ID(N'dbo.SYS_NumberTemplate', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'MH-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (
      N'MH-GENEL',
      N'Muhasebe fişi genel',
      N'AccountVoucherForm',
      N'AccountVoucher',
      0,
      N'MH-{YYYY}{SEQ:6}',
      6,
      10,
      1,
      N'Mahsup / tahsil / tediye — DocumentNumber'
    );

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'MH-FIRMA')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (
      N'MH-FIRMA',
      N'Muhasebe fişi firma bazlı',
      N'AccountVoucherForm',
      N'AccountVoucher',
      1,
      N'{CO}-MH-{YYYY}{SEQ:5}',
      5,
      20,
      1,
      N'ScopeType=1 Firma · {CO} firma kodu'
    );
END
GO
