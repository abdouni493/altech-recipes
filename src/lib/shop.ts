// Website shop items: one card shape for products and recipes (search, category filters, basket buttons).
import type { PriceTier, PublicProduct, PublicRecipe } from "@/lib/public-queries";

export type ShopItem = {
  kind: "PRODUCT" | "RECIPE";
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  price: number | null; categoryId: string | null; out: boolean;
  unitSymbol?: string; tiers?: PriceTier[];
};

export const productItem = (p: PublicProduct): ShopItem => ({
  kind: "PRODUCT", id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr,
  imageUrl: p.imageUrl, price: p.price, categoryId: p.categoryId, out: p.isOutOfStock, unitSymbol: p.unitSymbol, tiers: p.tiers,
});

export const recipeItem = (r: PublicRecipe): ShopItem => ({
  kind: "RECIPE", id: r.id, name: r.name, nameAr: r.nameAr, description: r.description, descriptionAr: r.descriptionAr,
  imageUrl: r.imageUrl, price: r.price === null || r.price === undefined ? null : Number(r.price), categoryId: r.categoryId ?? null, out: false,
});

/** Discount of a quantity offer compared with the unit price (0–100, rounded). */
export function tierSaving(unitPrice: number, tier: PriceTier) {
  const full = unitPrice * tier.quantity;
  return full > 0 && tier.price < full ? Math.round(((full - tier.price) / full) * 100) : 0;
}

/** 5 → "5", 2.5 → "2.5" (no trailing zeros). */
export const qtyLabel = (n: number) => String(Math.round(n * 1000) / 1000);
