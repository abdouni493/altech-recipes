import type { Metadata, Viewport } from "next";
import { Arvo, Bitter, DM_Sans, Cairo, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import { dirOf, type Locale } from "@/i18n/config";
import { getSiteSettings, localized } from "@/lib/site";
import "./globals.css";

const arvo = Arvo({ subsets: ["latin"], variable: "--font-arvo", display: "swap", weight: ["400", "700"] });
const bitter = Bitter({ subsets: ["latin"], variable: "--font-bitter", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap" });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap", weight: ["500", "600", "700", "800"] });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], variable: "--font-tajawal", display: "swap", weight: ["400", "500", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("common");
  try {
    const s = await getSiteSettings();
    const name = localized(s, "siteName", locale) || t("appName");
    return {
      title: { default: localized(s, "metaTitle", locale) || name, template: `%s · ${name}` },
      description: localized(s, "metaDescription", locale) || localized(s, "siteDescription", locale),
      icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
      openGraph: { siteName: name, locale: locale === "ar" ? "ar_DZ" : "fr_DZ" },
    };
  } catch {
    return { title: t("appName") };
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161214" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = dirOf(locale);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${arvo.variable} ${bitter.variable} ${dmSans.variable} ${cairo.variable} ${tajawal.variable}`}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Algiers">
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
