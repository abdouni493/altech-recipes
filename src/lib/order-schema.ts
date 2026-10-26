import { z } from "zod";
import { optionalText, phoneField, requiredText, V } from "@/lib/validators";

export const orderSchema = z.object({
  fullName: requiredText(120),
  phone: phoneField,
  wilayaCode: z.string().min(1, V.selectWilaya),
  communeName: z.string().min(1, V.selectCommune),
  item: z.string().optional().default(""), // "" | "recipe:<id>" | "pack:<id>"
  message: optionalText(2000),
  wantsClientAccount: z.boolean().default(false),
});
export type OrderInput = z.input<typeof orderSchema>;
