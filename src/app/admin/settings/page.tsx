import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate } from "@/lib/format";
import { SettingsTabs } from "./settings-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function SettingsPage() {
  const admin = await staffPageGuard();
  const t = await getTranslations("settings");
  const locale = await getLocale();
  const isAdmin = admin.role === "ADMIN";
  const [last, recipes, products, clients, orders] = isAdmin ? await Promise.all([
    prisma.appMeta.findUnique({ where: { key: "lastBackupAt" } }),
    prisma.recipe.count(), prisma.product.count(), prisma.client.count(), prisma.order.count(),
  ]) : [null, 0, 0, 0, 0];
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsTabs
        profile={{ name: admin.name, username: admin.username, email: admin.email ?? "" }}
        lastBackup={last ? formatDate(last.value, locale, true) : null}
        stats={{ recipes, products, clients, orders }}
        isAdmin={isAdmin}
      />
    </>
  );
}
