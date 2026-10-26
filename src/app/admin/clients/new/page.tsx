import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Order } from "@/lib/db-types";
import { getNextSerial, getPermissionCatalog } from "@/lib/client-queries";
import { PageHeader } from "@/components/shared/page-header";
import { ClientWizard } from "../client-wizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("clients"))("createTitle") };
}

export default async function NewClientPage({ searchParams }: { searchParams: { order?: string } }) {
  await staffPageGuard("clients.create");
  const t = await getTranslations("clients");
  const [catalog, nextSerial, order] = await Promise.all([
    getPermissionCatalog(),
    getNextSerial(),
    searchParams.order ? q<Order | null>(db().from("orders").select("*").eq("id", searchParams.order).maybeSingle()) : null,
  ]);
  return (
    <>
      <PageHeader title={t("createTitle")} backHref="/admin/clients" backLabel={t("title")} />
      <ClientWizard
        nextSerial={nextSerial}
        packs={catalog.packs}
        recipes={catalog.recipes}
        prefill={order ? { fullName: order.fullName, phone: order.phone, orderNumber: order.orderNumber, recipeId: order.recipeId, packId: order.packId } : undefined}
      />
    </>
  );
}
