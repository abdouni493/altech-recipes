import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { getPurchase, listCommerceProducts, listSuppliersLite } from "@/lib/commerce-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseForm } from "../../purchase-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("editPurchase") };
}

export default async function EditPurchasePage({ params }: { params: { id: string } }) {
  await staffPageGuard("purchases.edit");
  const t = await getTranslations("commerce");
  const [purchase, products, suppliers] = await Promise.all([getPurchase(params.id), listCommerceProducts(), listSuppliersLite().catch(() => [])]);
  if (!purchase) notFound();
  return (
    <>
      <PageHeader title={`${t("editPurchase")} ${purchase.number}`} description={t("editPurchaseHint")} backHref="/admin/purchases" backLabel={t("purchases")} />
      <PurchaseForm products={products} suppliers={suppliers} purchase={purchase} />
    </>
  );
}
