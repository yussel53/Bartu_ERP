using System.Data;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Windows Service / IIS (ANCM out-of-process) — makine acilisinda otomatik
builder.Host.UseWindowsService();

builder.Services.AddControllers(o =>
{
    o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    o.Filters.Add<TokenUserFilter>();
});

// Giriş (JWT): erişim anahtarı HttpOnly çerezde (bartu_at) veya "Authorization: Bearer"; tüm uçlar varsayılan olarak yetki ister
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DataScopeService>();
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<AccountingPostService>();
builder.Services.AddScoped<SafeParamsService>();
builder.Services.AddScoped<ModuleParamsService>();
builder.Services.AddScoped<InvoiceParamsService>();
builder.Services.AddScoped<DocumentLinksService>();
builder.Services.AddScoped<PaymentLinkService>();
builder.Services.AddScoped<DocumentFileService>();
builder.Services.AddScoped<CustomerAgingService>();
builder.Services.AddScoped<BoundPortfolioService>();
builder.Services.AddScoped<RiskService>();
builder.Services.AddScoped<ReportScheduleService>();
builder.Services.AddScoped<ManagementPanelService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<BudgetService>();
// Uygulama içinden güncelleme (iis-site-staging → servis) + veritabanı yedeği (gece 02:00 ve SQL öncesi)
builder.Services.AddSingleton<AppUpdateService>();
builder.Services.AddScoped<DbBackupService>();
builder.Services.AddHostedService<DbBackupJob>();
builder.Services.AddHostedService<AppAutoUpdateJob>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = AuthService.ValidationParameters(builder.Environment.ContentRootPath);
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (string.IsNullOrEmpty(ctx.Token))
                    ctx.Token = ctx.Request.Cookies[AuthClaims.AccessCookie];
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization(o =>
{
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
    o.AddPolicy(AuthClaims.AdminPolicy, p => p.RequireClaim(AuthClaims.Admin, "1"));
});
builder.Services.AddSingleton<DbConnectionStore>();
// Çok veritabanı: istek token'daki (girişte X-Bartu-Db başlığındaki) Bartu veritabanında çalışır
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<TenantDbRegistry>();
builder.Services.AddScoped(sp =>
    sp.GetRequiredService<TenantDbRegistry>().Resolve(sp.GetRequiredService<IHttpContextAccessor>().HttpContext));
builder.Services.AddScoped<IDbConnection>(sp =>
{
    var store = sp.GetRequiredService<DbConnectionStore>();
    return store.CreateConnection(sp.GetRequiredService<CurrentDatabase>().Name);
});
builder.Services.AddScoped<DynamicFormRepository>();
builder.Services.AddScoped<RecordsRepository>();
builder.Services.AddScoped<DashboardRepository>();
builder.Services.AddScoped<CardStatementRepository>();
builder.Services.AddScoped<CustomerKindRepository>();
builder.Services.AddScoped<CrmOrderRepository>();
builder.Services.AddScoped<FormLayoutRepository>();
builder.Services.AddScoped<BarcodeRepository>();
builder.Services.AddScoped<EGovPartyCardRepository>();
builder.Services.AddScoped<BartuERP.Backend.Services.EGovRules.EGovRuleEngine>();
builder.Services.AddScoped<TcmbRateService>();
builder.Services.AddHttpClient("Tcmb", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("KaviSoft-ERP/1.0");
});
// Günlük TCMB kur indirme (her 30 dk kontrol)
builder.Services.AddHostedService<CurrencyRateJob>();
builder.Services.AddHostedService<ReportScheduleJob>();
builder.Services.AddScoped<ModuleOverviewRepository>();
builder.Services.AddScoped<ProductPricesRepository>();
builder.Services.AddScoped<JournalNumberingRepository>();
builder.Services.AddScoped<ImportRepository>();
builder.Services.AddScoped<ImportProfileService>();
builder.Services.AddHostedService<ImportProfileJob>();
builder.Services.AddScoped<ExtraFieldsRepository>();
builder.Services.AddScoped<ProcessRepository>();
builder.Services.AddScoped<CrmRepository>();
builder.Services.AddScoped<CrmMailService>();
builder.Services.AddScoped<CrmMailProfileRepository>();
builder.Services.AddScoped<SqlReportsRepository>();
builder.Services.AddScoped<RolesRepository>();
builder.Services.AddScoped<PostSaveRepository>();
builder.Services.AddScoped<NumberTemplateRepository>();
builder.Services.AddScoped<DbUpdateRepository>();
builder.Services.AddScoped<DbBootstrapRepository>();
builder.Services.AddScoped<EFaturaMukellefRepository>();
builder.Services.AddScoped<EGovMukellefCheckRepository>();
builder.Services.AddScoped<EGovDocumentRepository>();
builder.Services.AddSingleton<GibEFaturaUserListService>();
// GİB mükellef listesi gece senkronu (E-06) — GibEFatura:NightlySyncEnabled / NightlySyncHour
builder.Services.AddHostedService<EFaturaMukellefSyncJob>();
builder.Services.AddScoped<IntegratorMukellefService>();
builder.Services.AddScoped<ELogoDocumentSyncService>();
builder.Services.AddScoped<EGovDesignRepository>();
builder.Services.AddScoped<EGovIncomingRepository>();
// Gelen e-belgeleri otomatik çekme (E-02): firma ayarına göre her dakika zamanı geleni çeker
builder.Services.AddScoped<EGovAutoFetchService>();
builder.Services.AddHostedService<EGovAutoFetchJob>();
builder.Services.AddScoped<EGovDespatchRepository>();
builder.Services.AddScoped<EGovConsoleRepository>();
builder.Services.AddScoped<EGovTaxReportRepository>();
builder.Services.AddScoped<ApprovalGroupRepository>();
builder.Services.AddSingleton<AddressSeedService>();
builder.Services.AddHttpClient("PostSave", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddHttpClient("IntegratorEFatura", client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("KaviSoft-EFatura/1.0");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AutomaticDecompression = System.Net.DecompressionMethods.All,
    SslProtocols = System.Security.Authentication.SslProtocols.Tls12
                   | System.Security.Authentication.SslProtocols.Tls13,
    CheckCertificateRevocationList = false,
});
builder.Services.AddHttpClient("GibEFatura", (sp, client) =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var minutes = cfg.GetValue("GibEFatura:DownloadTimeoutMinutes", 60);
    client.Timeout = TimeSpan.FromMinutes(Math.Clamp(minutes, 5, 180));
    client.DefaultRequestHeaders.UserAgent.ParseAdd("KaviSoft-GibUserList/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/zip,application/octet-stream,*/*");
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AutomaticDecompression = System.Net.DecompressionMethods.All,
    SslProtocols = System.Security.Authentication.SslProtocols.Tls12
                   | System.Security.Authentication.SslProtocols.Tls13,
    CheckCertificateRevocationList = false,
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "https://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");

