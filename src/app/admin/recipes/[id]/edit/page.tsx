import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Recipe, RecipeIngredient } from "@/lib/db-types";
import { getProductsDTO, getUnitsDTO } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { UnitsProvider } from "@/components/shared/units";
import { toNumber } from "@/lib/utils";
import { RecipeForm } from "../../recipe-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("recipes"))("editTitle") };
}

export default async function EditRecipePage({ params }: { params: { id: string } }) {
  await staffPageGuard("recipes.edit");
  const t = await getTranslations("recipes");
  const recipe = await q<(Recipe & { ingredients: RecipeIngredient[] }) | null>(
    db().from("recipes").select("*, ingredients:recipe_ingredients(*)").eq("id", params.id).maybeSingle(),
  );
  if (!recipe) notFound();
  const [products, units] = await Promise.all([getProductsDTO(), getUnitsDTO()]);
  return (
    <UnitsProvider initial={units}>
      <PageHeader title={t("editTitle")} description={recipe.name} backHref={`/admin/recipes/${recipe.id}`} backLabel={recipe.name} />
      <RecipeForm
        products={products}
        recipeId={recipe.id}
        initial={{
          name: recipe.name, nameAr: recipe.nameAr, description: recipe.description, descriptionAr: recipe.descriptionAr,
          imageUrl: recipe.imageUrl, isVisibleOnWebsite: recipe.isVisibleOnWebsite, price: recipe.price === null ? null : toNumber(recipe.price),
          outputQuantity: toNumber(recipe.outputQuantity), outputUnitId: recipe.outputUnitId,
          ingredients: [...recipe.ingredients].sort((a, b) => a.position - b.position).map((i) => ({ productId: i.productId, quantity: toNumber(i.quantity), unitId: i.unitId })),
        }}
      />
    </UnitsProvider>
  );
}
