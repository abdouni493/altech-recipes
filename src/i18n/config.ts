export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function dirOf(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Intl locale tags: Algerian Arabic keeps Latin digits. */
export function intlLocale(locale: string) {
  return locale === "ar" ? "ar-DZ" : "fr-FR";
}
