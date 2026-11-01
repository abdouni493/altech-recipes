import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Boxes } from "lucide-react";
import { getPublicPacks } from "@/lib/public-queries";
import { Reveal } from "@/components/shared/motion";
import { EmptyState } from "@/components/shared/page-header";
import { CustomRecipeCta, PacksShowcase } from "@/components/site/promos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop.packs");
  return { title: t("title"), description: t("subtitle") };
}

export default async function PacksPage() {
  const t = await getTranslations("shop.packs");
  const packs = await getPublicPacks();
  return (
    <div className="container space-y-8 pt-8 md:pt-14">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground sm:text-lg">{t("subtitle")}</p>
      </Reveal>
      {packs.length === 0 ? <EmptyState icon={<Boxes />} title={t("empty")} /> : <PacksShowcase packs={packs} />}
      <CustomRecipeCta />
    </div>
  );
}
