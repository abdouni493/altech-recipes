import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone } from "lucide-react";
import { getSessionUser } from "@/lib/authz";
import { getContactSettings, getSiteSettings, localized } from "@/lib/site";
import { SiteHeader } from "@/components/site/site-header";
import { SocialLinks } from "@/components/site/social-icons";
import { WhatsAppFloat } from "@/components/site/whatsapp-float";
import { Logo } from "@/components/shared/logo";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, contact, locale, t, tn, user] = await Promise.all([
    getSiteSettings(), getContactSettings(), getLocale(), getTranslations("site"), getTranslations("nav.site"), getSessionUser(),
  ]);
  const siteName = localized(settings, "siteName", locale);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader siteName={siteName} logoUrl={settings.logoUrl} role={user?.role ?? null} />
      <main id="main" className="flex-1">{children}</main>
      <footer className="mt-20 border-t-4 border-lemon bg-primary text-primary-foreground dark:bg-card dark:text-foreground">
        <div className="container grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo name={siteName} logoUrl={settings.logoUrl} className="[&>span:last-child]:text-primary-foreground dark:[&>span:last-child]:text-foreground" />
            <p className="max-w-sm text-sm opacity-70">{localized(settings, "footerText", locale)}</p>
            <SocialLinks facebookUrl={contact.facebookUrl} instagramUrl={contact.instagramUrl} tiktokUrl={contact.tiktokUrl} />
          </div>
          <nav className="space-y-3 text-sm">
            <p className="font-serif text-base font-semibold">{siteName}</p>
            <ul className="space-y-2 opacity-80">
              <li><Link href="/" className="hover:underline">{tn("home")}</Link></li>
              <li><Link href="/recettes" className="hover:underline">{tn("recipes")}</Link></li>
              <li><Link href="/commander" className="hover:underline">{tn("order")}</Link></li>
              <li><Link href="/login" className="hover:underline">{tn("clientArea")}</Link></li>
            </ul>
          </nav>
          <div className="space-y-3 text-sm">
            <p className="font-serif text-base font-semibold">{t("contactTitle")}</p>
            <ul className="space-y-2 opacity-80">
              {contact.phone && <li><a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" /><span dir="ltr">{contact.phone}</span></a></li>}
              {contact.email && <li><a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:underline"><Mail className="h-4 w-4" />{contact.email}</a></li>}
              {contact.mapsLocationUrl && <li><a href={contact.mapsLocationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline"><MapPin className="h-4 w-4" />{t("findUs")}</a></li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-current/10">
          <p className="container py-5 text-xs opacity-60">© {new Date().getFullYear()} {siteName}. {t("rights")}</p>
        </div>
      </footer>
      <WhatsAppFloat number={contact.whatsappNumber} />
    </div>
  );
}
