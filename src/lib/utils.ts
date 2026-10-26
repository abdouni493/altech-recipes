import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Lowercase, strip accents, keep only a-z0-9. "Youssef Abdouni" → "youssefabdouni" */
export function slugifyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function padSerial(serial: number) {
  return String(serial).padStart(4, "0");
}

/** Default credentials formula: slug(fullName) + serial padded to 4 digits. Falls back to "client" for non-latin names. */
export function defaultCredential(fullName: string, serial: number) {
  return `${slugifyName(fullName) || "client"}${padSerial(serial)}`;
}

export function excerpt(text: string, max = 80) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Normalize an Algerian phone number for wa.me links: 0555… → 213555… */
export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) return `213${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(phone: string, text?: string) {
  const n = toWhatsAppNumber(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v.toString());
}

/** Accent-insensitive, lowercase text for search matching. */
export function normalizeSearch(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
