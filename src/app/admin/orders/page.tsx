import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { getSiteSettings, localized } from "@/lib/site";
import { findWilaya } from "@/lib/algeria";
import { lname } from "@/lib/i18n-data";
import { OrdersView, type OrderRow } from "./orders-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders"))("title") };
}

export default async function OrdersPage() {
  await staffPageGuard("orders.view");
  const t = await getTranslations("orders");
  const locale = await getLocale();
  const [orders, settings] = await Promise.all([
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, include: { recipe: true, pack: true } }),
    getSiteSettings(),
  ]);
  const rows: OrderRow[] = orders.map((o) => {
    const w = findWilaya(o.wilayaCode);
    const commune = w?.communes.find((c) => c.fr === o.communeName);
    return {
      id: o.id, orderNumber: o.orderNumber, fullName: o.fullName, phone: o.phone,
      wilayaCode: o.wilayaCode, wilayaName: w ? (locale === "ar" ? w.ar : w.fr) : o.wilayaName,
      communeName: commune ? (locale === "ar" ? commune.ar : commune.fr) : o.communeName,
      item: o.recipe ? { kind: "recipe", name: lname(o.recipe, locale) } : o.pack ? { kind: "pack", name: lname(o.pack, locale) } : null,
      message: o.message, wantsClientAccount: o.wantsClientAccount, status: o.status as OrderRow["status"],
      createdAt: o.createdAt.toISOString(), confirmedAt: o.confirmedAt?.toISOString() ?? null, cancelledAt: o.cancelledAt?.toISOString() ?? null,
    };
  });
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <OrdersView rows={rows} siteName={localized(settings, "siteName", locale)} />
    </>
  );
}
