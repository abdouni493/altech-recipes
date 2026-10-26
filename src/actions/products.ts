"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function saveProductAction(id: string | null, input: ProductInput): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff(id ? "products.edit" : "products.create");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const unit = await prisma.unit.findUnique({ where: { id: parsed.data.unitId } });
    if (!unit) return { ok: false, error: "validation.selectUnit", fieldErrors: { unitId: "validation.selectUnit" } };
    const product = id
      ? await prisma.product.update({ where: { id }, data: parsed.data })
      : await prisma.product.create({ data: parsed.data });
    revalidatePath("/admin/products");
    revalidatePath("/admin/recipes", "layout");
    return { ok: true, data: { id: product.id, name: product.name } };
  });
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("products.delete");
    const count = await prisma.recipeIngredient.count({ where: { productId: id } });
    if (count > 0) return { ok: false, error: "products.inUse", meta: { count } };
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/products");
    return { ok: true };
  });
}
