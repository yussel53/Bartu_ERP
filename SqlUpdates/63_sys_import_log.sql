-- Excel / CSV içe aktarım geçmişi (ProductCard, CustomerCard, AccountCard)
IF OBJECT_ID(N'dbo.SYS_ImportLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SYS_ImportLog (
        ImportLogID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ImportLog PRIMARY KEY,
        Kind NVARCHAR(30) NOT NULL,
        TableName NVARCHAR(128) NOT NULL,
        FileName NVARCHAR(260) NULL,
        Mode NVARCHAR(20) NULL,
        TotalRows INT NOT NULL CONSTRAINT DF_SYS_ImportLog_Total DEFAULT (0),
        Inserted INT NOT NULL CONSTRAINT DF_SYS_ImportLog_Inserted DEFAULT (0),
        Updated INT NOT NULL CONSTRAINT DF_SYS_ImportLog_Updated DEFAULT (0),
        Skipped INT NOT NULL CONSTRAINT DF_SYS_ImportLog_Skipped DEFAULT (0),
        Failed INT NOT NULL CONSTRAINT DF_SYS_ImportLog_Failed DEFAULT (0),
        ErrorsJson NVARCHAR(MAX) NULL,
        ImportedBy NVARCHAR(100) NULL,
        ImportedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SYS_ImportLog_At DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_ImportLog_Kind' AND object_id = OBJECT_ID(N'dbo.SYS_ImportLog'))
    CREATE INDEX IX_SYS_ImportLog_Kind ON dbo.SYS_ImportLog (Kind, ImportedAt DESC);
GO

-- Kod ile eşleştirme (upsert) hızlı olsun
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProductCard_Code' AND object_id = OBJECT_ID(N'dbo.ProductCard'))
    CREATE INDEX IX_ProductCard_Code ON dbo.ProductCard (Code);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CustomerCard_Code' AND object_id = OBJECT_ID(N'dbo.CustomerCard'))
    CREATE INDEX IX_CustomerCard_Code ON dbo.CustomerCard (Code);
GO
