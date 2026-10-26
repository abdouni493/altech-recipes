// Shared zod schemas. Messages are translation keys (see FieldError / useErrorText).
import { z } from "zod";

export const V = {
  required: "validation.required",
  positive: "validation.positive",
  number: "validation.number",
  phone: "validation.phone",
  email: "validation.email",
  url: "validation.url",
  username: "validation.username",
  passwordMin: "validation.passwordMin",
  passwordMismatch: "validation.passwordMismatch",
  selectUnit: "validation.selectUnit",
  selectProduct: "validation.selectProduct",
  atLeastOneIngredient: "validation.atLeastOneIngredient",
  atLeastOneRecipe: "validation.atLeastOneRecipe",
  selectWilaya: "validation.selectWilaya",
  selectCommune: "validation.selectCommune",
  invalid: "validation.invalid",
  tooLong: (max: number) => `validation.tooLong|${max}`,
  tooShort: (min: number) => `validation.tooShort|${min}`,
} as const;

export const requiredText = (max = 120) => z.string({ required_error: V.required }).trim().min(1, V.required).max(max, V.tooLong(max));
export const optionalText = (max = 2000) => z.string().trim().max(max, V.tooLong(max)).optional().default("");
export const idField = (msg: string = V.required) => z.string({ required_error: msg }).min(1, msg);

/** Accepts "12.5", "12,5" or numbers; must be > 0. */
export const positiveNumber = z.preprocess(
  (v) => (typeof v === "string" ? Number(v.replace(",", ".").trim()) : v),
  z.number({ invalid_type_error: V.number, required_error: V.required }).finite(V.number).positive(V.positive).max(1_000_000_000, V.invalid)
);

/** Algerian phone numbers: mobiles 05/06/07 + 8 digits, landlines 0XX + 6/7 digits, optionally +213 / 00213. */
export const ALGERIAN_PHONE = /^(?:(?:\+|00)213|0)(?:[567]\d{8}|[2-4]\d{7}|[2-4]\d{8})$/;
export const phoneField = z
  .string({ required_error: V.required })
  .trim()
  .min(1, V.required)
  .transform((v) => v.replace(/[\s.\-()]/g, ""))
  .refine((v) => ALGERIAN_PHONE.test(v), V.phone);

export const optionalPhoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.\-()]/g, ""))
  .refine((v) => v === "" || ALGERIAN_PHONE.test(v), V.phone);

export const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), V.url);

export const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, V.email);

export const usernameField = z
  .string({ required_error: V.required })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, V.username);

export const passwordField = z.string({ required_error: V.required }).min(6, V.passwordMin).max(100, V.tooLong(100));

export const imageUrlField = z
  .string()
  .trim()
  .max(500)
  // Only images stored in this project's Supabase Storage (public buckets).
  .refine((v) => v === "" || v.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`), V.invalid)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string>; meta?: Record<string, number | string> };

/** Turn a zod error into { field: messageKey }. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
