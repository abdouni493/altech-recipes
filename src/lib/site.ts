import "server-only";
import { cache } from "react";
import type { ContactSettings, SiteSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LocalizedField =
  | "siteName" | "siteDescription" | "heroTitle" | "heroSubtitle" | "aboutText" | "howItWorks"
  | "ctaText" | "footerText" | "metaTitle" | "metaDescription";

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const existing = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.siteSettings.create({ data: { id: 1 } });
});

export const getContactSettings = cache(async (): Promise<ContactSettings> => {
  const existing = await prisma.contactSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.contactSettings.create({ data: { id: 1 } });
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
