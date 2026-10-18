namespace BartuERP.Backend.Services.EGovRules;

/// <summary>Hazır kural (şablon + önerilen parametre/koşul) — ekranda «Hazır kurallardan ekle»</summary>
public sealed class RulePreset
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string TemplateCode { get; set; } = "";
    public string DocKinds { get; set; } = "1,2";
    public Dictionary<string, string> Params { get; set; } = new();
    public RuleConditions Conditions { get; set; } = new();
    public string Description { get; set; } = "";
    /// <summary>Kaynak Logo kuralı (KURAL TANIMLARI örnekleri)</summary>
    public string? LogoSource { get; set; }
    /// <summary>XSLT tasarımına eklenmesi gereken parça (ek alan okumak için)</summary>
    public string? XsltSnippet { get; set; }
}

/// <summary>
/// Logo «Kural Tanımları» örneklerinin (VBScript ProcessEvent) Bartu karşılığı — kod yazmadan, şablon + parametre ile.
/// </summary>
public static class RulePresets
{
    private static string FieldSnippet(string type) =>
        $"""<xsl:for-each select="//cac:AdditionalDocumentReference[cbc:DocumentType='{type}']"><xsl:value-of select="cbc:ID"/></xsl:for-each>""";

    private static RulePreset Field(string key, string name, string type, string value, string desc, string? logo, string docKinds = "1,2") => new()
    {
        Key = key,
        Name = name,
        TemplateCode = "ADD_FIELD",
        DocKinds = docKinds,
        Params = new() { ["documentType"] = type, ["value"] = value, ["skipIfEmpty"] = "true" },
        Description = desc,
        LogoSource = logo,
        XsltSnippet = FieldSnippet(type),
    };

