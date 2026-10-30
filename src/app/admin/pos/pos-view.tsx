"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Minus, Plus, ScanBarcode, Search, ShoppingCart, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Switch } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Thumb } from "@/components/shared/thumb";
import { useCan } from "@/components/shared/staff-permissions";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { productSearchText } from "@/components/commerce/product-search";
import { PriceTypeSelect } from "@/components/commerce/price-type-select";
import { Money, PartyCombobox, SummaryRow } from "@/components/commerce/shared";
import { ClientWizard } from "@/app/admin/clients/client-wizard";
import type { PackWithRecipes } from "@/app/admin/clients/permissions-editor";
import { saveSaleAction } from "@/actions/commerce";
import {
  parseAmount, priceFor, round2, saleTotals, type CommerceProductDTO, type DiscountType, type PartyDTO, type PriceType, type SaleDetailDTO,
} from "@/lib/commerce";
import type { RecipeLiteDTO } from "@/lib/dto";
import { lname } from "@/lib/i18n-data";
import { cn, normalizeSearch } from "@/lib/utils";

type Line = { productId: string; quantity: string; priceType: PriceType; unitPrice: number | null };

export function PosView({
  products, clients: initialClients, sale, wizard, fromOrder,
}: {
  products: CommerceProductDTO[];
  clients: PartyDTO[];
  /** Edit an existing invoice instead of creating one. */
  sale?: SaleDetailDTO;
  wizard: { nextSerial: number; packs: PackWithRecipes[]; recipes: RecipeLiteDTO[] } | null;
  /** Website order converted into a sale. */
  fromOrder?: { id: string; number: string; items: { productId: string; quantity: number }[] };
}) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const can = useCan();
  const feedback = useActionFeedback();
  const searchRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const byBarcode = useMemo(() => new Map(products.filter((p) => p.barcode).map((p) => [p.barcode!.trim(), p])), [products]);

  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  // Edited invoices keep their stored unit prices; new lines use the product's current price.
  const [lines, setLines] = useState<Line[]>(() => sale
    ? sale.lines.map((l) => ({ productId: l.productId, quantity: String(l.quantity), priceType: l.priceType, unitPrice: l.unitPrice }))
    : (fromOrder?.items ?? []).filter((i) => byId.has(i.productId)).map((i) => ({ productId: i.productId, quantity: String(i.quantity), priceType: "DETAIL" as PriceType, unitPrice: null })));
  const [clientId, setClientId] = useState<string | null>(sale?.clientId ?? null);
  const [globalType, setGlobalType] = useState<PriceType>(sale?.priceType ?? "DETAIL");
  const [tvaOn, setTvaOn] = useState(sale?.tvaEnabled ?? false);
  const [tvaRate, setTvaRate] = useState(String(sale?.tvaRate ?? 19));
  const [discountOn, setDiscountOn] = useState((sale?.discountType ?? "NONE") !== "NONE");
  const [discountType, setDiscountType] = useState<Exclude<DiscountType, "NONE">>(sale?.discountType === "PERCENT" ? "PERCENT" : "AMOUNT");
  const [discountValue, setDiscountValue] = useState(String(sale?.discountValue ?? ""));
  const [paid, setPaid] = useState<string | null>(null);
  const [note, setNote] = useState(sale?.note ?? (fromOrder ? fromOrder.number : ""));
  const [busy, setBusy] = useState(false);
  const [newClient, setNewClient] = useState(false);
  const [askPrint, setAskPrint] = useState<{ id: string; number: string } | null>(null);

  const unitPrice = useCallback((l: Line) => {
    if (l.unitPrice !== null) return l.unitPrice;
    const p = byId.get(l.productId);
    return p ? priceFor(p, l.priceType) : 0;
  }, [byId]);
  const lineTotal = (l: Line) => round2(parseAmount(l.quantity) * unitPrice(l));
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l), 0));
  const totals = saleTotals(subtotal, discountOn ? discountType : "NONE", parseAmount(discountValue), tvaOn, parseAmount(tvaRate, 19));
  const paidValue = sale ? sale.paidAmount : paid === null ? totals.total : parseAmount(paid);
  const remaining = round2(totals.total - paidValue);
  const walkIn = !clientId;
  const blocked = lines.length === 0 || remaining < 0 || (walkIn && remaining > 0);

  const add = useCallback((p: CommerceProductDTO) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantity: String(round2(parseAmount(l.quantity) + 1)) } : l));
      return [...ls, { productId: p.id, quantity: "1", priceType: globalType, unitPrice: null }];
    });
  }, [globalType]);

  function onSearchChange(v: string) {
    const hit = byBarcode.get(v.trim());
    // A scanner types the whole code at once: add the product as soon as the code matches.
    if (hit && v.trim().length >= 4 && !hit.isOutOfStock) {
      add(hit);
      setSearch("");
      return;
    }
    setSearch(v);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const hit = byBarcode.get(search.trim()) ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (hit && !hit.isOutOfStock) { add(hit); setSearch(""); }
    else if (search.trim()) toast.error(t("barcodeNotFound"));
  }

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return q ? products.filter((p) => productSearchText(p).includes(q)) : products;
  }, [products, search]);

  function applyType(type: PriceType) {
    setGlobalType(type);
    setLines((ls) => ls.map((l) => ({ ...l, priceType: type, unitPrice: null })));
  }

  function selectClient(c: PartyDTO | null) {
    setClientId(c?.id ?? null);
    applyType(c?.priceType ?? "DETAIL");
  }

  function reset() {
    setLines([]); setClientId(null); setGlobalType("DETAIL"); setTvaOn(false); setDiscountOn(false); setDiscountValue("");
    setPaid(null); setNote(""); setSearch("");
    searchRef.current?.focus();
  }

  async function save() {
    if (blocked || busy) return;
    setBusy(true);
    const res = await saveSaleAction(sale?.id ?? null, {
      clientId, priceType: globalType, discountType: discountOn ? discountType : "NONE", discountValue: parseAmount(discountValue),
      tvaEnabled: tvaOn, tvaRate: parseAmount(tvaRate, 19), paidAmount: sale ? null : paidValue, note, orderId: fromOrder?.id ?? null,
      items: lines.map((l) => ({ productId: l.productId, quantity: parseAmount(l.quantity), priceType: l.priceType, unitPrice: l.unitPrice })),
    });
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    toast.success(sale ? t("saleUpdated", { number: res.data!.number }) : t("saleCreated", { number: res.data!.number }));
    if (sale) { router.push(`/admin/sales/${sale.id}`); router.refresh(); return; }
    setAskPrint({ id: res.data!.id, number: res.data!.number });
    router.refresh();
  }

  // F2: search, F9: save.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F9") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
      {/* Products */}
      <div className="space-y-4">
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchRef} autoFocus value={search} onChange={(e) => onSearchChange(e.target.value)} onKeyDown={onSearchKey}
            placeholder={t("posSearch")} className="h-12 ps-11 text-base" aria-label={t("posSearch")} />
          {search && <Button variant="ghost" size="icon-sm" className="absolute end-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")} aria-label={tc("close")}><X /></Button>}
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-16 text-muted-foreground"><Search className="h-8 w-8" />{t("noProduct")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {filtered.slice(0, 120).map((p) => {
              const out = p.isOutOfStock || p.stockQuantity <= 0;
              const inCart = lines.find((l) => l.productId === p.id);
              return (
                <button key={p.id} type="button" disabled={p.isOutOfStock} onClick={() => add(p)}
                  className={cn("group relative flex flex-col overflow-hidden rounded-xl border bg-card text-start shadow-soft transition hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    inCart && "border-primary ring-1 ring-primary")}>
                  <div className="aspect-[4/3] w-full bg-muted">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Thumb className="h-full w-full rounded-none border-0" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <div className="line-clamp-2 text-sm font-medium leading-tight">{lname(p, locale)}</div>
                    <Money value={priceFor(p, globalType)} className="text-sm font-bold text-primary" />
                    <div className={cn("text-xs", out ? "text-destructive" : p.stockQuantity <= p.minStockAlert ? "text-warning" : "text-muted-foreground")}>
                      {p.isOutOfStock ? t("outOfStock") : `${t("stock")}: ${p.stockQuantity} ${p.unitSymbol}`}
                    </div>
                  </div>
                  {inCart && <Badge className="absolute end-2 top-2 bg-primary text-primary-foreground">{inCart.quantity}</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart */}
      <Card className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><ShoppingCart className="h-5 w-5 text-primary" />{t("cart")}</h2>
            {lines.length > 0 && !sale && <Button variant="ghost" size="sm" onClick={reset}>{t("clearCart")}</Button>}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <PartyCombobox parties={clients} value={clientId} onChange={selectClient} placeholder={t("walkIn")} emptyLabel={t("noClient")} clearLabel={t("walkIn")} />
              </div>
              {wizard && can("clients.create") && (
                <Button variant="outline" size="icon" onClick={() => setNewClient(true)} aria-label={t("newClient")} title={t("newClient")}><UserPlus /></Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">{t("priceType")}</span>
              <PriceTypeSelect value={globalType} onChange={applyType} className="h-8" />
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed py-8 text-center text-sm text-muted-foreground">{t("cartEmpty")}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {lines.map((l, i) => {
                const p = byId.get(l.productId);
                const qty = parseAmount(l.quantity);
                const over = p && qty > p.stockQuantity;
                return (
                  <li key={l.productId} className={cn("space-y-2 p-2.5", over && "bg-warning/10")}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p ? lname(p, locale) : "—"}</div>
                        <div className="text-xs text-muted-foreground"><Money value={unitPrice(l)} /> / {p?.unitSymbol}</div>
                      </div>
                      <Money value={lineTotal(l)} className="text-sm font-semibold" />
                      <Button variant="ghost" size="icon-sm" className="-me-1 h-7 w-7 text-destructive" aria-label={tc("delete")} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border">
                        <Button variant="ghost" size="icon-sm" className="h-8 w-8" aria-label="-" onClick={() => update(i, { quantity: String(Math.max(0, round2(qty - 1))) })}><Minus /></Button>
                        <Input inputMode="decimal" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className="h-8 w-16 border-0 text-center" aria-label={t("quantity")} />
                        <Button variant="ghost" size="icon-sm" className="h-8 w-8" aria-label="+" onClick={() => update(i, { quantity: String(round2(qty + 1)) })}><Plus /></Button>
                      </div>
                      <PriceTypeSelect value={l.priceType} onChange={(v) => update(i, { priceType: v, unitPrice: null })} className="h-8 flex-1 text-xs" />
                    </div>
                    {over && <p className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5" />{t("overStock", { stock: p!.stockQuantity })}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-3 rounded-xl border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("tva")}</span>
              <span className="flex items-center gap-2">
                {tvaOn && <Input inputMode="decimal" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} className="h-8 w-16 text-end" aria-label={t("tvaRate")} />}
                {tvaOn && <span className="text-xs text-muted-foreground">%</span>}
                <Switch checked={tvaOn} onCheckedChange={setTvaOn} aria-label={t("tva")} />
              </span>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("discount")}</span>
              <Switch checked={discountOn} onCheckedChange={setDiscountOn} aria-label={t("discount")} />
            </label>
            {discountOn && (
              <div className="flex gap-2">
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as "AMOUNT" | "PERCENT")}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMOUNT">{t("discountAmount")}</SelectItem>
                    <SelectItem value="PERCENT">{t("discountPercent")}</SelectItem>
                  </SelectContent>
                </Select>
                <Input inputMode="decimal" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="h-9" placeholder="0" aria-label={t("discount")} />
              </div>
            )}
          </div>

          <div className="rounded-xl bg-secondary/50 px-3 py-2">
            <SummaryRow label={t("subtotal")}><Money value={totals.subtotal} /></SummaryRow>
            {totals.discount > 0 && <SummaryRow label={t("discount")}>−<Money value={totals.discount} /></SummaryRow>}
            {tvaOn && <SummaryRow label={`${t("tva")} (${parseAmount(tvaRate, 19)} %)`}><Money value={totals.tva} /></SummaryRow>}
            <SummaryRow label={t("total")} strong className="border-t pt-2 text-lg"><Money value={totals.total} /></SummaryRow>
          </div>

          {sale ? (
            <SummaryRow label={t("paid")}><Money value={sale.paidAmount} /></SummaryRow>
          ) : (
            <label className="block space-y-1 text-sm">
              <span>{t("amountPaid")}</span>
              <Input inputMode="decimal" value={paid ?? String(totals.total)} onChange={(e) => setPaid(e.target.value)} className="h-11 text-end text-lg font-semibold" />
            </label>
          )}
          <SummaryRow label={t("remaining")} strong className={remaining > 0 ? "text-destructive" : ""}><Money value={remaining} /></SummaryRow>
          {walkIn && remaining > 0 && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{t("errors.walkInMustPay")}</p>}
          {!walkIn && remaining > 0 && <p className="text-xs text-muted-foreground">{t("saleDebtHint")}</p>}
          {remaining < 0 && <p className="text-xs text-destructive">{t("errors.paidTooHigh")}</p>}

          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} maxLength={2000} />

          <Button className="h-12 w-full text-sm" onClick={save} disabled={blocked || busy}>
            {busy && <Loader2 className="animate-spin" />}
            {sale ? tc("save") : t("validateSale")} <span className="opacity-70">(F9)</span>
          </Button>
        </CardContent>
      </Card>

      {wizard && (
        <Dialog open={newClient} onOpenChange={setNewClient}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto" closeLabel={tc("close")}>
            <DialogHeader><DialogTitle>{t("newClient")}</DialogTitle></DialogHeader>
            {newClient && (
              <ClientWizard nextSerial={wizard.nextSerial} packs={wizard.packs} recipes={wizard.recipes} onCancel={() => setNewClient(false)}
                onCreated={(c) => {
                  const party: PartyDTO = { id: c.id, name: c.fullName, phone: c.phone, priceType: c.priceType, serial: c.serial };
                  setClients((cs) => [party, ...cs.filter((x) => x.id !== c.id)]);
                  selectClient(party);
                  setNewClient(false);
                }} />
            )}
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog open={!!askPrint} onOpenChange={(o) => { if (!o) { setAskPrint(null); reset(); } }} variant="default"
        title={t("printInvoiceQuestion")} description={askPrint?.number} confirmLabel={t("print")}
        onConfirm={() => { if (askPrint) window.open(`/print/sales/${askPrint.id}`, "_blank", "noopener"); }} />
    </div>
  );
}
