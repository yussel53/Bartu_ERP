-- 88: Standart raporlar (Y-13) — SQL Rapor Tasarımcısına hazır raporlar: Mizan, Muavin Defter, Stok Yaşlandırma, Satış Analizi.
-- ExportKey ile tanınır: yalnız yoksa eklenir (kullanıcı düzenlediyse dokunulmaz). Menü: ilgili modülün Raporlar grubu.
-- Bu betik scratch üreteciyle yazıldı; sorgu değişikliği yeni numaralı betikle yapılmalı.

IF OBJECT_ID(N'dbo.SYS_SqlReportMenu', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-muhasebe')
    INSERT INTO dbo.SYS_SqlReportMenu (ExportKey, ModulePath, GroupKey, Title, SortOrder, IsActive, CreatedAt)
    VALUES (N'std-menu-muhasebe', N'muhasebe', N'raporlar', N'Standart Raporlar', 10, 1, SYSDATETIME());
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-malzeme')
    INSERT INTO dbo.SYS_SqlReportMenu (ExportKey, ModulePath, GroupKey, Title, SortOrder, IsActive, CreatedAt)
    VALUES (N'std-menu-malzeme', N'malzeme', N'raporlar', N'Standart Raporlar', 20, 1, SYSDATETIME());
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-satis')
    INSERT INTO dbo.SYS_SqlReportMenu (ExportKey, ModulePath, GroupKey, Title, SortOrder, IsActive, CreatedAt)
    VALUES (N'std-menu-satis', N'satis', N'raporlar', N'Standart Raporlar', 10, 1, SYSDATETIME());
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE ExportKey = N'std-mizan')
    INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, ColumnFormats, AllowExport, IsActive,
      CreatedAt, MenuId, MenuDisplayName, MenuSortOrder, ExportKey)
    SELECT N'Mizan', N'Muhasebe', N'Hesap bazında devir, dönem borç / alacak ve bakiye; alt hesaplar üst hesaplara toplanır. Seviye: 0 tümü, 1 ana hesaplar, 2 bir alt seviye...',
      N'WITH mv AS (
  SELECT t.AccountCardID,
    SUM(CASE WHEN v.VoucherDate < CAST(N''{start_date}'' AS date) THEN ISNULL(t.Debit, 0) - ISNULL(t.Credit, 0) ELSE 0 END) AS Devir,
    SUM(CASE WHEN v.VoucherDate >= CAST(N''{start_date}'' AS date) THEN ISNULL(t.Debit, 0) ELSE 0 END) AS Borc,
    SUM(CASE WHEN v.VoucherDate >= CAST(N''{start_date}'' AS date) THEN ISNULL(t.Credit, 0) ELSE 0 END) AS Alacak
  FROM dbo.AccountTrans t
  JOIN dbo.AccountVoucher v ON v.AccountVoucherID = t.AccountVoucherID
  WHERE v.VoucherDate < DATEADD(DAY, 1, CAST(N''{end_date}'' AS date))
  GROUP BY t.AccountCardID
), tree AS (
  SELECT a.AccountCardID AS LeafID, a.AccountCardID AS NodeID, a.MainAccountID, 0 AS Lvl FROM dbo.AccountCard a
  UNION ALL
  SELECT tr.LeafID, p.AccountCardID, p.MainAccountID, tr.Lvl + 1
  FROM tree tr JOIN dbo.AccountCard p ON p.AccountCardID = tr.MainAccountID
  WHERE tr.Lvl < 15
)
SELECT
  a.Code AS [Hesap],
  a.Title AS [HesapAdi],
  CAST(SUM(m.Devir) AS decimal(19,2)) AS [Devir],
  CAST(SUM(m.Borc) AS decimal(19,2)) AS [Borc],
  CAST(SUM(m.Alacak) AS decimal(19,2)) AS [Alacak],
  CAST(CASE WHEN SUM(m.Devir + m.Borc - m.Alacak) > 0 THEN SUM(m.Devir + m.Borc - m.Alacak) ELSE 0 END AS decimal(19,2)) AS [BorcBakiye],
  CAST(CASE WHEN SUM(m.Devir + m.Borc - m.Alacak) < 0 THEN -SUM(m.Devir + m.Borc - m.Alacak) ELSE 0 END AS decimal(19,2)) AS [AlacakBakiye]
