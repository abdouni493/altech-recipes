import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { getSale } from "@/lib/commerce-queries";
import { formatMoney } from "@/lib/commerce";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { getContactSettings, getSiteSettings, localized } from "@/lib/site";
import { PrintSheet } from "@/components/commerce/print-sheet";
import { PrintDocument } from "@/components/commerce/print-document";

export const dynamic = "force-dynamic";

export default async function PrintSalePage({ params }: { params: { id: string } }) {
  await staffPageGuard();
  const [t, locale, s, site, contact] = await Promise.all([getTranslations("commerce"), getLocale(), getSale(params.id), getSiteSettings(), getContactSettings()]);
  if (!s) notFound();
  const m = (v: number) => formatMoney(v, locale);
  const totals = [{ label: t("subtotal"), value: s.subtotal }];
  if (s.discountAmount > 0) totals.push({ label: s.discountType === "PERCENT" ? `${t("discount")} (${s.discountValue} %)` : t("discount"), value: -s.discountAmount });
  if (s.tvaEnabled) totals.push({ label: `${t("tva")} (${s.tvaRate} %)`, value: s.tvaAmount });
  return (
    <PrintSheet>
      <PrintDocument locale={locale} title={t("invoice")} number={s.number} shopName={localized(site, "siteName", locale)} logoUrl={site.logoUrl}
        shopLines={[contact.phone, contact.email]} partyLabel={t("client")} partyLines={[s.clientName ?? t("walkIn")]}
        dateLabel={t("date")} date={formatDate(s.date, locale, true)}
        head={[t("product"), t("quantity"), t("unitPrice"), t("lineTotal")]}
        rows={s.lines.map((l) => [lname({ name: l.productName, nameAr: l.productNameAr }, locale), `${formatNumber(l.quantity, locale)} ${l.unitSymbol}`, m(l.unitPrice), m(l.lineTotal)])}
        totals={[...totals, { label: t("total"), value: s.total, strong: true }, { label: t("paid"), value: s.paidAmount }, { label: t("remaining"), value: s.remaining }]}
        footer={t("thanks")} />
    </PrintSheet>
  );
}