    public static readonly IReadOnlyList<RulePreset> All =
    [
        Field("cari-bakiye", "Cari bakiye ek alanı", "BAKIYE", "{Cari.BakiyeBA}",
            "Faturaya carinin güncel bakiyesini «1.234,56 (B)» biçiminde ek alan olarak yazar.", "Bakiye.txt · Son bakiye kuralı"),
        Field("siparis-no", "Sipariş no ek alanı", "SIPARISNO", "{Siparis.No}",
            "Fatura satırlarının bağlı olduğu sipariş numaralarını ek alana yazar.", "Sipariş no ve tarih"),
        Field("siparis-tarih", "Sipariş tarihi ek alanı", "SIPARISTARIHI", "{Siparis.Tarih}",
            "İlk bağlı siparişin tarihini ek alana yazar.", "Sipariş no ve tarih"),
        Field("irsaliye-no", "İrsaliye no ek alanı (faturada)", "IRSALIYENO", "{Irsaliye.No}",
            "Faturalanan irsaliye numaralarını ek alana yazar.", "Belge noyu faturada getirme"),
        Field("irsaliye-tarih", "İrsaliye tarihi ek alanı (faturada)", "IRSALIYETARIHI", "{Irsaliye.Tarih}",
            "İlk irsaliyenin tarihini ek alana yazar.", "e-İrsaliyede irsaliye tarihi ek alanla getirme"),
        Field("belge-no-irsaliye", "Belge no ek alanı (e-İrsaliye)", "BELGENO", "{Belge.Aciklama}",
            "e-İrsaliyede fiş açıklamasındaki belge numarasını ek alana yazar.", "e-İrsaliyede belge noyu ek alanla getirme", "3"),
        Field("toplam-miktar", "Toplam miktar ek alanı", "TOPLAMMIKTAR", "{Belge.ToplamMiktar}",
            "Satır miktarlarının toplamını ek alana yazar.", "Toplam miktar kuralı", "1,2,3"),
        Field("vade-tarihi", "Ödeme (vade) tarihi ek alanı", "VADETARIHI", "{Belge.VadeTarihi}",
            "Ödeme tarihini ek alana yazar.", "Ödeme tarihi · Vade tarihi"),
        Field("cari-kodu", "Cari kodu ek alanı", "CARIKODU", "{Cari.Kod}",
            "Alıcının ERP'deki cari kodunu ek alana yazar.", "Cari kod tanımlı alana getirme", "1,2,3"),
        new()
        {
            Key = "doviz-kuru-notu",
            Name = "Döviz kuru notu",
            TemplateCode = "ADD_NOTE",
            Params = new() { ["text"] = "Döviz kuru: {Belge.Kur} TL / 1 {Belge.ParaBirimi}", ["skipIfEmpty"] = "true" },
            Conditions = new() { Currencies = "!TRY" },
            Description = "Dövizli faturada kuru belge notuna yazar.",
            LogoSource = "Raporlama döviz kuru genel açıklamaya getirme",
        },
        new()
        {
            Key = "yalniz-tl-kaldir",
            Name = "Dövizli faturada «Yalnız … TL» notunu kaldır",
            TemplateCode = "REMOVE_NOTE",
            Params = new() { ["pattern"] = "^Yalnız", ["mode"] = "regex" },
            Conditions = new() { Currencies = "!TRY" },
            Description = "Yazı ile tutar notu dövizli faturada yanlış para birimi gösterdiği için kaldırılır.",
            LogoSource = "Dövizli faturalarda Yalnız TL ibaresinin kaldırılması",
        },
        new()
        {
            Key = "aciklama-malzeme-adi",
            Name = "Satır açıklaması → malzeme adı",
            TemplateCode = "LINE_FIELD",
            DocKinds = "1,2,3",
            Params = new() { ["target"] = "Item.Name", ["value"] = "{Satir.Aciklama}", ["mode"] = "set", ["skipIfEmpty"] = "true" },
            Description = "Satır açıklaması doluysa malzeme adı yerine o yazılır.",
            LogoSource = "satır açıklaması malzeme açıklamasına.txt",
        },
        new()
        {
            Key = "ozelkod-malzeme-kodu",
            Name = "Satır özel kodu → malzeme kodu",
            TemplateCode = "LINE_FIELD",
            DocKinds = "1,2,3",
            Params = new() { ["target"] = "Item.SellersId", ["value"] = "{Satir.OzelKod}", ["mode"] = "set", ["skipIfEmpty"] = "true" },
            Description = "Satır özel kodu doluysa malzeme kodu yerine yazılır.",
            LogoSource = "satır açıklaması malzeme açıklamasına.txt (AUXIL_CODE → MASTER_CODE) · Hareket özel kodu",
        },
        new()
        {
            Key = "barkod-satir",
            Name = "Barkod satır notuna",
            TemplateCode = "LINE_FIELD",
            DocKinds = "1,2,3",
            Params = new() { ["target"] = "Line.Note", ["value"] = "Barkod: {Satir.Barkod}", ["mode"] = "append", ["separator"] = " · ", ["skipIfEmpty"] = "true" },
            Description = "Malzemenin ilk barkodunu satır notuna ekler (barkod boşsa yazılmaz).",
            LogoSource = "Barkod satır açıklamasına getirme · serilot_kontrol (barkod)",
        },
        new()
        {
            Key = "aciklama2-satir",
            Name = "Açıklama 2 → satır notu",
            TemplateCode = "LINE_FIELD",
            DocKinds = "1,2,3",
            Params = new() { ["target"] = "Line.Note", ["value"] = "{Satir.Aciklama2}", ["mode"] = "append", ["separator"] = " · ", ["skipIfEmpty"] = "true" },
            Description = "Satırın ikinci açıklamasını satır notuna ekler.",
            LogoSource = "Malzeme açıklama2 alanını satır açıklaması alanına getirme",
        },
        new()
        {
            Key = "siparis-satir",
            Name = "Sipariş no satır notuna",
            TemplateCode = "LINE_FIELD",
            Params = new() { ["target"] = "Line.Note", ["value"] = "Sipariş: {Satir.SiparisNo}", ["mode"] = "append", ["separator"] = " · ", ["skipIfEmpty"] = "true" },
            Description = "Satırın bağlı olduğu sipariş numarasını satır notuna ekler.",
            LogoSource = "Satır açıklaması alanına sipariş fiş numarasını getirme",
        },
        new()
        {
            Key = "cari-malzeme-kodu",
            Name = "Cariye özel malzeme kodu ve adı",
            TemplateCode = "CUSTOMER_ITEM_CODE",
            DocKinds = "1,2,3",
            Params = new() { ["codeTarget"] = "Item.BuyersId", ["replaceName"] = "true", ["keepOriginal"] = "false" },
            Description = "Malzeme kartındaki cari bağlantısından müşterinin kendi kodu/adı satıra yazılır.",
            LogoSource = "IRSALIYE_MUSTERI_TEDARIKCI_KODU_ATAMASI.txt · Go serisi müşteri tedarikçi kodu kuralı",
        },
        new()
        {
            Key = "koli-adet",
            Name = "Koli → adet çevrimi",
            TemplateCode = "UNIT_CONVERT",
            DocKinds = "1,2,3",
            Params = new() { ["source"] = "productUnit", ["targetUnit"] = "C62", ["priceDecimals"] = "6" },
            Description = "Satırı malzeme kartındaki birim çevrimiyle ana birime (adet) çevirir; miktar × katsayı, fiyat ÷ katsayı.",
            LogoSource = "kolı_adet_cevrımlerı.txt",
        },
        new()
        {
            Key = "tek-satir",
            Name = "Faturayı tek satır olarak gönder",
            TemplateCode = "COLLAPSE_LINES",
            Params = new() { ["name"] = "{Belge.Aciklama}", ["fallbackName"] = "Hizmet bedeli", ["unitCode"] = "C62" },
            Description = "Tüm satırlar KDV oranı başına tek satırda toplanır; toplamlar değişmez. Kural genelde belirli cariler için açılır (koşul: cari kodu).",
            LogoSource = "SADECE ILK SATIRI BASSIN.txt",
        },
        new()
        {
            Key = "sifir-satir",
            Name = "Sıfır tutarlı satırları gönderme",
            TemplateCode = "DROP_ZERO_LINES",
            DocKinds = "1,2",
            Description = "Karma koli içeriği / bilgi satırları gibi 0 tutarlı satırlar belgeden çıkarılır.",
            LogoSource = "Karma kolinin içerisindeki malzemelerin faturada görünmemesi",
        },
        new()
        {
            Key = "iade-referans",
            Name = "İade faturası referansı (boşsa)",
            TemplateCode = "RETURN_REFERENCE",
            Params = new() { ["docNo"] = "{Belge.Aciklama}", ["fallbackDocNo"] = "ABC2025000000001", ["issueDate"] = "2025-01-01" },
            Description = "İADE tipli faturada iade edilen fatura referansı yoksa varsayılanla doldurur.",
            LogoSource = "IADE FATURASI.txt",
        },
        new()
        {
            Key = "irsaliye-plaka",
            Name = "e-İrsaliye plaka / şoför (cari ek alanından)",
            TemplateCode = "DESPATCH_TRANSPORT",
            DocKinds = "3",
            Params = new() { ["plate"] = "34ABC123", ["driverName"] = "", ["overwrite"] = "false" },
            Description = "Plaka ve şoför bilgisini sevkiyat bölümüne yazar. Sabit değer yerine «SQL sonucu» kuralıyla sürücü tablosundan da okunabilir.",
            LogoSource = "Plaka_Tanımlama.txt",
        },
        new()
        {
            Key = "unvan2",
            Name = "Alıcı unvanına ikinci satır ekle",
            TemplateCode = "PARTY_NAME",
            Params = new() { ["value"] = "", ["mode"] = "append" },
            Description = "Alıcı unvanının sonuna ek metin yazar (değeri doldurun).",
            LogoSource = "Ünvan2 kuralı",
        },
    ];
}
