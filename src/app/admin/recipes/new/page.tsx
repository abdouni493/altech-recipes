import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { getProductsDTO, getUnitsDTO } from "@/lib/queries";
import { getCategories } from "@/lib/categories";
import { PageHeader } from "@/components/shared/page-header";
import { UnitsProvider } from "@/components/shared/units";
import { RecipeForm } from "../recipe-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("recipes"))("createTitle") };
}

export default async function NewRecipePage() {
  await staffPageGuard("recipes.create");
  const t = await getTranslations("recipes");
  const [products, units, categories] = await Promise.all([getProductsDTO(), getUnitsDTO(), getCategories("RECIPE")]);
  return (
    <UnitsProvider initial={units}>
      <PageHeader title={t("createTitle")} backHref="/admin/recipes" backLabel={t("title")} />
      <RecipeForm products={products} categories={categories} />
    </UnitsProvider>
  );
}
