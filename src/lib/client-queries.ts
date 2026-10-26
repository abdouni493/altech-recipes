import "server-only";
import { prisma } from "@/lib/prisma";
import type { PackWithRecipes } from "@/app/admin/clients/permissions-editor";

export async function getPermissionCatalog() {
  const [packs, recipes] = await Promise.all([
    prisma.pack.findMany({ orderBy: { createdAt: "asc" }, include: { recipes: { select: { recipeId: true, recipe: { select: { name: true } } } } } }),
    prisma.recipe.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameAr: true, imageUrl: true } }),
  ]);
  const packDTO: PackWithRecipes[] = packs.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, imageUrl: p.imageUrl,
    recipeIds: p.recipes.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name)).map((r) => r.recipeId),
  }));
  return { packs: packDTO, recipes };
}

export async function getNextSerial() {
  const [c, max] = await Promise.all([
    prisma.counter.findUnique({ where: { name: "client" } }),
    prisma.client.aggregate({ _max: { serialNumber: true } }),
  ]);
  return Math.max(c?.value ?? 0, max._max.serialNumber ?? 0) + 1;
}
