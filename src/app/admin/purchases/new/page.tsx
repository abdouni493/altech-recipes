import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { listCommerceProducts, listSuppliersLite } from "@/lib/commerce-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseForm } from "../purchase-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("newPurchase") };
}

export default async function NewPurchasePage() {
  await staffPageGuard("purchases.create");
  const t = await getTranslations("commerce");
  const [products, suppliers] = await Promise.all([listCommerceProducts(), listSuppliersLite().catch(() => [])]);
  return (
    <>
      <PageHeader title={t("newPurchase")} description={t("newPurchaseHint")} backHref="/admin/purchases" backLabel={t("purchases")} />
      <PurchaseForm products={products} suppliers={suppliers} />
    </>
  );
}
