import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PacksView, type PackRow } from "./packs-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("packs"))("title") };
}

export default async function PacksPage() {
  await staffPageGuard("packs.view");
  const t = await getTranslations("packs");
  const [packs, recipes] = await Promise.all([
    prisma.pack.findMany({
      orderBy: { createdAt: "asc" },
      include: { recipes: { include: { recipe: { select: { id: true, name: true, nameAr: true, imageUrl: true } } } }, permissions: { select: { clientId: true } } },
    }),
    prisma.recipe.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, nameAr: true, imageUrl: true } }),
  ]);
  const rows: PackRow[] = packs.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr, imageUrl: p.imageUrl,
    recipes: p.recipes.map((r) => r.recipe),
    clients: new Set(p.permissions.map((x) => x.clientId)).size,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PacksView packs={rows} recipes={recipes} />
    </>
  );
}
