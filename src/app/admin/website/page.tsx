import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import { getContactSettings, getSiteSettings, parseHeroImages } from "@/lib/site";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { WebsiteTabs } from "./website-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("website"))("title") };
}

export default async function WebsitePage({ searchParams }: { searchParams: { tab?: string } }) {
  await staffPageGuard("website.view");
  const t = await getTranslations("website");
  const [recipes, contact, site] = await Promise.all([
    q<{ id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null; isVisibleOnWebsite: boolean }[]>(
      db().from("recipes").select("id, name, name_ar, description, description_ar, image_url, is_visible_on_website").order("name"),
    ),
    getContactSettings(),
    getSiteSettings(),
  ]);
  const { id: _id, updatedAt: _u, heroImages: _h, ...siteFields } = site;
  void _id; void _u; void _h;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")}
        actions={<Button asChild variant="outline"><a href="/" target="_blank" rel="noopener"><ExternalLink />{t("preview")}</a></Button>} />
      <WebsiteTabs
        initialTab={["recipes", "contacts", "settings"].includes(searchParams.tab ?? "") ? searchParams.tab! : "recipes"}
        recipes={recipes}
        contact={{
          facebookUrl: contact.facebookUrl, instagramUrl: contact.instagramUrl, tiktokUrl: contact.tiktokUrl, phone: contact.phone,
          whatsappNumber: contact.whatsappNumber, mapsLocationUrl: contact.mapsLocationUrl, email: contact.email,
        }}
        site={{ ...siteFields, heroImages: parseHeroImages(site) }}
      />
    </>
  );
}
