-- SQL Raporlama Tools (Raporlama / Nova Service modelinden)
-- SYS_SqlReport: sorgu şablonları, filtreler, grafik/KPI JSON

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_SqlReport (
    Id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReport PRIMARY KEY,
    Name              NVARCHAR(150) NOT NULL,
    ReportGroup       NVARCHAR(100) NOT NULL CONSTRAINT DF_SYS_SqlReport_Group DEFAULT (N'Genel'),
    Description       NVARCHAR(500) NULL,
    QueryTemplate     NVARCHAR(MAX) NOT NULL,
    PreQueryTemplate  NVARCHAR(MAX) NULL,
    FiltersConfig     NVARCHAR(MAX) NULL,  -- JSON: [{var_name,label,type,default_val}]
    ChartConfig       NVARCHAR(MAX) NULL,  -- JSON
    KpiConfig         NVARCHAR(MAX) NULL,  -- JSON
    ColumnFormats     NVARCHAR(MAX) NULL,  -- JSON
    AllowExport       BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_AllowExport DEFAULT (1),
    IsActive          BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_IsActive DEFAULT (1),
    CreatedAt         DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReport_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt         DATETIME2 NULL,
    CreatedBy         NVARCHAR(100) NULL
  );
  CREATE INDEX IX_SYS_SqlReport_Group ON dbo.SYS_SqlReport (ReportGroup, Name);
END
GO

-- Örnek raporlar (placeholder: {start_date}, {end_date}, {search_query})
IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE Name = N'Cari Kart Listesi')
BEGIN
  INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, CreatedBy)
  VALUES (
    N'Cari Kart Listesi',
    N'Finans',
    N'Cari kartlar — {search_query} ile kod/ünvan filtresi',
    N'SELECT TOP 5000
  c.CustomerCardID AS [Id],
  c.Code AS [Kod],
  c.Title AS [Unvan],
  c.TaxNr AS [VergiNo],
  c.Active AS [Aktif]
FROM dbo.CustomerCard c
WHERE (N''{search_query}'' = N'''' OR c.Code LIKE N''%{search_query}%'' OR c.Title LIKE N''%{search_query}%'')
ORDER BY c.Code',
    N'[{"var_name":"search_query","label":"Ara (kod/ünvan)","type":"text","default_val":""}]',
    N'seed'
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE Name = N'Malzeme Kart Listesi')
BEGIN
  INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, CreatedBy)
  VALUES (
    N'Malzeme Kart Listesi',
    N'Malzeme',
    N'Malzeme kartları — {search_query} ile kod/ad filtresi',
    N'SELECT TOP 5000
  p.ProductCardID AS [Id],
  p.Code AS [Kod],
  p.Title AS [Ad],
  p.ProductType AS [Tip],
  p.IsActive AS [Aktif]
FROM dbo.ProductCard p
WHERE (N''{search_query}'' = N'''' OR p.Code LIKE N''%{search_query}%'' OR p.Title LIKE N''%{search_query}%'')
ORDER BY p.Code',
    N'[{"var_name":"search_query","label":"Ara (kod/ad)","type":"text","default_val":""}]',
    N'seed'
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE Name = N'Sipariş Özeti (Tarih Aralığı)')
BEGIN
  INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, CreatedBy)
  VALUES (
    N'Sipariş Özeti (Tarih Aralığı)',
    N'Satış',
    N'{start_date} – {end_date} arası sipariş fişleri',
    N'SELECT TOP 5000
  o.OrderVoucherID AS [Id],
  o.OrderSlipNo AS [BelgeNo],
  o.OrderDate AS [Tarih],
  o.Type_ AS [Tip],
  o.Status_ AS [Durum],
  o.CustomerID AS [CariId],
  o.Description AS [Aciklama]
FROM dbo.OrderVoucher o
WHERE o.OrderDate >= CAST(''{start_date}'' AS DATE)
  AND o.OrderDate < DATEADD(DAY, 1, CAST(''{end_date}'' AS DATE))
ORDER BY o.OrderDate DESC, o.OrderVoucherID DESC',
    N'[{"var_name":"start_date","label":"Başlangıç","type":"date","default_val":"-30 days"},{"var_name":"end_date","label":"Bitiş","type":"date","default_val":""}]',
    N'seed'
  );
END
GO
