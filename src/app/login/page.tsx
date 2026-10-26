import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSettings, localized, parseHeroImages } from "@/lib/site";
import { db, q } from "@/lib/db";
import { LoginForm } from "./login-form";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Logo } from "@/components/shared/logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; expired?: string } }) {
  // The setup button is hidden only when an admin is known to exist. If the check fails, it stays
  // visible: create_first_admin() refuses a second admin anyway, and the form shows the real error.
  const [t, locale, settings, canCreateAdmin] = await Promise.all([
    getTranslations("auth"),
    getLocale(),
    getSiteSettings(),
    q<boolean>(db().rpc("admin_exists")).then((exists) => !exists, (e) => (console.error("adminExists failed:", e), true)),
  ]);
  const siteName = localized(settings, "siteName", locale);
  const hero = parseHeroImages(settings)[0];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        {hero && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(30_10%_8%/0.85)] via-[hsl(30_10%_8%/0.35)] to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo name={siteName} logoUrl={settings.logoUrl} className="text-white" />
          <div className="max-w-lg space-y-4">
            <h2 className="font-serif text-4xl font-semibold leading-tight text-balance">{t("asideTitle")}</h2>
            <p className="text-lg text-white/80">{t("asideText")}</p>
          </div>
        </div>
      </aside>
      <main className="relative flex flex-col bg-background grain">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="lg:invisible">
            <Logo name={siteName} logoUrl={settings.logoUrl} />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher variant="outline" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <LoginForm callbackUrl={searchParams.callbackUrl} expired={!!searchParams.expired} canCreateAdmin={canCreateAdmin} />
        </div>
      </main>
    </div>
  );
}
