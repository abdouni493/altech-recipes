"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, DbError, q } from "@/lib/db";
import { requireAnyStaff, requireStaff } from "@/lib/authz";
import { isConflict, isForeignKey, runAction } from "@/lib/action-utils";
import { DISCOUNT_TYPES, PRICE_TYPES, round2, type PartyHistory } from "@/lib/commerce";
import { toNumber } from "@/lib/utils";
import type { ActionResult } from "@/lib/validators";

const num = z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(",", "."))) : v), z.number().finite().min(0).max(1_000_000_000));
const optNum = num.optional().nullable();
const id = z.string().min(1);
const optId = z.string().optional().nullable().transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().transform((v) => v || null);

/** Database errors raised by commerce.sql → translated keys. */
function commerceError(e: unknown): ActionResult<never> | null {
  if (!(e instanceof DbError)) return null;
  if (/walk-in/.test(e.message)) return { ok: false, error: "commerce.errors.walkInMustPay" };
  if (/paid amount|lower than paid/.test(e.message)) return { ok: false, error: "commerce.errors.paidTooHigh" };
  if (/invalid amount/.test(e.message)) return { ok: false, error: "commerce.errors.amountTooHigh" };
  if (/does not belong/.test(e.message)) return { ok: false, error: "commerce.errors.invalidSelection" };
  if (isForeignKey(e) || e.code === "P0002") return { ok: false, error: "commerce.errors.notFound" };
  if (isConflict(e)) return { ok: false, error: "commerce.errors.barcodeUsed" };
  return null;
}

async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      const mapped = commerceError(e);
      if (mapped) return mapped;
      throw e;
    }
  });
}

function revalidateCommerce() {
  for (const p of ["/admin/purchases", "/admin/sales", "/admin/products", "/admin/pos", "/admin/clients", "/admin/suppliers", "/admin"]) {
    revalidatePath(p, "layout");
  }
  revalidatePath("/produits");
}

// ---- Purchases ------------------------------------------------------------------------

const purchaseSchema = z.object({
  supplierId: optId,
  note: z.string().max(2000).optional().default(""),
  purchasedAt: date,
  paidAmount: optNum,
  items: z.array(z.object({
    productId: id, quantity: num, unitCost: num,
    priceDetail: optNum, priceReseller: optNum, priceWholesale: optNum, minStockAlert: optNum,
  })).max(500),
});
export type PurchaseInput = z.input<typeof purchaseSchema>;

export async function savePurchaseAction(purchaseId: string | null, input: PurchaseInput): Promise<ActionResult<{ id: string; number: string }>> {
  return guarded(async () => {
    await requireStaff(purchaseId ? "purchases.edit" : "purchases.create");
    const parsed = purchaseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid" };
    const d = parsed.data;
    const res = await q<{ id: string; number: string }>(db().rpc("save_purchase", {
      p_id: purchaseId,
      p_data: { supplier_id: d.supplierId, note: d.note, purchased_at: d.purchasedAt, paid_amount: d.paidAmount ?? null },
      p_items: d.items.filter((i) => i.quantity > 0).map((i) => ({
        product_id: i.productId, quantity: i.quantity, unit_cost: i.unitCost, price_detail: i.priceDetail ?? null,
        price_reseller: i.priceReseller ?? null, price_wholesale: i.priceWholesale ?? null, min_stock_alert: i.minStockAlert ?? null,
      })),
    }));
    revalidateCommerce();
    return { ok: true, data: res };
  });
}

export async function deletePurchaseAction(purchaseId: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireStaff("purchases.delete");
    await q(db().rpc("delete_purchase", { p_id: purchaseId }));
    revalidateCommerce();
    return { ok: true };
  });
}

// ---- Sales ----------------------------------------------------------------------------

const saleSchema = z.object({
  clientId: optId,
  priceType: z.enum(PRICE_TYPES).default("DETAIL"),
  discountType: z.enum(DISCOUNT_TYPES).default("NONE"),
  discountValue: num.default(0),
  tvaEnabled: z.boolean().default(false),
  tvaRate: num.default(19),
  paidAmount: optNum,
  note: z.string().max(2000).optional().default(""),
  orderId: optId,
  items: z.array(z.object({ productId: id, quantity: num, priceType: z.enum(PRICE_TYPES), unitPrice: optNum })).min(1).max(500),
});
export type SaleInput = z.input<typeof saleSchema>;

