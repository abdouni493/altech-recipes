"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { db } from "@/lib/db";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false };
  cookies().set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  // Remembered on the profile of the signed-in user (no-op for visitors).
  await db().rpc("set_my_language", { p_language: locale });
  return { ok: true };
}
