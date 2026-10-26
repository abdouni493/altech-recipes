"use server";

import { revalidatePath } from "next/cache";
import { db, q, snake } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { isForeignKey, runAction } from "@/lib/action-utils";
import { supplierSchema, type SupplierInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function saveSupplierAction(id: string | null, input: SupplierInput): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff(id ? "suppliers.edit" : "suppliers.create");
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const { productIds, ...data } = parsed.data;
    try {
      // save_supplier() writes the supplier and its products in one transaction.
      const supplier = await q<{ id: string; name: string }>(
        db().rpc("save_supplier", { p_id: id, p_data: snake(data), p_product_ids: Array.from(new Set(productIds)) }),
      );
      revalidatePath("/admin/suppliers", "layout");
      revalidatePath("/client/suppliers", "layout");
      return { ok: true, data: supplier };
    } catch (e) {
      if (isForeignKey(e)) return { ok: false, error: "validation.invalidSelection" };
      throw e;
    }
  });
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("suppliers.delete");
    await q(db().from("suppliers").delete().eq("id", id));
    revalidatePath("/admin/suppliers", "layout");
    revalidatePath("/client/suppliers", "layout");
    return { ok: true };
  });
}
