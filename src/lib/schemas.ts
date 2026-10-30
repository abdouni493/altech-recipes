// Domain zod schemas shared by client forms and server actions.
import { z } from "zod";
import {
  optionalPhoneField, phoneField, idField, imageUrlField, optionalText, positiveNumber, requiredText, V,
} from "@/lib/validators";

/** Money / quantity ≥ 0; empty → 0. Accepts "12,5". */
const amountField = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? 0 : Number(v.replace(",", ".").trim())) : v ?? 0),
  z.number({ invalid_type_error: V.number }).finite(V.number).min(0, V.positive).max(1_000_000_000, V.invalid),
);

export const DIMENSIONS = ["VOLUME", "MASS", "COUNT", "OTHER"] as const;

export const unitSchema = z.object({
  name: requiredText(40),
  nameAr: optionalText(40),
  symbol: requiredText(12),
  dimension: z.enum(DIMENSIONS, { errorMap: () => ({ message: V.required }) }),
  factor: positiveNumber,
});
export type UnitInput = z.input<typeof unitSchema>;

export const productSchema = z.object({
  name: requiredText(120),
  nameAr: optionalText(120),
  description: optionalText(2000),
  descriptionAr: optionalText(2000),
  imageUrl: imageUrlField,
  unitId: idField(V.selectUnit),
  barcode: z.string().trim().max(64).regex(/^[A-Za-z0-9\-. ]*$/, V.invalid).optional().default("").transform((v) => v || null),
  purchasePrice: amountField,
  priceDetail: amountField,
  priceReseller: amountField,
  priceWholesale: amountField,
  minStockAlert: amountField,
  /** Only used when the product is created; later changes go through stock movements. */
  stockQuantity: amountField,
  isVisibleOnWebsite: z.boolean().default(false),
});
export type ProductInput = z.input<typeof productSchema>;

export const ingredientSchema = z.object({
  productId: idField(V.selectProduct),
  quantity: positiveNumber,
  unitId: idField(V.selectUnit),
});

/** Optional website price of a recipe / pack; empty → none. */
export const optionalPriceField = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v.replace(",", ".").trim())) : v ?? null),
  z.number({ invalid_type_error: V.number }).finite(V.number).min(0, V.positive).max(1_000_000_000, V.invalid).nullable(),
);

export const recipeSchema = z.object({
  price: optionalPriceField.optional(),
  name: requiredText(120),
  nameAr: optionalText(120),
  description: optionalText(4000),
  descriptionAr: optionalText(4000),
  imageUrl: imageUrlField,
  isVisibleOnWebsite: z.boolean().default(true),
  ingredients: z
    .array(ingredientSchema)
    .min(1, V.atLeastOneIngredient)
    .refine((rows) => new Set(rows.map((r) => r.productId)).size === rows.length, "validation.duplicateProduct"),
  outputQuantity: positiveNumber,
  outputUnitId: idField(V.selectUnit),
});
export type RecipeInput = z.input<typeof recipeSchema>;

export const packSchema = z.object({
  price: optionalPriceField.optional(),
  name: requiredText(120),
  nameAr: optionalText(120),
  description: optionalText(2000),
  descriptionAr: optionalText(2000),
  imageUrl: imageUrlField,
  recipeIds: z.array(z.string().min(1)).min(1, V.atLeastOneRecipe),
});
export type PackInput = z.input<typeof packSchema>;

export const supplierSchema = z.object({
  fullName: requiredText(120),
  address: optionalText(300),
  phone: phoneField,
  phone2: optionalPhoneField,
  productIds: z.array(z.string().min(1)).default([]),
});
export type SupplierInput = z.input<typeof supplierSchema>;

/** Known symbols → dimension & factor, used to prefill the inline unit dialog. */
export const KNOWN_UNITS: Record<string, { dimension: (typeof DIMENSIONS)[number]; factor: number }> = {
  l: { dimension: "VOLUME", factor: 1 },
  ml: { dimension: "VOLUME", factor: 0.001 },
  cl: { dimension: "VOLUME", factor: 0.01 },
  dl: { dimension: "VOLUME", factor: 0.1 },
  kg: { dimension: "MASS", factor: 1 },
  g: { dimension: "MASS", factor: 0.001 },
  mg: { dimension: "MASS", factor: 0.000001 },
  t: { dimension: "MASS", factor: 1000 },
  pc: { dimension: "COUNT", factor: 1 },
  pcs: { dimension: "COUNT", factor: 1 },
};
