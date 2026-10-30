import "server-only";
import { db, q } from "@/lib/db";
import type {
  CommerceProductDTO, PartyDTO, PaymentDTO, PriceType, PurchaseDetailDTO, PurchaseDTO, SaleDetailDTO, SaleDTO, DiscountType,
} from "@/lib/commerce";
import { toNumber } from "@/lib/utils";

type ProductRow = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null; barcode: string | null;
  purchasePrice: number; priceDetail: number; priceReseller: number; priceWholesale: number; stockQuantity: number; minStockAlert: number;
  isVisibleOnWebsite: boolean; isOutOfStock: boolean; unit: { symbol: string } | null;
};

export function commerceProductDTO(p: ProductRow): CommerceProductDTO {
  return {
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr, imageUrl: p.imageUrl,
    barcode: p.barcode, purchasePrice: toNumber(p.purchasePrice), priceDetail: toNumber(p.priceDetail), priceReseller: toNumber(p.priceReseller),
    priceWholesale: toNumber(p.priceWholesale), stockQuantity: toNumber(p.stockQuantity), minStockAlert: toNumber(p.minStockAlert),
    isVisibleOnWebsite: p.isVisibleOnWebsite, isOutOfStock: p.isOutOfStock, unitSymbol: p.unit?.symbol ?? "",
  };
}

const PRODUCT_COLUMNS =
  "id, name, name_ar, description, description_ar, image_url, barcode, purchase_price, price_detail, price_reseller, price_wholesale, stock_quantity, min_stock_alert, is_visible_on_website, is_out_of_stock, unit:units(symbol)";

export async function listCommerceProducts() {
  const rows = await q<ProductRow[]>(db().from("products").select(PRODUCT_COLUMNS).order("name"));
  return rows.map(commerceProductDTO);
}

export async function listSuppliersLite(): Promise<PartyDTO[]> {
  const rows = await q<{ id: string; fullName: string; phone: string }[]>(db().from("suppliers").select("id, full_name, phone").order("full_name"));
  return rows.map((s) => ({ id: s.id, name: s.fullName, phone: s.phone }));
}

export async function listClientsLite(): Promise<PartyDTO[]> {
  const rows = await q<{ id: string; fullName: string; phone: string; priceType: PriceType; serialNumber: number }[]>(
    db().from("clients").select("id, full_name, phone, price_type, serial_number").order("full_name"),
  );
  return rows.map((c) => ({ id: c.id, name: c.fullName, phone: c.phone, priceType: c.priceType ?? "DETAIL", serial: c.serialNumber }));
}

type PaymentRow = { id: string; amount: number; method: string; note: string; paidAt: string; creator: { name: string } | null };
const paymentDTO = (p: PaymentRow): PaymentDTO => ({
  id: p.id, amount: toNumber(p.amount), method: p.method, note: p.note, paidAt: p.paidAt, createdBy: p.creator?.name ?? null,
});

type PurchaseRow = {
  id: string; purchaseNumber: string; supplierId: string | null; supplier: { fullName: string } | null; total: number; paidAmount: number;
  remaining: number; note: string; purchasedAt: string; items: { count: number }[];
};
const purchaseDTO = (p: PurchaseRow): PurchaseDTO => ({
  id: p.id, number: p.purchaseNumber, supplierId: p.supplierId, supplierName: p.supplier?.fullName ?? null, total: toNumber(p.total),
  paidAmount: toNumber(p.paidAmount), remaining: toNumber(p.remaining), note: p.note, date: p.purchasedAt, itemsCount: p.items?.[0]?.count ?? 0,
});
const PURCHASE_COLUMNS = "*, supplier:suppliers(full_name), items:purchase_items(count)";

export async function listPurchases() {
  return (await q<PurchaseRow[]>(db().from("purchases").select(PURCHASE_COLUMNS).order("purchased_at", { ascending: false }).order("created_at", { ascending: false }))).map(purchaseDTO);
}

