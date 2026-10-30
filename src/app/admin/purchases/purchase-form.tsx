"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, PackagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Field } from "@/components/shared/form-fields";
import { Thumb } from "@/components/shared/thumb";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { ProductSearch } from "@/components/commerce/product-search";
import { Money, PartyCombobox, SummaryRow } from "@/components/commerce/shared";
import { savePurchaseAction } from "@/actions/commerce";
import { parseAmount, round2, type CommerceProductDTO, type PartyDTO, type PurchaseDetailDTO } from "@/lib/commerce";
import { lname } from "@/lib/i18n-data";

type Line = {
  productId: string; quantity: string; unitCost: string; priceDetail: string; priceReseller: string; priceWholesale: string; minStockAlert: string;
};
const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function PurchaseForm({ products, suppliers, purchase }: { products: CommerceProductDTO[]; suppliers: PartyDTO[]; purchase?: PurchaseDetailDTO }) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useActionFeedback();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [lines, setLines] = useState<Line[]>(() => (purchase?.lines ?? []).map((l) => ({
    productId: l.productId, quantity: str(l.quantity), unitCost: str(l.unitCost), priceDetail: str(l.priceDetail),
    priceReseller: str(l.priceReseller), priceWholesale: str(l.priceWholesale), minStockAlert: str(l.minStockAlert),
  })));
  const [supplierId, setSupplierId] = useState<string | null>(purchase?.supplierId ?? null);
  const [date, setDate] = useState(purchase?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(purchase?.note ?? "");
  const [paid, setPaid] = useState<string | null>(null); // null = follow the total
  const [busy, setBusy] = useState(false);

  const lineTotal = (l: Line) => round2(parseAmount(l.quantity) * parseAmount(l.unitCost));
  const total = round2(lines.reduce((s, l) => s + lineTotal(l), 0));
  const paidValue = purchase ? purchase.paidAmount : paid === null ? total : parseAmount(paid);
  const remaining = round2(total - paidValue);

  function add(p: CommerceProductDTO) {
    setLines((ls) => [...ls, {
      productId: p.id, quantity: "1", unitCost: str(p.purchasePrice), priceDetail: str(p.priceDetail), priceReseller: str(p.priceReseller),
      priceWholesale: str(p.priceWholesale), minStockAlert: str(p.minStockAlert),
    }]);
  }
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function save() {
    if (!purchase && (paidValue < 0 || paidValue > total)) return toast.error(t("errors.paidTooHigh"));
    setBusy(true);
    const opt = (v: string) => (v.trim() === "" ? null : parseAmount(v));
    const res = await savePurchaseAction(purchase?.id ?? null, {
      supplierId, note, purchasedAt: date || null, paidAmount: purchase ? null : paidValue,
      items: lines.map((l) => ({
        productId: l.productId, quantity: parseAmount(l.quantity), unitCost: parseAmount(l.unitCost),
        priceDetail: opt(l.priceDetail), priceReseller: opt(l.priceReseller), priceWholesale: opt(l.priceWholesale), minStockAlert: opt(l.minStockAlert),
      })),
    });
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    toast.success(purchase ? t("purchaseUpdated", { number: res.data!.number }) : t("purchaseCreated", { number: res.data!.number }));
    router.push("/admin/purchases");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold">{t("products")}</h2>
            <ProductSearch products={products} selectedIds={lines.map((l) => l.productId)} onSelect={add} />
          </div>
          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
              <PackagePlus className="h-8 w-8" />{t("noLines")}
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((l, i) => {
                const p = byId.get(l.productId);
                return (
                  <li key={l.productId} className="rounded-xl border bg-background/60 p-3">
                    <div className="mb-3 flex items-center gap-3">
                      <Thumb src={p?.imageUrl} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p ? lname(p, locale) : "—"}</div>
                        <div className="text-xs text-muted-foreground">{t("stock")}: {p?.stockQuantity ?? 0} {p?.unitSymbol}</div>
                      </div>
                      <div className="text-end">
                        <div className="text-xs text-muted-foreground">{t("lineTotal")}</div>
                        <Money value={lineTotal(l)} className="font-semibold" />
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={tc("delete")}
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                      <NumField label={`${t("quantity")} (${p?.unitSymbol ?? ""})`} value={l.quantity} onChange={(v) => update(i, { quantity: v })} />
                      <NumField label={t("unitCost")} value={l.unitCost} onChange={(v) => update(i, { unitCost: v })} />
                      <NumField label={t("priceDetail")} value={l.priceDetail} onChange={(v) => update(i, { priceDetail: v })} />
                      <NumField label={t("priceReseller")} value={l.priceReseller} onChange={(v) => update(i, { priceReseller: v })} />
                      <NumField label={t("priceWholesale")} value={l.priceWholesale} onChange={(v) => update(i, { priceWholesale: v })} />
                      <NumField label={t("minStockAlert")} value={l.minStockAlert} onChange={(v) => update(i, { minStockAlert: v })} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <Field label={t("supplier")} htmlFor="purchase-supplier" optional optionalLabel={tc("optional")}>
              <PartyCombobox id="purchase-supplier" parties={suppliers} value={supplierId} onChange={(s) => setSupplierId(s?.id ?? null)}
                placeholder={t("chooseSupplier")} emptyLabel={t("noSupplier")} clearLabel={t("noSupplierOption")} />
            </Field>
            <Field label={t("date")} htmlFor="purchase-date">
              <Input id="purchase-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("note")} htmlFor="purchase-note" optional optionalLabel={tc("optional")}>
              <Textarea id="purchase-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <SummaryRow label={t("total")} strong><Money value={total} /></SummaryRow>
            {purchase ? (
              <SummaryRow label={t("paid")}><Money value={purchase.paidAmount} /></SummaryRow>
            ) : (
              <Field label={t("amountPaid")} htmlFor="purchase-paid" hint={t("amountPaidHint")}>
                <Input id="purchase-paid" inputMode="decimal" value={paid ?? String(total)} onChange={(e) => setPaid(e.target.value)} />
              </Field>
            )}
            <SummaryRow label={t("remaining")} className={remaining > 0 ? "text-destructive" : ""}><Money value={remaining} /></SummaryRow>
            {remaining > 0 && <p className="text-xs text-muted-foreground">{t("purchaseDebtHint")}</p>}
            {remaining < 0 && <p className="text-xs text-destructive">{t("errors.paidTooHigh")}</p>}
            <Button className="w-full" onClick={save} disabled={busy || remaining < 0}>
              {busy && <Loader2 className="animate-spin" />}{purchase ? tc("save") : t("createPurchase")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span className="block truncate">{label}</span>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </label>
  );
}