FROM tree
JOIN mv m ON m.AccountCardID = tree.LeafID
JOIN dbo.AccountCard a ON a.AccountCardID = tree.NodeID
WHERE (N''{search_query}'' = N'''' OR a.Code LIKE N''{search_query}%'')
  AND (TRY_CAST(NULLIF(N''{level}'', N'''') AS int) IS NULL OR TRY_CAST(NULLIF(N''{level}'', N'''') AS int) = 0
       OR LEN(a.Code) - LEN(REPLACE(a.Code, N''.'', N'''')) < TRY_CAST(NULLIF(N''{level}'', N'''') AS int))
GROUP BY a.Code, a.Title
ORDER BY a.Code
OPTION (MAXRECURSION 20)',
      N'[{"var_name": "start_date", "label": "Başlangıç", "type": "date", "default_val": "year_start"}, {"var_name": "end_date", "label": "Bitiş", "type": "date", "default_val": ""}, {"var_name": "search_query", "label": "Hesap kodu (ile başlayan)", "type": "text", "default_val": ""}, {"var_name": "level", "label": "Seviye (0 tümü)", "type": "number", "default_val": "0"}]',
      N'[{"col": "Hesap", "format": "text", "label": "Hesap", "show": true}, {"col": "HesapAdi", "format": "text", "label": "Hesap Adı", "show": true}, {"col": "Devir", "format": "number", "label": "Devir", "show": true, "pattern": "#.###0,##"}, {"col": "Borc", "format": "number", "label": "Borç", "show": true, "pattern": "#.###0,##"}, {"col": "Alacak", "format": "number", "label": "Alacak", "show": true, "pattern": "#.###0,##"}, {"col": "BorcBakiye", "format": "number", "label": "Borç Bakiye", "show": true, "pattern": "#.###0,##"}, {"col": "AlacakBakiye", "format": "number", "label": "Alacak Bakiye", "show": true, "pattern": "#.###0,##"}]', 1, 1, SYSDATETIME(),
      (SELECT TOP 1 Id FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-muhasebe'), N'Mizan', 10, N'std-mizan';
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE ExportKey = N'std-muavin')
    INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, ColumnFormats, AllowExport, IsActive,
      CreatedAt, MenuId, MenuDisplayName, MenuSortOrder, ExportKey)
    SELECT N'Muavin Defter', N'Muhasebe', N'Seçilen hesap (ve alt hesapları) için devir ve fiş satırları, yürüyen bakiye.',
      N'WITH acc AS (
  SELECT AccountCardID, Code, Title FROM dbo.AccountCard
  WHERE N''{account_code}'' <> N'''' AND Code LIKE N''{account_code}%''
), mv AS (
  SELECT a.Code, a.Title, CAST(N''{start_date}'' AS date) AS Tarih, CAST(NULL AS nvarchar(50)) AS FisNo, N''Devir'' AS Aciklama,
    0 AS Sira, 0 AS VId, 0 AS LNo,
    SUM(ISNULL(t.Debit, 0) - ISNULL(t.Credit, 0)) AS Net
  FROM acc a
  JOIN dbo.AccountTrans t ON t.AccountCardID = a.AccountCardID
  JOIN dbo.AccountVoucher v ON v.AccountVoucherID = t.AccountVoucherID
  WHERE v.VoucherDate < CAST(N''{start_date}'' AS date)
  GROUP BY a.Code, a.Title
  UNION ALL
  SELECT a.Code, a.Title, CAST(v.VoucherDate AS date), COALESCE(v.journalNO, v.DocumentNumber),
    COALESCE(t.Description, v.Description), 1, v.AccountVoucherID, ISNULL(t.TransLineNo, 0),
    ISNULL(t.Debit, 0) - ISNULL(t.Credit, 0)
  FROM acc a
  JOIN dbo.AccountTrans t ON t.AccountCardID = a.AccountCardID
  JOIN dbo.AccountVoucher v ON v.AccountVoucherID = t.AccountVoucherID
  WHERE v.VoucherDate >= CAST(N''{start_date}'' AS date) AND v.VoucherDate < DATEADD(DAY, 1, CAST(N''{end_date}'' AS date))
)
SELECT
  Code AS [Hesap],
  Title AS [HesapAdi],
  Tarih,
  FisNo,
  Aciklama,
  CAST(CASE WHEN Net > 0 THEN Net ELSE 0 END AS decimal(19,2)) AS [Borc],
  CAST(CASE WHEN Net < 0 THEN -Net ELSE 0 END AS decimal(19,2)) AS [Alacak],
  CAST(SUM(Net) OVER (PARTITION BY Code ORDER BY Sira, Tarih, VId, LNo ROWS UNBOUNDED PRECEDING) AS decimal(19,2)) AS [Bakiye]
