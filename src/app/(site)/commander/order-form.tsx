"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Boxes, CheckCircle2, Loader2, Minus, Package, Plus, Send, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Checkbox } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Field, FieldError } from "@/components/shared/form-fields";
import { WilayaCommuneSelect } from "@/components/shared/wilaya-commune-select";
import { WhatsAppIcon } from "@/components/site/social-icons";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { createOrderAction, recipeProductsAction } from "@/actions/orders";
import { orderSchema, type OrderInput } from "@/lib/order-schema";
import { formatMoney } from "@/lib/commerce";
import { lname } from "@/lib/i18n-data";
import { useSiteCart, type CartItemType } from "@/lib/site-cart";
import type { PublicRecipeProduct } from "@/lib/public-queries";
import { cn, whatsappLink } from "@/lib/utils";

export type CatalogItem = { type: CartItemType; id: string; name: string; nameAr: string; imageUrl: string | null; price: number | null; out: boolean };

const ICONS = { RECIPE: BookOpen, PACK: Boxes, PRODUCT: Package } as const;

export function OrderForm({ catalog, initial, whatsappNumber }: {
  catalog: CatalogItem[]; initial: { type: CartItemType; id: string } | null; whatsappNumber: string;
}) {
  const t = useTranslations("site");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const cart = useSiteCart();
  const [done, setDone] = useState<null | { orderNumber: string; phone: string; total: number }>(null);
  const [suggest, setSuggest] = useState<{ recipeName: string; products: PublicRecipeProduct[]; picked: Set<string> } | null>(null);
  const form = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: { fullName: "", phone: "", wilayaCode: "", communeName: "", items: [], message: "", wantsClientAccount: true },
  });
  const e = form.formState.errors;
  const key = (type: string, id: string) => `${type}:${id}`;
  const byKey = useMemo(() => new Map(catalog.map((c) => [key(c.type, c.id), c])), [catalog]);

  // Only keep basket lines that still exist in the catalog.
  const lines = cart.items.flatMap((i) => {
    const item = byKey.get(key(i.type, i.id));
    return item ? [{ ...i, item }] : [];
  });
  const total = lines.reduce((s, l) => s + (l.item.price ?? 0) * l.quantity, 0);
  const hasUnpriced = lines.some((l) => l.item.price === null);

  async function proposeProducts(recipe: CatalogItem) {
    const res = await recipeProductsAction(recipe.id);
    const products = (res.ok ? res.data ?? [] : []).filter((p) => !p.isOutOfStock && !cart.items.some((i) => i.type === "PRODUCT" && i.id === p.id));
    if (products.length) setSuggest({ recipeName: lname(recipe, locale), products, picked: new Set(products.map((p) => p.id)) });
  }

  function addItem(type: CartItemType, id: string) {
    const item = byKey.get(key(type, id));
    if (!item || item.out) return;
    cart.add(type, id);
    if (type === "RECIPE") proposeProducts(item);
  }

  // ?recipe= / ?pack= / ?product= links add their item once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initial) return;
    started.current = true;
    const already = cart.items.some((i) => i.type === initial.type && i.id === initial.id);
    if (!already) addItem(initial.type, initial.id);
    else if (initial.type === "RECIPE") { const r = byKey.get(key("RECIPE", initial.id)); if (r) proposeProducts(r); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function setQty(type: CartItemType, id: string, quantity: number) {
    cart.set(quantity <= 0 ? cart.items.filter((i) => !(i.type === type && i.id === id)) : cart.items.map((i) => (i.type === type && i.id === id ? { ...i, quantity } : i)));
  }

  function acceptSuggestion() {
    if (!suggest) return;
    const next = [...cart.items];
    for (const id of Array.from(suggest.picked)) if (!next.some((i) => i.type === "PRODUCT" && i.id === id)) next.push({ type: "PRODUCT", id, quantity: 1 });
    cart.set(next);
    setSuggest(null);
  }

  async function submit(v: OrderInput) {
    const items = lines.map((l) => ({ type: l.type, id: l.id, quantity: l.quantity }));
    const res = await createOrderAction({ ...v, items });
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof OrderInput, { message: m }));
      return feedback.error(res);
    }
    setDone({ orderNumber: res.data!.orderNumber, phone: v.phone, total });
    cart.clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-3xl">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 py-12 text-center sm:py-14">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.15 }}
              className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-11 w-11" />
            </motion.div>
            <div className="space-y-2">
              <h2 className="font-serif text-3xl font-semibold">{t("successTitle")}</h2>
              <p className="text-muted-foreground">{t("successText", { phone: done.phone })}</p>
            </div>
            <div className="mx-auto inline-block rounded-2xl border-2 border-dashed border-primary/40 bg-sage-soft/50 px-8 py-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("successNumber")}</div>
              <div className="font-mono text-2xl font-bold text-primary" dir="ltr">{done.orderNumber}</div>
              {done.total > 0 && <div className="mt-1 text-sm text-muted-foreground">{t("orderTotal")} : {formatMoney(done.total, locale)}</div>}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {whatsappNumber && (
                <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                  <a href={whatsappLink(whatsappNumber, t("successWhatsappMessage", { number: done.orderNumber }))} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="h-5 w-5" />{t("successWhatsapp")}
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="outline"><Link href="/">{t("backHome")}</Link></Button>
              <Button size="lg" variant="ghost" onClick={() => { form.reset(); setDone(null); }}>{t("newOrder")}</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const groups: { type: CartItemType; label: string }[] = [
    { type: "RECIPE", label: t("form.addRecipe") }, { type: "PACK", label: t("form.addPack") }, { type: "PRODUCT", label: t("form.addProduct") },
  ];

  return (
    <form onSubmit={form.handleSubmit(submit)} className="mt-10 grid gap-6 lg:grid-cols-[1fr_22rem]" noValidate>
      <div className="space-y-6">
        {/* Basket */}
        <Card>
          <CardContent className="space-y-4 pt-6 sm:p-6">
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><ShoppingBag className="h-5 w-5 text-primary" />{t("form.basket")}</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {groups.map((g) => {
                const options = catalog.filter((c) => c.type === g.type);
                if (!options.length) return null;
                return (
                  <Select key={g.type} value="" onValueChange={(id) => addItem(g.type, id)}>
                    <SelectTrigger className="h-11" aria-label={g.label}><SelectValue placeholder={<span className="flex items-center gap-2"><Plus className="h-4 w-4" />{g.label}</span>} /></SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.id} value={o.id} disabled={o.out}>
                          {lname(o, locale)}{o.price !== null ? ` — ${formatMoney(o.price, locale)}` : ""}{o.out ? ` (${t("outOfStock")})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })}
            </div>

            <AnimatePresence>
              {suggest && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl border-2 border-primary/30 bg-sage-soft/40">
                  <div className="space-y-3 p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="flex-1">
                        <p className="font-semibold">{t("form.suggestTitle", { recipe: suggest.recipeName })}</p>
                        <p className="text-sm text-muted-foreground">{t("form.suggestText")}</p>
                      </div>
                      <button type="button" onClick={() => setSuggest(null)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t("form.suggestNo")}><X className="h-4 w-4" /></button>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {suggest.products.map((p) => (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-2">
                            <Checkbox checked={suggest.picked.has(p.id)} onCheckedChange={(c) => setSuggest((s) => {
                              if (!s) return s;
                              const picked = new Set(s.picked);
                              if (c === true) picked.add(p.id); else picked.delete(p.id);
                              return { ...s, picked };
                            })} />
                            {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                            <span className="min-w-0 flex-1 truncate text-sm">{lname(p, locale)}</span>
                            <span className="text-sm font-semibold text-primary">{formatMoney(p.price, locale)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSuggest(null)}>{t("form.suggestNo")}</Button>
                      <Button type="button" size="sm" onClick={acceptSuggestion} disabled={suggest.picked.size === 0}><Plus />{t("form.suggestYes", { count: suggest.picked.size })}</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {lines.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {t("form.basketEmpty")} <Link href="/produits" className="font-semibold text-primary hover:underline">{t("form.browseProducts")}</Link>
              </div>
            ) : (
              <ul className="divide-y rounded-xl border">
                {lines.map((l) => {
                  const Icon = ICONS[l.type];
                  return (
                    <li key={key(l.type, l.id)} className="flex items-center gap-3 p-3">
                      {l.item.imageUrl ? <img src={l.item.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{lname(l.item, locale)}</div>
                        <div className="text-xs text-muted-foreground">{t(`form.type.${l.type}`)} · {l.item.price !== null ? formatMoney(l.item.price, locale) : t("form.priceOnRequest")}</div>
                      </div>
                      <div className="flex items-center rounded-lg border">
                        <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => setQty(l.type, l.id, l.quantity - 1)} aria-label="-"><Minus className="h-3.5 w-3.5" /></button>
                        <Input inputMode="numeric" value={l.quantity} onChange={(ev) => setQty(l.type, l.id, Math.max(1, Math.min(10000, Number(ev.target.value) || 1)))}
                          className="h-8 w-12 border-0 px-1 text-center" aria-label={t("form.quantity")} />
                        <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => setQty(l.type, l.id, l.quantity + 1)} aria-label="+"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="hidden w-28 text-end text-sm font-semibold sm:block">{l.item.price !== null ? formatMoney(l.item.price * l.quantity, locale) : "—"}</div>
                      <button type="button" onClick={() => setQty(l.type, l.id, 0)} className="rounded p-1.5 text-muted-foreground hover:text-destructive" aria-label={t("form.remove")}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Customer */}
        <Card>
          <CardContent className="space-y-6 pt-6 sm:p-6">
            <h2 className="font-serif text-xl font-semibold">{t("form.yourDetails")}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("form.fullName")} htmlFor="o-name" error={e.fullName?.message}>
                <Input id="o-name" autoComplete="name" className="h-11" placeholder={t("form.fullNamePlaceholder")} {...form.register("fullName")} aria-invalid={!!e.fullName} />
              </Field>
              <Field label={t("form.phone")} htmlFor="o-phone" error={e.phone?.message}>
                <Input id="o-phone" type="tel" autoComplete="tel" dir="ltr" className="h-11" placeholder={t("form.phonePlaceholder")} {...form.register("phone")} aria-invalid={!!e.phone} />
              </Field>
            </div>
            <div className="space-y-1">
              <Controller control={form.control} name="wilayaCode" render={({ field: wf }) => (
                <Controller control={form.control} name="communeName" render={({ field: cf }) => (
                  <WilayaCommuneSelect ids={{ wilaya: "o-wilaya", commune: "o-commune" }}
                    wilaya={wf.value} commune={cf.value}
                    onWilayaChange={(v) => { wf.onChange(v); form.clearErrors("wilayaCode"); }}
                    onCommuneChange={(v) => { cf.onChange(v); if (v) form.clearErrors("communeName"); }}
                    wilayaError={!!e.wilayaCode} communeError={!!e.communeName} />
                )} />
              )} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldError message={e.wilayaCode?.message} />
                <FieldError message={e.communeName?.message} />
              </div>
            </div>
            <Field label={t("form.message")} htmlFor="o-message" error={e.message?.message}>
              <Textarea id="o-message" rows={3} placeholder={t("form.messagePlaceholder")} {...form.register("message")} />
            </Field>
            <Controller control={form.control} name="wantsClientAccount" render={({ field }) => (
              <label htmlFor="o-account" className="flex cursor-pointer items-start gap-3 rounded-xl border bg-sage-soft/40 p-4">
                <Checkbox id="o-account" checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{t("form.wantsAccount")}</span>
                  <span className="text-sm text-muted-foreground">{t("form.wantsAccountHint")}</span>
                </span>
              </label>
            )} />
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="lg:sticky lg:top-24 lg:self-start">
        <CardContent className="space-y-4 pt-6 sm:p-6">
          <h2 className="font-serif text-xl font-semibold">{t("form.summary")}</h2>
          <ul className="space-y-1.5 text-sm">
            {lines.map((l) => (
              <li key={key(l.type, l.id)} className="flex justify-between gap-3">
                <span className="truncate text-muted-foreground">{l.quantity} × {lname(l.item, locale)}</span>
                <span className="shrink-0">{l.item.price !== null ? formatMoney(l.item.price * l.quantity, locale) : "—"}</span>
              </li>
            ))}
            {lines.length === 0 && <li className="text-muted-foreground">{t("form.basketEmpty")}</li>}
          </ul>
          <div className={cn("flex items-center justify-between border-t pt-3 text-lg font-bold")}>
            <span>{t("orderTotal")}</span><span className="text-primary">{formatMoney(total, locale)}</span>
          </div>
          {hasUnpriced && <p className="text-xs text-muted-foreground">{t("form.unpricedHint")}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="flip-rtl" />}
            {form.formState.isSubmitting ? t("form.submitting") : t("form.submit")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("form.privacy")}</p>
        </CardContent>
      </Card>
    </form>
  );
}
