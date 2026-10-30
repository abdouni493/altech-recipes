import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Order, Pack, Recipe } from "@/lib/db-types";
import { PageHeader } from "@/components/shared/page-header";
import { getSiteSettings, localized } from "@/lib/site";
import { findWilaya } from "@/lib/algeria";
import { lname } from "@/lib/i18n-data";
import { toNumber } from "@/lib/utils";
import { OrdersView, type OrderRow } from "./orders-view";

type Named = { name: string; nameAr: string } | null;
type OrderItemRow = {
  id: string; itemType: "RECIPE" | "PACK" | "PRODUCT"; productId: string | null; name: string;
  quantity: number; unitPrice: number; lineTotal: number; position: number; recipe: Named; pack: Named; product: Named;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders"))("title") };
}

export default async function OrdersPage() {
  await staffPageGuard("orders.view");
  const t = await getTranslations("orders");
  const locale = await getLocale();
  const [orders, settings] = await Promise.all([
    q<(Order & { total: number; recipe: Recipe | null; pack: Pack | null; items: OrderItemRow[] })[]>(
      db().from("orders")
        .select("*, recipe:recipes(*), pack:packs(*), items:order_items(*, recipe:recipes(name, name_ar), pack:packs(name, name_ar), product:products(name, name_ar))")
        .order("created_at", { ascending: false }),
    ),
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
      createdAt: o.createdAt, confirmedAt: o.confirmedAt, cancelledAt: o.cancelledAt,
      total: toNumber(o.total),
      items: [...(o.items ?? [])].sort((a, b) => a.position - b.position).map((i) => {
        const live = i.recipe ?? i.pack ?? i.product;
        return {
          id: i.id, type: i.itemType, productId: i.productId, name: live ? lname(live, locale) : i.name,
          quantity: toNumber(i.quantity), unitPrice: toNumber(i.unitPrice), lineTotal: toNumber(i.lineTotal),
        };
      }),
    };
  });
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <OrdersView rows={rows} siteName={localized(settings, "siteName", locale)} />
    </>
  );
}
