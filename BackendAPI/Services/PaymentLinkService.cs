using System.Data;
using System.Security.Cryptography;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class PaymentLinkResult
{
    public bool Ok { get; set; }
    public string? Message { get; set; }
    public string? Url { get; set; }
    public string? Token { get; set; }
    public string? Provider { get; set; }
    public byte Status { get; set; }
}

/// <summary>
/// Cari fiş ödeme linki — iyzico anahtarı varsa hazırlık; yoksa manuel / taban URL + token.
/// </summary>
public sealed class PaymentLinkService
{
    private readonly IDbConnection _db;

    public PaymentLinkService(IDbConnection db) => _db = db;

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private async Task<string?> SettingAsync(string code)
    {
        return (await _db.ExecuteScalarAsync<string?>(
            "SELECT TOP 1 Value FROM dbo.Setting WHERE Code = @code", new { code }))?.Trim();
    }

    private async Task<bool> HasColAsync(string name)
    {
        var len = await _db.ExecuteScalarAsync<int?>(
            "SELECT COL_LENGTH(N'dbo.CustomerVoucher', @name)", new { name });
        return len is > 0;
    }

    public async Task<PaymentLinkResult> GenerateAsync(int customerVoucherId, string? publicBaseUrl, CancellationToken ct = default)
    {
        Open();
        if (customerVoucherId <= 0)
            return new PaymentLinkResult { Ok = false, Message = "Önce cari fişi kaydedin." };

        if (!await HasColAsync("PaymentLinkUrl"))
            return new PaymentLinkResult { Ok = false, Message = "Ödeme linki kolonları yok — Veritabanı Güncelleme uygulayın." };

        var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.CustomerVoucher WHERE CustomerVoucherID = @id",
            new { id = customerVoucherId }, cancellationToken: ct));
        if (exists == 0)
            return new PaymentLinkResult { Ok = false, Message = "Cari fiş bulunamadı." };

        var provider = (await SettingAsync("PAY_PROVIDER"))?.ToLowerInvariant() ?? "manual";
        var iyzicoKey = await SettingAsync("IYZICO_API_KEY");
        var iyzicoSecret = await SettingAsync("IYZICO_SECRET_KEY");
        var baseUrl = await SettingAsync("PAY_LINK_BASE_URL");
        if (string.IsNullOrWhiteSpace(baseUrl))
            baseUrl = string.IsNullOrWhiteSpace(publicBaseUrl) ? null : publicBaseUrl.TrimEnd('/');

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        string url;
        string note;

        if (provider == "iyzico" && !string.IsNullOrWhiteSpace(iyzicoKey) && !string.IsNullOrWhiteSpace(iyzicoSecret))
        {
            // Checkout Form API sonraki turda; token’lı URL + sağlayıcı işareti
            url = $"{(baseUrl ?? "https://www.iyzico.com")}/pay/{token}";
            note = "iyzico anahtarları tanımlı — link kaydedildi (checkout API sonraki bağlama).";
            provider = "iyzico";
        }
        else
        {
            if (string.IsNullOrWhiteSpace(baseUrl))
                baseUrl = "https://pay.local";
            url = $"{baseUrl.TrimEnd('/')}/p/{token}";
            note = provider == "iyzico"
                ? "iyzico anahtarı yok — manuel link üretildi. İsterseniz iyzico panel linkini alana yapıştırın."
                : "Manuel ödeme linki üretildi.";
            if (string.IsNullOrWhiteSpace(iyzicoKey))
                provider = "manual";
        }

        await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.CustomerVoucher SET
  PaymentProvider = @provider,
  PaymentLinkUrl = @url,
  PaymentLinkToken = @token,
  PaymentLinkStatus = 1,
  PaymentLinkAt = GETDATE()
WHERE CustomerVoucherID = @id",
            new { id = customerVoucherId, provider, url, token }, cancellationToken: ct));

        return new PaymentLinkResult
        {
            Ok = true,
            Message = note,
            Url = url,
            Token = token,
            Provider = provider,
            Status = 1,
        };
    }
}