export async function saveSaleAction(saleId: string | null, input: SaleInput): Promise<ActionResult<{ id: string; number: string; total: number }>> {
  return guarded(async () => {
    if (saleId) await requireStaff("sales.edit");
    else await requireAnyStaff(["sales.create", "pos.use"]);
    const parsed = saleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "commerce.errors.emptyCart" };
    const d = parsed.data;
    const res = await q<{ id: string; number: string; total: number }>(db().rpc("save_sale", {
      p_id: saleId,
      p_data: {
        client_id: d.clientId, price_type: d.priceType, discount_type: d.discountType, discount_value: d.discountValue,
        tva_enabled: d.tvaEnabled, tva_rate: d.tvaRate, paid_amount: d.paidAmount ?? null, note: d.note, order_id: d.orderId,
      },
      p_items: d.items.filter((i) => i.quantity > 0).map((i) => ({
        product_id: i.productId, quantity: i.quantity, price_type: i.priceType, unit_price: i.unitPrice ?? null,
      })),
    }));
    revalidateCommerce();
    if (d.orderId) revalidatePath("/admin/orders");
    return { ok: true, data: { ...res, total: toNumber(res.total) } };
  });
}

export async function deleteSaleAction(saleId: string): Promise<ActionResult> {
  return guarded(async () => {
    await requireStaff("sales.delete");
    await q(db().rpc("delete_sale", { p_id: saleId }));
    revalidateCommerce();
    return { ok: true };
  });
}

// ---- Payments / debts -----------------------------------------------------------------

export async function addPaymentAction(kind: "PURCHASE" | "SALE", refId: string, amount: number, note = ""): Promise<ActionResult> {
  return guarded(async () => {
    await requireStaff(kind === "PURCHASE" ? "purchases.pay" : "sales.pay");
    if (!(round2(amount) > 0)) return { ok: false, error: "commerce.errors.amountRequired" };
    await q(db().rpc("add_payment", { p_kind: kind, p_ref_id: refId, p_amount: round2(amount), p_note: note.slice(0, 500), p_method: "CASH" }));
    revalidateCommerce();
    return { ok: true };
  });
}

const allocations = z.array(z.object({ id, amount: num })).min(1).max(500);

export async function payPartyDebtAction(kind: "client" | "supplier", partyId: string, input: { id: string; amount: number }[], note = ""): Promise<ActionResult<{ paid: number }>> {
  return guarded(async () => {
    await requireStaff(kind === "client" ? "sales.pay" : "purchases.pay");
    const parsed = allocations.safeParse(input.filter((a) => a.amount > 0));
    if (!parsed.success) return { ok: false, error: "commerce.errors.amountRequired" };
    const paid = await q<number>(db().rpc(kind === "client" ? "pay_client_debt" : "pay_supplier_debt", {
      [kind === "client" ? "p_client_id" : "p_supplier_id"]: partyId,
      p_allocations: parsed.data.map((a) => ({ id: a.id, amount: round2(a.amount) })),
      p_note: note.slice(0, 500),
    }));
    revalidateCommerce();
    return { ok: true, data: { paid: toNumber(paid) } };
  });
}

/** Documents of a client / supplier that still have something to pay. */
export async function unpaidDocumentsAction(kind: "client" | "supplier", partyId: string): Promise<ActionResult<{ id: string; number: string; date: string; total: number; remaining: number }[]>> {
  return guarded(async () => {
    if (kind === "client") {
      await requireAnyStaff(["sales.pay", "sales.view", "clients.view"]);
      const rows = await q<{ id: string; invoiceNumber: string; soldAt: string; total: number; remaining: number }[]>(
        db().from("sales").select("id, invoice_number, sold_at, total, remaining").eq("client_id", partyId).gt("remaining", 0).order("sold_at"),
      );
      return { ok: true, data: rows.map((r) => ({ id: r.id, number: r.invoiceNumber, date: r.soldAt, total: toNumber(r.total), remaining: toNumber(r.remaining) })) };
    }
    await requireAnyStaff(["purchases.pay", "purchases.view", "suppliers.view"]);
    const rows = await q<{ id: string; purchaseNumber: string; purchasedAt: string; total: number; remaining: number }[]>(
      db().from("purchases").select("id, purchase_number, purchased_at, total, remaining").eq("supplier_id", partyId).gt("remaining", 0).order("purchased_at"),
    );
    return { ok: true, data: rows.map((r) => ({ id: r.id, number: r.purchaseNumber, date: r.purchasedAt, total: toNumber(r.total), remaining: toNumber(r.remaining) })) };
  });
}

type RawHistory = {
  sales?: Record<string, unknown>[]; purchases?: Record<string, unknown>[];
  payments: Record<string, unknown>[]; ledger: Record<string, unknown>[];
  totals: { total: number; paid: number; debt: number; count: number };
};

