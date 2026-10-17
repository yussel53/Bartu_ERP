using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

public sealed class LoginRequest
{
    public string UserName { get; set; } = "";
    public string Password { get; set; } = "";
    /// <summary>Beni hatırla: çerezler kalıcı (aksi halde tarayıcı kapanınca silinir)</summary>
    public bool Remember { get; set; }
}

public sealed class ChangePasswordRequest
{
    public string? CurrentPassword { get; set; }
    public string NewPassword { get; set; } = "";
}

/// <summary>
/// Giriş / çıkış / oturum. Erişim anahtarı (JWT) ve yenileme anahtarı HttpOnly çerezde taşınır;
/// harici istemciler (Outlook eklentisi vb.) "Authorization: Bearer" da kullanabilir.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly IWebHostEnvironment _env;
    private readonly DbConnectionStore _store;

    public AuthController(AuthService auth, IWebHostEnvironment env, DbConnectionStore store)
    {
        _auth = auth;
        _env = env;
        _store = store;
    }

    private CookieOptions Cookie(string path, DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = Request.IsHttps,
        SameSite = SameSiteMode.Strict,
        Path = path,
        Expires = expires,
        IsEssential = true,
    };

    private async Task<object> SignInAsync(AuthUser user, bool remember)
    {
        var access = AuthService.CreateAccessToken(user, _env.ContentRootPath);
        var refresh = await _auth.IssueRefreshTokenAsync(user.UserId, Request.Headers.UserAgent.ToString());
        Response.Cookies.Append(AuthClaims.AccessCookie, access,
            Cookie("/", remember ? DateTimeOffset.UtcNow.Add(AuthService.AccessLifetime) : null));
        Response.Cookies.Append(AuthClaims.RefreshCookie, refresh + (remember ? "|r" : ""),
            Cookie("/api/auth", remember ? DateTimeOffset.UtcNow.Add(AuthService.RefreshLifetime) : null));
        return new { user, accessToken = access, expiresIn = (int)AuthService.AccessLifetime.TotalSeconds };
    }

    private void ClearCookies()
    {
        Response.Cookies.Delete(AuthClaims.AccessCookie, Cookie("/", null));
        Response.Cookies.Delete(AuthClaims.RefreshCookie, Cookie("/api/auth", null));
    }

    /// <summary>Giriş ekranı açılmadan: veritabanı hazır mı, ilk yönetici şifresi gerekiyor mu</summary>
    [AllowAnonymous]
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        if (!_store.IsConfigured()) return Ok(new { dbReady = false, needsSetup = false });
        try
        {
            return Ok(new { dbReady = true, needsSetup = await _auth.NeedsSetupAsync() });
        }
        catch (Exception ex)
        {
            return Ok(new { dbReady = false, needsSetup = false, message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        try
        {
            var (user, error) = await _auth.LoginAsync(req.UserName, req.Password);
            if (user is null) return Unauthorized(new { message = error });
            return Ok(await SignInAsync(user, req.Remember));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>İlk kurulum: Admin kullanıcıya şifre ver ve giriş yap</summary>
    [AllowAnonymous]
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] LoginRequest req)
    {
        try
        {
            var (user, error) = await _auth.SetupAdminAsync(req.UserName, req.Password);
            if (user is null) return BadRequest(new { message = error });
            return Ok(await SignInAsync(user, req.Remember));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        try
        {
            var raw = Request.Cookies[AuthClaims.RefreshCookie] ?? "";
            var remember = raw.EndsWith("|r", StringComparison.Ordinal);
            var user = await _auth.UseRefreshTokenAsync(remember ? raw[..^2] : raw);
            if (user is null)
            {
                ClearCookies();
                return Unauthorized(new { message = "Oturum süresi doldu — yeniden giriş yapın." });
            }
            return Ok(await SignInAsync(user, remember));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var raw = Request.Cookies[AuthClaims.RefreshCookie] ?? "";
        try
        {
            await _auth.RevokeRefreshTokenAsync(raw.EndsWith("|r", StringComparison.Ordinal) ? raw[..^2] : raw);
        }
        catch
        {
            // çıkış her durumda çerezleri temizler
        }
        ClearCookies();
        return Ok(new { success = true });
    }

    /// <summary>Oturumdaki kullanıcı (yönetici bilgisi veritabanından güncel okunur)</summary>
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _auth.GetUserAsync(User.UserId());
        if (user is null)
        {
            ClearCookies();
            return Unauthorized(new { message = "Kullanıcı bulunamadı veya pasif." });
        }
        return Ok(user);
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var error = await _auth.ChangePasswordAsync(User.UserId(), req.CurrentPassword, req.NewPassword);
        return error is null ? Ok(new { success = true, message = "Şifre değiştirildi." }) : BadRequest(new { message = error });
    }
}
