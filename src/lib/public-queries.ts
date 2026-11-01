import "server-only";
import { db, q } from "@/lib/db";

/**
 * Public catalog: ONLY id + name, description and image (with their Arabic variants).
 * Ingredients, quantities and output are never selected here, so they cannot reach the HTML or any API response.
 */
export const PUBLIC_RECIPE_COLUMNS = "id, name, name_ar, description, description_ar, image_url, price, category_id";

export type PublicRecipe = { id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null; price: number | null; categoryId: string | null };

/** Public pages render an empty catalog instead of crashing when the database is unreachable. */
async function orEmpty<T>(label: string, query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (e) {
    console.error(`${label} failed:`, e);
    return [];
  }
}

export function getPublicRecipes(take?: number): Promise<PublicRecipe[]> {
  let query = db().from("recipes").select(PUBLIC_RECIPE_COLUMNS).eq("is_visible_on_website", true).order("created_at", { ascending: false });
  if (take) query = query.limit(take);
  return orEmpty("getPublicRecipes", q<PublicRecipe[]>(query));
}

export async function getPublicRecipe(id: string): Promise<PublicRecipe | null> {
  try {
    return await q<PublicRecipe | null>(db().from("recipes").select(PUBLIC_RECIPE_COLUMNS).eq("id", id).eq("is_visible_on_website", true).maybeSingle());
  } catch (e) {
    console.error("getPublicRecipe failed:", e);
    return null;
  }
}

export type PublicPackItem = { packId: string; itemType: "RECIPE" | "PRODUCT"; itemId: string; name: string; nameAr: string; imageUrl: string | null; quantity: number };
export type PublicPack = Omit<PublicRecipe, "categoryId"> & { items: PublicPackItem[] };

export async function getPublicPacks(): Promise<PublicPack[]> {
  const [packs, items] = await Promise.all([
    orEmpty("getPublicPacks", q<Omit<PublicPack, "items">[]>(
      db().from("packs").select("id, name, name_ar, description, description_ar, image_url, price").order("created_at", { ascending: true }),
    )),
    orEmpty("getPublicPackItems", q<PublicPackItem[]>(db().rpc("public_pack_items"))),
  ]);
  return packs.map((p) => ({ ...p, items: items.filter((i) => i.packId === p.id).map((i) => ({ ...i, quantity: Number(i.quantity) })) }));
}

export type PublicCategory = { id: string; kind: "PRODUCT" | "RECIPE"; name: string; nameAr: string };

export function getPublicCategories() {
  return orEmpty("getPublicCategories", q<PublicCategory[]>(db().from("categories").select("id, kind, name, name_ar").order("position").order("name")));
}

/** Products sold on the website (public_products(): safe columns only, never cost or stock quantity). */
export type PublicProduct = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  barcode: string | null; price: number; unitId: string; unitSymbol: string; isOutOfStock: boolean; categoryId: string | null;
  /** Quantity offers: `price` is the total for `quantity` units. */
  tiers: PriceTier[];
};
export type PriceTier = { id: string; quantity: number; price: number };

export function getPublicProducts() {
  return orEmpty("getPublicProducts", q<PublicProduct[]>(db().rpc("public_products")).then((rows) => rows.map((p) => ({
    ...p, price: Number(p.price), tiers: (p.tiers ?? []).map((t) => ({ id: t.id, quantity: Number(t.quantity), price: Number(t.price) })),
  }))));
}

export type PublicRecipeProduct = { id: string; name: string; nameAr: string; imageUrl: string | null; price: number; isOutOfStock: boolean };

export function getPublicRecipeProducts(recipeId: string) {
  return orEmpty("getPublicRecipeProducts", q<PublicRecipeProduct[]>(db().rpc("public_recipe_products", { p_recipe_id: recipeId })).then((rows) => rows.map((p) => ({ ...p, price: Number(p.price) }))));
}
