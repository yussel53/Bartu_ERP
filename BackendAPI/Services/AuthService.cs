using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.IdentityModel.Tokens;

namespace BartuERP.Backend.Services;

/// <summary>Oturum açmış kullanıcı (JWT içeriği / api/auth/me)</summary>
public sealed class AuthUser
{
    public int UserId { get; set; }
    public string UserName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool IsAdmin { get; set; }
    public bool MustChangePassword { get; set; }
}

public static class AuthClaims
{
    public const string Admin = "bartu_admin";
    public const string MustChange = "bartu_must_change";
    public const string AdminPolicy = "Admin";
    public const string AccessCookie = "bartu_at";
    public const string RefreshCookie = "bartu_rt";

    /// <summary>Token'daki kullanıcı (yoksa 0)</summary>
    public static int UserId(this ClaimsPrincipal? user) =>
        int.TryParse(user?.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? user?.FindFirstValue(ClaimTypes.NameIdentifier),
            out var id) ? id : 0;

    public static bool IsAdmin(this ClaimsPrincipal? user) => user?.FindFirstValue(Admin) == "1";
}

/// <summary>
/// Giriş / JWT / parola özeti (PBKDF2). Kullanıcılar dbo.SystemUser (SqlUpdates/79).
/// İmza anahtarı repoda değil: BackendAPI/Data/jwt.key (ilk açılışta üretilir) veya BARTU_JWT_KEY ortam değişkeni.
/// </summary>
public sealed class AuthService
{
    public const string Issuer = "BartuERP";
    public static readonly TimeSpan AccessLifetime = TimeSpan.FromHours(8);
    public static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(30);
    public const int MaxFailedLogins = 5;
    public static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(15);
    private const int Pbkdf2Iterations = 100_000;

    private readonly IDbConnection _db;

    public AuthService(IDbConnection db)
    {
        _db = db;
    }

    // ── İmza anahtarı ───────────────────────────────────────────────────

    private static byte[]? _key;
    private static readonly object KeyLock = new();

    public static byte[] SigningKey(string contentRoot)
    {
        if (_key != null) return _key;
        lock (KeyLock)
        {
            if (_key != null) return _key;
            var env = Environment.GetEnvironmentVariable("BARTU_JWT_KEY");
            if (!string.IsNullOrWhiteSpace(env) && env.Trim().Length >= 32)
                return _key = Encoding.UTF8.GetBytes(env.Trim());

            var dir = Path.Combine(contentRoot, "Data");
            var file = Path.Combine(dir, "jwt.key");
            if (File.Exists(file))
            {
                var text = File.ReadAllText(file).Trim();
                if (text.Length >= 44) return _key = Convert.FromBase64String(text);
            }
            Directory.CreateDirectory(dir);
            var bytes = RandomNumberGenerator.GetBytes(64);
            File.WriteAllText(file, Convert.ToBase64String(bytes));
            return _key = bytes;
        }
    }

    public static TokenValidationParameters ValidationParameters(string contentRoot) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = Issuer,
        ValidateAudience = true,
        ValidAudience = Issuer,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(SigningKey(contentRoot)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
        NameClaimType = JwtRegisteredClaimNames.UniqueName,
    };