export async function partyHistoryAction(kind: "client" | "supplier", partyId: string, from: string | null, to: string | null): Promise<ActionResult<PartyHistory>> {
  return guarded(async () => {
    await requireAnyStaff(kind === "client" ? ["clients.view", "sales.view"] : ["suppliers.view", "purchases.view"]);
    const raw = await q<RawHistory>(db().rpc(kind === "client" ? "client_history" : "supplier_history", {
      [kind === "client" ? "p_client_id" : "p_supplier_id"]: partyId, p_from: from || null, p_to: to || null,
    }));
    const docs = (kind === "client" ? raw.sales : raw.purchases) ?? [];
    return {
      ok: true,
      data: {
        documents: docs.map((d) => ({
          id: String(d.id), number: String(d.invoiceNumber ?? d.purchaseNumber), date: String(d.soldAt ?? d.purchasedAt),
          total: toNumber(d.total), paidAmount: toNumber(d.paidAmount), remaining: toNumber(d.remaining),
        })),
        payments: raw.payments.map((p) => ({
          id: String(p.id), amount: toNumber(p.amount), method: String(p.method), note: String(p.note ?? ""), paidAt: String(p.paidAt),
          reference: String(p.invoiceNumber ?? p.purchaseNumber ?? ""),
        })),
        ledger: raw.ledger.map((l) => ({ date: String(l.date), type: String(l.type), reference: String(l.reference), debit: toNumber(l.debit), credit: toNumber(l.credit) })),
        totals: { total: toNumber(raw.totals.total), paid: toNumber(raw.totals.paid), debt: toNumber(raw.totals.debt), count: toNumber(raw.totals.count) },
      },
    };
  });
}

// ---- Products: stock, flags, history -------------------------------------------------

export async function adjustStockAction(productId: string, quantity: number, note = ""): Promise<ActionResult> {
  return guarded(async () => {
    await requireStaff("products.edit");
    if (!Number.isFinite(quantity)) return { ok: false, error: "validation.number" };
    await q(db().rpc("adjust_stock", { p_product_id: productId, p_new_quantity: quantity, p_note: note.slice(0, 300) }));
    revalidateCommerce();
    return { ok: true };
  });
}

export async function setProductFlagAction(productId: string, flag: "isVisibleOnWebsite" | "isOutOfStock", value: boolean): Promise<ActionResult> {
  return guarded(async () => {
    await requireStaff("products.edit");
    await q(db().from("products").update(flag === "isVisibleOnWebsite" ? { is_visible_on_website: value } : { is_out_of_stock: value }).eq("id", productId));
    revalidateCommerce();
    return { ok: true };
  });
}

/** Barcode already used by another product? */
export async function barcodeTakenAction(barcode: string, exceptId: string | null): Promise<ActionResult<{ taken: boolean }>> {
  return guarded(async () => {
    await requireAnyStaff(["products.create", "products.edit"]);
    let query = db().from("products").select("id").eq("barcode", barcode.trim()).limit(1);
    if (exceptId) query = query.neq("id", exceptId);
    const rows = await q<{ id: string }[]>(query);
    return { ok: true, data: { taken: rows.length > 0 } };
  });
}

export type ProductHistory = {
  purchases: { id: string; number: string; date: string; supplier: string | null; quantity: number; unitCost: number; lineTotal: number }[];
  sales: { id: string; number: string; date: string; client: string | null; quantity: number; priceType: string; unitPrice: number; lineTotal: number; profit: number }[];
  recipes: { id: string; name: string; nameAr: string; quantity: number }[];
  orders: { id: string; number: string; date: string; client: string; status: string; quantity: number; lineTotal: number }[];
  movements: { id: string; type: string; quantity: number; note: string; createdAt: string }[];
  totals: { purchasedQty: number; purchasedAmount: number; soldQty: number; soldAmount: number; profit: number; orderedQty: number; recipesCount: number };
};

export async function productHistoryAction(productId: string, from: string | null, to: string | null): Promise<ActionResult<ProductHistory>> {
  return guarded(async () => {
    await requireStaff("products.view");
    const raw = await q<Record<string, Record<string, unknown>[]> & { totals: Record<string, number> }>(
      db().rpc("product_history", { p_product_id: productId, p_from: from || null, p_to: to || null }),
    );
    const nums = <T extends Record<string, unknown>>(rows: Record<string, unknown>[], keys: string[]) =>
      rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, keys.includes(k) ? toNumber(v) : v])) as T);
    const t = raw.totals;
    return {
      ok: true,
      data: {
        purchases: nums(raw.purchases ?? [], ["quantity", "unitCost", "lineTotal"]),
        sales: nums(raw.sales ?? [], ["quantity", "unitPrice", "lineTotal", "profit"]),
        recipes: nums(raw.recipes ?? [], ["quantity"]),
        orders: nums(raw.orders ?? [], ["quantity", "lineTotal"]),
        movements: nums(raw.movements ?? [], ["quantity"]),
        totals: {
          purchasedQty: toNumber(t.purchasedQty), purchasedAmount: toNumber(t.purchasedAmount), soldQty: toNumber(t.soldQty),
          soldAmount: toNumber(t.soldAmount), profit: toNumber(t.profit), orderedQty: toNumber(t.orderedQty), recipesCount: toNumber(t.recipesCount),
        },
      },
    };
  });
}