export async function getPurchase(id: string): Promise<PurchaseDetailDTO | null> {
  const p = await q<(PurchaseRow & {
    lines: { productId: string; quantity: number; unitCost: number; lineTotal: number; priceDetail: number | null; priceReseller: number | null;
      priceWholesale: number | null; minStockAlert: number | null; position: number; product: { name: string; nameAr: string; unit: { symbol: string } | null } | null }[];
    payments: PaymentRow[];
  }) | null>(
    db().from("purchases").select(`${PURCHASE_COLUMNS}, lines:purchase_items(*, product:products(name, name_ar, unit:units(symbol))), payments(*, creator:profiles(name))`)
      .eq("id", id).maybeSingle(),
  );
  if (!p) return null;
  const n = (v: number | null) => (v === null ? null : toNumber(v));
  return {
    ...purchaseDTO(p),
    lines: [...p.lines].sort((a, b) => a.position - b.position).map((l) => ({
      productId: l.productId, productName: l.product?.name ?? "—", productNameAr: l.product?.nameAr ?? "", unitSymbol: l.product?.unit?.symbol ?? "",
      quantity: toNumber(l.quantity), unitCost: toNumber(l.unitCost), lineTotal: toNumber(l.lineTotal),
      priceDetail: n(l.priceDetail), priceReseller: n(l.priceReseller), priceWholesale: n(l.priceWholesale), minStockAlert: n(l.minStockAlert),
    })),
    payments: [...p.payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).map(paymentDTO),
  };
}

type SaleRow = {
  id: string; invoiceNumber: string; clientId: string | null; client: { fullName: string } | null; priceType: PriceType; subtotal: number;
  discountType: DiscountType; discountValue: number; discountAmount: number; tvaEnabled: boolean; tvaRate: number; tvaAmount: number;
  total: number; paidAmount: number; remaining: number; note: string; soldAt: string; items: { count: number }[];
};
const saleDTO = (s: SaleRow): SaleDTO => ({
  id: s.id, number: s.invoiceNumber, clientId: s.clientId, clientName: s.client?.fullName ?? null, priceType: s.priceType,
  subtotal: toNumber(s.subtotal), discountType: s.discountType, discountValue: toNumber(s.discountValue), discountAmount: toNumber(s.discountAmount),
  tvaEnabled: s.tvaEnabled, tvaRate: toNumber(s.tvaRate), tvaAmount: toNumber(s.tvaAmount), total: toNumber(s.total),
  paidAmount: toNumber(s.paidAmount), remaining: toNumber(s.remaining), note: s.note, date: s.soldAt, itemsCount: s.items?.[0]?.count ?? 0,
});
const SALE_COLUMNS = "*, client:clients(full_name), items:sale_items(count)";

export async function listSales() {
  return (await q<SaleRow[]>(db().from("sales").select(SALE_COLUMNS).order("sold_at", { ascending: false }))).map(saleDTO);
}

export async function getSale(id: string): Promise<SaleDetailDTO | null> {
  const s = await q<(SaleRow & {
    lines: { productId: string; quantity: number; priceType: PriceType; unitPrice: number; lineTotal: number; position: number;
      product: { name: string; nameAr: string; unit: { symbol: string } | null } | null }[];
    payments: PaymentRow[];
  }) | null>(
    db().from("sales").select(`${SALE_COLUMNS}, lines:sale_items(*, product:products(name, name_ar, unit:units(symbol))), payments(*, creator:profiles(name))`)
      .eq("id", id).maybeSingle(),
  );
  if (!s) return null;
  return {
    ...saleDTO(s),
    lines: [...s.lines].sort((a, b) => a.position - b.position).map((l) => ({
      productId: l.productId, productName: l.product?.name ?? "—", productNameAr: l.product?.nameAr ?? "", unitSymbol: l.product?.unit?.symbol ?? "",
      quantity: toNumber(l.quantity), priceType: l.priceType, unitPrice: toNumber(l.unitPrice), lineTotal: toNumber(l.lineTotal),
    })),
    payments: [...s.payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).map(paymentDTO),
  };
}

/** Total remaining per client / supplier id. */
export async function debtsBy(kind: "client" | "supplier") {
  const rows = kind === "client"
    ? await q<{ clientId: string; debt: number }[]>(db().from("client_balances").select("client_id, debt").gt("debt", 0))
    : await q<{ supplierId: string; debt: number }[]>(db().from("supplier_balances").select("supplier_id, debt").gt("debt", 0));
  return Object.fromEntries(rows.map((r) => ["clientId" in r ? r.clientId : r.supplierId, toNumber(r.debt)]));
}
