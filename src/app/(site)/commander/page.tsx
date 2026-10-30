import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublicPacks, getPublicProducts, getPublicRecipes } from "@/lib/public-queries";
import { getContactSettings } from "@/lib/site";
import { Reveal } from "@/components/shared/motion";
import { OrderForm, type CatalogItem } from "./order-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return { title: t("orderTitle"), description: t("orderSubtitle") };
}

export default async function OrderPage({ searchParams }: { searchParams: { recipe?: string; pack?: string; product?: string } }) {
  const t = await getTranslations("site");
  const [recipes, packs, products, contact] = await Promise.all([getPublicRecipes(), getPublicPacks(), getPublicProducts(), getContactSettings()]);
  const catalog: CatalogItem[] = [
    ...recipes.map((r) => ({ type: "RECIPE" as const, id: r.id, name: r.name, nameAr: r.nameAr, imageUrl: r.imageUrl, price: r.price === null ? null : Number(r.price), out: false })),
    ...packs.map((p) => ({ type: "PACK" as const, id: p.id, name: p.name, nameAr: p.nameAr, imageUrl: p.imageUrl, price: p.price === null ? null : Number(p.price), out: false })),
    ...products.map((p) => ({ type: "PRODUCT" as const, id: p.id, name: p.name, nameAr: p.nameAr, imageUrl: p.imageUrl, price: p.price, out: p.isOutOfStock })),
  ];
  const initial = searchParams.recipe ? { type: "RECIPE" as const, id: searchParams.recipe }
    : searchParams.pack ? { type: "PACK" as const, id: searchParams.pack }
    : searchParams.product ? { type: "PRODUCT" as const, id: searchParams.product } : null;
  return (
    <div className="container max-w-5xl pt-10 md:pt-16">
      <Reveal className="text-center">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">{t("orderTitle")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("orderSubtitle")}</p>
      </Reveal>
      <OrderForm catalog={catalog} initial={initial && catalog.some((c) => c.type === initial.type && c.id === initial.id) ? initial : null} whatsappNumber={contact.whatsappNumber} />
    </div>
  );
}
