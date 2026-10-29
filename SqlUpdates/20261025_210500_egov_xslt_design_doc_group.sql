-- 20261025210500: E-Devlet — XSLT tasarımının belge grubu (EFATURA · EARSIV · EIRSALIYE · EMM · ESMM)
-- e-Belge şablonu eklenirken yalnız şablonun belge türüne ait tasarımlar seçilebilsin.
-- Mevcut tasarımlar: DespatchAdvice içeren → EIRSALIYE; adı / dosya adı «arşiv» içeren → EARSIV; diğerleri EFATURA.

IF OBJECT_ID(N'dbo.EGovXsltDesign', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovXsltDesign', N'DocGroup') IS NULL
  ALTER TABLE dbo.EGovXsltDesign ADD DocGroup NVARCHAR(10) NULL;
GO

IF OBJECT_ID(N'dbo.EGovXsltDesign', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovXsltDesign', N'DocGroup') IS NOT NULL
  UPDATE dbo.EGovXsltDesign
  SET DocGroup = CASE
      WHEN XsltContent LIKE N'%schema:xsd:DespatchAdvice-2%' THEN N'EIRSALIYE'
      WHEN LOWER(ISNULL(Title, N'') + N' ' + ISNULL(FileName, N'')) LIKE N'%arsiv%'
        OR LOWER(ISNULL(Title, N'') + N' ' + ISNULL(FileName, N'')) LIKE N'%arşiv%' THEN N'EARSIV'
      ELSE N'EFATURA' END
  WHERE DocGroup IS NULL;
GO
