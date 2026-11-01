"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, ChefHat, Loader2, Package, Plus, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Checkbox } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Field, FieldError } from "@/components/shared/form-fields";
import { WilayaCommuneSelect } from "@/components/shared/wilaya-commune-select";
import { WhatsAppIcon } from "@/components/site/social-icons";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { createCustomOrderAction } from "@/actions/orders";
import { customOrderSchema, type CustomOrderInput } from "@/lib/order-schema";
import type { PublicProduct } from "@/lib/public-queries";
import { formatMoney, parseAmount } from "@/lib/commerce";
import { lname } from "@/lib/i18n-data";
import { normalizeSearch, whatsappLink } from "@/lib/utils";

export function CustomRecipeForm({ products, whatsappNumber }: { products: PublicProduct[]; whatsappNumber: string }) {
  const t = useTranslations("shop.custom");
  const ts = useTranslations("site");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const [done, setDone] = useState<null | { orderNumber: string; phone: string }>(null);
  const [lines, setLines] = useState<{ id: string; qty: string }[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [search, setSearch] = useState("");
  const form = useForm<CustomOrderInput>({
    resolver: zodResolver(customOrderSchema),
    defaultValues: { recipeName: "", fullName: "", phone: "", wilayaCode: "", communeName: "", items: [], message: "", wantsClientAccount: true },
  });
  const e = form.formState.errors;
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const candidates = products.filter((p) => !lines.some((l) => l.id === p.id) && (!search || normalizeSearch(`${p.name} ${p.nameAr}`).includes(normalizeSearch(search))));
  const estimate = lines.reduce((s, l) => s + (byId.get(l.id)?.price ?? 0) * parseAmount(l.qty), 0);

  // The product lines live outside react-hook-form; they are copied into `items` before validation.
  function syncItems(next: typeof lines) {
    setLines(next);
    form.setValue("items", next.map((l) => ({ type: "PRODUCT" as const, id: l.id, quantity: parseAmount(l.qty) })), { shouldValidate: form.formState.isSubmitted });
  }

  async function submit(v: CustomOrderInput) {
    const res = await createCustomOrderAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof CustomOrderInput, { message: m }));
      return feedback.error(res);
    }
    setDone({ orderNumber: res.data!.orderNumber, phone: v.phone });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card><CardContent className="space-y-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <div className="space-y-2">
            <h2 className="font-serif text-3xl font-semibold">{ts("successTitle")}</h2>
            <p className="text-muted-foreground">{ts("successText", { phone: done.phone })}</p>
          </div>
          <div className="mx-auto inline-block rounded-2xl border-2 border-dashed border-primary/40 bg-sage-soft/50 px-8 py-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{ts("successNumber")}</div>
            <div className="font-mono text-2xl font-bold text-primary" dir="ltr">{done.orderNumber}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {whatsappNumber && (
              <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <a href={whatsappLink(whatsappNumber, ts("successWhatsappMessage", { number: done.orderNumber }))} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-5 w-5" />{ts("successWhatsapp")}</a>
              </Button>
            )}
            <Button asChild size="lg" variant="outline"><Link href="/">{ts("backHome")}</Link></Button>
          </div>
        </CardContent></Card>
      </motion.div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5 p-4 sm:p-6">
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><ChefHat className="h-5 w-5 text-primary" />{t("pageTitle")}</h2>
            <Field label={t("recipeName")} htmlFor="c-name" error={e.recipeName?.message}>
              <Input id="c-name" className="h-11" placeholder={t("recipeNamePlaceholder")} {...form.register("recipeName")} aria-invalid={!!e.recipeName} />
            </Field>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("products")}</p>
                <Popover open={pickOpen} onOpenChange={(o) => { setPickOpen(o); if (o) setSearch(""); }}>
                  <PopoverTrigger asChild><Button type="button" size="sm" variant="outline"><Plus />{t("addProduct")}</Button></PopoverTrigger>
                  <PopoverContent className="w-[min(92vw,24rem)] p-2" align="end">
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input autoFocus value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder={t("searchProduct")} className="ps-9" />
                    </div>
                    <ul className="max-h-72 overflow-y-auto">
                      {candidates.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-secondary"
                            onClick={() => { syncItems([...lines, { id: p.id, qty: "1" }]); setPickOpen(false); }}>
                            {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                            <span className="min-w-0 flex-1 truncate text-sm">{lname(p, locale)}</span>
                            <span className="text-xs font-semibold text-primary">{formatMoney(p.price, locale)} / {p.unitSymbol}</span>
                          </button>
                        </li>
                      ))}
                      {candidates.length === 0 && <li className="p-3 text-center text-sm text-muted-foreground">{ts("form.noMatch")}</li>}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
              {lines.length === 0 ? (
                <button type="button" onClick={() => setPickOpen(true)} className="w-full rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm text-muted-foreground hover:border-primary/50">{t("noProducts")}</button>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {lines.map((l, idx) => {
                    const p = byId.get(l.id);
                    if (!p) return null;
                    return (
                      <li key={l.id} className="flex items-center gap-3 p-2.5 sm:p-3">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{lname(p, locale)}</div>
                          <div className="text-xs text-muted-foreground">{formatMoney(p.price, locale)} / {p.unitSymbol}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input inputMode="decimal" dir="ltr" value={l.qty} aria-label={ts("form.quantity")}
                            onChange={(ev) => syncItems(lines.map((x, j) => (j === idx ? { ...x, qty: ev.target.value } : x)))} className="h-9 w-20 text-center" />
                          <span className="w-8 text-xs text-muted-foreground">{p.unitSymbol}</span>
                        </div>
                        <button type="button" onClick={() => syncItems(lines.filter((_, j) => j !== idx))} className="rounded p-1.5 text-muted-foreground hover:text-destructive" aria-label={ts("form.remove")}><Trash2 className="h-4 w-4" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <FieldError message={(e.items as { message?: string } | undefined)?.message ?? (e.items as { root?: { message?: string } } | undefined)?.root?.message} />
            </div>
            <Field label={t("notes")} htmlFor="c-notes" error={e.message?.message}>
              <Textarea id="c-notes" rows={3} placeholder={t("notesPlaceholder")} {...form.register("message")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 p-4 sm:p-6">
            <h2 className="font-serif text-xl font-semibold">{ts("form.yourDetails")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ts("form.fullName")} htmlFor="c-full" error={e.fullName?.message}>
                <Input id="c-full" autoComplete="name" className="h-11" placeholder={ts("form.fullNamePlaceholder")} {...form.register("fullName")} aria-invalid={!!e.fullName} />
              </Field>
              <Field label={ts("form.phone")} htmlFor="c-phone" error={e.phone?.message}>
                <Input id="c-phone" type="tel" autoComplete="tel" dir="ltr" className="h-11" placeholder={ts("form.phonePlaceholder")} {...form.register("phone")} aria-invalid={!!e.phone} />
              </Field>
            </div>
            <div className="space-y-1">
              <Controller control={form.control} name="wilayaCode" render={({ field: wf }) => (
                <Controller control={form.control} name="communeName" render={({ field: cf }) => (
                  <WilayaCommuneSelect ids={{ wilaya: "c-wilaya", commune: "c-commune" }} wilaya={wf.value} commune={cf.value}
                    onWilayaChange={(v) => { wf.onChange(v); form.clearErrors("wilayaCode"); }}
                    onCommuneChange={(v) => { cf.onChange(v); if (v) form.clearErrors("communeName"); }}
                    wilayaError={!!e.wilayaCode} communeError={!!e.communeName} />
                )} />
              )} />
              <div className="grid gap-4 sm:grid-cols-2"><FieldError message={e.wilayaCode?.message} /><FieldError message={e.communeName?.message} /></div>
            </div>
            <Controller control={form.control} name="wantsClientAccount" render={({ field }) => (
              <label htmlFor="c-account" className="flex cursor-pointer items-start gap-3 rounded-xl border bg-sage-soft/40 p-4">
                <Checkbox id="c-account" checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
                <span><span className="block font-medium">{ts("form.wantsAccount")}</span><span className="text-sm text-muted-foreground">{ts("form.wantsAccountHint")}</span></span>
              </label>
            )} />
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-24 lg:self-start">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <h2 className="font-serif text-xl font-semibold">{ts("form.summary")}</h2>
          <ul className="space-y-1.5 text-sm">
            {lines.map((l) => {
              const p = byId.get(l.id);
              return p ? (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="truncate text-muted-foreground">{l.qty} {p.unitSymbol} × {lname(p, locale)}</span>
                  <span className="shrink-0">{formatMoney(p.price * parseAmount(l.qty), locale)}</span>
                </li>
              ) : null;
            })}
          </ul>
          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold"><span>{t("estimate")}</span><span className="text-primary">{formatMoney(estimate, locale)}</span></div>
          <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="flip-rtl" />}{t("submit")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{ts("form.privacy")}</p>
        </CardContent>
      </Card>
    </form>
  );
}
