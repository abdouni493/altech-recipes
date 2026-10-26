import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublicRecipes } from "@/lib/public-queries";
import { Reveal } from "@/components/shared/motion";
import { RecipeCatalog } from "./recipe-catalog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return { title: t("recipesTitle"), description: t("recipesSubtitle") };
}

export default async function RecipesCatalogPage() {
  const t = await getTranslations("site");
  const recipes = await getPublicRecipes();
  return (
    <div className="container pt-10 md:pt-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">{t("recipesTitle")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("recipesSubtitle")}</p>
      </Reveal>
      <RecipeCatalog recipes={recipes} />
    </div>
  );
}
