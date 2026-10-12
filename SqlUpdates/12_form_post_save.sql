-- Form kaydet sonrası komutlar (SQL / API)

IF OBJECT_ID(N'dbo.SYS_FormPostSave', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_FormPostSave (
    FormPostSaveID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_FormPostSave PRIMARY KEY,
    FormCode       NVARCHAR(80) NOT NULL,
    Title          NVARCHAR(150) NULL,
    ActionOrder    INT NOT NULL CONSTRAINT DF_SYS_FormPostSave_Ord DEFAULT (10),
    -- sql | api
    ActionType     NVARCHAR(10) NOT NULL CONSTRAINT DF_SYS_FormPostSave_Type DEFAULT (N'sql'),
    -- Örn: UPDATE Invoice SET Status_ = 1 WHERE InvoiceID = {recId}
    -- Örn: POST http://localhost:5205/api/...  veya GET /api/...
    CommandText    NVARCHAR(MAX) NOT NULL,
    IsActive       BIT NOT NULL CONSTRAINT DF_SYS_FormPostSave_Active DEFAULT (1),
    Notes          NVARCHAR(300) NULL
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_FormPostSave_Form' AND object_id = OBJECT_ID(N'dbo.SYS_FormPostSave')
)
  CREATE NONCLUSTERED INDEX IX_SYS_FormPostSave_Form
    ON dbo.SYS_FormPostSave (FormCode, IsActive, ActionOrder);
GO

-- Örnek: Satış faturası kaydından sonra durumu onaylı yap (isteğe bağlı — yorum satırı)
-- INSERT örneklerini UI/formSchemas da tanımlayabilirsiniz.
IF NOT EXISTS (
  SELECT 1 FROM dbo.SYS_FormPostSave WHERE FormCode = N'SalesInvoiceForm' AND Title = N'Örnek durum'
)
BEGIN
  INSERT INTO dbo.SYS_FormPostSave (FormCode, Title, ActionOrder, ActionType, CommandText, IsActive, Notes)
  VALUES (
    N'SalesInvoiceForm',
    N'Örnek durum',
    10,
    N'sql',
    N'UPDATE dbo.Invoice SET Status_ = 1 WHERE InvoiceID = {recId}',
    0, -- varsayılan kapalı; açmak için IsActive=1
    N'Placeholder: {recId}, {InvoiceID}, {CustomerID}, {Status_} …'
  );
END
GO
