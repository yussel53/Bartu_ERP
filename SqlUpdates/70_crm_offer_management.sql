-- CRM / Teklif Yönetimi: Fırsat → Aksiyon → Teklif (+kalem) · Görüşmeler · Mail kaydı (Outlook entegrasyonu)
-- Yapı GALAXI / Nova Sierra "Actions" ekranı ve Outlook_Entegrasyon CRM API sözleşmesi (v1.1) örnek alınarak kuruldu.
-- Konu etiketi: /#{ÖNEK}-{OpportunityID}#/   (varsayılan önek: KS → /#KS-12#/)

-- ─── Ayarlar ────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.CRM_Setting', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_Setting
  (
    SettingKey   NVARCHAR(100) NOT NULL CONSTRAINT PK_CRM_Setting PRIMARY KEY,
    SettingValue NVARCHAR(MAX) NULL,
    UpdatedAt    DATETIME2     NOT NULL CONSTRAINT DF_CRM_Setting_UpdatedAt DEFAULT (SYSDATETIME())
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CRM_Setting WHERE SettingKey = N'TagPrefix')
  INSERT INTO dbo.CRM_Setting (SettingKey, SettingValue) VALUES (N'TagPrefix', N'KS');
IF NOT EXISTS (SELECT 1 FROM dbo.CRM_Setting WHERE SettingKey = N'ApiKey')
  INSERT INTO dbo.CRM_Setting (SettingKey, SettingValue) VALUES (N'ApiKey', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.CRM_Setting WHERE SettingKey = N'OfferDocStart')
  INSERT INTO dbo.CRM_Setting (SettingKey, SettingValue) VALUES (N'OfferDocStart', N'1000');
GO

