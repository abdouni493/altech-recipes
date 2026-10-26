import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { clientPageGuard } from "@/lib/authz";
import { getClientPacks, getClientRecipes } from "@/lib/portal-queries";
import { TextReveal } from "@/components/shared/motion";
import { MyRecipes } from "./my-recipes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("portal"))("recipesTitle") };
}

export default async function ClientHome() {
  const client = await clientPageGuard();
  const t = await getTranslations("portal");
  const [recipes, packs] = await Promise.all([getClientRecipes(client.id), getClientPacks(client.id)]);
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t("welcome", { name: client.fullName.split(" ")[0] })}</p>
        <TextReveal as="h1" inView={false} delay={0.2} text={t("recipesTitle")} className="mt-2 block font-serif text-3xl font-bold sm:text-5xl" />
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("recipesSubtitle")}</p>
      </div>
      <MyRecipes
        packs={packs}
        recipes={recipes.map((r) => ({
          id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
          outputQuantity: r.outputQuantity, outputSymbol: r.outputUnit.symbol, ingredientsCount: r.ingredientsCount, favorite: r.favorite, packIds: r.packIds,
        }))}
      />
    </div>
  );
}
