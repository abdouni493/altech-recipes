import "server-only";
import { db, q } from "@/lib/db";
import type { PackWithRecipes } from "@/app/admin/clients/permissions-editor";

export async function getPermissionCatalog() {
  const [packs, recipes] = await Promise.all([
    q<{ id: string; name: string; nameAr: string; imageUrl: string | null; recipes: { recipeId: string; recipe: { name: string } | null }[] }[]>(
      db().from("packs").select("id, name, name_ar, image_url, recipes:pack_recipes(recipe_id, recipe:recipes(name))").order("created_at"),
    ),
    q<{ id: string; name: string; nameAr: string; imageUrl: string | null }[]>(
      db().from("recipes").select("id, name, name_ar, image_url").order("name"),
    ),
  ]);
  const packDTO: PackWithRecipes[] = packs.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, imageUrl: p.imageUrl,
    recipeIds: p.recipes
      .sort((a, b) => (a.recipe?.name ?? "").localeCompare(b.recipe?.name ?? ""))
      .map((r) => r.recipeId),
  }));
  return { packs: packDTO, recipes };
}

/** Preview of the next serial number (not reserved). */
export async function getNextSerial() {
  return q<number>(db().rpc("next_client_serial"));
}
