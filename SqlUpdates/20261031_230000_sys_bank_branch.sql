-- SYS banka / şube katalogu (adres gibi sistem referansı)
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'dbo.SYS_Bank', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Bank (
    SYS_BankID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_Bank PRIMARY KEY,
    Code         NVARCHAR(10)  NOT NULL,   -- EFT kodu (0010)
    Title        NVARCHAR(200) NOT NULL,
    ShortTitle   NVARCHAR(80)  NULL,
    Swift        NVARCHAR(20)  NULL,
    IsActive     BIT NOT NULL CONSTRAINT DF_SYS_Bank_Active DEFAULT (1),
    SortOrder    INT NOT NULL CONSTRAINT DF_SYS_Bank_Sort DEFAULT (100)
  );
  CREATE UNIQUE NONCLUSTERED INDEX UX_SYS_Bank_Code ON dbo.SYS_Bank (Code);
END
GO

IF OBJECT_ID(N'dbo.SYS_BankBranch', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_BankBranch (
    SYS_BankBranchID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_BankBranch PRIMARY KEY,
    SYS_BankID       INT NOT NULL,
    Code             NVARCHAR(20)  NOT NULL,  -- şube kodu
    Title            NVARCHAR(200) NOT NULL,
    City             NVARCHAR(80)  NULL,
    IsActive         BIT NOT NULL CONSTRAINT DF_SYS_BankBranch_Active DEFAULT (1),
    CONSTRAINT FK_SYS_BankBranch_Bank FOREIGN KEY (SYS_BankID) REFERENCES dbo.SYS_Bank (SYS_BankID)
  );
  CREATE UNIQUE NONCLUSTERED INDEX UX_SYS_BankBranch_BankCode
    ON dbo.SYS_BankBranch (SYS_BankID, Code);
END
GO

-- Bankalar (yoksa ekle — Code ile)
IF OBJECT_ID(N'dbo.SYS_Bank', N'U') IS NOT NULL
BEGIN
  ;WITH src AS (
    SELECT * FROM (VALUES
      (N'0001', N'Türkiye Cumhuriyet Merkez Bankası', N'TCMB', N'TCMBTR2A', 1),
      (N'0004', N'İller Bankası A.Ş.', N'İller Bankası', NULL, 10),
      (N'0010', N'Türkiye Cumhuriyeti Ziraat Bankası A.Ş.', N'Ziraat', N'TCZBTR2A', 20),
      (N'0012', N'Türkiye Halk Bankası A.Ş.', N'Halkbank', N'TRHATR2A', 30),
      (N'0014', N'Türkiye Sınai Kalkınma Bankası A.Ş.', N'TSKB', N'TSKBTR2A', 40),
      (N'0015', N'Türkiye Vakıflar Bankası T.A.O.', N'VakıfBank', N'TVBATR2A', 50),
      (N'0016', N'Türk Eximbank', N'Eximbank', N'TEXBTR2A', 60),
      (N'0017', N'Türkiye Kalkınma ve Yatırım Bankası A.Ş.', N'TKYB', N'TKFBTR2A', 70),
      (N'0029', N'Birleşik Fon Bankası A.Ş.', N'Birleşik Fon', NULL, 80),
      (N'0032', N'Türk Ekonomi Bankası A.Ş.', N'TEB', N'TEBUTR2A', 90),
      (N'0046', N'Akbank T.A.Ş.', N'Akbank', N'AKBKTR2A', 100),
      (N'0059', N'Şekerbank T.A.Ş.', N'Şekerbank', N'SEKETR2A', 110),
      (N'0060', N'Türk Ticaret Bankası A.Ş.', N'Türk Ticaret', NULL, 120),
      (N'0062', N'Türkiye Garanti Bankası A.Ş.', N'Garanti BBVA', N'TGBATRIS', 130),
      (N'0064', N'Türkiye İş Bankası A.Ş.', N'İş Bankası', N'ISBKTRIS', 140),
      (N'0067', N'Yapı ve Kredi Bankası A.Ş.', N'Yapı Kredi', N'YAPITRIS', 150),
      (N'0091', N'Arap Türk Bankası A.Ş.', N'Arap Türk', N'ATUBTRIS', 160),
      (N'0092', N'Citibank A.Ş.', N'Citibank', N'CITITRIX', 170),
      (N'0096', N'Freedom Bank A.Ş.', N'Freedom', NULL, 180),
      (N'0099', N'ING Bank A.Ş.', N'ING', N'INGBTRIS', 190),
      (N'0103', N'Fibabanka A.Ş.', N'Fibabanka', N'FBHLTRIS', 200),
      (N'0109', N'ICBC Turkey Bank A.Ş.', N'ICBC', N'ICBKTRIS', 210),
      (N'0111', N'QNB Finansbank A.Ş.', N'QNB', N'FNNBTRIS', 220),
      (N'0115', N'Deutsche Bank A.Ş.', N'Deutsche', N'DEUTTRIS', 230),
      (N'0116', N'Pasha Yatırım Bankası A.Ş.', N'Pasha', NULL, 240),
      (N'0123', N'HSBC Bank A.Ş.', N'HSBC', N'HSBCTRIS', 250),
      (N'0124', N'Alternatifbank A.Ş.', N'Alternatifbank', N'ALFBTRIS', 260),
      (N'0125', N'Burgan Bank A.Ş.', N'Burgan', N'BRGLTRIS', 270),
      (N'0129', N'Bank of America Yatırım Bank A.Ş.', N'BofA', NULL, 280),
      (N'0132', N'İstanbul Takas ve Saklama Bankası A.Ş.', N'Takasbank', N'TAKBTR2A', 290),
      (N'0134', N'Denizbank A.Ş.', N'Denizbank', N'DENITRIS', 300),
      (N'0135', N'Anadolubank A.Ş.', N'Anadolubank', N'ANDLTRIS', 310),
      (N'0138', N'Diler Yatırım Bankası A.Ş.', N'Diler', NULL, 320),
      (N'0139', N'GSD Yatırım Bankası A.Ş.', N'GSD', NULL, 330),
      (N'0141', N'Nurol Yatırım Bankası A.Ş.', N'Nurol', NULL, 340),
      (N'0142', N'Bankpozitif Kredi ve Kalkınma Bankası A.Ş.', N'Bankpozitif', NULL, 350),
      (N'0143', N'Aktif Yatırım Bankası A.Ş.', N'Aktif', N'CAYTTRIS', 360),
      (N'0146', N'Odea Bank A.Ş.', N'Odeabank', N'ODEATRIS', 370),
      (N'0147', N'MUFG Bank Turkey A.Ş.', N'MUFG', NULL, 380),
      (N'0148', N'Intesa Sanpaolo S.p.A.', N'Intesa', NULL, 390),
      (N'0149', N'Bank of China Turkey A.Ş.', N'Bank of China', NULL, 400),
      (N'0151', N'D Yatırım Bankası A.Ş.', N'D Yatırım', NULL, 410),
      (N'0152', N'Destek Yatırım Bankası A.Ş.', N'Destek', NULL, 420),
      (N'0157', N'Enpara Bank A.Ş.', N'Enpara', NULL, 430),
      (N'0158', N'Colendi Bank A.Ş.', N'Colendi', NULL, 440),
      (N'0159', N'Fups Bank A.Ş.', N'Fups', NULL, 450),
      (N'0203', N'Albaraka Türk Katılım Bankası A.Ş.', N'Albaraka', N'BTFHTRIS', 460),
      (N'0205', N'Kuveyt Türk Katılım Bankası A.Ş.', N'Kuveyt Türk', N'KTEFTRIS', 470),
      (N'0206', N'Türkiye Finans Katılım Bankası A.Ş.', N'Türkiye Finans', N'AFKBTRIS', 480),
      (N'0209', N'Ziraat Katılım Bankası A.Ş.', N'Ziraat Katılım', N'ZKBATRIS', 490),
      (N'0210', N'Vakıf Katılım Bankası A.Ş.', N'Vakıf Katılım', N'VAKFTRIS', 500),
      (N'0212', N'Hayat Finans Katılım Bankası A.Ş.', N'Hayat Finans', NULL, 510),
      (N'0214', N'Dünya Katılım Bankası A.Ş.', N'Dünya Katılım', NULL, 520),
      (N'0215', N'Adil Katılım Bankası A.Ş.', N'Adil Katılım', NULL, 530),
      (N'0807', N'Posta ve Telgraf Teşkilatı A.Ş.', N'PTT', NULL, 540)
    ) AS v(Code, Title, ShortTitle, Swift, SortOrder)
  )
  INSERT INTO dbo.SYS_Bank (Code, Title, ShortTitle, Swift, IsActive, SortOrder)
  SELECT s.Code, s.Title, s.ShortTitle, s.Swift, 1, s.SortOrder
  FROM src s
  WHERE NOT EXISTS (SELECT 1 FROM dbo.SYS_Bank b WHERE b.Code = s.Code);
END
GO

-- Cari IBAN şube adı
IF OBJECT_ID(N'dbo.CustomerIban', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerIban', N'BranchName') IS NULL
  ALTER TABLE dbo.CustomerIban ADD BranchName NVARCHAR(120) NULL;
GO

-- Örnek şubeler (yoksa) — yaygın merkez şubeler
IF OBJECT_ID(N'dbo.SYS_BankBranch', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.SYS_Bank', N'U') IS NOT NULL
BEGIN
  ;WITH br AS (
    SELECT * FROM (VALUES
      (N'0010', N'90001', N'Ankara Merkez', N'Ankara'),
      (N'0010', N'90101', N'İstanbul Merkez', N'İstanbul'),
      (N'0012', N'1', N'Ankara Merkez', N'Ankara'),
      (N'0012', N'90', N'İstanbul Merkez', N'İstanbul'),
      (N'0015', N'1', N'Ankara Merkez', N'Ankara'),
      (N'0046', N'1', N'Sabıha Gökçen', N'İstanbul'),
      (N'0062', N'1', N'Levent', N'İstanbul'),
      (N'0064', N'1', N'Ulus', N'Ankara'),
      (N'0067', N'1', N'İstanbul Merkez', N'İstanbul'),
      (N'0111', N'1', N'İstanbul Merkez', N'İstanbul'),
      (N'0134', N'1', N'İstanbul Merkez', N'İstanbul')
    ) AS v(BankCode, Code, Title, City)
  )
  INSERT INTO dbo.SYS_BankBranch (SYS_BankID, Code, Title, City, IsActive)
  SELECT b.SYS_BankID, br.Code, br.Title, br.City, 1
  FROM br
  INNER JOIN dbo.SYS_Bank b ON b.Code = br.BankCode
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SYS_BankBranch x
    WHERE x.SYS_BankID = b.SYS_BankID AND x.Code = br.Code
  );
END
GO