    public static string CreateAccessToken(AuthUser u, string contentRoot)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, u.UserId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, u.UserName),
            new(JwtRegisteredClaimNames.Name, u.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        if (u.IsAdmin) claims.Add(new Claim(AuthClaims.Admin, "1"));
        if (u.MustChangePassword) claims.Add(new Claim(AuthClaims.MustChange, "1"));

        var creds = new SigningCredentials(new SymmetricSecurityKey(SigningKey(contentRoot)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(Issuer, Issuer, claims, DateTime.UtcNow, DateTime.UtcNow.Add(AccessLifetime), creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ── Parola özeti ────────────────────────────────────────────────────

    public static bool IsHashed(string? stored) => stored?.StartsWith("PBKDF2$", StringComparison.Ordinal) == true;

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Pbkdf2Iterations, HashAlgorithmName.SHA256, 32);
        return $"PBKDF2${Pbkdf2Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    /// <summary>Doğrulama; eski düz metin parolada <paramref name="legacy"/> true döner (yeniden özetlenmeli)</summary>
    public static bool VerifyPassword(string password, string? stored, out bool legacy)
    {
        legacy = false;
        if (string.IsNullOrEmpty(stored)) return false;
        if (IsHashed(stored))
        {
            var p = stored.Split('$');
            if (p.Length != 4 || !int.TryParse(p[1], out var iter)) return false;
            var salt = Convert.FromBase64String(p[2]);
            var expected = Convert.FromBase64String(p[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iter, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        // Eski kayıt: düz metin (ilk başarılı girişte özetlenir)
        legacy = true;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(password), Encoding.UTF8.GetBytes(stored));
    }

    public static string? PasswordPolicyError(string? password) =>
        string.IsNullOrWhiteSpace(password) || password.Length < 6 ? "Şifre en az 6 karakter olmalı." : null;

    // ── Kullanıcı işlemleri ─────────────────────────────────────────────

    private sealed class UserRow
    {
        public int SystemUserID { get; set; }
        public string? NickName { get; set; }
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Password { get; set; }
        public int? Type { get; set; }
        public bool? IsActive { get; set; }
        public int? FailedLoginCount { get; set; }
        public DateTime? LockedUntil { get; set; }
        public bool? MustChangePassword { get; set; }
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private async Task<bool> IsAdminAsync(int userId, int? type)
    {
        if (type == 1) return true;
        var hasRoles = await _db.ExecuteScalarAsync<int>(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_UserRole', N'U') IS NULL OR OBJECT_ID(N'dbo.SYS_Role', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
        if (!hasRoles) return false;
        return await _db.ExecuteScalarAsync<int>(@"
SELECT COUNT(1) FROM dbo.SYS_UserRole ur JOIN dbo.SYS_Role r ON r.Id = ur.RoleId
WHERE ur.SystemUserID = @userId AND r.IsAdmin = 1 AND ISNULL(r.IsActive, 1) = 1", new { userId }) > 0;
    }

    private async Task<AuthUser> ToAuthUserAsync(UserRow r) => new()
    {
        UserId = r.SystemUserID,
        UserName = r.NickName?.Trim() ?? "",
        DisplayName = string.Join(' ', new[] { r.Name, r.Surname }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim() is { Length: > 0 } dn
            ? dn
            : r.NickName?.Trim() ?? "",
        IsAdmin = await IsAdminAsync(r.SystemUserID, r.Type),
        MustChangePassword = r.MustChangePassword == true,
    };

    private const string UserSelect = @"
SELECT SystemUserID, NickName, Name, Surname, Password, Type, IsActive, FailedLoginCount, LockedUntil, MustChangePassword
FROM dbo.SystemUser";

    /// <summary>İlk kurulum: hiçbir kullanıcının parolası yoksa yönetici parolası belirlenir</summary>
    public async Task<bool> NeedsSetupAsync()
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.SystemUser WHERE NULLIF(LTRIM(RTRIM(Password)), '') IS NOT NULL") == 0;
    }

    public async Task<(AuthUser? User, string? Error)> LoginAsync(string userName, string password)
    {
        Open();
        userName = (userName ?? "").Trim();
        if (userName.Length == 0 || string.IsNullOrEmpty(password)) return (null, "Kullanıcı adı ve şifre girin.");

        var rows = (await _db.QueryAsync<UserRow>(UserSelect + " WHERE LTRIM(RTRIM(NickName)) = @userName", new { userName })).ToList();
        var r = rows.FirstOrDefault(x => x.IsActive != false) ?? rows.FirstOrDefault();
        // Kullanıcı yok / şifre yanlış aynı mesaj (kullanıcı adı tahmini zorlaşır)
        const string wrong = "Kullanıcı adı veya şifre hatalı.";
        if (r is null) return (null, wrong);
        if (r.IsActive == false) return (null, "Kullanıcı pasif.");
        if (r.LockedUntil is DateTime until && until > DateTime.Now)
            return (null, $"Çok sayıda hatalı giriş — hesap kilitli. {until:HH:mm} sonra tekrar deneyin.");

        if (!VerifyPassword(password, r.Password, out var legacy))
        {
            var fails = (r.FailedLoginCount ?? 0) + 1;
            DateTime? lockUntil = fails >= MaxFailedLogins ? DateTime.Now.Add(LockDuration) : null;
            await _db.ExecuteAsync(
                "UPDATE dbo.SystemUser SET FailedLoginCount = @fails, LockedUntil = @lockUntil WHERE SystemUserID = @id",
                new { fails = lockUntil != null ? 0 : fails, lockUntil, id = r.SystemUserID });
            return (null, lockUntil != null ? $"Çok sayıda hatalı giriş — hesap kilitlendi. {lockUntil:HH:mm} sonra tekrar deneyin." : wrong);
        }

        await _db.ExecuteAsync(@"
UPDATE dbo.SystemUser SET FailedLoginCount = 0, LockedUntil = NULL, LastLoginAt = SYSDATETIME(),
       Password = CASE WHEN @rehash IS NULL THEN Password ELSE @rehash END,
       PasswordChangedAt = CASE WHEN @rehash IS NULL THEN PasswordChangedAt ELSE SYSDATETIME() END
WHERE SystemUserID = @id", new { rehash = legacy ? HashPassword(password) : null, id = r.SystemUserID });

        return (await ToAuthUserAsync(r), null);
    }

    public async Task<AuthUser?> GetUserAsync(int userId)
    {
        Open();
        var r = await _db.QueryFirstOrDefaultAsync<UserRow>(UserSelect + " WHERE SystemUserID = @userId", new { userId });
        return r is null || r.IsActive == false ? null : await ToAuthUserAsync(r);
    }

    public async Task<string?> ChangePasswordAsync(int userId, string? current, string? next, bool skipCurrentCheck = false)
    {
        Open();
        if (PasswordPolicyError(next) is { } err) return err;
        var stored = await _db.ExecuteScalarAsync<string?>("SELECT Password FROM dbo.SystemUser WHERE SystemUserID = @userId", new { userId });
        if (!skipCurrentCheck && !VerifyPassword(current ?? "", stored, out _)) return "Mevcut şifre hatalı.";
        await _db.ExecuteAsync(@"
UPDATE dbo.SystemUser SET Password = @hash, PasswordChangedAt = SYSDATETIME(), MustChangePassword = 0,
       FailedLoginCount = 0, LockedUntil = NULL
WHERE SystemUserID = @userId", new { hash = HashPassword(next!), userId });
        return null;
    }

    /// <summary>İlk kurulum: Admin tipli (yoksa ilk aktif) kullanıcıya parola</summary>
    public async Task<(AuthUser? User, string? Error)> SetupAdminAsync(string userName, string password)
    {
        if (!await NeedsSetupAsync()) return (null, "Kurulum zaten yapılmış — giriş ekranını kullanın.");
        if (PasswordPolicyError(password) is { } err) return (null, err);
        var r = await _db.QueryFirstOrDefaultAsync<UserRow>(
            UserSelect + " WHERE LTRIM(RTRIM(NickName)) = @userName AND ISNULL(IsActive, 1) = 1", new { userName = (userName ?? "").Trim() });
        if (r is null) return (null, "Bu kullanıcı adıyla aktif kullanıcı yok.");
        if (!await IsAdminAsync(r.SystemUserID, r.Type)) return (null, "İlk şifre yalnızca yönetici (Admin) kullanıcıya verilebilir.");
        await ChangePasswordAsync(r.SystemUserID, null, password, skipCurrentCheck: true);
        return (await ToAuthUserAsync(r), null);
    }

    // ── Yenileme anahtarı (refresh token) ───────────────────────────────

    private static string Sha256(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s)));

    public async Task<string> IssueRefreshTokenAsync(int userId, string? userAgent)
    {
        Open();
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        await _db.ExecuteAsync(@"
INSERT INTO dbo.SYS_AuthRefreshToken (SystemUserID, TokenHash, ExpiresAt, UserAgent)
VALUES (@userId, @hash, @expires, @ua)",
            new { userId, hash = Sha256(token), expires = DateTime.Now.Add(RefreshLifetime), ua = userAgent?.Length > 300 ? userAgent[..300] : userAgent });
        return token;
    }

    /// <summary>Geçerli yenileme anahtarı → kullanıcı; anahtar tek kullanımlıktır (döndürülür)</summary>
    public async Task<AuthUser?> UseRefreshTokenAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        Open();
        var hash = Sha256(token);
        var userId = await _db.ExecuteScalarAsync<int?>(@"
UPDATE dbo.SYS_AuthRefreshToken SET RevokedAt = SYSDATETIME()
OUTPUT INSERTED.SystemUserID
WHERE TokenHash = @hash AND RevokedAt IS NULL AND ExpiresAt > SYSDATETIME()", new { hash });
        return userId is int id ? await GetUserAsync(id) : null;
    }

    public async Task RevokeRefreshTokenAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        Open();
        await _db.ExecuteAsync("UPDATE dbo.SYS_AuthRefreshToken SET RevokedAt = SYSDATETIME() WHERE TokenHash = @hash AND RevokedAt IS NULL",
            new { hash = Sha256(token) });
    }
}
