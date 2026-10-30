import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { getSale } from "@/lib/commerce-queries";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentDetails } from "@/components/commerce/document-details";
import { Money } from "@/components/commerce/shared";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("commerce"))("saleDetails") };
}

export default async function SaleDetailsPage({ params }: { params: { id: string } }) {
  const user = await staffPageGuard("sales.view");
  const [t, locale, s] = await Promise.all([getTranslations("commerce"), getLocale(), getSale(params.id)]);
  if (!s) notFound();
  const summary = [{ label: t("subtotal"), value: s.subtotal }];
  if (s.discountAmount > 0) summary.push({ label: t("discount"), value: -s.discountAmount });
  if (s.tvaEnabled) summary.push({ label: `${t("tva")} (${s.tvaRate} %)`, value: s.tvaAmount });
  return (
    <>
      <PageHeader title={t("saleDetails")} backHref="/admin/sales" backLabel={t("sales")}
        actions={hasPermission(user, "sales.edit") ? <Button variant="outline" asChild><Link href={`/admin/sales/${s.id}/edit`}><Pencil />{t("edit")}</Link></Button> : undefined} />
      <DocumentDetails kind="SALE" id={s.id} number={s.number}
        info={[
          { label: t("date"), value: formatDate(s.date, locale, true) },
          { label: t("client"), value: s.clientName ?? t("walkIn") },
          { label: t("priceType"), value: t(`priceTypes.${s.priceType}`) },
        ]}
        head={[t("product"), t("quantity"), t("priceType"), t("unitPrice"), t("lineTotal")]}
        rows={s.lines.map((l) => [
          lname({ name: l.productName, nameAr: l.productNameAr }, locale), `${formatNumber(l.quantity, locale)} ${l.unitSymbol}`,
          t(`priceTypes.${l.priceType}`), <Money key="u" value={l.unitPrice} />, <Money key="t" value={l.lineTotal} className="font-semibold" />,
        ])}
        summary={summary} total={s.total} paid={s.paidAmount} remaining={s.remaining} payments={s.payments} />
    </>
  );
}
