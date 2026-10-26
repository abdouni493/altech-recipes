"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { recipeSchema, type RecipeInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

function revalidateRecipes() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

export async function saveRecipeAction(id: string | null, input: RecipeInput): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff(id ? "recipes.edit" : "recipes.create");
    const parsed = recipeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const { ingredients, ...data } = parsed.data;

    // Every referenced product & unit must exist.
    const productIds = ingredients.map((i) => i.productId);
    const unitIds = Array.from(new Set([...ingredients.map((i) => i.unitId), data.outputUnitId]));
    const [pCount, uCount] = await Promise.all([
      prisma.product.count({ where: { id: { in: productIds } } }),
      prisma.unit.count({ where: { id: { in: unitIds } } }),
    ]);
    if (pCount !== productIds.length || uCount !== unitIds.length) return { ok: false, error: "validation.invalidSelection" };

    const rows = ingredients.map((i, position) => ({ productId: i.productId, quantity: i.quantity, unitId: i.unitId, position }));
    const recipe = await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        return tx.recipe.update({ where: { id }, data: { ...data, ingredients: { create: rows } } });
      }
      return tx.recipe.create({ data: { ...data, ingredients: { create: rows } } });
    });
    revalidateRecipes();
    return { ok: true, data: { id: recipe.id, name: recipe.name } };
  });
}

export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("recipes.delete");
    await prisma.recipe.delete({ where: { id } });
    revalidateRecipes();
    return { ok: true };
  });
}

export async function duplicateRecipeAction(id: string): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff("recipes.create");
    const t = await getTranslations("recipes");
    const src = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } });
    if (!src) return { ok: false, error: "common.genericError" };
    const copy = await prisma.recipe.create({
      data: {
        name: `${src.name} ${t("copySuffix")}`,
        nameAr: src.nameAr ? `${src.nameAr} (نسخة)` : "",
        description: src.description,
        descriptionAr: src.descriptionAr,
        imageUrl: src.imageUrl,
        outputQuantity: src.outputQuantity,
        outputUnitId: src.outputUnitId,
        isVisibleOnWebsite: false,
        ingredients: {
          create: src.ingredients.map((i) => ({ productId: i.productId, quantity: i.quantity, unitId: i.unitId, position: i.position })),
        },
      },
    });
    revalidateRecipes();
    return { ok: true, data: { id: copy.id, name: copy.name } };
  });
}

export async function setRecipeVisibilityAction(id: string, visible: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("recipes.edit");
    await prisma.recipe.update({ where: { id }, data: { isVisibleOnWebsite: visible } });
    revalidateRecipes();
    return { ok: true };
  });
}
