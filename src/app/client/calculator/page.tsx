import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { clientPageGuard } from "@/lib/authz";
import { getClientRecipes, getPermittedRecipe } from "@/lib/portal-queries";
import { getUnitsDTO } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { RecipePicker } from "./recipe-picker";
import { CalculatorView } from "./calculator-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("calculator"))("title") };
}

export default async function CalculatorPage({ searchParams }: { searchParams: { recipe?: string; qty?: string; unit?: string } }) {
  const client = await clientPageGuard();
  const t = await getTranslations("calculator");

  if (!searchParams.recipe) {
    const recipes = await getClientRecipes(client.id);
    return (
      <>
        <PageHeader title={t("title")} description={t("subtitle")} />
        <RecipePicker recipes={recipes.map((r) => ({ id: r.id, name: r.name, nameAr: r.nameAr, imageUrl: r.imageUrl, output: `${r.outputQuantity} ${r.outputUnit.symbol}` }))} />
      </>
    );
  }

  const [recipe, units] = await Promise.all([getPermittedRecipe(client.id, searchParams.recipe), getUnitsDTO()]);
  if (!recipe) notFound();
  const qty = Number(searchParams.qty);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CalculatorView
        recipe={recipe}
        units={units}
        clientName={client.fullName}
        initialTarget={Number.isFinite(qty) && qty > 0 ? qty : undefined}
        initialUnitId={searchParams.unit}
      />
    </>
  );
}
