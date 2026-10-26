import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { clientPageGuard } from "@/lib/authz";
import { getClientRecipes } from "@/lib/portal-queries";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { PortalRecipeCardView } from "../recipe-card";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("portal"))("favoritesTitle") };
}

export default async function FavoritesPage() {
  const client = await clientPageGuard();
  const t = await getTranslations("portal");
  // Favorites are intersected with current permissions: a revoked recipe never shows up.
  const recipes = (await getClientRecipes(client.id)).filter((r) => r.favorite);
  return (
    <>
      <PageHeader title={t("favoritesTitle")} description={t("favoritesSubtitle")} />
      {recipes.length === 0 ? (
        <EmptyState icon={<Heart />} title={t("noFavoritesTitle")} description={t("noFavoritesText")} />
      ) : (
        <Stagger className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {recipes.map((r) => (
            <StaggerItem key={r.id}>
              <PortalRecipeCardView r={{
                id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr, imageUrl: r.imageUrl,
                outputQuantity: r.outputQuantity, outputSymbol: r.outputUnit.symbol, ingredientsCount: r.ingredientsCount, favorite: true,
              }} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