// Frontend build (wwwroot) — IIS gerekmeden tek süreçte yayın (giriş ekranı yetkisiz açılmalı: yetkiden önce)
var www = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(www))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthentication();
// Oturum açmış istekte X-User-Id başlığı token'daki kullanıcıdır (istemcinin gönderdiği yok sayılır)
app.Use(async (ctx, next) =>
{
    var uid = ctx.User.UserId();
    if (uid > 0) ctx.Request.Headers["X-User-Id"] = uid.ToString();
    else ctx.Request.Headers.Remove("X-User-Id");
    await next();
});
app.UseAuthorization();

app.MapControllers();

if (Directory.Exists(www))
{
    // Bilinmeyen /api adresi index.html değil 404 döner (eski backend'de yeni ekran sessizce çökmesin)
    app.MapFallback("/api/{**rest}", (HttpContext ctx) =>
        Results.NotFound(new { message = $"API ucu bulunamadı: {ctx.Request.Path} — backend güncel olmayabilir." }))
        .AllowAnonymous();
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

// Giriş şeması (SqlUpdates/79) yoksa açılışta uygula — giriş yapılamadan güncelleme ekranına ulaşılamaz.
// Sunucudaki her Bartu veritabanı için (çok veritabanı).
if (app.Services.GetRequiredService<DbConnectionStore>().IsConfigured())
{
    var registry = app.Services.GetRequiredService<TenantDbRegistry>();
    var names = registry.List().ToList();
    if (!names.Contains(registry.DefaultDatabase, StringComparer.OrdinalIgnoreCase)) names.Add(registry.DefaultDatabase);
    foreach (var name in names)
    {
        using var scope = app.Services.CreateScope();
        try
        {
            var sp = scope.ServiceProvider;
            sp.GetRequiredService<CurrentDatabase>().Name = name;
            var db = sp.GetRequiredService<IDbConnection>();
            db.Open();
            var missing = db.ExecuteScalar<int>(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.SystemUser', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_AuthRefreshToken', N'U') IS NULL THEN 1 ELSE 0 END") == 1;
            if (missing)
            {
                var r = await sp.GetRequiredService<DbUpdateRepository>().ApplyAsync("79_sys_auth_login.sql", "startup");
                app.Logger.LogInformation("Giriş şeması (79) uygulandı ({Db}): {Ok} {Msg}", name, r.Success, r.Message);
            }
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Giriş şeması kontrolü yapılamadı ({Db})", name);
        }
    }
}

app.Run();
