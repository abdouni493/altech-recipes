import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { listSuppliers } from "@/lib/suppliers";
import { PageHeader } from "@/components/shared/page-header";
import { debtsBy } from "@/lib/commerce-queries";
import { SuppliersView } from "./suppliers-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("suppliers"))("title") };
}

export default async function SuppliersPage() {
  await staffPageGuard("suppliers.view");
  const t = await getTranslations("suppliers");
  const [suppliers, debts] = await Promise.all([
    listSuppliers(),
    debtsBy("supplier").catch(() => ({} as Record<string, number>)),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SuppliersView suppliers={suppliers} debts={debts} />
    </>
  );
}
