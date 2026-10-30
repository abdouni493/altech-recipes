"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { DateRange, Money, PrintLink } from "@/components/commerce/shared";
import { SimpleTable, Stat } from "@/components/commerce/party-history-dialog";
import { productHistoryAction, type ProductHistory } from "@/actions/commerce";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";

/** Everything that happened to one product: purchases, sales, recipes using it, website orders and stock movements. */
export function ProductHistoryDialog({ open, onOpenChange, product }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  product: { id: string; name: string; nameAr: string; unit: { symbol: string } };
}) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ProductHistory | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    productHistoryAction(product.id, from || null, to || null).then((res) => {
      if (!res.ok) return feedback.error(res);
      setData(res.data!);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.id, from, to]);

  const u = product.unit.symbol;
  const qty = (v: number) => `${formatNumber(v, locale)} ${u}`;
  const qs = new URLSearchParams({ from, to }).toString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("history")} — {lname(product, locale)}</DialogTitle>
          <DialogDescription>{t("productHistoryHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
          <PrintLink href={`/print/product-history/${product.id}?${qs}`} label={t("printReport")} size="sm" />
        </div>
        {!data ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label={t("purchasedQty")} value={qty(data.totals.purchasedQty)} />
              <Stat label={t("purchasedAmount")} value={<Money value={data.totals.purchasedAmount} />} />
              <Stat label={t("soldQty")} value={qty(data.totals.soldQty)} />
              <Stat label={t("soldAmount")} value={<Money value={data.totals.soldAmount} />} />
              <Stat label={t("profit")} value={<Money value={data.totals.profit} className={data.totals.profit < 0 ? "text-destructive" : "text-success"} />} />
              <Stat label={t("orderedQty")} value={qty(data.totals.orderedQty)} />
            </div>
            <Tabs defaultValue="purchases">
              <TabsList className="flex-wrap">
                <TabsTrigger value="purchases">{t("purchasesTab")} ({data.purchases.length})</TabsTrigger>
                <TabsTrigger value="sales">{t("sales")} ({data.sales.length})</TabsTrigger>
                <TabsTrigger value="recipes">{t("recipes")} ({data.recipes.length})</TabsTrigger>
                <TabsTrigger value="orders">{t("websiteOrders")} ({data.orders.length})</TabsTrigger>
                <TabsTrigger value="movements">{t("movements")} ({data.movements.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="purchases">
                <SimpleTable empty={t("nothingYet")} head={[t("date"), t("number"), t("supplier"), t("quantity"), t("unitCost"), t("lineTotal")]}
                  rows={data.purchases.map((r) => [formatDate(r.date, locale), r.number, r.supplier ?? "—", qty(r.quantity), <Money key="c" value={r.unitCost} />, <Money key="t" value={r.lineTotal} />])} />
              </TabsContent>
              <TabsContent value="sales">
                <SimpleTable empty={t("nothingYet")} head={[t("date"), t("number"), t("client"), t("quantity"), t("priceType"), t("unitPrice"), t("lineTotal"), t("profit")]}
                  rows={data.sales.map((r) => [formatDate(r.date, locale, true), r.number, r.client ?? t("walkIn"), qty(r.quantity), t(`priceTypes.${r.priceType}` as never),
                    <Money key="u" value={r.unitPrice} />, <Money key="t" value={r.lineTotal} />, <Money key="p" value={r.profit} />])} />
              </TabsContent>
              <TabsContent value="recipes">
                <SimpleTable empty={t("nothingYet")} head={[t("recipe"), t("quantity")]}
                  rows={data.recipes.map((r) => [lname(r, locale), formatNumber(r.quantity, locale)])} />
              </TabsContent>
              <TabsContent value="orders">
                <SimpleTable empty={t("nothingYet")} head={[t("date"), t("number"), t("client"), t("status"), t("quantity"), t("lineTotal")]}
                  rows={data.orders.map((r) => [formatDate(r.date, locale), r.number, r.client, r.status, qty(r.quantity), <Money key="t" value={r.lineTotal} />])} />
              </TabsContent>
              <TabsContent value="movements">
                <SimpleTable empty={t("nothingYet")} head={[t("date"), t("operation"), t("quantity"), t("note")]}
                  rows={data.movements.map((r) => [formatDate(r.createdAt, locale, true), t(`movementTypes.${r.type}` as never),
                    <span key="q" className={r.quantity < 0 ? "text-destructive" : "text-success"}>{r.quantity > 0 ? "+" : ""}{qty(r.quantity)}</span>, r.note || "—"])} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
