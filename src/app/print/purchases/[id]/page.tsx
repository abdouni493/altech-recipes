import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { getPurchase } from "@/lib/commerce-queries";
import { formatMoney } from "@/lib/commerce";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { getContactSettings, getSiteSettings, localized } from "@/lib/site";
import { PrintSheet } from "@/components/commerce/print-sheet";
import { PrintDocument } from "@/components/commerce/print-document";

export const dynamic = "force-dynamic";

export default async function PrintPurchasePage({ params }: { params: { id: string } }) {
  await staffPageGuard("purchases.view");
  const [t, locale, p, site, contact] = await Promise.all([getTranslations("commerce"), getLocale(), getPurchase(params.id), getSiteSettings(), getContactSettings()]);
  if (!p) notFound();
  const m = (v: number) => formatMoney(v, locale);
  return (
    <PrintSheet>
      <PrintDocument locale={locale} title={t("purchaseDoc")} number={p.number} shopName={localized(site, "siteName", locale)} logoUrl={site.logoUrl}
        shopLines={[contact.phone, contact.email]} partyLabel={t("supplier")} partyLines={[p.supplierName ?? "—"]}
        dateLabel={t("date")} date={formatDate(p.date, locale)}
        head={[t("product"), t("quantity"), t("unitCost"), t("lineTotal")]}
        rows={p.lines.map((l) => [lname({ name: l.productName, nameAr: l.productNameAr }, locale), `${formatNumber(l.quantity, locale)} ${l.unitSymbol}`, m(l.unitCost), m(l.lineTotal)])}
        totals={[{ label: t("total"), value: p.total, strong: true }, { label: t("paid"), value: p.paidAmount }, { label: t("remaining"), value: p.remaining }]}
        footer={p.note || undefined} />
    </PrintSheet>
  );
}
