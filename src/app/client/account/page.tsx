import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Hash, MapPin, Phone, UserRound } from "lucide-react";
import { clientPageGuard } from "@/lib/authz";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic";
import { formatDate } from "@/lib/format";
import { padSerial } from "@/lib/utils";
import { PasswordForm } from "./password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("portal"))("accountTitle") };
}

export default async function AccountPage() {
  const client = await clientPageGuard();
  const t = await getTranslations("portal");
  const tcl = await getTranslations("clients");
  const locale = await getLocale();
  const rows = [
    { icon: Hash, label: t("clientNumber"), value: `#${padSerial(client.serialNumber)}` },
    { icon: UserRound, label: tcl("fullName"), value: client.fullName },
    { icon: Phone, label: tcl("phone"), value: client.phone, ltr: true },
    { icon: MapPin, label: tcl("address"), value: client.address || "—" },
    { icon: UserRound, label: tcl("username"), value: client.user.username, ltr: true },
  ];
  return (
    <>
      <PageHeader title={t("accountTitle")} description={t("accountSubtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("myInfo")}</CardTitle>
            <p className="text-sm text-muted-foreground">{tcl("since", { date: formatDate(client.createdAt, locale) })}</p>
          </CardHeader>
          <CardContent>
            <dl className="divide-y rounded-xl border">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center gap-3 p-3">
                  <r.icon className="h-4 w-4 text-muted-foreground" />
                  <dt className="w-36 text-sm text-muted-foreground">{r.label}</dt>
                  <dd className="min-w-0 flex-1 truncate font-medium" dir={r.ltr ? "ltr" : undefined}>{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{t("infoReadonly")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("changePassword")}</CardTitle></CardHeader>
          <CardContent><PasswordForm /></CardContent>
        </Card>
      </div>
    </>
  );
}
