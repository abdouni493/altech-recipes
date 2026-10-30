import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { listSuppliers, type SupplierProductDTO } from "@/lib/suppliers";
import { PageHeader } from "@/components/shared/page-header";
import { debtsBy } from "@/lib/commerce-queries";
import { SuppliersView } from "./suppliers-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("suppliers"))("title") };
}

export default async function SuppliersPage() {
  const user = await staffPageGuard("suppliers.view");
  const t = await getTranslations("suppliers");
  const canWrite = hasPermission(user, "suppliers.create") || hasPermission(user, "suppliers.edit");
  const [suppliers, products, debts] = await Promise.all([
    listSuppliers(),
    canWrite ? q<SupplierProductDTO[]>(db().from("products").select("id, name, name_ar, image_url").order("name")) : [],
    debtsBy("supplier").catch(() => ({} as Record<string, number>)),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SuppliersView suppliers={suppliers} products={products} debts={debts} />
    </>
  );
}
