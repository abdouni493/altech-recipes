import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { db, n, q } from "@/lib/db";
import type { Recipe, Unit } from "@/lib/db-types";
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
  const recipes = await q<(Recipe & { outputUnit: Unit; ingredients: unknown; packs: unknown })[]>(
    db().from("recipes")
      .select("*, outputUnit:units!recipes_output_unit_id_fkey(*), ingredients:recipe_ingredients(count), packs:pack_recipes(count)")
      .order("created_at", { ascending: false }),
  );
  const rows: RecipeRow[] = recipes.map((r) => ({
    id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
    ingredients: n(r.ingredients), packs: n(r.packs), outputQuantity: toNumber(r.outputQuantity), outputSymbol: r.outputUnit.symbol,
    visible: r.isVisibleOnWebsite, createdAt: r.createdAt,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")}
        actions={hasPermission(user, "recipes.create") && <Button asChild><Link href="/admin/recipes/new"><Plus />{t("new")}</Link></Button>} />
      <RecipesView rows={rows} />
    </>
  );
}
