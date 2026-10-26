import "server-only";
import { cache } from "react";
import { db, q } from "@/lib/db";
import type { ContactSettings, SiteSettings } from "@/lib/db-types";

export type LocalizedField =
  | "siteName" | "siteDescription" | "heroTitle" | "heroSubtitle" | "aboutText" | "howItWorks"
  | "ctaText" | "footerText" | "metaTitle" | "metaDescription";

const FALLBACK_SITE: SiteSettings = {
  id: 1, siteNameFr: "Recettes altech", siteNameAr: "وصفات ألتك", siteDescriptionFr: "", siteDescriptionAr: "",
  logoUrl: null, faviconUrl: null, heroImages: "[]", heroTitleFr: "", heroTitleAr: "", heroSubtitleFr: "", heroSubtitleAr: "",
  aboutTextFr: "", aboutTextAr: "", howItWorksFr: "", howItWorksAr: "", ctaTextFr: "", ctaTextAr: "", footerTextFr: "", footerTextAr: "",
  metaTitleFr: "", metaTitleAr: "", metaDescriptionFr: "", metaDescriptionAr: "", updatedAt: "",
};

const FALLBACK_CONTACT: ContactSettings = {
  id: 1, facebookUrl: "", instagramUrl: "", tiktokUrl: "", phone: "", whatsappNumber: "", mapsLocationUrl: "", email: "", updatedAt: "",
};

// The settings are read by every layout: when the database is unreachable, render with defaults
// instead of crashing the whole page (the real error stays in the server logs, see /api/health).
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    return (await q<SiteSettings | null>(db().from("site_settings").select("*").eq("id", 1).maybeSingle())) ?? FALLBACK_SITE;
  } catch (e) {
    console.error("getSiteSettings failed:", e);
    return FALLBACK_SITE;
  }
});

export const getContactSettings = cache(async (): Promise<ContactSettings> => {
  try {
    return (await q<ContactSettings | null>(db().from("contact_settings").select("*").eq("id", 1).maybeSingle())) ?? FALLBACK_CONTACT;
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
