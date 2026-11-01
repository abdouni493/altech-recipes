import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublicCategories, getPublicProducts } from "@/lib/public-queries";
import { getContactSettings } from "@/lib/site";
import { productItem } from "@/lib/shop";
import { Reveal } from "@/components/shared/motion";
import { ShopCatalog } from "@/components/site/shop";
import { CalculatorAd, CustomRecipeCta } from "@/components/site/promos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("productsTitle"), description: t("productsSubtitle") };
}

export default async function ProductsPage() {
  const t = await getTranslations("shop");
  const [products, categories, contact] = await Promise.all([getPublicProducts(), getPublicCategories(), getContactSettings()]);
  return (
    <div className="container space-y-8 pt-8 md:pt-14">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-5xl">{t("productsTitle")}</h1>
        <p className="mt-2 text-muted-foreground sm:text-lg">{t("productsSubtitle")}</p>
      </Reveal>
      <ShopCatalog items={products.map(productItem)} categories={categories.filter((c) => c.kind === "PRODUCT")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CustomRecipeCta />
        <CalculatorAd whatsappNumber={contact.whatsappNumber} />
      </div>
    </div>
  );
}
