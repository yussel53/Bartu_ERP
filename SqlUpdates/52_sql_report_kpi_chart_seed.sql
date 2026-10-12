-- Nova Sierra uyumlu örnek KPI + grafik yapılandırması

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
  -- Malzeme Kart Listesi
  UPDATE dbo.SYS_SqlReport
  SET
    KpiConfig = N'[{"title":"Kart Sayısı","type":"count","col":"","suffix":"adet","color":"#2563eb","icon":"bi-box","spanWidth":3,"filter_col":"","filter_val":""},{"title":"Aktif Kart","type":"count","col":"","suffix":"","color":"#10b981","icon":"bi-check","spanWidth":3,"filter_col":"Aktif","filter_val":"True"}]',
    ChartConfig = N'[{"id":0,"title":"Malzeme Tip Dağılımı","type":"doughnut","label_col":"Tip","value_col":"Id","agg":"count","width":6},{"id":1,"title":"Aktif / Pasif","type":"bar","label_col":"Aktif","value_col":"Id","agg":"count","width":6}]'
  WHERE Name = N'Malzeme Kart Listesi'
    AND (KpiConfig IS NULL OR KpiConfig = N'[]' OR LTRIM(RTRIM(KpiConfig)) = N'');

  -- Cari Kart Listesi
  UPDATE dbo.SYS_SqlReport
  SET
    KpiConfig = N'[{"title":"Cari Sayısı","type":"count","col":"","suffix":"adet","color":"#6366f1","icon":"bi-people","spanWidth":3,"filter_col":"","filter_val":""},{"title":"Benzersiz Vergi No","type":"count_distinct","col":"VergiNo","suffix":"","color":"#f59e0b","icon":"bi-hash","spanWidth":3,"filter_col":"","filter_val":""}]',
    ChartConfig = N'[{"id":0,"title":"Aktiflik","type":"pie","label_col":"Aktif","value_col":"Id","agg":"count","width":6}]'
  WHERE Name = N'Cari Kart Listesi'
    AND (KpiConfig IS NULL OR KpiConfig = N'[]' OR LTRIM(RTRIM(KpiConfig)) = N'');

  -- Sipariş Özeti
  UPDATE dbo.SYS_SqlReport
  SET
    KpiConfig = N'[{"title":"Sipariş Adedi","type":"count","col":"","suffix":"adet","color":"#0ea5e9","icon":"bi-cart","spanWidth":3,"filter_col":"","filter_val":""},{"title":"Benzersiz Cari","type":"count_distinct","col":"CariId","suffix":"","color":"#8b5cf6","icon":"bi-people","spanWidth":3,"filter_col":"","filter_val":""}]',
    ChartConfig = N'[{"id":0,"title":"Sipariş Tipi","type":"bar","label_col":"Tip","value_col":"Id","agg":"count","width":6},{"id":1,"title":"Durum Dağılımı","type":"doughnut","label_col":"Durum","value_col":"Id","agg":"count","width":6}]'
  WHERE Name = N'Sipariş Özeti (Tarih Aralığı)'
    AND (KpiConfig IS NULL OR KpiConfig = N'[]' OR LTRIM(RTRIM(KpiConfig)) = N'');
END
GO
