import { z } from "zod";
import { optionalEmail, passwordField, requiredText, usernameField, V } from "@/lib/validators";

export const adminProfileSchema = z.object({ name: requiredText(80), username: usernameField, email: optionalEmail });
export type AdminProfileInput = z.input<typeof adminProfileSchema>;

export const adminPasswordSchema = z
  .object({ currentPassword: z.string().min(1, V.required), newPassword: passwordField, confirmPassword: z.string().min(1, V.required) })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: V.passwordMismatch });
export type AdminPasswordInput = z.input<typeof adminPasswordSchema>;
