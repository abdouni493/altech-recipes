import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { listSales } from "@/lib/commerce-queries";
import { PageHeader } from "@/components/shared/page-header";
import { SalesView } from "./sales-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("sales") };
}

export default async function SalesPage() {
  const user = await staffPageGuard("sales.view");
  const t = await getTranslations("commerce");
  const sales = await listSales();
  return (
    <>
      <PageHeader title={t("sales")} description={t("salesHint")}
        actions={hasPermission(user, "pos.use") ? <Button asChild><Link href="/admin/pos"><ScanBarcode />{t("newSale")}</Link></Button> : undefined} />
      <SalesView sales={sales} />
    </>
  );
}
