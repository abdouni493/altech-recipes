import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { listPurchases } from "@/lib/commerce-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PurchasesView } from "./purchases-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("purchases") };
}

export default async function PurchasesPage() {
  const user = await staffPageGuard("purchases.view");
  const t = await getTranslations("commerce");
  const purchases = await listPurchases();
  return (
    <>
      <PageHeader title={t("purchases")} description={t("purchasesHint")}
        actions={hasPermission(user, "purchases.create") ? <Button asChild><Link href="/admin/purchases/new"><Plus />{t("newPurchase")}</Link></Button> : undefined} />
      <PurchasesView purchases={purchases} />
    </>
  );
}
