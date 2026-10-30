import { z } from "zod";
import { optionalText, phoneField, requiredText, V } from "@/lib/validators";

export const orderSchema = z.object({
  fullName: requiredText(120),
  phone: phoneField,
  wilayaCode: z.string().min(1, V.selectWilaya),
  communeName: z.string().min(1, V.selectCommune),
  /** Basket: recipes, packs and products (prices are re-read by create_order_v2). */
  items: z.array(z.object({
    type: z.enum(["RECIPE", "PACK", "PRODUCT"]),
    id: z.string().min(1).max(64),
    quantity: z.number().positive().max(10000),
  })).max(50).default([]),
  message: optionalText(2000),
  wantsClientAccount: z.boolean().default(false),
});
export type OrderInput = z.input<typeof orderSchema>;
