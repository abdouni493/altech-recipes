import "server-only";
import { db, q } from "@/lib/db";

/**
 * Public catalog: ONLY id + name, description and image (with their Arabic variants).
 * Ingredients, quantities and output are never selected here, so they cannot reach the HTML or any API response.
 */
export const PUBLIC_RECIPE_COLUMNS = "id, name, name_ar, description, description_ar, image_url";

export type PublicRecipe = { id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null };

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

export function getPublicPacks() {
  return orEmpty("getPublicPacks", q<PublicRecipe[]>(
    db().from("packs").select("id, name, name_ar, description, description_ar, image_url").order("created_at", { ascending: true }),
  ));
}
