import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import { productHistoryAction } from "@/actions/commerce";
import { formatMoney } from "@/lib/commerce";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { getSiteSettings, localized } from "@/lib/site";
import { PrintSheet } from "@/components/commerce/print-sheet";

export const dynamic = "force-dynamic";

export default async function ProductReportPage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string; to?: string } }) {
  await staffPageGuard("products.view");
  const [t, locale, site] = await Promise.all([getTranslations("commerce"), getLocale(), getSiteSettings()]);
  const product = await q<{ name: string; nameAr: string; stockQuantity: number; unit: { symbol: string } | null } | null>(
    db().from("products").select("name, name_ar, stock_quantity, unit:units(symbol)").eq("id", params.id).maybeSingle(),
  );
  if (!product) notFound();
  const res = await productHistoryAction(params.id, searchParams.from || null, searchParams.to || null);
  if (!res.ok) notFound();
  const h = res.data!;
  const u = product.unit?.symbol ?? "";
  const m = (v: number) => formatMoney(v, locale);
  const period = searchParams.from || searchParams.to
    ? `${searchParams.from ? formatDate(searchParams.from, locale) : "…"} → ${searchParams.to ? formatDate(searchParams.to, locale) : "…"}`
    : t("allTime");
  const section = (title: string, head: string[], rows: string[][]) => (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-sm font-bold uppercase">{title}</h2>
      {rows.length === 0 ? <p className="text-xs text-neutral-500">{t("nothingYet")}</p> : (
        <table className="w-full border-collapse text-xs">
          <thead><tr className="bg-neutral-100">{head.map((x) => <th key={x} className="border border-neutral-300 px-2 py-1 text-start">{x}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-neutral-300 px-2 py-1">{c}</td>)}</tr>)}</tbody>
        </table>
      )}
    </section>
  );
  return (
    <PrintSheet>
      <header className="border-b-2 border-black pb-3">
        <div className="text-xs">{localized(site, "siteName", locale)}</div>
        <h1 className="text-xl font-bold">{t("productReport")} — {lname(product, locale)}</h1>
        <div className="text-xs">{t("period")} : {period} · {t("currentStock")} : {formatNumber(Number(product.stockQuantity), locale)} {u}</div>
      </header>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {[
          [t("purchasedQty"), `${formatNumber(h.totals.purchasedQty, locale)} ${u}`], [t("purchasedAmount"), m(h.totals.purchasedAmount)],
          [t("soldQty"), `${formatNumber(h.totals.soldQty, locale)} ${u}`], [t("soldAmount"), m(h.totals.soldAmount)],
          [t("profit"), m(h.totals.profit)], [t("orderedQty"), `${formatNumber(h.totals.orderedQty, locale)} ${u}`],
        ].map(([k, v]) => <div key={k} className="rounded border p-2"><div className="text-neutral-500">{k}</div><div className="font-bold">{v}</div></div>)}
      </div>
      {section(t("purchasesTab"), [t("date"), t("number"), t("supplier"), t("quantity"), t("lineTotal")],
        h.purchases.map((r) => [formatDate(r.date, locale), r.number, r.supplier ?? "—", formatNumber(r.quantity, locale), m(r.lineTotal)]))}
      {section(t("sales"), [t("date"), t("number"), t("client"), t("quantity"), t("lineTotal")],
        h.sales.map((r) => [formatDate(r.date, locale), r.number, r.client ?? t("walkIn"), formatNumber(r.quantity, locale), m(r.lineTotal)]))}
      {section(t("recipes"), [t("recipe"), t("quantity")], h.recipes.map((r) => [lname(r, locale), formatNumber(r.quantity, locale)]))}
      {section(t("websiteOrders"), [t("date"), t("number"), t("client"), t("quantity")],
        h.orders.map((r) => [formatDate(r.date, locale), r.number, r.client, formatNumber(r.quantity, locale)]))}
    </PrintSheet>
  );
}
