import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublicProducts } from "@/lib/public-queries";
import { getContactSettings } from "@/lib/site";
import { Reveal } from "@/components/shared/motion";
import { CalculatorAd } from "@/components/site/promos";
import { CustomRecipeForm } from "./custom-recipe-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop.custom");
  return { title: t("pageTitle"), description: t("pageSubtitle") };
}

export default async function CustomRecipePage() {
  const t = await getTranslations("shop.custom");
  const [products, contact] = await Promise.all([getPublicProducts(), getContactSettings()]);
  return (
    <div className="container max-w-5xl space-y-8 pt-8 md:pt-14">
      <Reveal className="text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-5xl">{t("pageTitle")}</h1>
        <p className="mt-2 text-muted-foreground sm:text-lg">{t("pageSubtitle")}</p>
      </Reveal>
      <CustomRecipeForm products={products.filter((p) => !p.isOutOfStock)} whatsappNumber={contact.whatsappNumber} />
      <CalculatorAd whatsappNumber={contact.whatsappNumber} />
    </div>
  );
}
