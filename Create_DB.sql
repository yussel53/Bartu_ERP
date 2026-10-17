USE [AQUAN]
GO

/****** Object:  Table [dbo].[AAAAciklamalar]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AAAAciklamalar](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[SayisalAlan] [int] NULL,
	[Aciklama] [nvarchar](250) NULL,
	[SayisalAlan2] [int] NULL,
	[Turu] [int] NULL,
	[Aciklama2] [nvarchar](250) NULL,
	[Aciklama3] [nvarchar](250) NULL,
 CONSTRAINT [PK_AAAAciklamalar] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountCard](
	[AccountCardID] [int] NOT NULL,
	[CompanyID] [int] NULL,
	[DepartmentID] [int] NULL,
	[AccountGroup] [int] NULL,
	[Type_] [tinyint] NULL,
	[IsActive] [bit] NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[MainAccountID] [int] NULL,
	[MainAccount] [bit] NULL,
	[DefaultCurrency] [int] NULL,
	[DefaultRate] [int] NULL,
 CONSTRAINT [PK_Account] PRIMARY KEY CLUSTERED 
(
	[AccountCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountGroup]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountGroup](
	[AccountGroupID] [int] NOT NULL,
	[IsActive] [bit] NULL,
	[Description] [nvarchar](max) NULL,
 CONSTRAINT [PK_AccountGroup] PRIMARY KEY CLUSTERED 
(
	[AccountGroupID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountLink]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountLink](
	[AccountLinkID] [int] NOT NULL,
	[AccountGroupID] [int] NULL,
	[AccountGroup] [int] NULL,
	[StartDate] [datetime] NULL,
	[EndDate] [datetime] NULL,
	[IsActive] [bit] NULL,
	[CompanyID] [int] NULL,
	[CountryID] [int] NULL,
	[DepartmentID] [int] NULL,
 CONSTRAINT [PK_AccountLink] PRIMARY KEY CLUSTERED 
(
	[AccountLinkID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountLinkDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountLinkDetail](
	[AccountLinkDetailID] [int] NOT NULL,
	[AccountLinkID] [int] NULL,
	[AccountID] [int] NULL,
	[SourceCardID] [int] NULL,
	[Module] [int] NULL,
	[Type] [int] NULL,
 CONSTRAINT [PK_AccountLinkDetail] PRIMARY KEY CLUSTERED 
(
	[AccountLinkDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountLinkTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountLinkTrans](
	[AccountLinkTransID] [int] NOT NULL,
	[AccountGroup] [int] NULL,
	[AccountLinkID] [int] NULL,
	[ModuleID] [int] NULL,
	[TransType] [int] NULL,
	[AccountCardID] [int] NULL,
	[Type_] [int] NULL,
 CONSTRAINT [PK_AccountLinkTrans] PRIMARY KEY CLUSTERED 
(
	[AccountLinkTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountTrans](
	[AccountTrasnID] [int] NULL,
	[AccountGroup] [int] NULL,
	[CompanyID] [int] NULL,
	[DepartmentID] [int] NULL,
	[Type_] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[AccountCardID] [int] NULL,
	[Description] [nvarchar](max) NULL,
	[Amount] [float] NULL,
	[TotalType_] [smallint] NULL,
	[TransDate] [datetime] NULL,
	[AccountVoucherNr] [tinyint] NULL,
	[AccontCountrySystem] [tinyint] NULL,
	[Currency] [int] NULL,
	[CurrencyRate] [float] NULL,
	[CurrencyAmount] [float] NULL,
	[TransLineNo] [int] NULL,
	[GlobalLineNo] [int] NULL,
	[CrossAccountID] [int] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountTransDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountTransDetail](
	[AccountTransDetailID] [int] NOT NULL,
	[AccountGroup] [int] NULL,
	[AccountTrasnID] [int] NULL,
	[ExpenseID] [int] NULL,
	[Amount] [float] NULL,
	[TotalType_] [smallint] NULL,
	[CurrencyAmount] [float] NULL,
	[AccountSlipNr] [tinyint] NULL,
	[AccontCountrySystem] [tinyint] NULL,
	[Currency] [int] NULL,
	[CurrencyRate] [float] NULL,
	[TransLineNo] [int] NULL,
 CONSTRAINT [PK_AccountTransDetail] PRIMARY KEY CLUSTERED 
(
	[AccountTransDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AccountVoucher]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AccountVoucher](
	[AccountVoucherID] [int] NOT NULL,
	[CompanyID] [int] NULL,
	[DepartmentID] [int] NULL,
	[AccountGroup] [int] NULL,
	[Type] [tinyint] NULL,
	[Status] [tinyint] NULL,
	[DocumentNumber] [nvarchar](50) NULL,
	[SourceModule] [smallint] NULL,
	[SourceID] [int] NULL,
	[VoucherDate] [datetime] NULL,
	[Description] [nvarchar](max) NULL,
	[SumDebit] [float] NULL,
	[SumCredit] [float] NULL,
	[AccountVoucherType] [tinyint] NULL,
	[AccontCountrySystem] [tinyint] NULL,
	[journalNO] [nvarchar](50) NULL,
 CONSTRAINT [PK_AccountSlip] PRIMARY KEY CLUSTERED 
(
	[AccountVoucherID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ActionType]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ActionType](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](max) NULL,
	[Flag] [bit] NOT NULL,
	[MenuID] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.ActionType] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AuxilCodes]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AuxilCodes](
	[AuxilCodesID] [int] NOT NULL,
	[AuxilCODE] [nvarchar](50) NULL,
	[AuxilDefinition] [nvarchar](max) NULL,
	[Trcode] [smallint] NULL,
	[Type] [smallint] NULL,
 CONSTRAINT [PK_AuxilCodes] PRIMARY KEY CLUSTERED 
(
	[AuxilCodesID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[AuxilCodeTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[AuxilCodeTrans](
	[AuxilCodeTransID] [int] NOT NULL,
	[MainCardID] [int] NULL,
	[AuxilCode] [nvarchar](50) NULL,
	[LineNr] [int] NULL,
	[ModuleNr] [int] NULL,
	[Trcode] [int] NULL,
	[Type] [int] NULL,
	[Definition] [nvarchar](150) NULL,
 CONSTRAINT [PK_AuxilCodeTrans] PRIMARY KEY CLUSTERED 
(
	[AuxilCodeTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[BankAccountCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BankAccountCard](
	[BankAccountCardID] [int] NULL,
	[BankCardID] [int] NULL,
	[IsActive] [bit] NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[Currency] [int] NULL,
	[CurrencyRate] [smallint] NULL,
	[IbanNO] [nvarchar](30) NULL,
	[SwiftNO] [nvarchar](20) NULL,
	[AccountNO] [nvarchar](20) NULL,
	[CountryID] [smallint] NULL,
	[AccountGroupID] [int] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[BankCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BankCard](
	[BankCardID] [int] NULL,
	[IsActive] [bit] NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[BankCode] [nvarchar](40) NULL,
	[Adress] [nvarchar](250) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[BankTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BankTrans](
	[BankTtansID] [int] NOT NULL,
	[Type_] [tinyint] NOT NULL,
	[Status_] [tinyint] NOT NULL,
	[TransDate] [datetime] NULL,
	[BankCardID] [int] NULL,
	[BankAccountCardID] [int] NULL,
	[Amount] [float] NULL,
	[Expense] [float] NULL,
	[TransLineNo] [int] NULL,
 CONSTRAINT [PK_BankTrans] PRIMARY KEY CLUSTERED 
(
	[BankTtansID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[BankVoucher]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BankVoucher](
	[BankVoucherID] [int] NOT NULL,
	[Type_] [tinyint] NOT NULL,
	[Status_] [tinyint] NULL,
	[VoucherDate] [datetime] NULL,
	[Amount] [float] NULL,
 CONSTRAINT [PK_BankSlip] PRIMARY KEY CLUSTERED 
(
	[BankVoucherID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[BoundCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BoundCard](
	[BoundCardID] [int] NOT NULL,
	[Type_] [tinyint] NOT NULL,
	[Status_] [tinyint] NOT NULL,
	[DocumentNr] [nvarchar](50) NULL,
	[TransDate] [datetime] NULL,
	[DueDate] [datetime] NULL,
	[Amount] [float] NULL,
	[Currency] [int] NULL,
	[CurrencyRate] [float] NULL,
	[CustomerID] [int] NULL,
 CONSTRAINT [PK_CheckCard] PRIMARY KEY CLUSTERED 
(
	[BoundCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[BoundTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[BoundTrans](
	[BoundTransID] [int] NOT NULL,
	[CheckID] [int] NULL,
	[Type_] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[Modulenr] [int] NULL,
	[CustomerID] [int] NULL,
	[BankAccountID] [int] NULL,
	[LineNr] [int] NULL,
	[TransDate] [datetime] NULL,
 CONSTRAINT [PK_CheckTrans] PRIMARY KEY CLUSTERED 
(
	[BoundTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[CustomerAdress]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CustomerAdress](
	[CustomerAdressID] [int] NOT NULL,
	[CustomerCardID] [int] NULL,
	[Active] [bit] NULL,
	[IsDefault] [bit] NULL,
	[AdressCode] [nvarchar](50) NULL,
	[Adress] [nvarchar](max) NULL,
	[City] [nvarchar](80) NULL,
	[Town] [nvarchar](80) NULL,
	[Dictrict] [nvarchar](80) NULL,
	[Country] [nvarchar](80) NULL,
	[CTDCode] [int] NULL,
	[LocationCode] [nvarchar](max) NULL,
	[CountryCode] [nvarchar](5) NULL,
	[TaxNr] [nvarchar](50) NULL,
	[TaxOffice] [nvarchar](50) NULL,
	[TaxType] [int] NULL,
	[AccountGroupID] [int] NULL,
 CONSTRAINT [PK_CustomerAdress] PRIMARY KEY CLUSTERED 
(
	[CustomerAdressID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[CustomerCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CustomerCard](
	[CustomerCardID] [int] NOT NULL,
	[DefultCompanyID] [int] NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[Active] [bit] NULL,
	[Language] [int] NULL,
	[SalesModuleCheck] [bit] NULL,
	[PurchaseModuleCheck] [bit] NULL,
	[FinanceModuleCheck] [bit] NULL,
	[RiskGroupID] [int] NULL,
	[EinvoiceType] [int] NULL,
	[TaxNr] [nvarchar](50) NULL,
	[TaxOffice] [nvarchar](50) NULL,
	[TaxType] [int] NULL,
	[AccountGroupID] [int] NOT NULL,
 CONSTRAINT [PK_CustomerCard] PRIMARY KEY CLUSTERED 
(
	[CustomerCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[CustomerContact]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CustomerContact](
	[CustomerContactID] [int] NOT NULL,
	[CustomerCardID] [int] NULL,
	[IsDefault] [bit] NULL,
	[ContactType] [smallint] NULL,
	[ContactTitle] [nvarchar](50) NULL,
	[Contact] [nvarchar](50) NULL,
	[DefaultCurrency] [int] NULL,
 CONSTRAINT [PK_CustomerContact] PRIMARY KEY CLUSTERED 
(
	[CustomerContactID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[CustomerEinvoiceDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CustomerEinvoiceDetail](
	[CustomerEinvoiceDetail] [int] NOT NULL,
	[LineNr] [nchar](10) NULL,
	[CustomerID] [nchar](10) NULL,
	[CustomerAdressID] [nchar](10) NULL,
	[EinvoiceCode] [nvarchar](50) NULL,
	[EinvoiceCountry] [int] NULL,
	[IsDefault] [bit] NULL,
	[SenderLabel] [nvarchar](150) NULL,
	[PostLabel] [nvarchar](150) NULL,
	[CountryID] [smallint] NULL,
	[EinvoiceEntryDate] [datetime] NULL,
	[EinvoiceEmailAdress] [nvarchar](50) NULL,
 CONSTRAINT [PK_CustomerEinvoiceDetail] PRIMARY KEY CLUSTERED 
(
	[CustomerEinvoiceDetail] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[CustomerTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CustomerTrans](
	[CustomerTransID] [int] NOT NULL,
	[Type] [tinyint] NOT NULL,
	[Status] [tinyint] NOT NULL,
	[CustomerID] [int] NULL,
	[SourceID] [int] NULL,
	[TransDate] [datetime] NULL,
	[LocalAmount] [float] NULL,
	[CustomerCurrency] [int] NULL,
	[CustomerCurrencyRate] [float] NULL,
	[CustomerCurrencyTotal] [float] NULL,
 CONSTRAINT [PK_CustomerTrans] PRIMARY KEY CLUSTERED 
(
	[CustomerTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[CustomerVoucher]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[CustomerVoucher](
	[CustomerVoucherID] [int] NOT NULL,
	[Type] [tinyint] NOT NULL,
	[Status] [tinyint] NULL,
	[CustomerID] [int] NULL,
	[VoucherDate] [datetime] NULL,
	[DocumentNumber] [nvarchar](50) NULL,
	[AvgDueDate] [datetime] NULL,
	[Description] [nvarchar](max) NULL,
	[Amount] [float] NULL,
 CONSTRAINT [PK_CustomerSlip] PRIMARY KEY CLUSTERED 
(
	[CustomerVoucherID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[DailyAction]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[DailyAction](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[Comment] [nvarchar](max) NULL,
	[CreateUserID] [int] NULL,
	[Date_] [date] NULL,
	[IsLocked] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.DailyAction] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[DailyActionDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[DailyActionDetail](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[DailyActionID] [int] NULL,
	[PersonID] [int] NOT NULL,
	[JobID] [int] NOT NULL,
	[MonthlyActionID] [int] NULL,
	[StartTime] [time](7) NULL,
	[EndTime] [time](7) NULL,
	[BreakTime] [time](7) NULL,
	[Factor] [float] NULL,
	[Price] [float] NULL,
	[Comment] [nvarchar](max) NULL,
	[IsActive] [bit] NOT NULL,
	[DayCount] [int] NULL,
 CONSTRAINT [PK_dbo.DailyActionDetail] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Invoice]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Invoice](
	[InvoiceID] [int] NOT NULL,
	[InvoiceType] [tinyint] NULL,
	[InvoiceDate] [datetime] NULL,
	[DocumentNumber] [nvarchar](50) NULL,
	[CompanyID] [int] NULL,
	[DepartmentID] [int] NULL,
	[Type_] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[WhouseID] [int] NULL,
	[CustomerID] [int] NULL,
	[CustomerAdressID] [int] NULL,
	[Description] [nvarchar](max) NULL,
 CONSTRAINT [PK_Invoice] PRIMARY KEY CLUSTERED 
(
	[InvoiceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[JobRegion]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[JobRegion](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[FrmNr] [int] NOT NULL,
 CONSTRAINT [PK_dbo.JobRegion] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Menu]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Menu](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[UserID] [int] NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.Menu] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[MenuAction]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[MenuAction](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](20) NOT NULL,
	[UserID] [int] NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.MenuAction] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[MenuItems]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[MenuItems](
	[ID] [int] NULL,
	[Nr] [nvarchar](50) NULL,
	[Description] [nvarchar](50) NULL,
	[LanguageID] [int] NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[MonthlyAction]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[MonthlyAction](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[PersonID] [int] NOT NULL,
	[BeginDate] [date] NULL,
	[EndDate] [date] NULL,
	[Amount_] [float] NOT NULL,
	[WorkDay] [int] NULL,
	[WorkTime] [float] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[Lref] [int] NULL,
 CONSTRAINT [PK_dbo.MonthlyAction] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[OrderTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[OrderTrans](
	[OrderTransID] [int] NOT NULL,
	[OrderSlipID] [int] NULL,
	[WhouseID] [int] NULL,
	[Type_] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[DepartmentID] [int] NULL,
	[CostGroup] [int] NULL,
	[ItemsID] [int] NULL,
	[Description] [nvarchar](50) NULL,
	[Quantity] [float] NULL,
	[UnitID] [int] NULL,
	[Price] [float] NULL,
	[TotalDiscount] [float] NULL,
	[TotalPrice] [float] NULL,
	[TransLineNo] [int] NULL,
 CONSTRAINT [PK_OrderTrans] PRIMARY KEY CLUSTERED 
(
	[OrderTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[OrderTransProductTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[OrderTransProductTrans](
	[OrderTransProductTransID] [int] NOT NULL,
	[OrderTransID] [int] NULL,
	[ProductTransID] [int] NULL,
	[Quantity] [float] NULL,
	[Date] [datetime] NULL,
 CONSTRAINT [PK_OrderTransMTrans] PRIMARY KEY CLUSTERED 
(
	[OrderTransProductTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[OrderVoucher]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[OrderVoucher](
	[OrderVoucherID] [int] NOT NULL,
	[CompanyID] [int] NULL,
	[WhouseID] [int] NULL,
	[Type_] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[DepartmentID] [int] NULL,
	[OrderSlipNo] [nvarchar](50) NULL,
	[OrderDate] [datetime] NULL,
	[CustomerID] [int] NULL,
	[CustomerAdressID] [int] NULL,
	[Description] [nvarchar](max) NULL,
 CONSTRAINT [PK_OrderSlip] PRIMARY KEY CLUSTERED 
(
	[OrderVoucherID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[PaidPlanCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PaidPlanCard](
	[PaidPlanID] [int] NULL,
	[Code] [nvarchar](50) NULL,
	[Decription] [nchar](10) NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[PaymentClosedTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PaymentClosedTrans](
	[PaymentclosedTransID] [int] NULL,
	[SourcePaymentTransID] [int] NULL,
	[AimPaymentTransID] [int] NULL,
	[ClosedDate] [datetime] NULL,
	[CurrencyTotal] [float] NULL,
	[DebitPaymentID] [int] NULL,
	[CredistPaymentID] [int] NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[PaymentTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PaymentTrans](
	[PaymentTransID] [int] NOT NULL,
	[CustomerID] [int] NULL,
	[BankAccountID] [int] NULL,
	[SourceID] [int] NULL,
	[Module] [tinyint] NULL,
	[CompanyID] [int] NULL,
	[DepartmentID] [int] NULL,
	[Type_] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[DueDate] [datetime] NULL,
	[SourceSlipDate] [datetime] NULL,
	[GroupNr] [int] NULL,
	[DiscDate] [datetime] NULL,
	[CurrencyTotal] [float] NULL,
	[Closed] [bit] NULL,
	[Currency] [int] NULL,
	[CurrencyRate] [float] NULL,
	[LocationTotal] [float] NULL,
	[ClosedPaymentID] [int] NULL,
	[CustomerCurrency] [int] NULL,
	[CustomerCurrencyRate] [float] NULL,
	[TransLineNo] [int] NULL,
 CONSTRAINT [PK_PaymentTrans] PRIMARY KEY CLUSTERED 
(
	[PaymentTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[PersonCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PersonCard](
	[PersonCardID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](21) NULL,
	[Surname] [nvarchar](21) NULL,
	[Sex] [smallint] NOT NULL,
	[CountryIDNo] [nvarchar](21) NULL,
	[BirthDate] [datetime] NULL,
	[InDate] [datetime] NULL,
	[OutDate] [datetime] NULL,
	[IsActive] [bit] NOT NULL,
	[Lref] [int] NOT NULL,
	[JobRegionID] [int] NULL,
	[Code] [nvarchar](17) NULL,
	[Paid] [float] NOT NULL,
	[PaidType] [smallint] NOT NULL,
	[JobRegionDeptID] [int] NULL,
	[JobRegionLocID] [int] NULL,
 CONSTRAINT [PK_dbo.Person] PRIMARY KEY CLUSTERED 
(
	[PersonCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[PersonDocument]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PersonDocument](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[PersonID] [int] NOT NULL,
	[Name] [nvarchar](max) NULL,
	[TypeID] [int] NOT NULL,
	[Content] [varbinary](max) NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.PersonDocument] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductBarcode]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductBarcode](
	[ProductBarcodeID] [int] IDENTITY(1,1) NOT NULL,
	[Barcode] [nvarchar](50) NULL,
	[LineNr] [int] NULL,
	[Type] [int] NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductCard](
	[ProductCardID] [int] NOT NULL,
	[ProductType] [tinyint] NULL,
	[IsActive] [bit] NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[TaxCardID] [int] NULL,
	[DefaultUnitID] [int] NULL,
	[IsVariant] [bit] NULL,
	[AccountGroupID] [int] NOT NULL,
 CONSTRAINT [PK_ProductCard] PRIMARY KEY CLUSTERED 
(
	[ProductCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductSub]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductSub](
	[ProductSubID] [int] NOT NULL,
	[Type] [tinyint] NULL,
	[MainProductCardID] [int] NULL,
	[SubProductCardID] [int] NULL,
	[Quantity] [float] NULL,
	[UnitID] [int] NULL,
	[CostRate] [float] NULL,
	[PriceRate] [float] NULL,
 CONSTRAINT [PK_ItemSub] PRIMARY KEY CLUSTERED 
(
	[ProductSubID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductTrans](
	[ProductTransID] [int] NOT NULL,
	[ProductVoucherID] [int] NULL,
	[ModuleID] [int] NULL,
	[TransType] [int] NULL,
	[VoucherType] [int] NULL,
	[Status_] [int] NULL,
	[TransDate] [datetime] NULL,
	[WhouseID] [int] NULL,
	[DepartmentID] [int] NULL,
	[CostGroup] [int] NULL,
	[CostProjectGroup] [int] NULL,
	[ProductCardID] [int] NULL,
	[Description] [nchar](10) NULL,
	[Quantity] [float] NULL,
	[Price] [float] NULL,
	[TotalDiscount] [float] NULL,
	[TotalCost] [float] NULL,
	[TotalPrice] [float] NULL,
	[TotalTax] [float] NULL,
	[UnitID] [int] NULL,
	[MainUnitQuantity] [int] NULL,
	[LineUnitQuantity] [int] NULL,
	[InvoiceID] [int] NULL,
	[AuxilCode] [nvarchar](50) NULL,
	[CustomerTrackCode] [nvarchar](50) NULL,
	[TransMonth] [int] NULL,
	[TransYear] [int] NULL,
	[GroupNr] [int] NULL,
	[Description1] [nvarchar](max) NULL,
	[TransLineNo] [int] NULL,
	[AccountGroupID] [int] NULL,
 CONSTRAINT [PK_MTrans] PRIMARY KEY CLUSTERED 
(
	[ProductTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductTransCalcDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductTransCalcDetail](
	[ProductTransCalcDetailID] [int] NOT NULL,
	[ProductTransID] [int] NULL,
	[Type] [int] NULL,
	[DiscountCostID] [int] NULL,
	[TransLineNo] [int] NULL,
	[Amount] [float] NULL,
	[SourceType] [int] NULL,
	[SourceID] [int] NULL,
 CONSTRAINT [PK_MTransCalcDetail] PRIMARY KEY CLUSTERED 
(
	[ProductTransCalcDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductTransCostCalc]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductTransCostCalc](
	[ProductTransCostCalcID] [int] NULL,
	[MtransID] [int] NULL,
	[Type] [int] NULL,
	[SourceMTransID] [int] NULL,
	[Amount] [float] NULL,
	[CostGroup] [int] NULL,
	[CostProjectGroup] [int] NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductTransSize]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductTransSize](
	[ProductTransSizeID] [int] NOT NULL,
	[ProductTransID] [int] NULL,
	[ProductTransSizeType] [int] NULL,
	[Quantity] [float] NULL,
	[UnitID] [int] NULL,
	[ProductTransGrossKG] [float] NULL,
	[ProductTransGrossMt] [float] NULL,
	[ProductTransNetKG] [float] NULL,
	[ProductTransNetMt] [float] NULL,
 CONSTRAINT [PK_MTransSize] PRIMARY KEY CLUSTERED 
(
	[ProductTransSizeID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductTransTaxDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductTransTaxDetail](
	[ProductTransTaxDetailID] [int] NOT NULL,
	[ProductTransID] [int] NULL,
	[TaxCalcID] [int] NULL,
	[TaxType] [int] NULL,
	[LineNr] [int] NULL,
	[TaxMatrah] [float] NULL,
	[TaxRate] [float] NULL,
	[Tax] [float] NULL,
	[TaxCountryID] [int] NOT NULL,
 CONSTRAINT [PK_MTransTaxDetail] PRIMARY KEY CLUSTERED 
(
	[ProductTransTaxDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductTransTrack]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductTransTrack](
	[ProductTransTrackID] [int] NOT NULL,
	[ProductTransID] [int] NULL,
	[TrackType] [tinyint] NULL,
	[TransType] [smallint] NULL,
	[TransLineNo] [int] NULL,
	[Title] [nvarchar](50) NULL,
	[ProductTrackID] [int] NULL,
	[Quantity] [float] NULL,
	[LocationID] [int] NULL,
 CONSTRAINT [PK_MTransTrack] PRIMARY KEY CLUSTERED 
(
	[ProductTransTrackID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ProductVoucher]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ProductVoucher](
	[ProductVoucherID] [int] NOT NULL,
	[ModuleID] [tinyint] NULL,
	[DepartmentID] [int] NULL,
	[VoucherType] [int] NULL,
	[VoucherDate] [datetime] NULL,
	[DocumentNumber] [nvarchar](50) NOT NULL,
	[Type] [tinyint] NULL,
	[Status_] [tinyint] NULL,
	[CompanyID] [int] NULL,
	[WhouseID] [int] NULL,
	[CustomerID] [int] NULL,
	[CustomerAdressID] [int] NULL,
	[Description] [nvarchar](max) NULL,
 CONSTRAINT [PK_MSlip] PRIMARY KEY CLUSTERED 
(
	[ProductVoucherID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[RiskGroup]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[RiskGroup](
	[RiskGroupID] [int] NOT NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[IsActive] [bit] NULL,
 CONSTRAINT [PK_RiskGroup] PRIMARY KEY CLUSTERED 
(
	[RiskGroupID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[RiskGroupDetail]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[RiskGroupDetail](
	[RiskGroupDetailID] [int] NOT NULL,
	[RiskGroupID] [int] NULL,
	[ModuleID] [int] NULL,
	[Formula] [nvarchar](max) NULL,
	[IsActive] [bit] NULL,
 CONSTRAINT [PK_RiskGroupDetail] PRIMARY KEY CLUSTERED 
(
	[RiskGroupDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[SafeCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[SafeCard](
	[SafeCardID] [int] NULL,
	[IsActive] [bit] NULL,
	[Code] [nvarchar](150) NULL,
	[Defintion] [nvarchar](250) NULL,
	[Currency] [int] NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Setting]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Setting](
	[SettingID] [int] NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](50) NULL,
	[Value] [nvarchar](50) NULL
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Sýralama]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Sýralama](
	[ID] [int] NULL,
	[IsActive] [bit] NULL,
	[CompanyID] [int] NULL,
	[DepartmanID] [int] NULL,
	[Type_] [smallint] NULL,
	[Status_] [smallint] NULL,
	[UstFýsID] [int] NULL,
	[Date] [datetime] NULL,
	[Code_veya_DokumanNo] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[kaynakID] [int] NULL,
	[VoucherType] [int] NULL,
	[Location] [int] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[SystemUser]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[SystemUser](
	[SystemUserID] [int] IDENTITY(1,1) NOT NULL,
	[NickName] [nvarchar](20) NOT NULL,
	[Name] [nvarchar](50) NOT NULL,
	[Surname] [nvarchar](50) NOT NULL,
	[Password] [nvarchar](max) NULL,
	[Type] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.User] PRIMARY KEY CLUSTERED 
(
	[SystemUserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[SystemUserLOG]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[SystemUserLOG](
	[SystemUserLOGID] [int] NOT NULL,
	[SystemUserID] [int] NULL,
	[ModuleID] [int] NULL,
	[SourceID] [int] NULL,
	[Type] [smallint] NULL,
	[Date] [datetime] NULL,
	[Description] [nvarchar](max) NULL,
	[IsCreated] [bit] NULL,
 CONSTRAINT [PK_SystemUserLOG] PRIMARY KEY CLUSTERED 
(
	[SystemUserLOGID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[TaxCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[TaxCard](
	[TaxCardID] [int] NOT NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[Type_] [tinyint] NULL,
	[IsActive] [bit] NULL,
	[AccountGroupID] [int] NOT NULL,
 CONSTRAINT [PK_TaxCalc] PRIMARY KEY CLUSTERED 
(
	[TaxCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[TaxLine]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[TaxLine](
	[TaxLineID] [int] NOT NULL,
	[TaxCardID] [int] NULL,
	[Type_] [tinyint] NULL,
	[LineNr] [int] NULL,
	[Priority] [int] NULL,
	[Module] [int] NULL,
	[Formula] [nvarchar](250) NULL,
 CONSTRAINT [PK_TaxCalcLine] PRIMARY KEY CLUSTERED 
(
	[TaxLineID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[TLanguage]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[TLanguage](
	[LID] [int] IDENTITY(1,1) NOT NULL,
	[LanguageKey] [nvarchar](max) NULL,
	[ModuleID] [nchar](10) NULL,
	[FormID] [nchar](10) NULL,
	[LineNr] [nchar](10) NULL,
	[Type] [nchar](10) NULL,
	[English] [nvarchar](max) NULL,
	[Turkish] [nvarchar](max) NULL,
	[Deutche] [nvarchar](max) NULL,
 CONSTRAINT [PK_TLanguage] PRIMARY KEY CLUSTERED 
(
	[LID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[UserMenuAuth]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[UserMenuAuth](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[UserID] [int] NULL,
	[MenuID] [int] NOT NULL,
	[MenuActionID] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
 CONSTRAINT [PK_dbo.UserMenuAuth] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[VariantCard]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[VariantCard](
	[VariantCardID] [int] NOT NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
	[ProductCardID] [int] NULL,
	[UnitID] [int] NULL,
	[TaxCalcID] [int] NULL,
	[AccountGroupID] [int] NULL,
 CONSTRAINT [PK_Variant] PRIMARY KEY CLUSTERED 
(
	[VariantCardID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[VariantPropertiesTrans]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[VariantPropertiesTrans](
	[VariantPropertiesTransID] [int] NOT NULL,
	[VariantID] [int] NULL,
	[VariantPropertiesID] [int] NULL,
 CONSTRAINT [PK_VariantPropertiesTrans] PRIMARY KEY CLUSTERED 
(
	[VariantPropertiesTransID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[VaritantProperties]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[VaritantProperties](
	[VaritantPropertiesID] [int] NOT NULL,
	[Code] [nvarchar](50) NULL,
	[Title] [nvarchar](max) NULL,
 CONSTRAINT [PK_VaritantProperties] PRIMARY KEY CLUSTERED 
(
	[VaritantPropertiesID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[VoucherType]    Script Date: 22.09.2026 19:49:37 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[VoucherType](
	[VoucherTypeID] [int] NULL,
	[Code] [int] NULL,
	[ModuleID] [int] NULL,
	[Type] [int] NULL,
	[Status] [bit] NULL,
	[Description] [nvarchar](150) NULL
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[JobRegion] ADD  DEFAULT ((0)) FOR [FrmNr]
GO

ALTER TABLE [dbo].[PersonCard] ADD  DEFAULT ((0)) FOR [Paid]
GO

ALTER TABLE [dbo].[PersonCard] ADD  DEFAULT ((0)) FOR [PaidType]
GO

ALTER TABLE [dbo].[ActionType]  WITH CHECK ADD  CONSTRAINT [FK_dbo.ActionType_dbo.Menu_MenuID] FOREIGN KEY([MenuID])
REFERENCES [dbo].[Menu] ([ID])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[ActionType] CHECK CONSTRAINT [FK_dbo.ActionType_dbo.Menu_MenuID]
GO

ALTER TABLE [dbo].[CustomerAdress]  WITH CHECK ADD  CONSTRAINT [FK_CustomerAdress_Customer] FOREIGN KEY([CustomerCardID])
REFERENCES [dbo].[CustomerCard] ([CustomerCardID])
GO

ALTER TABLE [dbo].[CustomerAdress] CHECK CONSTRAINT [FK_CustomerAdress_Customer]
GO

ALTER TABLE [dbo].[CustomerCard]  WITH CHECK ADD  CONSTRAINT [FK_Customer_RiskGroup] FOREIGN KEY([RiskGroupID])
REFERENCES [dbo].[RiskGroup] ([RiskGroupID])
GO

ALTER TABLE [dbo].[CustomerCard] CHECK CONSTRAINT [FK_Customer_RiskGroup]
GO

ALTER TABLE [dbo].[DailyAction]  WITH CHECK ADD  CONSTRAINT [FK_dbo.DailyAction_dbo.User_CreateUserID] FOREIGN KEY([CreateUserID])
REFERENCES [dbo].[SystemUser] ([SystemUserID])
GO

ALTER TABLE [dbo].[DailyAction] CHECK CONSTRAINT [FK_dbo.DailyAction_dbo.User_CreateUserID]
GO

ALTER TABLE [dbo].[DailyActionDetail]  WITH CHECK ADD  CONSTRAINT [FK_dbo.DailyActionDetail_dbo.DailyAction_DailyActionID] FOREIGN KEY([DailyActionID])
REFERENCES [dbo].[DailyAction] ([ID])
GO

ALTER TABLE [dbo].[DailyActionDetail] CHECK CONSTRAINT [FK_dbo.DailyActionDetail_dbo.DailyAction_DailyActionID]
GO

ALTER TABLE [dbo].[DailyActionDetail]  WITH CHECK ADD  CONSTRAINT [FK_dbo.DailyActionDetail_dbo.MonthlyAction_MonthlyActionID] FOREIGN KEY([MonthlyActionID])
REFERENCES [dbo].[MonthlyAction] ([ID])
GO

ALTER TABLE [dbo].[DailyActionDetail] CHECK CONSTRAINT [FK_dbo.DailyActionDetail_dbo.MonthlyAction_MonthlyActionID]
GO

ALTER TABLE [dbo].[DailyActionDetail]  WITH CHECK ADD  CONSTRAINT [FK_dbo.DailyActionDetail_dbo.Person_PersonID] FOREIGN KEY([PersonID])
REFERENCES [dbo].[PersonCard] ([PersonCardID])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[DailyActionDetail] CHECK CONSTRAINT [FK_dbo.DailyActionDetail_dbo.Person_PersonID]
GO

ALTER TABLE [dbo].[Menu]  WITH CHECK ADD  CONSTRAINT [FK_dbo.Menu_dbo.User_CreateUserID] FOREIGN KEY([UserID])
REFERENCES [dbo].[SystemUser] ([SystemUserID])
GO

ALTER TABLE [dbo].[Menu] CHECK CONSTRAINT [FK_dbo.Menu_dbo.User_CreateUserID]
GO

ALTER TABLE [dbo].[MenuAction]  WITH CHECK ADD  CONSTRAINT [FK_dbo.MenuAction_dbo.User_CreateUserID] FOREIGN KEY([UserID])
REFERENCES [dbo].[SystemUser] ([SystemUserID])
GO

ALTER TABLE [dbo].[MenuAction] CHECK CONSTRAINT [FK_dbo.MenuAction_dbo.User_CreateUserID]
GO

ALTER TABLE [dbo].[MonthlyAction]  WITH CHECK ADD  CONSTRAINT [FK_dbo.MonthlyAction_dbo.Person_PersonID] FOREIGN KEY([PersonID])
REFERENCES [dbo].[PersonCard] ([PersonCardID])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[MonthlyAction] CHECK CONSTRAINT [FK_dbo.MonthlyAction_dbo.Person_PersonID]
GO

ALTER TABLE [dbo].[PersonCard]  WITH CHECK ADD  CONSTRAINT [FK_dbo.Person_dbo.JobRegion_JobRegionID] FOREIGN KEY([JobRegionID])
REFERENCES [dbo].[JobRegion] ([ID])
GO

ALTER TABLE [dbo].[PersonCard] CHECK CONSTRAINT [FK_dbo.Person_dbo.JobRegion_JobRegionID]
GO

ALTER TABLE [dbo].[PersonDocument]  WITH CHECK ADD  CONSTRAINT [FK_dbo.PersonDocument_dbo.ActionType_TypeID] FOREIGN KEY([TypeID])
REFERENCES [dbo].[ActionType] ([ID])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[PersonDocument] CHECK CONSTRAINT [FK_dbo.PersonDocument_dbo.ActionType_TypeID]
GO

ALTER TABLE [dbo].[ProductCard]  WITH CHECK ADD  CONSTRAINT [FK_Item_TaxCalc] FOREIGN KEY([TaxCardID])
REFERENCES [dbo].[TaxCard] ([TaxCardID])
GO

ALTER TABLE [dbo].[ProductCard] CHECK CONSTRAINT [FK_Item_TaxCalc]
GO

ALTER TABLE [dbo].[ProductTrans]  WITH CHECK ADD  CONSTRAINT [FK_MTrans_Item] FOREIGN KEY([ProductCardID])
REFERENCES [dbo].[ProductCard] ([ProductCardID])
GO

ALTER TABLE [dbo].[ProductTrans] CHECK CONSTRAINT [FK_MTrans_Item]
GO

ALTER TABLE [dbo].[RiskGroupDetail]  WITH CHECK ADD  CONSTRAINT [FK_RiskGroupDetail_RiskGroup] FOREIGN KEY([RiskGroupID])
REFERENCES [dbo].[RiskGroup] ([RiskGroupID])
GO

ALTER TABLE [dbo].[RiskGroupDetail] CHECK CONSTRAINT [FK_RiskGroupDetail_RiskGroup]
GO

ALTER TABLE [dbo].[TaxLine]  WITH CHECK ADD  CONSTRAINT [FK_TaxCalcLine_TaxCalc] FOREIGN KEY([TaxCardID])
REFERENCES [dbo].[TaxCard] ([TaxCardID])
GO

ALTER TABLE [dbo].[TaxLine] CHECK CONSTRAINT [FK_TaxCalcLine_TaxCalc]
GO

ALTER TABLE [dbo].[UserMenuAuth]  WITH CHECK ADD  CONSTRAINT [FK_dbo.UserMenuAuth_dbo.User_UserID] FOREIGN KEY([UserID])
REFERENCES [dbo].[SystemUser] ([SystemUserID])
GO

ALTER TABLE [dbo].[UserMenuAuth] CHECK CONSTRAINT [FK_dbo.UserMenuAuth_dbo.User_UserID]
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Eðer boþ yada * ise bütün iþyerlerinde kullanýlýr yoksa sadece o iþyeri o departman' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountCard', @level2type=N'COLUMN',@level2name=N'CompanyID'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'bir fiþin bir den çok muhaseb kaydý oluþmasý için kullanýlýr' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountCard', @level2type=N'COLUMN',@level2name=N'AccountGroup'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Üst Muhasebe Kodu' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountCard', @level2type=N'COLUMN',@level2name=N'MainAccountID'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Ana Hesap Ýse True Olacak' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountCard', @level2type=N'COLUMN',@level2name=N'MainAccount'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Muhasebe hesaplarý' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountCard'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Ülkelere göre v.s. Ayrýmak için Kullanýlýr' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountGroup'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'bir fiþin bir den çok muhaseb kaydý oluþmasý için kullanýlýr' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLink', @level2type=N'COLUMN',@level2name=N'AccountGroup'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'muhasebe baðlantý kodlarý' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLink'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Link IDsi' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkDetail', @level2type=N'COLUMN',@level2name=N'AccountLinkID'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Hesap Kodu' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkDetail', @level2type=N'COLUMN',@level2name=N'AccountID'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'ProductID-CustomerID-bankAccountID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkDetail', @level2type=N'COLUMN',@level2name=N'SourceCardID'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'1-Product/2-Customer/3-Bankaccount/v.b.' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkDetail', @level2type=N'COLUMN',@level2name=N'Module'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Product için/1-alým/2-satýþ....//cari için 1-cari/ banka için 1-Gelen havalede/2-Giden Havalde gibi.' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkDetail', @level2type=N'COLUMN',@level2name=N'Type'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'bir fiþin bir den çok muhaseb kaydý oluþmasý için kullanýlýr' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkTrans', @level2type=N'COLUMN',@level2name=N'AccountGroup'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Ön Muhasebe Ýle Resmi Muhasebeyi Baðlayan Kýsým' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountLinkTrans'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'1 Borç -1 alacak' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountTrans', @level2type=N'COLUMN',@level2name=N'TotalType_'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'1 Borç -1 alacak' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountTransDetail', @level2type=N'COLUMN',@level2name=N'TotalType_'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'bir kaydýn bir den çok muhasebe fiþi olabilir.. Türk sistemi Ýngili zsistemi amerkan gibi ' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AccountVoucher', @level2type=N'COLUMN',@level2name=N'AccountVoucherType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Ozel Kod tanimlari' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AuxilCodes'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Kart yada iþlemlerin Özel kod baðlantýsýný yapar.' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'AuxilCodeTrans'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Çek senet kartlarý' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BoundCard'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Çek senet hareketleri' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BoundTrans'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Özel bi kod ile Diðer adresi bulmak örn: 3401005 Kasýmpaþa Gibi' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerAdress', @level2type=N'COLUMN',@level2name=N'CTDCode'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Google Mapsten Lokasyon takibi yapýp yeri bulmak' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerAdress', @level2type=N'COLUMN',@level2name=N'LocationCode'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Bu alan Ülkeye göre deðiþebilir. mesela Türkiyede  0 Kurumsal 1 bireysel 2 Yurt içi Perakende 3 Yurt dýþý perakende gibi.. ' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerAdress', @level2type=N'COLUMN',@level2name=N'TaxType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Her cariye N tane Adres Tanýmlanabilir / Isdefault True olan Default' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerAdress'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'0- Efturaya Tabi deðil  1- Efatura2-Earþiv....' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerCard', @level2type=N'COLUMN',@level2name=N'EinvoiceType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Bu alan Ülkeye göre deðiþebilir. mesela Türkiyede  0 Kurumsal 1 bireysel 2 Yurt içi Perakende 3 Yurt dýþý perakende gibi.. ' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerCard', @level2type=N'COLUMN',@level2name=N'TaxType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Email Adresi' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'CustomerEinvoiceDetail', @level2type=N'COLUMN',@level2name=N'EinvoiceEmailAdress'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Aylýk Action' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'MonthlyAction'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Malzemeler' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductCard'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Malzeme alt malzemleri tanýtýlýr Karma koli Ürün reçeteleri v.b. alt malzemler için kullanýlýr.' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductSub'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Satir Tipi 0-Malzeme1-himzet 2masraf v.s.' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductTrans', @level2type=N'COLUMN',@level2name=N'TransType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Malzeme Hareket Satýrlarý' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductTrans'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Satýrlarýn Ýndirim Vergi gibi detaylarýný barýndýrýr' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductTransCalcDetail'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Fiyata + Eklenir - düþürülür yada ona benzer önce kendinden önceki vergileri alýr onlarý yok sayar gibi özellikler eklenebilir.' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductTransTaxDetail', @level2type=N'COLUMN',@level2name=N'TaxType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'giriþler 1 çýkýþlar -1 olacak' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductTransTrack', @level2type=N'COLUMN',@level2name=N'TransType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'1 DEVÝR 2-ALIM 3' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductVoucher', @level2type=N'COLUMN',@level2name=N'VoucherType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Girþ Çýkýþ ' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductVoucher', @level2type=N'COLUMN',@level2name=N'Type'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Malzme Fiþleri' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'ProductVoucher'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Kasa KARTI' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'SafeCard'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Fiiþ Tipi Burada 08 Satýþ faturasýnýnda Alt fiþ türü olacak Ýçinde baþlka bir hesaplama yada baþka bir queryler var.. ' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Sýralama', @level2type=N'COLUMN',@level2name=N'VoucherType'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'1-Ekleme/2-Deðiþiklik/3-Cýkarma/4-Ýnceleme' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'SystemUserLOG', @level2type=N'COLUMN',@level2name=N'Type'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Vergi Kartý' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'TaxCard'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Eklenecek Fiþlerin Tipleri' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'VoucherType'
GO



-- =============================================
-- ERP DYNAMIC FORMS & UDF METADATA TABLES
-- =============================================
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- 1. Form TanÄ±mlarÄ± (SYS_Forms)
CREATE TABLE [dbo].[SYS_Forms](
	[FormId] [int] IDENTITY(1,1) NOT NULL,
	[FormCode] [nvarchar](50) NOT NULL, -- Ã–rn: "ProductCardForm"
	[Title] [nvarchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[TableName] [nvarchar](100) NOT NULL, -- Ã–rn: "ProductCard"
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[CreatedAt] [datetime] NOT NULL DEFAULT(GETDATE()),
 CONSTRAINT [PK_SYS_Forms] PRIMARY KEY CLUSTERED 
(
	[FormId] ASC
)
) ON [PRIMARY]
GO

-- 2. Form AlanlarÄ± (SYS_FormFields)
CREATE TABLE [dbo].[SYS_FormFields](
	[FieldId] [int] IDENTITY(1,1) NOT NULL,
	[FormId] [int] NOT NULL,
	[FieldName] [nvarchar](100) NOT NULL, -- JSON property key, Ã–rn: "U_WarrantyPeriod"
	[Label] [nvarchar](100) NOT NULL,
	[FieldType] [nvarchar](50) NOT NULL, -- text, number, date, select, checkbox
	[IsRequired] [bit] NOT NULL DEFAULT(0),
	[ColSpan] [int] NOT NULL DEFAULT(6), -- 12'li Grid'de kaÃ§ kolon kaplayacaÄŸÄ±
	[OrderIndex] [int] NOT NULL DEFAULT(0),
	[OptionsJson] [nvarchar](max) NULL, -- Select tipleri iÃ§in: [{"label":"Var","value":"1"}]
	[DefaultValue] [nvarchar](250) NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
 CONSTRAINT [PK_SYS_FormFields] PRIMARY KEY CLUSTERED 
(
	[FieldId] ASC
)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[SYS_FormFields]  WITH CHECK ADD  CONSTRAINT [FK_SYS_FormFields_SYS_Forms] FOREIGN KEY([FormId])
REFERENCES [dbo].[SYS_Forms] ([FormId])
ON DELETE CASCADE
GO

-- =============================================
-- EKSÄ°K SYS TABLOLARI
-- =============================================

-- SYS_Users (Mevcut SystemUser'a ek/alternatif olarak)
CREATE TABLE [dbo].[SYS_Users](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](50) NOT NULL,
	[PasswordHash] [nvarchar](250) NOT NULL,
	[FullName] [nvarchar](150) NULL,
	[Email] [nvarchar](150) NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[AdditionalFields] [nvarchar](max) NULL, -- JSON UDF AlanÄ±
 CONSTRAINT [PK_SYS_Users] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)
) ON [PRIMARY]
GO

-- SYS_Companies
CREATE TABLE [dbo].[SYS_Companies](
	[CompanyId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyCode] [nvarchar](50) NOT NULL,
	[Title] [nvarchar](200) NOT NULL,
	[TaxNumber] [nvarchar](50) NULL,
	[TaxOffice] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[AdditionalFields] [nvarchar](max) NULL, -- JSON UDF AlanÄ±
 CONSTRAINT [PK_SYS_Companies] PRIMARY KEY CLUSTERED 
(
	[CompanyId] ASC
)
) ON [PRIMARY]
GO

-- SYS_Whouse (Depolar)
CREATE TABLE [dbo].[SYS_Whouse](
	[WhouseId] [int] IDENTITY(1,1) NOT NULL,
	[WhouseCode] [nvarchar](50) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[AdditionalFields] [nvarchar](max) NULL, -- JSON UDF AlanÄ±
 CONSTRAINT [PK_SYS_Whouse] PRIMARY KEY CLUSTERED 
(
	[WhouseId] ASC
)
) ON [PRIMARY]
GO

-- SYS_City (Åžehirler)
CREATE TABLE [dbo].[SYS_City](
	[CityId] [int] IDENTITY(1,1) NOT NULL,
	[CityCode] [nvarchar](10) NOT NULL, -- Ã–rn: 34
	[Name] [nvarchar](100) NOT NULL,
 CONSTRAINT [PK_SYS_City] PRIMARY KEY CLUSTERED 
(
	[CityId] ASC
)
) ON [PRIMARY]
GO

-- =============================================
-- MEVCUT TABLOLARA UDF (JSON) ALANI EKLENMESÄ°
-- =============================================
-- Ã–rnek: ProductCard tablosuna AdditionalFields (JSON UDF) alanÄ± ekleme
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[ProductCard]') AND name = 'AdditionalFields'
)
BEGIN
    ALTER TABLE [dbo].[ProductCard] ADD [AdditionalFields] [nvarchar](max) NULL
END
GO

