"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { orderSchema, type OrderInput } from "@/lib/order-schema";
import { db, q } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { findWilaya } from "@/lib/algeria";
import { V, zodFieldErrors, type ActionResult } from "@/lib/validators";
import { getPublicRecipeProducts, type PublicRecipeProduct } from "@/lib/public-queries";

// Simple in-memory rate limit: 5 orders / 10 minutes per IP.
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function createOrderAction(input: OrderInput): Promise<ActionResult<{ orderNumber: string }>> {
  return runAction(async () => {
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "site.orderError", fieldErrors: zodFieldErrors(parsed.error) };
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (rateLimited(ip)) return { ok: false, error: "site.tooMany" };

    const d = parsed.data;
    const wilaya = findWilaya(d.wilayaCode);
    if (!wilaya) return { ok: false, error: "site.orderError", fieldErrors: { wilayaCode: V.selectWilaya } };
    const commune = wilaya.communes.find((c) => c.fr === d.communeName);
    if (!commune) return { ok: false, error: "site.orderError", fieldErrors: { communeName: V.selectCommune } };

    const base = { p_full_name: d.fullName, p_phone: d.phone, p_wilaya_code: wilaya.code, p_wilaya_name: wilaya.fr, p_commune_name: commune.fr };
    // create_order_v2() keeps only visible recipes, existing packs and products in stock, and re-reads every price.
    // An order without items (a simple question) still goes through create_order().
    const orderNumber = d.items.length
      ? await q<string>(db().rpc("create_order_v2", {
          ...base, p_items: d.items, p_message: d.message, p_wants_client_account: d.wantsClientAccount,
        }))
      : await q<string>(db().rpc("create_order", {
          ...base, p_recipe_id: null, p_pack_id: null, p_message: d.message, p_wants_client_account: d.wantsClientAccount,
        }));
    revalidatePath("/admin", "layout");
    return { ok: true, data: { orderNumber } };
  });
}

export async function setOrderStatusAction(id: string, status: "CONFIRMED" | "CANCELLED" | "PENDING"): Promise<ActionResult<{ orderNumber: string }>> {
  return runAction(async () => {
    await requireStaff("orders.edit");
    if (!["CONFIRMED", "CANCELLED", "PENDING"].includes(status)) return { ok: false, error: "validation.invalid" };
    const now = new Date().toISOString();
    const order = await q<{ orderNumber: string }>(
      db().from("orders").update({
        status,
        confirmed_at: status === "CONFIRMED" ? now : null,
        cancelled_at: status === "CANCELLED" ? now : null,
      }).eq("id", id).select("order_number").single(),
    );
    revalidatePath("/admin", "layout");
    return { ok: true, data: { orderNumber: order.orderNumber } };
  });
}

export async function deleteOrderAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("orders.delete");
    await q(db().from("orders").delete().eq("id", id));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

/** Public: products used by a recipe that can be ordered with it (website order form suggestion). */
export async function recipeProductsAction(recipeId: string): Promise<ActionResult<PublicRecipeProduct[]>> {
  return runAction(async () => ({ ok: true, data: await getPublicRecipeProducts(String(recipeId).slice(0, 64)) }));
}
