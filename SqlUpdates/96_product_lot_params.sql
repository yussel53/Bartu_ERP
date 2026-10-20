-- 96: Malzeme kartı izleme parametreleri.
-- AllowLotSplit: lot bölme. TrackLocation: seri/lot için stok yeri takibi.
-- IssuePolicy: 0 serbest · 1 FEFO zorla · 2 FIFO zorla.
-- Öndeğer kart (ProductCardID = -1) bu alanlarla doldurulur.

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'AllowLotSplit') IS NULL
    ALTER TABLE dbo.ProductCard ADD AllowLotSplit BIT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'TrackLocation') IS NULL
    ALTER TABLE dbo.ProductCard ADD TrackLocation BIT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'IssuePolicy') IS NULL
    ALTER TABLE dbo.ProductCard ADD IssuePolicy TINYINT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'AllowLotSplit') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'TrackLocation') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'IssuePolicy') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.ProductCard WHERE ProductCardID = -1)
BEGIN
  UPDATE dbo.ProductCard
  SET AllowLotSplit = ISNULL(AllowLotSplit, 0),
      TrackLocation = ISNULL(TrackLocation, 0),
      IssuePolicy = ISNULL(IssuePolicy, 0)
  WHERE ProductCardID = -1;
END
GO
