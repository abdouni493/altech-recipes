"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { packSchema, type PackInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function savePackAction(id: string | null, input: PackInput): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff(id ? "packs.edit" : "packs.create");
    const parsed = packSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const { recipeIds, ...data } = parsed.data;
    const ids = Array.from(new Set(recipeIds));
    const found = await prisma.recipe.count({ where: { id: { in: ids } } });
    if (found !== ids.length) return { ok: false, error: "validation.invalidSelection" };
    const pack = await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.packRecipe.deleteMany({ where: { packId: id } });
        return tx.pack.update({ where: { id }, data: { ...data, recipes: { create: ids.map((recipeId) => ({ recipeId })) } } });
      }
      return tx.pack.create({ data: { ...data, recipes: { create: ids.map((recipeId) => ({ recipeId })) } } });
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return { ok: true, data: { id: pack.id, name: pack.name } };
  });
}

export async function deletePackAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("packs.delete");
    // Permissions keep the recipe access; only the pack reference is cleared (onDelete: SetNull).
    await prisma.pack.delete({ where: { id } });
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
