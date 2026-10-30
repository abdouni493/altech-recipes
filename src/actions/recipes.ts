"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db, q, snake } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { isForeignKey, runAction } from "@/lib/action-utils";
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
    const { ingredients, price, ...data } = parsed.data;
    try {
      // save_recipe() writes the recipe and its ingredients (array order = position) in one transaction;
      // unknown products or units are rejected by the foreign keys.
      const recipe = await q<{ id: string; name: string }>(db().rpc("save_recipe", {
        p_id: id,
        p_data: snake(data),
        p_ingredients: ingredients.map((i) => ({ product_id: i.productId, quantity: i.quantity, unit_id: i.unitId })),
      }));
      // Website price (supabase/commerce-2.sql).
      await q(db().rpc("set_catalog_price", { p_kind: "RECIPE", p_id: recipe.id, p_price: price ?? null }));
      revalidateRecipes();
      return { ok: true, data: recipe };
    } catch (e) {
      if (isForeignKey(e)) return { ok: false, error: "validation.invalidSelection" };
      throw e;
    }
  });
}

export async function deleteRecipeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("recipes.delete");
    await q(db().from("recipes").delete().eq("id", id));
    revalidateRecipes();
    return { ok: true };
  });
}

export async function duplicateRecipeAction(id: string): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff("recipes.create");
    const t = await getTranslations("recipes");
    const copy = await q<{ id: string; name: string }>(db().rpc("duplicate_recipe", { p_id: id, p_suffix: t("copySuffix") }));
    revalidateRecipes();
    return { ok: true, data: copy };
  });
}

export async function setRecipeVisibilityAction(id: string, visible: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("recipes.edit");
    await q(db().from("recipes").update({ is_visible_on_website: visible }).eq("id", id));
    revalidateRecipes();
    return { ok: true };
  });
}
