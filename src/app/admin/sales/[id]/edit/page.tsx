import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { getSale } from "@/lib/commerce-queries";
import { loadPosData } from "@/lib/pos-data";
import { PageHeader } from "@/components/shared/page-header";
import { PosView } from "../../../pos/pos-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("editSale") };
}

export default async function EditSalePage({ params }: { params: { id: string } }) {
  const user = await staffPageGuard("sales.edit");
  const t = await getTranslations("commerce");
  const [sale, data] = await Promise.all([getSale(params.id), loadPosData(user)]);
  if (!sale) notFound();
  return (
    <>
      <PageHeader title={`${t("editSale")} ${sale.number}`} description={t("editSaleHint")} backHref={`/admin/sales/${sale.id}`} backLabel={sale.number} />
      <PosView {...data} sale={sale} />
    </>
  );
}
