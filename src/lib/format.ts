import { intlLocale } from "@/i18n/config";

export function formatNumber(value: number, locale: string, maxFractionDigits = 3) {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: maxFractionDigits }).format(value);
}

export function formatDate(date: Date | string, locale: string, withTime = false) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Africa/Algiers",
  }).format(d);
}

export function formatMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "Africa/Algiers" }).format(date);
}
