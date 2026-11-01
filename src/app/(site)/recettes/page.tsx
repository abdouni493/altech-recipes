import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { getPublicCategories, getPublicRecipes } from "@/lib/public-queries";
import { getContactSettings } from "@/lib/site";
import { recipeItem } from "@/lib/shop";
import { Reveal } from "@/components/shared/motion";
import { EmptyState } from "@/components/shared/page-header";
import { ShopCatalog } from "@/components/site/shop";
import { CalculatorAd, CustomRecipeCta } from "@/components/site/promos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return { title: t("recipesTitle"), description: t("recipesSubtitle") };
}

export default async function RecipesCatalogPage() {
  const t = await getTranslations("site");
  const [recipes, categories, contact] = await Promise.all([getPublicRecipes(), getPublicCategories(), getContactSettings()]);
  return (
    <div className="container space-y-8 pt-8 md:pt-14">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-5xl">{t("recipesTitle")}</h1>
        <p className="mt-2 text-muted-foreground sm:text-lg">{t("recipesSubtitle")}</p>
      </Reveal>
      <CalculatorAd whatsappNumber={contact.whatsappNumber} />
      {recipes.length === 0
        ? <EmptyState icon={<BookOpen />} title={t("noRecipesYet")} />
        : <ShopCatalog items={recipes.map(recipeItem)} categories={categories.filter((c) => c.kind === "RECIPE")} />}
      <CustomRecipeCta />
    </div>
  );
}
