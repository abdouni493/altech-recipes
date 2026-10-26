import { z } from "zod";
import { optionalText, passwordField, phoneField, requiredText, usernameField } from "@/lib/validators";

export const clientInfoSchema = z.object({
  fullName: requiredText(120),
  phone: phoneField,
  address: optionalText(300),
});
export type ClientInfoInput = z.input<typeof clientInfoSchema>;

export const credentialsSchema = z.object({
  username: usernameField,
  password: passwordField,
  /** true when the admin kept the generated credentials (they are recomputed with the definitive serial). */
  credentialsAuto: z.boolean().default(true),
});

export const permissionsSchema = z.object({
  permissions: z.array(z.object({ recipeId: z.string().min(1), packId: z.string().min(1).nullable().optional() })).max(2000),
});
export type PermissionsInput = z.input<typeof permissionsSchema>;

export const clientCreateSchema = clientInfoSchema.merge(credentialsSchema).merge(permissionsSchema);
export type ClientCreateInput = z.input<typeof clientCreateSchema>;
