import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublicProducts } from "@/lib/public-queries";
import { Reveal } from "@/components/shared/motion";
import { ProductShop } from "./product-shop";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return { title: t("productsTitle"), description: t("productsSubtitle") };
}

export default async function ProductsPage() {
  const t = await getTranslations("site");
  const products = await getPublicProducts();
  return (
    <div className="container pt-10 md:pt-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">{t("productsTitle")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("productsSubtitle")}</p>
      </Reveal>
      <ProductShop products={products} />
    </div>
  );
}
