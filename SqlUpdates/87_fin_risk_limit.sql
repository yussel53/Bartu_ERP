-- 87: Risk limiti (Y-12)
-- RiskGroup: RiskLimit (grup öndeğer limiti), RiskAction 0 izle · 1 uyar · 2 yönetici onayı · 3 engelle,
--            IncOrders açık satış siparişleri · IncDispatches faturalanmamış satış irsaliyeleri · IncBounds portföydeki müşteri çek / senetleri
-- CustomerCard.RiskLimit: cariye özel limit (boş → risk grubunun limiti).
-- Risk = cari bakiye (+ seçilen kalemler) + kaydedilen belge; limit aşılırsa satış siparişi / irsaliyesi / faturası kaydında RiskAction uygulanır.

IF OBJECT_ID(N'dbo.RiskGroup', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.RiskGroup', N'RiskLimit') IS NULL ALTER TABLE dbo.RiskGroup ADD RiskLimit FLOAT NULL;
  IF COL_LENGTH(N'dbo.RiskGroup', N'RiskAction') IS NULL ALTER TABLE dbo.RiskGroup ADD RiskAction TINYINT NOT NULL CONSTRAINT DF_RiskGroup_RiskAction DEFAULT 1;
  IF COL_LENGTH(N'dbo.RiskGroup', N'IncOrders') IS NULL ALTER TABLE dbo.RiskGroup ADD IncOrders BIT NOT NULL CONSTRAINT DF_RiskGroup_IncOrders DEFAULT 1;
  IF COL_LENGTH(N'dbo.RiskGroup', N'IncDispatches') IS NULL ALTER TABLE dbo.RiskGroup ADD IncDispatches BIT NOT NULL CONSTRAINT DF_RiskGroup_IncDispatches DEFAULT 0;
  IF COL_LENGTH(N'dbo.RiskGroup', N'IncBounds') IS NULL ALTER TABLE dbo.RiskGroup ADD IncBounds BIT NOT NULL CONSTRAINT DF_RiskGroup_IncBounds DEFAULT 1;
END
GO

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.CustomerCard', N'RiskLimit') IS NULL
  ALTER TABLE dbo.CustomerCard ADD RiskLimit FLOAT NULL;
GO
