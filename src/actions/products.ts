"use server";

import { revalidatePath } from "next/cache";
import { countOf, db, q, snake } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { isForeignKey, runAction } from "@/lib/action-utils";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function saveProductAction(id: string | null, input: ProductInput): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff(id ? "products.edit" : "products.create");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const row = snake(parsed.data);
    try {
      const product = await q<{ id: string; name: string }>(
        id
          ? db().from("products").update(row).eq("id", id).select("id, name").single()
          : db().from("products").insert(row).select("id, name").single(),
      );
      revalidatePath("/admin/products");
      revalidatePath("/admin/recipes", "layout");
      return { ok: true, data: product };
    } catch (e) {
      if (isForeignKey(e)) return { ok: false, error: "validation.selectUnit", fieldErrors: { unitId: "validation.selectUnit" } };
      throw e;
    }
  });
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("products.delete");
    const count = await countOf(db().from("recipe_ingredients").select("id", { count: "exact", head: true }).eq("product_id", id));
    if (count > 0) return { ok: false, error: "products.inUse", meta: { count } };
    await q(db().from("products").delete().eq("id", id));
    revalidatePath("/admin/products");
    return { ok: true };
  });
}
