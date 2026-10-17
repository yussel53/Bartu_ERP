-- 78: Onay grupları (Yönetici / Alt Yönetici / Müdür …)
--  · SYS_ApprovalGroup        : onay grubu (biri varsayılan)
--  · SYS_ApprovalGroupMember  : gruptaki kullanıcılar (SystemUser)
--  · SYS_ProcessTask.AssignedGroupId : görev bir gruba atanırsa grubun herhangi bir üyesi onaylar / reddeder
-- Gelen e-fatura «Onaya Gönder» penceresinde onay açıklaması + grup seçilir.

IF OBJECT_ID(N'dbo.SYS_ApprovalGroup', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ApprovalGroup (
    ApprovalGroupID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ApprovalGroup PRIMARY KEY,
    Code         NVARCHAR(40)  NOT NULL,
    Name         NVARCHAR(150) NOT NULL,
    Description  NVARCHAR(500) NULL,
    IsDefault    BIT NOT NULL CONSTRAINT DF_SYS_ApprovalGroup_IsDefault DEFAULT (0),
    IsActive     BIT NOT NULL CONSTRAINT DF_SYS_ApprovalGroup_IsActive DEFAULT (1),
    SortOrder    INT NOT NULL CONSTRAINT DF_SYS_ApprovalGroup_Sort DEFAULT (10),
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_SYS_ApprovalGroup_Created DEFAULT (SYSDATETIME()),
    UpdatedAt    DATETIME2 NULL,
    CONSTRAINT UQ_SYS_ApprovalGroup_Code UNIQUE (Code)
  );
END
GO

-- Tek varsayılan grup
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UX_SYS_ApprovalGroup_Default' AND object_id = OBJECT_ID(N'dbo.SYS_ApprovalGroup')
)
  CREATE UNIQUE NONCLUSTERED INDEX UX_SYS_ApprovalGroup_Default
    ON dbo.SYS_ApprovalGroup (IsDefault)
    WHERE IsDefault = 1;
GO

IF OBJECT_ID(N'dbo.SYS_ApprovalGroupMember', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ApprovalGroupMember (
    ApprovalGroupID INT NOT NULL
      CONSTRAINT FK_SYS_ApprovalGroupMember_Group REFERENCES dbo.SYS_ApprovalGroup (ApprovalGroupID) ON DELETE CASCADE,
    SystemUserID    INT NOT NULL,
    CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_SYS_ApprovalGroupMember_Created DEFAULT (SYSDATETIME()),
    CONSTRAINT PK_SYS_ApprovalGroupMember PRIMARY KEY (ApprovalGroupID, SystemUserID)
  );

  CREATE NONCLUSTERED INDEX IX_SYS_ApprovalGroupMember_User
    ON dbo.SYS_ApprovalGroupMember (SystemUserID);
END
GO

IF OBJECT_ID(N'dbo.SYS_ProcessTask', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SYS_ProcessTask', N'AssignedGroupId') IS NULL
  ALTER TABLE dbo.SYS_ProcessTask ADD AssignedGroupId INT NULL;
GO

-- Başlangıç grupları
IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ApprovalGroup)
BEGIN
  INSERT INTO dbo.SYS_ApprovalGroup (Code, Name, Description, IsDefault, SortOrder)
  VALUES
    (N'YONETICI',     N'Yönetici',     N'Genel yönetici onayı', 1, 10),
    (N'ALT_YONETICI', N'Alt Yönetici', N'Birim / alt yönetici onayı', 0, 20),
    (N'MUDUR',        N'Müdür',        N'Müdür onayı', 0, 30);

  -- 76'daki YONETICI rolündeki kullanıcılar Yönetici grubuna
  IF OBJECT_ID(N'dbo.SYS_UserRole', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_Role', N'U') IS NOT NULL
    INSERT INTO dbo.SYS_ApprovalGroupMember (ApprovalGroupID, SystemUserID)
    SELECT g.ApprovalGroupID, ur.SystemUserID
    FROM dbo.SYS_UserRole ur
    JOIN dbo.SYS_Role r ON r.Id = ur.RoleId AND r.Code = N'YONETICI'
    JOIN dbo.SYS_ApprovalGroup g ON g.Code = N'YONETICI';
END
GO
