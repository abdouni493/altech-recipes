// Commerce helpers shared by server and client code: price types, money math, document shapes.
// The database (supabase/commerce.sql) recomputes every total; the values computed here are previews.
import { intlLocale } from "@/i18n/config";

export const PRICE_TYPES = ["DETAIL", "RESELLER", "WHOLESALE"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const DISCOUNT_TYPES = ["NONE", "AMOUNT", "PERCENT"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

export const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
export const round3 = (v: number) => Math.round((Number(v) || 0) * 1000) / 1000;

/** "12,5" → 12.5; empty / invalid → fallback. */
export function parseAmount(v: unknown, fallback = 0) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const n = Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""));
  return String(v ?? "").trim() === "" || !Number.isFinite(n) ? fallback : n;
}

export function formatMoney(value: number, locale: string) {
  const n = new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(round2(value));
  return locale === "ar" ? `${n} د.ج` : `${n} DA`;
}

export type Priced = { priceDetail: number; priceReseller: number; priceWholesale: number };

export function priceFor(p: Priced, type: PriceType) {
  return type === "RESELLER" ? p.priceReseller : type === "WHOLESALE" ? p.priceWholesale : p.priceDetail;
}

export function paymentStatus(total: number, paid: number): PaymentStatus {
  if (round2(total - paid) <= 0) return "PAID";
  return paid > 0 ? "PARTIAL" : "UNPAID";
}

/** Same formula as save_sale(): discount on the subtotal, then TVA on the discounted amount. */
export function saleTotals(subtotal: number, discountType: DiscountType, discountValue: number, tvaEnabled: boolean, tvaRate: number) {
  const sub = round2(subtotal);
  const value = Math.max(0, round2(discountValue));
  const discount = discountType === "AMOUNT" ? Math.min(value, sub) : discountType === "PERCENT" ? round2((sub * Math.min(value, 100)) / 100) : 0;
  const tva = tvaEnabled ? round2(((sub - discount) * tvaRate) / 100) : 0;
  return { subtotal: sub, discount, tva, total: round2(sub - discount + tva) };
}

/** Random EAN-13 starting with "2" (in-store range), with a valid check digit. */
export function generateEan13() {
  let digits = "2";
  for (let i = 0; i < 11; i++) digits += Math.floor(Math.random() * 10);
  return digits + ean13CheckDigit(digits);
}

export function ean13CheckDigit(first12: string) {
  const sum = first12.split("").reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

// ---- Shapes passed from server pages to client components ----------------------------

export type CommerceProductDTO = Priced & {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  barcode: string | null; purchasePrice: number; stockQuantity: number; minStockAlert: number;
  isVisibleOnWebsite: boolean; isOutOfStock: boolean; unitSymbol: string;
};

export type PartyDTO = { id: string; name: string; phone: string; priceType?: PriceType; serial?: number };

export type PaymentDTO = { id: string; amount: number; method: string; note: string; paidAt: string; createdBy: string | null };

export type PurchaseLineDTO = {
  productId: string; productName: string; productNameAr: string; unitSymbol: string;
  quantity: number; unitCost: number; lineTotal: number;
  priceDetail: number | null; priceReseller: number | null; priceWholesale: number | null; minStockAlert: number | null;
};

export type PurchaseDTO = {
  id: string; number: string; supplierId: string | null; supplierName: string | null; total: number; paidAmount: number; remaining: number;
  note: string; date: string; itemsCount: number;
};

export type PurchaseDetailDTO = PurchaseDTO & { lines: PurchaseLineDTO[]; payments: PaymentDTO[] };

export type SaleLineDTO = {
  productId: string; productName: string; productNameAr: string; unitSymbol: string;
  quantity: number; priceType: PriceType; unitPrice: number; lineTotal: number;
};

export type SaleDTO = {
  id: string; number: string; clientId: string | null; clientName: string | null; priceType: PriceType;
  subtotal: number; discountType: DiscountType; discountValue: number; discountAmount: number;
  tvaEnabled: boolean; tvaRate: number; tvaAmount: number; total: number; paidAmount: number; remaining: number;
  note: string; date: string; itemsCount: number;
};

export type SaleDetailDTO = SaleDTO & { lines: SaleLineDTO[]; payments: PaymentDTO[] };

export type LedgerRow = { date: string; type: string; reference: string; debit: number; credit: number };
export type PartyHistory = {
  documents: { id: string; number: string; date: string; total: number; paidAmount: number; remaining: number }[];
  payments: { id: string; amount: number; method: string; note: string; paidAt: string; reference: string }[];
  ledger: LedgerRow[];
  totals: { total: number; paid: number; debt: number; count: number };
};
