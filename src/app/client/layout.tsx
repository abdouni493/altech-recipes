import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shared/app-shell";
import { clientPageGuard } from "@/lib/authz";
import { getSiteSettings, localized } from "@/lib/site";
import { padSerial } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const client = await clientPageGuard();
  const [settings, locale, t] = await Promise.all([getSiteSettings(), getLocale(), getTranslations("portal")]);
  return (
    <AppShell
      area="client"
      siteName={localized(settings, "siteName", locale)}
      logoUrl={settings.logoUrl}
      user={{ name: client.fullName, username: client.user.username, subtitle: `${t("clientNumber")} #${padSerial(client.serialNumber)}` }}
    >
      {children}
    </AppShell>
  );
}
