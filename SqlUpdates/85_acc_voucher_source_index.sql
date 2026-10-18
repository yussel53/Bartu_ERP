-- 85: Muhasebeleştirme (Y-09) — belgeden muhasebe fişi araması için indeks.
-- Fiş: AccountVoucher.SourceModule = 7 fatura / 4 kasa fişi, SourceID = belge ID (AccountingPostService).
-- Parametre 43_setting_module.sql'deki ACC_AUTO_POST («Otomatik Mahsup»): 0 yalnız «Muhasebeleştir» ile · 1 kayıtta otomatik.

IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AccountVoucher_Source' AND object_id = OBJECT_ID(N'dbo.AccountVoucher'))
  CREATE INDEX IX_AccountVoucher_Source ON dbo.AccountVoucher (SourceModule, SourceID);
GO