FROM mv
ORDER BY Code, Sira, Tarih, VId, LNo',
      N'[{"var_name": "account_code", "label": "Hesap kodu (ile başlayan)", "type": "text", "default_val": ""}, {"var_name": "start_date", "label": "Başlangıç", "type": "date", "default_val": "year_start"}, {"var_name": "end_date", "label": "Bitiş", "type": "date", "default_val": ""}]',
      N'[{"col": "Hesap", "format": "text", "label": "Hesap", "show": true}, {"col": "HesapAdi", "format": "text", "label": "Hesap Adı", "show": true}, {"col": "Tarih", "format": "date", "label": "Tarih", "show": true, "pattern": "d.m.Y"}, {"col": "FisNo", "format": "text", "label": "Fiş / Yevmiye No", "show": true}, {"col": "Aciklama", "format": "text", "label": "Açıklama", "show": true}, {"col": "Borc", "format": "number", "label": "Borç", "show": true, "pattern": "#.###0,##"}, {"col": "Alacak", "format": "number", "label": "Alacak", "show": true, "pattern": "#.###0,##"}, {"col": "Bakiye", "format": "number", "label": "Bakiye", "show": true, "pattern": "#.###0,##"}]', 1, 1, SYSDATETIME(),
      (SELECT TOP 1 Id FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-muhasebe'), N'Muavin Defter', 20, N'std-muavin';
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE ExportKey = N'std-stok-yaslandirma')
    INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, ColumnFormats, AllowExport, IsActive,
      CreatedAt, MenuId, MenuDisplayName, MenuSortOrder, ExportKey)
    SELECT N'Stok Yaşlandırma', N'Malzeme', N'Eldeki stok en son girişlerden kaldığı varsayılarak giriş tarihine göre yaşlandırılır (0-30 / 31-60 / 61-90 / 91-180 / 180+ gün); değer giriş fiyatıyla.',
      N'WITH mv AS (
  SELECT t.ProductCardID, CAST(COALESCE(t.TransDate, p.VoucherDate) AS date) AS Dt,
    CAST(COALESCE(t.VoucherType, p.VoucherType) AS int) AS VT,
    CAST(ISNULL(NULLIF(t.MainUnitQuantity, 0), ISNULL(t.Quantity, 0)) AS float) AS Qty,
    CAST(ISNULL(t.Price, 0) AS float) AS Price, t.ProductTransID
  FROM dbo.ProductTrans t
  JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
  WHERE t.ProductCardID IS NOT NULL AND ISNULL(p.Status_, 1) <> 3
    AND COALESCE(t.TransDate, p.VoucherDate) < DATEADD(DAY, 1, CAST(N''{end_date}'' AS date))
    AND (TRY_CAST(NULLIF(N''{whouse_id}'', N'''') AS int) IS NULL OR COALESCE(t.WhouseID, p.WhouseID) = TRY_CAST(NULLIF(N''{whouse_id}'', N'''') AS int))
), stock AS (
  SELECT ProductCardID,
    SUM(CASE WHEN VT IN (1, 2, 5, 9) THEN Qty WHEN VT IN (3, 4, 8, 10) THEN -Qty ELSE 0 END) AS OnHand
  FROM mv GROUP BY ProductCardID
), ins AS (
  SELECT m.ProductCardID, m.Dt, m.Qty, m.Price, s.OnHand,
    SUM(m.Qty) OVER (PARTITION BY m.ProductCardID ORDER BY m.Dt DESC, m.ProductTransID DESC ROWS UNBOUNDED PRECEDING) AS Cum
  FROM mv m JOIN stock s ON s.ProductCardID = m.ProductCardID
  WHERE m.VT IN (1, 2, 5, 9) AND s.OnHand > 0
), lots AS (
  SELECT ProductCardID, Dt, Price,
    CASE WHEN Cum <= OnHand THEN Qty WHEN Cum - Qty < OnHand THEN OnHand - (Cum - Qty) ELSE 0 END AS Rest,
    DATEDIFF(DAY, Dt, CAST(N''{end_date}'' AS date)) AS Age
  FROM ins
)
SELECT
  pc.Code AS [Kod],
  pc.Title AS [Malzeme],
  CAST(SUM(l.Rest) AS decimal(19,3)) AS [Eldeki],
  CAST(SUM(CASE WHEN l.Age <= 30 THEN l.Rest ELSE 0 END) AS decimal(19,3)) AS [G0_30],
  CAST(SUM(CASE WHEN l.Age BETWEEN 31 AND 60 THEN l.Rest ELSE 0 END) AS decimal(19,3)) AS [G31_60],
  CAST(SUM(CASE WHEN l.Age BETWEEN 61 AND 90 THEN l.Rest ELSE 0 END) AS decimal(19,3)) AS [G61_90],
  CAST(SUM(CASE WHEN l.Age BETWEEN 91 AND 180 THEN l.Rest ELSE 0 END) AS decimal(19,3)) AS [G91_180],
  CAST(SUM(CASE WHEN l.Age > 180 THEN l.Rest ELSE 0 END) AS decimal(19,3)) AS [G180Ustu],
  CAST(SUM(l.Rest * l.Price) AS decimal(19,2)) AS [Deger],
  MAX(l.Age) AS [EnEskiGun]
FROM lots l
JOIN dbo.ProductCard pc ON pc.ProductCardID = l.ProductCardID
WHERE l.Rest > 0
  AND (N''{search_query}'' = N'''' OR pc.Code LIKE N''%{search_query}%'' OR pc.Title LIKE N''%{search_query}%'')
GROUP BY pc.Code, pc.Title
ORDER BY MAX(l.Age) DESC, pc.Code',
      N'[{"var_name": "end_date", "label": "Tarih itibarıyla", "type": "date", "default_val": ""}, {"var_name": "whouse_id", "label": "Ambar ID (boş: tümü)", "type": "number", "default_val": ""}, {"var_name": "search_query", "label": "Malzeme (kod / ad)", "type": "text", "default_val": ""}]',
      N'[{"col": "Kod", "format": "text", "label": "Kod", "show": true}, {"col": "Malzeme", "format": "text", "label": "Malzeme", "show": true}, {"col": "Eldeki", "format": "number", "label": "Eldeki", "show": true, "pattern": "#.###0,##"}, {"col": "G0_30", "format": "number", "label": "0-30", "show": true, "pattern": "#.###0,##"}, {"col": "G31_60", "format": "number", "label": "31-60", "show": true, "pattern": "#.###0,##"}, {"col": "G61_90", "format": "number", "label": "61-90", "show": true, "pattern": "#.###0,##"}, {"col": "G91_180", "format": "number", "label": "91-180", "show": true, "pattern": "#.###0,##"}, {"col": "G180Ustu", "format": "number", "label": "180+", "show": true, "pattern": "#.###0,##"}, {"col": "Deger", "format": "number", "label": "Değer", "show": true, "pattern": "#.###0,##"}, {"col": "EnEskiGun", "format": "number", "label": "En eski (gün)", "show": true, "pattern": "#.###0,##"}]', 1, 1, SYSDATETIME(),
      (SELECT TOP 1 Id FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-malzeme'), N'Stok Yaşlandırma', 30, N'std-stok-yaslandirma';
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReport WHERE ExportKey = N'std-satis-analizi')
    INSERT INTO dbo.SYS_SqlReport (Name, ReportGroup, Description, QueryTemplate, FiltersConfig, ColumnFormats, AllowExport, IsActive,
      CreatedAt, MenuId, MenuDisplayName, MenuSortOrder, ExportKey)
    SELECT N'Satış Analizi', N'Satış', N'Satış faturaları (iadeler düşülür): miktar, net satış, KDV, maliyet (ağırlıklı ortalama), brüt kâr ve kâr %. Gruplama: cari, malzeme ya da ay.',
      N'WITH l AS (
  SELECT
    CASE WHEN i.InvoiceType = 3 THEN -1 ELSE 1 END AS Sgn,
    i.InvoiceDate, c.Code AS CariKod, c.Title AS CariAd, pc.Code AS MalKod, pc.Title AS MalAd,
    CAST(ISNULL(NULLIF(t.MainUnitQuantity, 0), ISNULL(t.Quantity, 0)) AS float) AS Qty,
    CAST(ISNULL(t.TotalPrice, 0) AS float) AS Net,
    CAST(ISNULL(t.TotalTax, 0) AS float) AS Tax,
    uc.UnitCost
  FROM dbo.Invoice i
  JOIN dbo.ProductTrans t ON t.InvoiceID = i.InvoiceID
  LEFT JOIN dbo.CustomerCard c ON c.CustomerCardID = i.CustomerID
  LEFT JOIN dbo.ProductCard pc ON pc.ProductCardID = t.ProductCardID
  OUTER APPLY (
    SELECT TOP 1 cc.Amount / NULLIF(ISNULL(NULLIF(pt.MainUnitQuantity, 0), pt.Quantity), 0) AS UnitCost
    FROM dbo.ProductTransCostCalc cc
    JOIN dbo.ProductTrans pt ON pt.ProductTransID = cc.MtransID
    WHERE cc.Type = 1 AND pt.ProductCardID = t.ProductCardID AND pt.TransDate <= i.InvoiceDate
    ORDER BY pt.TransDate DESC, pt.ProductTransID DESC
  ) uc
  WHERE i.InvoiceType IN (1, 3, 7)
    AND i.InvoiceDate >= CAST(N''{start_date}'' AS date) AND i.InvoiceDate < DATEADD(DAY, 1, CAST(N''{end_date}'' AS date))
), g AS (
  SELECT
    CASE LOWER(N''{group_by}'') WHEN N''malzeme'' THEN ISNULL(MalKod, N''-'') WHEN N''ay'' THEN CONVERT(nvarchar(7), InvoiceDate, 120) ELSE ISNULL(CariKod, N''-'') END AS Kod,
    CASE LOWER(N''{group_by}'') WHEN N''malzeme'' THEN MalAd WHEN N''ay'' THEN N'''' ELSE CariAd END AS Ad,
    Sgn * Qty AS Qty, Sgn * Net AS Net, Sgn * Tax AS Tax, Sgn * Qty * UnitCost AS Cost
  FROM l
  WHERE N''{search_query}'' = N'''' OR CariKod LIKE N''%{search_query}%'' OR CariAd LIKE N''%{search_query}%''
     OR MalKod LIKE N''%{search_query}%'' OR MalAd LIKE N''%{search_query}%''
)
SELECT
  Kod,
  Ad,
  CAST(SUM(Qty) AS decimal(19,3)) AS [Miktar],
  CAST(SUM(Net) AS decimal(19,2)) AS [NetSatis],
  CAST(SUM(Tax) AS decimal(19,2)) AS [KDV],
  CAST(SUM(Cost) AS decimal(19,2)) AS [Maliyet],
  CAST(SUM(Net) - SUM(Cost) AS decimal(19,2)) AS [BrutKar],
  CAST(CASE WHEN SUM(Net) = 0 THEN NULL ELSE (SUM(Net) - SUM(Cost)) * 100.0 / SUM(Net) END AS decimal(9,2)) AS [KarYuzde]
FROM g
GROUP BY Kod, Ad
ORDER BY SUM(Net) DESC',
      N'[{"var_name": "start_date", "label": "Başlangıç", "type": "date", "default_val": "month_start"}, {"var_name": "end_date", "label": "Bitiş", "type": "date", "default_val": ""}, {"var_name": "group_by", "label": "Gruplama (cari / malzeme / ay)", "type": "text", "default_val": "cari"}, {"var_name": "search_query", "label": "Ara (cari / malzeme)", "type": "text", "default_val": ""}]',
      N'[{"col": "Kod", "format": "text", "label": "Kod", "show": true}, {"col": "Ad", "format": "text", "label": "Ad", "show": true}, {"col": "Miktar", "format": "number", "label": "Miktar", "show": true, "pattern": "#.###0,##"}, {"col": "NetSatis", "format": "number", "label": "Net Satış", "show": true, "pattern": "#.###0,##"}, {"col": "KDV", "format": "number", "label": "KDV", "show": true, "pattern": "#.###0,##"}, {"col": "Maliyet", "format": "number", "label": "Maliyet", "show": true, "pattern": "#.###0,##"}, {"col": "BrutKar", "format": "number", "label": "Brüt Kâr", "show": true, "pattern": "#.###0,##"}, {"col": "KarYuzde", "format": "number", "label": "Kâr %", "show": true, "pattern": "#.###0,##"}]', 1, 1, SYSDATETIME(),
      (SELECT TOP 1 Id FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'std-menu-satis'), N'Satış Analizi', 40, N'std-satis-analizi';
END
GO
