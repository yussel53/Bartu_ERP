using System.Globalization;
using System.Text.Json;

namespace BartuERP.Backend.Repositories;

/// <summary>
/// Muhasebe fişi kayıt kuralları (AccountVoucher / AccountTrans / AccountTransDetail):
/// tutarlar her zaman 2 hane (kuruş), satırda tek taraf, fiş borç = alacak,
/// dağıtım varsa satır tutarına eşit. Hata varsa mesaj döner; kayıt yapılmaz.
/// </summary>
internal static class AccountVoucherRules
{
    public static string? Apply(RecordSaveRequest data, Dictionary<string, object?> header)
    {
        var lines = data.Lines;
        if (lines == null) return null; // satırlara dokunulmayan güncelleme

        lines.RemoveAll(IsBlankLine);
        if (lines.Count < 2)
            return "Muhasebe fişinde en az bir borç ve bir alacak satırı olmalı";

        decimal sumDebit = 0, sumCredit = 0;
        var lineAmounts = new Dictionary<int, decimal>();
        for (var i = 0; i < lines.Count; i++)
        {
            var row = lines[i];
            var no = i + 1;
            var debit = Money(Get(row, "Debit"));
            var credit = Money(Get(row, "Credit"));
            if (debit < 0 || credit < 0) return $"{no}. satırda negatif tutar olamaz";
            if (debit > 0 && credit > 0) return $"{no}. satırda borç ve alacak birlikte girilemez";
            if (debit == 0 && credit == 0) return $"{no}. satırda borç veya alacak tutarı girilmeli";
            if (Get(row, "AccountCardID") is null) return $"{no}. satırda hesap seçilmeli";

            Set(row, "Debit", debit > 0 ? debit : null);
            Set(row, "Credit", credit > 0 ? credit : null);
            Set(row, "Amount", debit > 0 ? debit : credit);
            Set(row, "TotalType_", debit > 0 ? 1 : -1);
            Set(row, "LineNo", no);
            Set(row, "TransLineNo", no);

            lineAmounts[no] = debit + credit;
            sumDebit += debit;
            sumCredit += credit;
        }

        if (sumDebit != sumCredit)
        {
            return $"Fiş dengede değil: Borç {Fmt(sumDebit)} · Alacak {Fmt(sumCredit)} · Fark {Fmt(Math.Abs(sumDebit - sumCredit))}";
        }

        if (data.Distributions != null)
        {
            var byLine = new Dictionary<int, decimal>();
            foreach (var d in data.Distributions)
            {
                var amt = Money(Get(d, "Amount"));
                if (amt < 0) return "Dağıtım tutarı negatif olamaz";
                Set(d, "Amount", amt);
                var lineNo = (int)Money(Get(d, "TransLineNo"));
                if (!lineAmounts.ContainsKey(lineNo))
                    return $"Dağıtım satırı geçersiz fiş satırına bağlı ({lineNo})";
                byLine[lineNo] = byLine.GetValueOrDefault(lineNo) + amt;
            }
            foreach (var (lineNo, total) in byLine)
            {
                if (total != lineAmounts[lineNo])
                    return $"{lineNo}. satırın dağıtım toplamı ({Fmt(total)}) satır tutarına ({Fmt(lineAmounts[lineNo])}) eşit değil";
            }
        }

        Set(header, "SumDebit", sumDebit);
        Set(header, "SumCredit", sumCredit);
        return null;
    }

    /// <summary>Kuruşa yuvarla (0,005 → 0,01)</summary>
    public static decimal Money(object? v)
    {
        var d = ToDecimal(v);
        return Math.Round(d, 2, MidpointRounding.AwayFromZero);
    }

    private static decimal ToDecimal(object? v)
    {
        if (v is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.Number => je.TryGetDecimal(out var dec) ? dec : (decimal)je.GetDouble(),
                JsonValueKind.String => Parse(je.GetString()),
                _ => 0m,
            };
        }
        return v switch
        {
            null => 0m,
            decimal m => m,
            double dbl => double.IsFinite(dbl) ? (decimal)dbl : 0m,
            float f => (decimal)f,
            int i => i,
            long l => l,
            string s => Parse(s),
            _ => Parse(Convert.ToString(v, CultureInfo.InvariantCulture)),
        };
    }

    private static decimal Parse(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return 0m;
        s = s.Trim().Replace(" ", "");
        // "1.234,56" (TR) veya "1234.56"
        if (s.Contains(',') && s.Contains('.')) s = s.Replace(".", "").Replace(',', '.');
        else s = s.Replace(',', '.');
        return decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : 0m;
    }

    private static bool IsBlankLine(Dictionary<string, object?> row) =>
        Get(row, "AccountCardID") is null
        && Money(Get(row, "Debit")) == 0
        && Money(Get(row, "Credit")) == 0
        && string.IsNullOrWhiteSpace(Convert.ToString(Unwrap(Get(row, "Description"))));

    private static object? Get(Dictionary<string, object?> row, string key)
    {
        var k = row.Keys.FirstOrDefault(x => x.Equals(key, StringComparison.OrdinalIgnoreCase));
        if (k == null) return null;
        var v = Unwrap(row[k]);
        return v is string s && string.IsNullOrWhiteSpace(s) ? null : v;
    }

    private static object? Unwrap(object? v) =>
        v is JsonElement je
            ? je.ValueKind switch
            {
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                JsonValueKind.String => je.GetString(),
                _ => je,
            }
            : v;

    private static void Set(Dictionary<string, object?> row, string key, object? value)
    {
        var k = row.Keys.FirstOrDefault(x => x.Equals(key, StringComparison.OrdinalIgnoreCase)) ?? key;
        row[k] = value;
    }

    private static string Fmt(decimal d) => d.ToString("N2", CultureInfo.GetCultureInfo("tr-TR"));
}
