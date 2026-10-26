import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "../../messages/load";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

export default getRequestConfig(async () => {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : defaultLocale;
  return { locale, messages: await loadMessages(locale), timeZone: "Africa/Algiers", now: new Date() };
});
