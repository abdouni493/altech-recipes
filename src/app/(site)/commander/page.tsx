import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicPacks, getPublicRecipes } from "@/lib/public-queries";
import { getContactSettings } from "@/lib/site";
import { lname } from "@/lib/i18n-data";
import { Reveal } from "@/components/shared/motion";
import { OrderForm } from "./order-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return { title: t("orderTitle"), description: t("orderSubtitle") };
}

export default async function OrderPage({ searchParams }: { searchParams: { recipe?: string; pack?: string } }) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const [recipes, packs, contact] = await Promise.all([getPublicRecipes(), getPublicPacks(), getContactSettings()]);
  const initialItem = searchParams.recipe && recipes.some((r) => r.id === searchParams.recipe) ? `recipe:${searchParams.recipe}`
    : searchParams.pack && packs.some((p) => p.id === searchParams.pack) ? `pack:${searchParams.pack}` : "";
  return (
    <div className="container max-w-3xl pt-10 md:pt-16">
      <Reveal className="text-center">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">{t("orderTitle")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("orderSubtitle")}</p>
      </Reveal>
      <OrderForm
        initialItem={initialItem}
        whatsappNumber={contact.whatsappNumber}
        recipes={recipes.map((r) => ({ value: `recipe:${r.id}`, label: lname(r, locale) }))}
        packs={packs.map((p) => ({ value: `pack:${p.id}`, label: lname(p, locale) }))}
      />
    </div>
  );
}
