import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Public catalog: ONLY id + name, description and image (with their Arabic variants).
 * Ingredients, quantities and output are never selected here, so they cannot reach the HTML or any API response.
 */
export const PUBLIC_RECIPE_SELECT = {
  id: true, name: true, nameAr: true, description: true, descriptionAr: true, imageUrl: true,
} as const;

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
  return orEmpty("getPublicRecipes", prisma.recipe.findMany({ where: { isVisibleOnWebsite: true }, select: PUBLIC_RECIPE_SELECT, orderBy: { createdAt: "desc" }, take }));
}

export function getPublicRecipe(id: string): Promise<PublicRecipe | null> {
  return prisma.recipe.findFirst({ where: { id, isVisibleOnWebsite: true }, select: PUBLIC_RECIPE_SELECT });
}

export function getPublicPacks() {
  return orEmpty("getPublicPacks", prisma.pack.findMany({
    select: { id: true, name: true, nameAr: true, description: true, descriptionAr: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  }));
}
