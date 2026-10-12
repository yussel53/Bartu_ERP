-- 35: Sistem tarih formatı ayarı (Setting.Code = DateFormat)
-- Uygulama açılışında /api/system/info bu değeri okur; yoksa OS kültürü kullanılır.

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.Setting WHERE Code = N'DateFormat')
  BEGIN
    DECLARE @nextId int =
      ISNULL((SELECT MAX(SettingID) FROM dbo.Setting), 0) + 1;

    INSERT INTO dbo.Setting (SettingID, Code, Title, Value)
    VALUES (@nextId, N'DateFormat', N'Tarih Formatı', N'dd.MM.yyyy');
  END
END
GO
