-- 90: Kritik stok seviyesi (Y-14) — ProductCard.MinStock: eldeki miktar bu değere ya da altına inince yönetim panelinde
-- «Kritik stok» listesine düşer (boş / 0: izlenmez; eksiye düşen stok her zaman listelenir).

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductCard', N'MinStock') IS NULL
  ALTER TABLE dbo.ProductCard ADD MinStock FLOAT NULL;
GO
