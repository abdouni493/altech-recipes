"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Printer, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { padSerial } from "@/lib/utils";

/** Shows credentials once, with copy and print buttons (prints a clean credentials sheet). */
export function CredentialsCard({ fullName, serial, username, password }: { fullName: string; serial: number; username: string; password: string }) {
  const t = useTranslations("clients");
  const [loginUrl, setLoginUrl] = useState("/login");
  useEffect(() => setLoginUrl(`${window.location.origin}/login`), []);
  const all = t("credentialsCopyText", { username, password, url: loginUrl });

  return (
    <div className="space-y-4">
      <div className="print-area space-y-3 rounded-2xl border-2 border-dashed border-primary/40 bg-sage-soft/40 p-5">
        <div className="print-only mb-4">
          <h2 className="font-serif text-2xl font-semibold">{t("printTitle")}</h2>
          <p>{fullName} — #{padSerial(serial)}</p>
        </div>
        <Row icon={<UserRound />} label={t("username")} value={username} copyLabel={t("copyUsername")} />
        <Row icon={<KeyRound />} label={t("password")} value={password} copyLabel={t("copyPassword")} />
        <div className="text-sm text-muted-foreground">{t("loginUrl")} : <span className="font-mono" dir="ltr">{loginUrl}</span></div>
        <p className="print-only mt-6 text-sm">{t("printFooter")}</p>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        <CopyButton text={all} label={t("copyAll")} showLabel />
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}><Printer />{t("printCredentials")}</Button>
      </div>
    </div>
  );
}

function Row({ icon, label, value, copyLabel }: { icon: React.ReactNode; label: string; value: string; copyLabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-base font-semibold" dir="ltr">{value}</div>
      </div>
      <CopyButton text={value} label={copyLabel} className="no-print" />
    </div>
  );
}
