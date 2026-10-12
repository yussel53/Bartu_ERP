-- 49: Fiş DocumentNumber kolonları + malzeme / ödeme / çek-senet numara şablonları

IF OBJECT_ID(N'dbo.PaymentTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.PaymentTrans', N'DocumentNumber') IS NULL
  ALTER TABLE dbo.PaymentTrans ADD DocumentNumber nvarchar(50) NULL;
GO

IF OBJECT_ID(N'dbo.BoundTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.BoundTrans', N'DocumentNumber') IS NULL
  ALTER TABLE dbo.BoundTrans ADD DocumentNumber nvarchar(50) NULL;
GO

IF OBJECT_ID(N'dbo.SYS_NumberTemplate', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'MAT-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (N'MAT-GENEL', N'Malzeme fişi genel', N'MaterialVoucherForm', N'ProductVoucher', 0, N'MAT-{YYYY}{SEQ:6}', 6, 15, 1,
            N'Malzeme Yönetimi stok fişleri');

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'YUK-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (N'YUK-GENEL', N'Yükleme fişi', N'MaterialLoadingForm', N'ProductVoucher', 0, N'YUK-{YYYY}{SEQ:6}', 6, 16, 1, NULL);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'OT-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (N'OT-GENEL', N'Ödeme / tahsilat genel', N'PaymentTransForm', N'PaymentTrans', 0, N'OT-{YYYY}{SEQ:6}', 6, 10, 1, NULL);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'CS-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (N'CS-GENEL', N'Çek / senet fişi genel', N'BoundTransForm', N'BoundTrans', 0, N'CS-{YYYY}{SEQ:6}', 6, 10, 1, NULL);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'ML-GENEL')
    INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
    VALUES (N'ML-GENEL', N'Maliyetlendirme', N'MaterialCostingForm', N'ProductTransCostCalc', 0, N'ML-{YYYY}{SEQ:6}', 6, 10, 1, NULL);
END
GO
