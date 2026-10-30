import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { getPurchase } from "@/lib/commerce-queries";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentDetails } from "@/components/commerce/document-details";
import { Money } from "@/components/commerce/shared";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("purchaseDetails") };
}

export default async function PurchaseDetailsPage({ params }: { params: { id: string } }) {
  const user = await staffPageGuard("purchases.view");
  const [t, locale, p] = await Promise.all([getTranslations("commerce"), getLocale(), getPurchase(params.id)]);
  if (!p) notFound();
  const opt = (v: number | null) => (v === null ? "—" : <Money value={v} />);
  return (
    <>
      <PageHeader title={t("purchaseDetails")} backHref="/admin/purchases" backLabel={t("purchases")}
        actions={hasPermission(user, "purchases.edit") ? <Button variant="outline" asChild><Link href={`/admin/purchases/${p.id}/edit`}><Pencil />{t("edit")}</Link></Button> : undefined} />
      <DocumentDetails kind="PURCHASE" id={p.id} number={p.number}
        info={[
          { label: t("date"), value: formatDate(p.date, locale) },
          { label: t("supplier"), value: p.supplierName ?? "—" },
          { label: t("note"), value: p.note || "—" },
        ]}
        head={[t("product"), t("quantity"), t("unitCost"), t("priceDetail"), t("priceReseller"), t("priceWholesale"), t("lineTotal")]}
        rows={p.lines.map((l) => [
          lname({ name: l.productName, nameAr: l.productNameAr }, locale), `${formatNumber(l.quantity, locale)} ${l.unitSymbol}`,
          <Money key="c" value={l.unitCost} />, opt(l.priceDetail), opt(l.priceReseller), opt(l.priceWholesale),
          <Money key="t" value={l.lineTotal} className="font-semibold" />,
        ])}
        summary={[]} total={p.total} paid={p.paidAmount} remaining={p.remaining} payments={p.payments} />
    </>
  );
}
