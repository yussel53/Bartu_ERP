-- E-Devlet: firma dönüşüm şablonlarının istediği ek alanlar (U_ kolonu + SYS_ExtraFields tanımı)
-- Belge Kuralları bunları {Cari.U_EdiNo}, {Malzeme.U_UreticiKodu}, {Belge.U_IzlemeNo} ... olarak okur.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.CustomerCard', N'U_EdiNo') IS NULL
    ALTER TABLE dbo.CustomerCard ADD U_EdiNo NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductCard', N'U_UreticiKodu') IS NULL
    ALTER TABLE dbo.ProductCard ADD U_UreticiKodu NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductCard', N'U_GrupKodu') IS NULL
    ALTER TABLE dbo.ProductCard ADD U_GrupKodu NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductTrans', N'U_KunyeNo') IS NULL
    ALTER TABLE dbo.ProductTrans ADD U_KunyeNo NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.OrderVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.OrderVoucher', N'U_MusteriSiparisNo') IS NULL
    ALTER TABLE dbo.OrderVoucher ADD U_MusteriSiparisNo NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'U_IzlemeNo') IS NULL
    ALTER TABLE dbo.Invoice ADD U_IzlemeNo NVARCHAR(50) NULL;
GO
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'U_EBelgeNot1') IS NULL
    ALTER TABLE dbo.Invoice ADD U_EBelgeNot1 NVARCHAR(250) NULL;
GO
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'U_EBelgeNot2') IS NULL
    ALTER TABLE dbo.Invoice ADD U_EBelgeNot2 NVARCHAR(250) NULL;
GO
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'U_EBelgeNot3') IS NULL
    ALTER TABLE dbo.Invoice ADD U_EBelgeNot3 NVARCHAR(250) NULL;
GO
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'U_EBelgeNot4') IS NULL
    ALTER TABLE dbo.Invoice ADD U_EBelgeNot4 NVARCHAR(250) NULL;
GO

-- Tanımlar: kolon varsa ve tanım yoksa eklenir; kullanıcının değiştirdiği etiket / sıra korunur
IF OBJECT_ID(N'dbo.SYS_ExtraFields', N'U') IS NOT NULL
    INSERT INTO dbo.SYS_ExtraFields (TableName, FieldName, Label, DataType, TextLength, OrderIndex, CreatedBy)
    SELECT v.TableName, v.FieldName, v.Label, N'text', v.TextLength, v.OrderIndex, N'SqlUpdates'
    FROM (VALUES
        (N'CustomerCard', N'U_EdiNo', N'EDI / GLN no (e-Belge)', 50, 900),
        (N'ProductCard', N'U_UreticiKodu', N'Üretici ürün kodu', 50, 900),
        (N'ProductCard', N'U_GrupKodu', N'Malzeme grup kodu', 50, 901),
        (N'ProductTrans', N'U_KunyeNo', N'Künye no', 50, 900),
        (N'OrderVoucher', N'U_MusteriSiparisNo', N'Müşteri sipariş no', 50, 900),
        (N'Invoice', N'U_IzlemeNo', N'Doküman izleme no (e-Belge)', 50, 900),
        (N'Invoice', N'U_EBelgeNot1', N'e-Belge notu 1', 250, 901),
        (N'Invoice', N'U_EBelgeNot2', N'e-Belge notu 2', 250, 902),
        (N'Invoice', N'U_EBelgeNot3', N'e-Belge notu 3', 250, 903),
        (N'Invoice', N'U_EBelgeNot4', N'e-Belge notu 4', 250, 904)
    ) AS v (TableName, FieldName, Label, TextLength, OrderIndex)
    WHERE COL_LENGTH(N'dbo.' + v.TableName, v.FieldName) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ExtraFields e WHERE e.TableName = v.TableName AND e.FieldName = v.FieldName);
GO
