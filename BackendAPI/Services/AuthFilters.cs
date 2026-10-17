using System.Data;
using System.Reflection;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace BartuERP.Backend.Services;

/// <summary>
/// «Token kazanır»: oturum açmış istekte istemcinin gönderdiği kullanıcı kimliği yok sayılır —
/// ?userId= / ?isAdmin= sorgusu ve gövdedeki UserId / StartedBy alanları token'daki kullanıcıyla değiştirilir.
/// (X-User-Id başlığı Program.cs'teki ara katmanda değiştirilir.) Yol parametresindeki {userId}
/// (yöneticinin başka kullanıcıyı düzenlemesi) değişmez.
/// </summary>
public sealed class TokenUserFilter : IActionFilter
{
    private static readonly string[] BodyUserProps = ["UserId", "StartedBy"];

    public void OnActionExecuting(ActionExecutingContext context)
    {
        var user = context.HttpContext.User;
        var uid = user.UserId();
        if (uid <= 0) return;

        foreach (var p in context.ActionDescriptor.Parameters)
        {
            var source = p.BindingInfo?.BindingSource;
            if (source == BindingSource.Query || (source == null && IsSimple(p.ParameterType)))
            {
                if (p.Name.Equals("userId", StringComparison.OrdinalIgnoreCase))
                    context.ActionArguments[p.Name] = Convert(uid, p.ParameterType);
                else if (p.Name.Equals("isAdmin", StringComparison.OrdinalIgnoreCase) && p.ParameterType == typeof(bool))
                    context.ActionArguments[p.Name] = user.IsAdmin();
            }
            else if (source == BindingSource.Body && context.ActionArguments.TryGetValue(p.Name, out var body) && body != null)
            {
                foreach (var name in BodyUserProps)
                {
                    var prop = body.GetType().GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                    if (prop is { CanWrite: true } && (prop.PropertyType == typeof(int) || prop.PropertyType == typeof(int?)))
                        prop.SetValue(body, uid);
                }
            }
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }

    private static bool IsSimple(Type t) =>
        (Nullable.GetUnderlyingType(t) ?? t) is var u && (u.IsPrimitive || u == typeof(string));

    private static object? Convert(int uid, Type t)
    {
        var u = Nullable.GetUnderlyingType(t) ?? t;
        if (u == typeof(int)) return uid;
        if (u == typeof(string)) return uid.ToString();
        if (u == typeof(long)) return (long)uid;
        return uid;
    }
}

/// <summary>
/// Kurulum uçları (SQL bağlantısı, veritabanı oluşturma / güncelleme): veritabanı hazır değilken,
/// giriş şeması (SqlUpdates/79) yokken ya da hiç şifreli kullanıcı yokken anonim; aksi halde yalnız yönetici.
/// Kullanım: [AllowAnonymous] + [SetupOrAdmin]
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class SetupOrAdminAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor is ControllerActionDescriptor cad
            && cad.MethodInfo.GetCustomAttribute<SkipSetupCheckAttribute>() != null)
            return;

        var http = context.HttpContext;
        if (http.User.IsAdmin()) return;
        if (await SetupModeAsync(http.RequestServices)) return;

        context.Result = http.User.UserId() > 0
            ? new ObjectResult(new { message = "Bu işlem yalnızca yönetici içindir." }) { StatusCode = 403 }
            : new UnauthorizedObjectResult(new { message = "Giriş yapın." });
    }

    public static async Task<bool> SetupModeAsync(IServiceProvider sp)
    {
        var store = sp.GetRequiredService<DbConnectionStore>();
        if (!store.IsConfigured()) return true;
        try
        {
            var (ok, _, exists) = await store.TestDetailedAsync();
            if (!ok || !exists) return true;
            var db = sp.GetRequiredService<IDbConnection>();
            if (db.State != ConnectionState.Open) db.Open();
            var authReady = await db.ExecuteScalarAsync<int>(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_AuthRefreshToken', N'U') IS NULL OR OBJECT_ID(N'dbo.SystemUser', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
            if (!authReady) return true;
            return await db.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM dbo.SystemUser WHERE NULLIF(LTRIM(RTRIM(Password)), '') IS NOT NULL") == 0;
        }
        catch
        {
            return true;
        }
    }
}

/// <summary>[SetupOrAdmin] denetimi atlanır (ör. her zaman açık durum ucu)</summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class SkipSetupCheckAttribute : Attribute
{
}
