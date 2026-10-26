// camelCase row shapes of the tables in supabase/schema.sql (as returned by `q()` in src/lib/db.ts).
// Timestamps are ISO strings, numerics are numbers.

export type Profile = {
  id: string; username: string; role: string; name: string; email: string | null; language: string;
  permissions: string[]; createdAt: string; updatedAt: string;
};
export type Unit = { id: string; name: string; nameAr: string; symbol: string; dimension: string; factor: number; createdAt: string };
export type Product = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  unitId: string; createdAt: string; updatedAt: string;
};
export type Recipe = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  outputQuantity: number; outputUnitId: string; isVisibleOnWebsite: boolean; createdAt: string; updatedAt: string;
};
export type RecipeIngredient = { id: string; recipeId: string; productId: string; quantity: number; unitId: string; position: number };
export type Pack = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  createdAt: string; updatedAt: string;
};
export type Client = { id: string; serialNumber: number; fullName: string; phone: string; address: string; userId: string; createdAt: string };
export type ClientPermission = { id: string; clientId: string; recipeId: string; packId: string | null; createdAt: string };
export type Order = {
  id: string; orderNumber: string; fullName: string; phone: string; wilayaCode: string; wilayaName: string; communeName: string;
  recipeId: string | null; packId: string | null; message: string; wantsClientAccount: boolean; status: string;
  createdAt: string; confirmedAt: string | null; cancelledAt: string | null;
};
export type SiteSettings = {
  id: number; siteNameFr: string; siteNameAr: string; siteDescriptionFr: string; siteDescriptionAr: string;
  logoUrl: string | null; faviconUrl: string | null; heroImages: string;
  heroTitleFr: string; heroTitleAr: string; heroSubtitleFr: string; heroSubtitleAr: string;
  aboutTextFr: string; aboutTextAr: string; howItWorksFr: string; howItWorksAr: string;
  ctaTextFr: string; ctaTextAr: string; footerTextFr: string; footerTextAr: string;
  metaTitleFr: string; metaTitleAr: string; metaDescriptionFr: string; metaDescriptionAr: string; updatedAt: string;
};
export type ContactSettings = {
  id: number; facebookUrl: string; instagramUrl: string; tiktokUrl: string; phone: string; whatsappNumber: string;
  mapsLocationUrl: string; email: string; updatedAt: string;
};
export type CalculationHistory = { id: string; clientId: string; recipeId: string; targetQuantity: number; unitId: string; createdAt: string };
