import "server-only";
import { db, n, q } from "@/lib/db";
import type { Product, Recipe, RecipeIngredient, Unit } from "@/lib/db-types";
import { unitDTO, type UnitDTO } from "@/lib/dto";
import { toNumber } from "@/lib/utils";

export type PortalRecipe = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  outputQuantity: number; outputUnit: UnitDTO; ingredientsCount: number; packIds: string[]; favorite: boolean;
};

type RecipeWithUnit = Recipe & { outputUnit: Unit; packs: { packId: string }[] };
const RECIPE_SELECT = "*, outputUnit:units!recipes_output_unit_id_fkey(*), packs:pack_recipes(pack_id)";

/** Only the recipes the client has a permission for (the source of truth; RLS enforces it too). */
export async function getClientRecipes(clientId: string): Promise<PortalRecipe[]> {
  const [perms, favorites] = await Promise.all([
    q<{ packId: string | null; recipe: (RecipeWithUnit & { ingredients: unknown }) | null }[]>(
      db().from("client_permissions").select(`pack_id, recipe:recipes(${RECIPE_SELECT}, ingredients:recipe_ingredients(count))`).eq("client_id", clientId),
    ),
    q<{ recipeId: string }[]>(db().from("favorites").select("recipe_id").eq("client_id", clientId)),
  ]);
  const fav = new Set(favorites.map((f) => f.recipeId));
  return perms
    .filter((p): p is { packId: string | null; recipe: RecipeWithUnit & { ingredients: unknown } } => Boolean(p.recipe))
    .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name))
    .map(({ recipe: r, packId }) => ({
      id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
      outputQuantity: toNumber(r.outputQuantity), outputUnit: unitDTO(r.outputUnit), ingredientsCount: n(r.ingredients),
      packIds: Array.from(new Set([...(packId ? [packId] : []), ...r.packs.map((p) => p.packId)])),
      favorite: fav.has(r.id),
    }));
}

export type PortalRecipeDetail = PortalRecipe & {
  ingredients: { id: string; productName: string; productNameAr: string; imageUrl: string | null; quantity: number; unit: UnitDTO }[];
};

/** Full formula of one recipe — returns null when the client has no permission (never leaks existence). */
export async function getPermittedRecipe(clientId: string, recipeId: string): Promise<PortalRecipeDetail | null> {
  const perm = await q<{ id: string } | null>(
    db().from("client_permissions").select("id").eq("client_id", clientId).eq("recipe_id", recipeId).maybeSingle(),
  );
  if (!perm) return null;
  const [r, fav] = await Promise.all([
    q<(RecipeWithUnit & { ingredients: (RecipeIngredient & { product: Product; unit: Unit })[] }) | null>(
      db().from("recipes")
        .select(`${RECIPE_SELECT}, ingredients:recipe_ingredients(*, product:products(*), unit:units(*))`)
        .eq("id", recipeId).maybeSingle(),
    ),
    q<{ recipeId: string } | null>(db().from("favorites").select("recipe_id").eq("client_id", clientId).eq("recipe_id", recipeId).maybeSingle()),
  ]);
  if (!r) return null;
  const ingredients = [...r.ingredients].sort((a, b) => a.position - b.position);
  return {
    id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
    outputQuantity: toNumber(r.outputQuantity), outputUnit: unitDTO(r.outputUnit), ingredientsCount: ingredients.length,
    packIds: r.packs.map((p) => p.packId), favorite: Boolean(fav),
    ingredients: ingredients.map((i) => ({
      id: i.id, productName: i.product?.name ?? "", productNameAr: i.product?.nameAr ?? "", imageUrl: i.product?.imageUrl ?? null,
      quantity: toNumber(i.quantity), unit: unitDTO(i.unit),
    })),
  };
}

export async function getClientPacks(clientId: string) {
  const perms = await q<{ pack: { id: string; name: string; nameAr: string } | null }[]>(
    db().from("client_permissions").select("pack:packs(id, name, name_ar)").eq("client_id", clientId).not("pack_id", "is", null),
  );
  const map = new Map<string, { id: string; name: string; nameAr: string }>();
  for (const p of perms) if (p.pack) map.set(p.pack.id, p.pack);
  return Array.from(map.values());
}
