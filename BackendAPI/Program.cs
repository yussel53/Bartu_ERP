using System.Data;
using Microsoft.Data.SqlClient;
using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Windows Service / IIS (ANCM out-of-process) — makine acilisinda otomatik
builder.Host.UseWindowsService();

builder.Services.AddControllers(o => o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);
builder.Services.AddSingleton<DbConnectionStore>();
builder.Services.AddScoped<IDbConnection>(sp =>
{
    var store = sp.GetRequiredService<DbConnectionStore>();
    return store.CreateConnection();
});
builder.Services.AddScoped<DynamicFormRepository>();
builder.Services.AddScoped<RecordsRepository>();
builder.Services.AddScoped<DashboardRepository>();
builder.Services.AddScoped<CardStatementRepository>();
builder.Services.AddScoped<ModuleOverviewRepository>();
builder.Services.AddScoped<ProductPricesRepository>();
builder.Services.AddScoped<JournalNumberingRepository>();
builder.Services.AddScoped<ImportRepository>();
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
builder.Services.AddSingleton<GibEFaturaUserListService>();
builder.Services.AddScoped<IntegratorMukellefService>();
builder.Services.AddScoped<ELogoDocumentSyncService>();
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
app.UseAuthorization();

// Frontend build (wwwroot) — IIS gerekmeden tek süreçte yayın
var www = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(www))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.MapControllers();

if (Directory.Exists(www))
{
    app.MapFallbackToFile("index.html");
}

app.Run();
