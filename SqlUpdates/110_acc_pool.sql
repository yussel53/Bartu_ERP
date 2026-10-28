-- 110: Muhasebe havuzu (SYS_AccPool) + otomatik mahsup parametreleri
-- Kayıt sonrası muhasebe kodları havuza yazılır; ACC_AUTO_POST=1 ise hemen fişleşir, 0 ise havuzdan elle/seçerek.

IF OBJECT_ID(N'dbo.SYS_AccPool', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_AccPool (
    AccPoolID       int            NOT NULL,
    SourceModule    int            NOT NULL,  -- 7 Fatura, 4 Kasa
    SourceID        int            NOT NULL,
    SourceType      int            NULL,      -- InvoiceType / SafeVoucher.Type_
    DocumentDate    date           NULL,
    DocumentNumber  nvarchar(50)   NULL,
    Description     nvarchar(250)  NULL,
    CompanyID       int            NULL,
    DepartmentID    int            NULL,
    CustomerID      int            NULL,
    CustomerTitle   nvarchar(200)  NULL,
    Currency        int            NULL,
    CurrencyRate    float          NULL,
    AuthCode        nvarchar(20)   NULL,
    VoucherType     int            NOT NULL CONSTRAINT DF_SYS_AccPool_VoucherType DEFAULT (1),
    SumDebit        decimal(18, 2) NOT NULL CONSTRAINT DF_SYS_AccPool_SumDebit DEFAULT (0),
    SumCredit       decimal(18, 2) NOT NULL CONSTRAINT DF_SYS_AccPool_SumCredit DEFAULT (0),
    Status_         tinyint        NOT NULL CONSTRAINT DF_SYS_AccPool_Status DEFAULT (0), -- 0 bekliyor, 1 muhasebeleşti, 2 eksik/hata, 3 iptal
    AccountVoucherID int           NULL,
    ErrorMessage    nvarchar(500)  NULL,
    CreatedAt       datetime2      NOT NULL CONSTRAINT DF_SYS_AccPool_CreatedAt DEFAULT (SYSUTCDATETIME()),
    PostedAt        datetime2      NULL,
    CONSTRAINT PK_SYS_AccPool PRIMARY KEY (AccPoolID)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_AccPool', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_AccPool_Source' AND object_id = OBJECT_ID(N'dbo.SYS_AccPool'))
BEGIN
  CREATE INDEX IX_SYS_AccPool_Source ON dbo.SYS_AccPool (SourceModule, SourceID, Status_);
END
GO

IF OBJECT_ID(N'dbo.SYS_AccPool', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_AccPool_StatusDate' AND object_id = OBJECT_ID(N'dbo.SYS_AccPool'))
BEGIN
  CREATE INDEX IX_SYS_AccPool_StatusDate ON dbo.SYS_AccPool (Status_, DocumentDate);
END
GO

IF OBJECT_ID(N'dbo.SYS_AccPoolLine', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_AccPoolLine (
    AccPoolLineID   int            NOT NULL,
    AccPoolID       int            NOT NULL,
    [LineNo]        int            NOT NULL,
    AccountCardID   int            NULL,
    AccountCode     nvarchar(50)   NULL,
    AccountTitle    nvarchar(150)  NULL,
    Description     nvarchar(250)  NULL,
    Debit           decimal(18, 2) NOT NULL CONSTRAINT DF_SYS_AccPoolLine_Debit DEFAULT (0),
    Credit          decimal(18, 2) NOT NULL CONSTRAINT DF_SYS_AccPoolLine_Credit DEFAULT (0),
    LinkHint        nvarchar(120)  NULL, -- eksik bağlantı açıklaması
    CONSTRAINT PK_SYS_AccPoolLine PRIMARY KEY (AccPoolLineID)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_AccPoolLine', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_AccPoolLine_Pool' AND object_id = OBJECT_ID(N'dbo.SYS_AccPoolLine'))
BEGIN
  CREATE INDEX IX_SYS_AccPoolLine_Pool ON dbo.SYS_AccPoolLine (AccPoolID, [LineNo]);
END
GO

-- Parametreler (ModuleKey = muhasebe)
IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(100), Value nvarchar(100), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'ACC_AUTO_POST', N'Kayıt sonrası otomatik muhasebeleştir', N'0', N'muhasebe'),
    (N'ACC_POOL_INVOICE', N'Havuza: Faturalar', N'1', N'muhasebe'),
    (N'ACC_POOL_SAFE', N'Havuza: Kasa fişleri', N'1', N'muhasebe'),
    (N'ACC_INV_TYPES', N'Havuza fatura türleri (* veya 1,2,..)', N'*', N'muhasebe'),
    (N'ACC_SAFE_TYPES', N'Havuza kasa türleri (* veya 1,2,..)', N'*', N'muhasebe');

  DECLARE @code nvarchar(50), @title nvarchar(100), @val nvarchar(100), @mod nvarchar(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Code, Title, Value, ModuleKey FROM @seed;
  OPEN c;
  FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Setting WHERE Code = @code)
    BEGIN
      DECLARE @nextId int = ISNULL((SELECT MAX(SettingID) FROM dbo.Setting), 0) + 1;
      INSERT INTO dbo.Setting (SettingID, Code, Title, Value, ModuleKey)
      VALUES (@nextId, @code, @title, @val, @mod);
    END
    ELSE
    BEGIN
      UPDATE dbo.Setting
      SET Title = @title,
          ModuleKey = ISNULL(ModuleKey, @mod)
      WHERE Code = @code;
    END
    FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  END
  CLOSE c;
  DEALLOCATE c;
END
GO