-- Kullanıcı e-postası (teklif mailinde Reply-To / gönderen)
IF OBJECT_ID(N'dbo.SystemUser', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SystemUser', N'Email') IS NULL
  ALTER TABLE dbo.SystemUser ADD Email NVARCHAR(320) NULL;
GO

-- ─── Aksiyon tipleri ────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.CRM_ActionType', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_ActionType
  (
    ActionTypeID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_ActionType PRIMARY KEY,
    Title        NVARCHAR(100) NOT NULL,
    Icon         NVARCHAR(40)  NULL,
    CloseKind    TINYINT       NOT NULL CONSTRAINT DF_CRM_ActionType_CloseKind DEFAULT (0), -- 0 yok · 1 olumlu kapatır · 2 olumsuz kapatır
    SortOrder    INT           NOT NULL CONSTRAINT DF_CRM_ActionType_Sort DEFAULT (0),
    IsActive     BIT           NOT NULL CONSTRAINT DF_CRM_ActionType_IsActive DEFAULT (1)
  );

  INSERT INTO dbo.CRM_ActionType (Title, Icon, CloseKind, SortOrder) VALUES
    (N'Telefon Görüşmesi', N'phone', 0, 10),
    (N'Ziyaret / Toplantı', N'users', 0, 20),
    (N'E-posta', N'mail', 0, 30),
    (N'Teklif Hazırlama', N'fileText', 0, 40),
    (N'Demo / Sunum', N'presentation', 0, 50),
    (N'Takip / Hatırlatma', N'bell', 0, 60),
    (N'Olumlu Kapanış (Kazanıldı)', N'check', 1, 90),
    (N'Olumsuz Kapanış (Kaybedildi)', N'x', 2, 91);
END
GO

-- ─── Fırsat (Opportunity) ───────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.CRM_Opportunity', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_Opportunity
  (
    OpportunityID     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_Opportunity PRIMARY KEY,
    CustomerCardID    INT            NULL,
    CustomerContactID INT            NULL,
    ContactName       NVARCHAR(150)  NULL,
    ContactEmail      NVARCHAR(320)  NULL,
    ContactPhone      NVARCHAR(50)   NULL,
    Title             NVARCHAR(250)  NOT NULL,
    Description       NVARCHAR(MAX)  NULL,
    OppType           NVARCHAR(50)   NULL,          -- Satış / Hizmet / Proje / Bakım …
    Source            NVARCHAR(50)   NULL,          -- Web / Telefon / Referans / Fuar …
    Priority          TINYINT        NOT NULL CONSTRAINT DF_CRM_Opp_Priority DEFAULT (2), -- 1 Yüksek · 2 Normal · 3 Düşük
    Status            TINYINT        NOT NULL CONSTRAINT DF_CRM_Opp_Status DEFAULT (0),   -- 0 Açık · 1 Kazanıldı · 2 Kaybedildi · 3 İptal
    Probability       INT            NULL,
    ExpectedAmount    DECIMAL(18,2)  NULL,
    CurrencyID        INT            NULL,
    ExpectedCloseDate DATE           NULL,
    ReminderDate      DATETIME2      NULL,
    CloseDate         DATETIME2      NULL,
    CloseNote         NVARCHAR(1000) NULL,
    OwnerUserID       INT            NULL,
    CreateUserID      INT            NULL,
    CreateDate        DATETIME2      NOT NULL CONSTRAINT DF_CRM_Opp_CreateDate DEFAULT (SYSDATETIME()),
    UpdateDate        DATETIME2      NULL
  );
  CREATE INDEX IX_CRM_Opportunity_Customer ON dbo.CRM_Opportunity (CustomerCardID);
  CREATE INDEX IX_CRM_Opportunity_Status   ON dbo.CRM_Opportunity (Status, CreateDate DESC);
END
GO

-- ─── Aksiyon ────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.CRM_Action', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_Action
  (
    ActionID          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_Action PRIMARY KEY,
    OpportunityID     INT            NOT NULL,
    ActionTypeID      INT            NULL,
    ActionDate        DATETIME2      NOT NULL CONSTRAINT DF_CRM_Action_Date DEFAULT (SYSDATETIME()),
    DueDate           DATE           NULL,
    Description       NVARCHAR(MAX)  NULL,
    CustomerContactID INT            NULL,
    ContactName       NVARCHAR(150)  NULL,
    AssignedUserID    INT            NULL,
    IsDone            BIT            NOT NULL CONSTRAINT DF_CRM_Action_IsDone DEFAULT (0),
    DoneDate          DATETIME2      NULL,
    IsActive          BIT            NOT NULL CONSTRAINT DF_CRM_Action_IsActive DEFAULT (1),
    CreateUserID      INT            NULL,
    CreateDate        DATETIME2      NOT NULL CONSTRAINT DF_CRM_Action_CreateDate DEFAULT (SYSDATETIME())
  );
  CREATE INDEX IX_CRM_Action_Opportunity ON dbo.CRM_Action (OpportunityID);
END
GO

-- ─── Teklif başlığı ─────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.CRM_Offer', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_Offer
  (
    OfferID         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_Offer PRIMARY KEY,
    OpportunityID   INT            NOT NULL,
    ActionID        INT            NULL,
    DocNum          INT            NOT NULL,
    RevisionNo      INT            NOT NULL CONSTRAINT DF_CRM_Offer_Rev DEFAULT (0),
    ParentOfferID   INT            NULL,           -- revizyon zinciri
    OfferDate       DATE           NOT NULL,
    ValidityDate    DATE           NULL,
    Description     NVARCHAR(500)  NULL,
    CurrencyID      INT            NULL,
    GeneralDiscount DECIMAL(18,2)  NOT NULL CONSTRAINT DF_CRM_Offer_GDisc DEFAULT (0),
    SubTotal        DECIMAL(18,2)  NOT NULL CONSTRAINT DF_CRM_Offer_Sub DEFAULT (0),
    VatTotal        DECIMAL(18,2)  NOT NULL CONSTRAINT DF_CRM_Offer_Vat DEFAULT (0),
    GrandTotal      DECIMAL(18,2)  NOT NULL CONSTRAINT DF_CRM_Offer_Grand DEFAULT (0),
    PaymentTerms    NVARCHAR(500)  NULL,
    DeliveryTerms   NVARCHAR(500)  NULL,
    Notes           NVARCHAR(MAX)  NULL,
    Status          TINYINT        NOT NULL CONSTRAINT DF_CRM_Offer_Status DEFAULT (0), -- 0 Taslak · 1 Gönderildi · 2 Onaylandı · 3 Reddedildi · 4 Revize edildi
    IsActive        BIT            NOT NULL CONSTRAINT DF_CRM_Offer_IsActive DEFAULT (1),
    CreateUserID    INT            NULL,
    CreateDate      DATETIME2      NOT NULL CONSTRAINT DF_CRM_Offer_CreateDate DEFAULT (SYSDATETIME()),
    UpdateDate      DATETIME2      NULL
  );
  CREATE INDEX IX_CRM_Offer_Opportunity ON dbo.CRM_Offer (OpportunityID);
  CREATE INDEX IX_CRM_Offer_Action      ON dbo.CRM_Offer (ActionID);
END
GO

-- ─── Teklif kalemleri ───────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.CRM_OfferLine', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_OfferLine
  (
    OfferLineID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_OfferLine PRIMARY KEY,
    OfferID       INT            NOT NULL,
    LineNr        INT            NOT NULL,
    ProductCardID INT            NULL,
    ProductCode   NVARCHAR(50)   NULL,
    Description   NVARCHAR(500)  NULL,
    Quantity      DECIMAL(18,4)  NOT NULL CONSTRAINT DF_CRM_OfferLine_Qty DEFAULT (1),
    UnitName      NVARCHAR(30)   NULL,
    Price         DECIMAL(18,4)  NOT NULL CONSTRAINT DF_CRM_OfferLine_Price DEFAULT (0),
    DiscountRate  DECIMAL(9,4)   NOT NULL CONSTRAINT DF_CRM_OfferLine_DiscR DEFAULT (0),
    DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_CRM_OfferLine_DiscA DEFAULT (0),
    VatRate       DECIMAL(9,4)   NOT NULL CONSTRAINT DF_CRM_OfferLine_Vat DEFAULT (20),
    NetTotal      DECIMAL(18,2)  NOT NULL CONSTRAINT DF_CRM_OfferLine_Net DEFAULT (0)
  );
  CREATE INDEX IX_CRM_OfferLine_Offer ON dbo.CRM_OfferLine (OfferID);
END
GO

-- ─── Görüşmeler (telefon / yüz yüze / online notları) ──────────────────────
IF OBJECT_ID(N'dbo.CRM_Meeting', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_Meeting
  (
    MeetingID     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_Meeting PRIMARY KEY,
    OpportunityID INT            NOT NULL,
    ActionID      INT            NULL,
    MeetingDate   DATETIME2      NOT NULL CONSTRAINT DF_CRM_Meeting_Date DEFAULT (SYSDATETIME()),
    Channel       NVARCHAR(30)   NOT NULL CONSTRAINT DF_CRM_Meeting_Channel DEFAULT (N'Telefon'), -- Telefon / Yüz yüze / Online / Not
    Direction     TINYINT        NOT NULL CONSTRAINT DF_CRM_Meeting_Dir DEFAULT (2),             -- 1 Gelen · 2 Giden
    ContactName   NVARCHAR(150)  NULL,
    Subject       NVARCHAR(250)  NULL,
    Notes         NVARCHAR(MAX)  NULL,
    DurationMin   INT            NULL,
    NextStep      NVARCHAR(500)  NULL,
    NextStepDate  DATE           NULL,
    CreateUserID  INT            NULL,
    CreateDate    DATETIME2      NOT NULL CONSTRAINT DF_CRM_Meeting_CreateDate DEFAULT (SYSDATETIME())
  );
  CREATE INDEX IX_CRM_Meeting_Opportunity ON dbo.CRM_Meeting (OpportunityID);
END
GO

-- ─── Mail kaydı (Outlook CRM eklentisi + ERP'den gönderilen teklif mailleri) ─
IF OBJECT_ID(N'dbo.CRM_MailLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_MailLog
  (
    MailLogID       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_MailLog PRIMARY KEY,
    OpportunityID   INT             NULL,   -- konudaki /#KS-OpportunityID#/
    ActionID        INT             NULL,
    OfferID         INT             NULL,
    Direction       TINYINT         NOT NULL,  -- 1 Giden · 2 Gelen
    Status          TINYINT         NOT NULL,  -- 0 Taslak (Outlook .eml) · 1 Gönderildi · 2 Hata · 3 Alındı
    Channel         NVARCHAR(20)    NOT NULL,  -- SMTP / OUTLOOK_DRAFT / OUTLOOK
    TagCode         NVARCHAR(50)    NULL,
    Subject         NVARCHAR(500)   NULL,
    MailFrom        NVARCHAR(320)   NULL,
    MailTo          NVARCHAR(2000)  NULL,
    MailCc          NVARCHAR(2000)  NULL,
    Body            NVARCHAR(MAX)   NULL,
    IsHtml          BIT             NOT NULL CONSTRAINT DF_CRM_MailLog_IsHtml DEFAULT (0),
    AttachmentNames NVARCHAR(1000)  NULL,
    MessageId       NVARCHAR(500)   NULL,
    RawMessage      VARBINARY(MAX)  NULL,
    RawFileName     NVARCHAR(260)   NULL,
    ErrorMessage    NVARCHAR(2000)  NULL,
    MailDate        DATETIME2       NULL,
    CreateDate      DATETIME2       NOT NULL CONSTRAINT DF_CRM_MailLog_CreateDate DEFAULT (SYSDATETIME()),
    CreateUserID    INT             NULL,
    Source          NVARCHAR(100)   NULL
  );
  CREATE INDEX IX_CRM_MailLog_Opportunity ON dbo.CRM_MailLog (OpportunityID);
  CREATE INDEX IX_CRM_MailLog_Offer       ON dbo.CRM_MailLog (OfferID);
  CREATE INDEX IX_CRM_MailLog_MessageId   ON dbo.CRM_MailLog (MessageId);
END
GO
