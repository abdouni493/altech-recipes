import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { toNumber } from "@/lib/utils";
import { RecipesView, type RecipeRow } from "./recipes-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("recipes"))("title") };
}

export default async function RecipesPage() {
  const user = await staffPageGuard("recipes.view");
  const t = await getTranslations("recipes");
  const recipes = await prisma.recipe.findMany({
    orderBy: { createdAt: "desc" },
    include: { outputUnit: true, _count: { select: { ingredients: true, packs: true } } },
  });
  const rows: RecipeRow[] = recipes.map((r) => ({
    id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
    ingredients: r._count.ingredients, packs: r._count.packs, outputQuantity: toNumber(r.outputQuantity), outputSymbol: r.outputUnit.symbol,
    visible: r.isVisibleOnWebsite, createdAt: r.createdAt.toISOString(),
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")}
        actions={hasPermission(user, "recipes.create") && <Button asChild><Link href="/admin/recipes/new"><Plus />{t("new")}</Link></Button>} />
      <RecipesView rows={rows} />
    </>
  );
}
