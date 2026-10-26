import "server-only";
import { cache } from "react";
import type { ContactSettings, SiteSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LocalizedField =
  | "siteName" | "siteDescription" | "heroTitle" | "heroSubtitle" | "aboutText" | "howItWorks"
  | "ctaText" | "footerText" | "metaTitle" | "metaDescription";

const FALLBACK_SITE: SiteSettings = {
  id: 1, siteNameFr: "Recettes altech", siteNameAr: "وصفات ألتك", siteDescriptionFr: "", siteDescriptionAr: "",
  logoUrl: null, faviconUrl: null, heroImages: "[]", heroTitleFr: "", heroTitleAr: "", heroSubtitleFr: "", heroSubtitleAr: "",
  aboutTextFr: "", aboutTextAr: "", howItWorksFr: "", howItWorksAr: "", ctaTextFr: "", ctaTextAr: "", footerTextFr: "", footerTextAr: "",
  metaTitleFr: "", metaTitleAr: "", metaDescriptionFr: "", metaDescriptionAr: "", updatedAt: new Date(0),
};

const FALLBACK_CONTACT: ContactSettings = {
  id: 1, facebookUrl: "", instagramUrl: "", tiktokUrl: "", phone: "", whatsappNumber: "", mapsLocationUrl: "", email: "", updatedAt: new Date(0),
};

// The settings are read by every layout: when the database is unreachable, render with defaults
// instead of crashing the whole page (the real error stays in the server logs, see /api/health).
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const existing = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    return existing ?? (await prisma.siteSettings.create({ data: { id: 1 } }));
  } catch (e) {
    console.error("getSiteSettings failed:", e);
    return FALLBACK_SITE;
  }
});

export const getContactSettings = cache(async (): Promise<ContactSettings> => {
  try {
    const existing = await prisma.contactSettings.findUnique({ where: { id: 1 } });
    return existing ?? (await prisma.contactSettings.create({ data: { id: 1 } }));
  } catch (e) {
    console.error("getContactSettings failed:", e);
    return FALLBACK_CONTACT;
  }
});

/** Read a translatable field for a locale, falling back to French when the Arabic text is empty. */
export function localized(settings: SiteSettings, field: LocalizedField, locale: string): string {
  const s = settings as unknown as Record<string, string>;
  const ar = s[`${field}Ar`];
  const fr = s[`${field}Fr`];
  return locale === "ar" ? ar || fr || "" : fr || ar || "";
}

export function parseHeroImages(settings: SiteSettings): string[] {
  try {
    const arr = JSON.parse(settings.heroImages);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
