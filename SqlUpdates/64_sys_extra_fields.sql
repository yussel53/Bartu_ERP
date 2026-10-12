-- Ek Alanlar: U_ kolonu tanımları (AdditionalFields JSON yerine gerçek kolon)
IF OBJECT_ID(N'dbo.SYS_ExtraFields', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SYS_ExtraFields (
        ExtraFieldID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ExtraFields PRIMARY KEY,
        TableName NVARCHAR(128) NOT NULL,          -- ProductCard, ProductTrans, Invoice, ...
        FieldName NVARCHAR(128) NOT NULL,          -- U_Marka
        Label NVARCHAR(150) NOT NULL,
        DataType NVARCHAR(20) NOT NULL,            -- text | date | float
        TextLength INT NULL,                       -- text için NVARCHAR uzunluğu
        FormulaText NVARCHAR(1000) NULL,           -- doluysa alan hesaplanır, elle girilmez
        IsRequired BIT NOT NULL CONSTRAINT DF_SYS_ExtraFields_Req DEFAULT (0),
        ColSpan INT NOT NULL CONSTRAINT DF_SYS_ExtraFields_Span DEFAULT (6),
        OrderIndex INT NOT NULL CONSTRAINT DF_SYS_ExtraFields_Order DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_SYS_ExtraFields_Active DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SYS_ExtraFields_At DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(100) NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_SYS_ExtraFields_Table_Field' AND object_id = OBJECT_ID(N'dbo.SYS_ExtraFields'))
    CREATE UNIQUE INDEX UX_SYS_ExtraFields_Table_Field ON dbo.SYS_ExtraFields (TableName, FieldName);
GO
