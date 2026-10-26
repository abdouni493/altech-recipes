import { z } from "zod";
import { imageUrlField, optionalEmail, optionalPhoneField, optionalText, optionalUrl, requiredText } from "@/lib/validators";

export const contactSchema = z.object({
  facebookUrl: optionalUrl, instagramUrl: optionalUrl, tiktokUrl: optionalUrl, mapsLocationUrl: optionalUrl,
  phone: z.string().trim().max(30), whatsappNumber: optionalPhoneField, email: optionalEmail,
});
export type ContactInput = z.input<typeof contactSchema>;

const t = (max = 4000) => optionalText(max);
export const siteSchema = z.object({
  siteNameFr: requiredText(80), siteNameAr: t(80),
  siteDescriptionFr: t(500), siteDescriptionAr: t(500),
  logoUrl: imageUrlField, faviconUrl: imageUrlField,
  heroImages: z.array(z.string().startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)).max(12),
  heroTitleFr: t(200), heroTitleAr: t(200), heroSubtitleFr: t(500), heroSubtitleAr: t(500),
  aboutTextFr: t(), aboutTextAr: t(), howItWorksFr: t(1000), howItWorksAr: t(1000),
  ctaTextFr: t(500), ctaTextAr: t(500), footerTextFr: t(500), footerTextAr: t(500),
  metaTitleFr: t(120), metaTitleAr: t(120), metaDescriptionFr: t(300), metaDescriptionAr: t(300),
});
export type SiteInput = z.input<typeof siteSchema>;
