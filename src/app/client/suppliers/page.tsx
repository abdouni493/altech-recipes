import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { clientPageGuard } from "@/lib/authz";
import { listSuppliers } from "@/lib/suppliers";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierList } from "@/components/shared/supplier-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("suppliers"))("title") };
}

export default async function ClientSuppliersPage() {
  await clientPageGuard();
  const [t, suppliers] = await Promise.all([getTranslations("suppliers"), listSuppliers()]);
  return (
    <>
      <PageHeader title={t("title")} description={t("clientSubtitle")} />
      <SupplierList suppliers={suppliers} viewBase="/client/suppliers" />
    </>
  );
}
