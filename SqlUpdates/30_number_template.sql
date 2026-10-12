-- 30: Fiş numaralama şablonları (kullanıcı / firma / işyeri / ambar kapsamı)

IF OBJECT_ID(N'dbo.SYS_NumberTemplate', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_NumberTemplate (
    TemplateId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_NumberTemplate PRIMARY KEY,
    Code         NVARCHAR(40)  NOT NULL,
    Title        NVARCHAR(150) NOT NULL,
    -- Boş = tüm formlar; örn. SalesInvoiceForm
    FormCode     NVARCHAR(80)  NULL,
    -- Boş = FormCode ile eşleşen; örn. Invoice, OrderVoucher, ProductVoucher
    TableName    NVARCHAR(80)  NULL,
    -- 0 Genel, 1 Firma, 2 İşyeri, 3 Ambar, 4 Kullanıcı
    ScopeType    TINYINT NOT NULL CONSTRAINT DF_SYS_NumberTemplate_Scope DEFAULT (0),
    -- Örn: {CO}-{WP}-{YYYY}{SEQ:6}  |  {USR}-{SEQ:8}  |  INV-{YY}{MM}-{SEQ:5}
    Pattern      NVARCHAR(120) NOT NULL,
    SeqPad       INT NOT NULL CONSTRAINT DF_SYS_NumberTemplate_Pad DEFAULT (6),
    Priority     INT NOT NULL CONSTRAINT DF_SYS_NumberTemplate_Pri DEFAULT (10),
    IsActive     BIT NOT NULL CONSTRAINT DF_SYS_NumberTemplate_Active DEFAULT (1),
    Notes        NVARCHAR(300) NULL,
    CONSTRAINT UQ_SYS_NumberTemplate_Code UNIQUE (Code)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_NumberCounter', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_NumberCounter (
    CounterId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_NumberCounter PRIMARY KEY,
    TemplateId   INT NOT NULL,
    -- FirmaId / WorkplaceId / WhouseId / UserId / boş (genel)
    ScopeKey     NVARCHAR(80) NOT NULL CONSTRAINT DF_SYS_NumberCounter_Scope DEFAULT (N''),
    -- YYYY veya YYYYMM (şablonda yıl/ay varsa); boş = dönem yok
    PeriodKey    NVARCHAR(20) NOT NULL CONSTRAINT DF_SYS_NumberCounter_Period DEFAULT (N''),
    LastValue    BIGINT NOT NULL CONSTRAINT DF_SYS_NumberCounter_Last DEFAULT (0),
    UpdatedAt    DATETIME NOT NULL CONSTRAINT DF_SYS_NumberCounter_Upd DEFAULT (GETDATE()),
    CONSTRAINT FK_SYS_NumberCounter_Tpl FOREIGN KEY (TemplateId)
      REFERENCES dbo.SYS_NumberTemplate (TemplateId)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SYS_NumberCounter_TplScope' AND object_id = OBJECT_ID(N'dbo.SYS_NumberCounter')
)
  CREATE UNIQUE NONCLUSTERED INDEX IX_SYS_NumberCounter_TplScope
    ON dbo.SYS_NumberCounter (TemplateId, ScopeKey, PeriodKey);
GO

-- Örnek şablonlar
IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'INV-GENEL')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'INV-GENEL', N'Fatura genel', NULL, N'Invoice', 0, N'INV-{YYYY}{SEQ:6}', 6, 10, 1,
          N'{YYYY} yıl, {SEQ:6} sıfır dolgulu sıra');

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'SIP-GENEL')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'SIP-GENEL', N'Sipariş genel', NULL, N'OrderVoucher', 0, N'SIP-{YYYY}{SEQ:6}', 6, 10, 1, NULL);

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'IRS-FIRMA')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'IRS-FIRMA', N'İrsaliye firma bazlı', NULL, N'ProductVoucher', 1, N'{CO}-IR-{YYYY}{SEQ:5}', 5, 20, 1,
          N'ScopeType=1 Firma · {CO} firma kodu');

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'IRS-ISYERI')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'IRS-ISYERI', N'İrsaliye işyeri bazlı', N'SalesDispatchForm', N'ProductVoucher', 2, N'{CO}{WP}-{YY}{MM}{SEQ:4}', 4, 30, 1,
          N'ScopeType=2 İşyeri');

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'FAT-KULLANICI')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'FAT-KULLANICI', N'Satış faturası kullanıcı bazlı', N'SalesInvoiceForm', N'Invoice', 4, N'{USR}-{SEQ:6}', 6, 40, 1,
          N'ScopeType=4 Kullanıcı · {USR} kullanıcı adı');

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'CV-GENEL')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'CV-GENEL', N'Cari fiş genel', NULL, N'CustomerVoucher', 0, N'CV-{YYYY}{SEQ:6}', 6, 10, 1, NULL);

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_NumberTemplate WHERE Code = N'BV-GENEL')
  INSERT INTO dbo.SYS_NumberTemplate (Code, Title, FormCode, TableName, ScopeType, Pattern, SeqPad, Priority, IsActive, Notes)
  VALUES (N'BV-GENEL', N'Banka fiş genel', NULL, N'BankVoucher', 0, N'BV-{YYYY}{SEQ:6}', 6, 10, 1, NULL);
GO
