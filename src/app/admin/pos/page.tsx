import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { loadPosData } from "@/lib/pos-data";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { PosView } from "./pos-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("pos") };
}

export default async function PosPage({ searchParams }: { searchParams: { order?: string } }) {
  const user = await staffPageGuard("pos.use");
  const t = await getTranslations("commerce");
  const [data, order] = await Promise.all([
    loadPosData(user),
    // "Convert to sale" from a website order: its products go to the cart.
    searchParams.order && hasPermission(user, "orders.view")
      ? q<{ id: string; orderNumber: string; items: { productId: string | null; quantity: number }[] } | null>(
          db().from("orders").select("id, order_number, items:order_items(product_id, quantity)").eq("id", searchParams.order).maybeSingle(),
        ).catch(() => null)
      : null,
  ]);
  const fromOrder = order
    ? { id: order.id, number: order.orderNumber, items: order.items.flatMap((i) => (i.productId ? [{ productId: i.productId, quantity: toNumber(i.quantity) }] : [])) }
    : undefined;
  return (
    <>
      <PageHeader title={t("pos")} description={fromOrder ? t("fromOrder", { number: fromOrder.number }) : t("posHint")} />
      <PosView {...data} fromOrder={fromOrder} />
    </>
  );
}
