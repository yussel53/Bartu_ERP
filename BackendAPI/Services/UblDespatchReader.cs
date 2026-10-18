using System.Xml.Linq;
using static BartuERP.Backend.Services.UblInvoiceReader;

namespace BartuERP.Backend.Services;

public sealed class UblDespatchLine
{
    public int LineNo { get; set; }
    /// <summary>Satıcının malzeme kodu (SellersItemIdentification)</summary>
    public string? SellerCode { get; set; }
    public string? BuyerCode { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    /// <summary>Sevk edilen miktar (DeliveredQuantity)</summary>
    public decimal Quantity { get; set; }
    public string? UnitCode { get; set; }
    /// <summary>Satırın bağlı olduğu sipariş satırı (OrderLineReference/LineID)</summary>
    public string? OrderLineRef { get; set; }
}

public sealed class UblDespatch
{
    public string? DespatchNo { get; set; }
    public string? Uuid { get; set; }
    public DateTime? IssueDate { get; set; }
    public string? ProfileId { get; set; }
    /// <summary>SEVK · MATBUDAN</summary>
    public string? TypeCode { get; set; }
    public UblParty Supplier { get; set; } = new();
    public UblParty Customer { get; set; } = new();
    /// <summary>Sipariş numaraları (OrderReference/ID)</summary>
    public List<string> OrderRefs { get; set; } = new();
    public DateTime? ActualDespatchDate { get; set; }
    public string? PlateNo { get; set; }
    public string? DriverName { get; set; }
    public List<UblDespatchLine> Lines { get; set; } = new();
}

/// <summary>UBL-TR DespatchAdvice okuyucu (gelen e-İrsaliye → alış irsaliyesi, E-05). Yalnız gereken alanlar.</summary>
public static class UblDespatchReader
{
    public static UblDespatch Read(string xml)
    {
        var root = Load(xml);
        if (root.Name.LocalName != "DespatchAdvice")
            throw new InvalidOperationException($"UBL bir e-İrsaliye değil ({root.Name.LocalName}).");

        var shipment = root.Element(Cac + "Shipment");
        var stage = shipment?.Element(Cac + "ShipmentStage");
        var driver = stage?.Element(Cac + "DriverPerson");
        var d = new UblDespatch
        {
            DespatchNo = Text(root, Cbc + "ID"),
            Uuid = Text(root, Cbc + "UUID"),
            IssueDate = Date(Text(root, Cbc + "IssueDate")),
            ProfileId = Text(root, Cbc + "ProfileID"),
            TypeCode = Text(root, Cbc + "DespatchAdviceTypeCode"),
            Supplier = Party(root.Element(Cac + "DespatchSupplierParty")),
            Customer = Party(root.Element(Cac + "DeliveryCustomerParty")),
            OrderRefs = root.Elements(Cac + "OrderReference").Select(r => Text(r, Cbc + "ID")).Where(x => x != null).Select(x => x!).ToList(),
            ActualDespatchDate = Date(Text(shipment?.Element(Cac + "Delivery")?.Element(Cac + "Despatch"), Cbc + "ActualDespatchDate")),
            PlateNo = Text(stage?.Element(Cac + "TransportMeans")?.Element(Cac + "RoadTransport"), Cbc + "LicensePlateID")
                      ?? Text(shipment?.Element(Cac + "TransportHandlingUnit")?.Element(Cac + "TransportEquipment"), Cbc + "ID"),
            DriverName = driver is null ? null
                : string.Join(' ', new[] { Text(driver, Cbc + "FirstName"), Text(driver, Cbc + "FamilyName") }.Where(s => !string.IsNullOrWhiteSpace(s))),
        };
        if (string.IsNullOrWhiteSpace(d.DriverName)) d.DriverName = null;

        var i = 0;
        foreach (var l in root.Elements(Cac + "DespatchLine"))
        {
            i++;
            var item = l.Element(Cac + "Item");
            var qty = l.Element(Cbc + "DeliveredQuantity");
            d.Lines.Add(new UblDespatchLine
            {
                LineNo = int.TryParse(Text(l, Cbc + "ID"), out var no) ? no : i,
                SellerCode = Text(item?.Element(Cac + "SellersItemIdentification"), Cbc + "ID"),
                BuyerCode = Text(item?.Element(Cac + "BuyersItemIdentification"), Cbc + "ID"),
                Name = Text(item, Cbc + "Name"),
                Description = Text(item, Cbc + "Description"),
                Quantity = Num(qty?.Value) ?? 0,
                UnitCode = qty?.Attribute("unitCode")?.Value,
                OrderLineRef = Text(l.Element(Cac + "OrderLineReference"), Cbc + "LineID"),
            });
        }
        return d;
    }
}
