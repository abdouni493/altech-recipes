import "server-only";
import { prisma } from "@/lib/prisma";
import { unitDTO, type UnitDTO } from "@/lib/dto";
import { toNumber } from "@/lib/utils";

export type PortalRecipe = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  outputQuantity: number; outputUnit: UnitDTO; ingredientsCount: number; packIds: string[]; favorite: boolean;
};

/** Only the recipes the client has a permission for (the source of truth). */
export async function getClientRecipes(clientId: string): Promise<PortalRecipe[]> {
  const [perms, favorites] = await Promise.all([
    prisma.clientPermission.findMany({
      where: { clientId },
      include: { recipe: { include: { outputUnit: true, packs: { select: { packId: true } }, _count: { select: { ingredients: true } } } } },
      orderBy: { recipe: { name: "asc" } },
    }),
    prisma.favorite.findMany({ where: { clientId }, select: { recipeId: true } }),
  ]);
  const fav = new Set(favorites.map((f) => f.recipeId));
  return perms.map(({ recipe: r, packId }) => ({
    id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
    outputQuantity: toNumber(r.outputQuantity), outputUnit: unitDTO(r.outputUnit), ingredientsCount: r._count.ingredients,
    packIds: Array.from(new Set([...(packId ? [packId] : []), ...r.packs.map((p) => p.packId)])),
    favorite: fav.has(r.id),
  }));
}

export type PortalRecipeDetail = PortalRecipe & {
  ingredients: { id: string; productName: string; productNameAr: string; imageUrl: string | null; quantity: number; unit: UnitDTO }[];
};

/** Full formula of one recipe — returns null when the client has no permission (never leaks existence). */
export async function getPermittedRecipe(clientId: string, recipeId: string): Promise<PortalRecipeDetail | null> {
  const perm = await prisma.clientPermission.findUnique({ where: { clientId_recipeId: { clientId, recipeId } } });
  if (!perm) return null;
  const r = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      outputUnit: true,
      packs: { select: { packId: true } },
      ingredients: { orderBy: { position: "asc" }, include: { product: true, unit: true } },
    },
  });
  if (!r) return null;
  const fav = await prisma.favorite.findUnique({ where: { clientId_recipeId: { clientId, recipeId } } });
  return {
    id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
    outputQuantity: toNumber(r.outputQuantity), outputUnit: unitDTO(r.outputUnit), ingredientsCount: r.ingredients.length,
    packIds: r.packs.map((p) => p.packId), favorite: Boolean(fav),
    ingredients: r.ingredients.map((i) => ({
      id: i.id, productName: i.product.name, productNameAr: i.product.nameAr, imageUrl: i.product.imageUrl,
      quantity: toNumber(i.quantity), unit: unitDTO(i.unit),
    })),
  };
}

export async function getClientPacks(clientId: string) {
  const perms = await prisma.clientPermission.findMany({ where: { clientId, packId: { not: null } }, select: { pack: true } });
  const map = new Map<string, { id: string; name: string; nameAr: string }>();
  for (const p of perms) if (p.pack) map.set(p.pack.id, { id: p.pack.id, name: p.pack.name, nameAr: p.pack.nameAr });
  return Array.from(map.values());
}
