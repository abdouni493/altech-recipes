"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false };
  cookies().set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getSessionUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { language: locale } }).catch(() => undefined);
  }
  return { ok: true };
}
