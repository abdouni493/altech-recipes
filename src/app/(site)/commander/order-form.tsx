"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Checkbox } from "@/components/ui/primitives";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Field, FieldError } from "@/components/shared/form-fields";
import { WilayaCommuneSelect } from "@/components/shared/wilaya-commune-select";
import { WhatsAppIcon } from "@/components/site/social-icons";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { createOrderAction } from "@/actions/orders";
import { orderSchema, type OrderInput } from "@/lib/order-schema";
import { whatsappLink } from "@/lib/utils";

type Opt = { value: string; label: string };
const NONE = "__none__";

export function OrderForm({ recipes, packs, initialItem, whatsappNumber }: { recipes: Opt[]; packs: Opt[]; initialItem: string; whatsappNumber: string }) {
  const t = useTranslations("site");
  const feedback = useActionFeedback();
  const [done, setDone] = useState<null | { orderNumber: string; phone: string }>(null);
  const form = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: { fullName: "", phone: "", wilayaCode: "", communeName: "", item: initialItem, message: "", wantsClientAccount: true },
  });
  const e = form.formState.errors;

  async function submit(v: OrderInput) {
    const res = await createOrderAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof OrderInput, { message: m }));
      return feedback.error(res);
    }
    setDone({ orderNumber: res.data!.orderNumber, phone: v.phone });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
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

  return (
    <Card className="mt-10">
      <CardContent className="pt-6 sm:p-8">
        <form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
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
          <Field label={t("form.item")} htmlFor="o-item">
            <Controller control={form.control} name="item" render={({ field }) => (
              <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                <SelectTrigger id="o-item" className="h-11"><SelectValue placeholder={t("form.itemPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("form.itemNone")}</SelectItem>
                  {packs.length > 0 && (
                    <SelectGroup>
                      <DropdownMenuLabelShim>{t("form.packsGroup")}</DropdownMenuLabelShim>
                      {packs.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectGroup>
                  )}
                  {recipes.length > 0 && (
                    <SelectGroup>
                      <DropdownMenuLabelShim>{t("form.recipesGroup")}</DropdownMenuLabelShim>
                      {recipes.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )} />
          </Field>
          <Field label={t("form.message")} htmlFor="o-message" error={e.message?.message}>
            <Textarea id="o-message" rows={4} placeholder={t("form.messagePlaceholder")} {...form.register("message")} />
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
          <div className="space-y-3">
            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="flip-rtl" />}
              {form.formState.isSubmitting ? t("form.submitting") : t("form.submit")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("form.privacy")}</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DropdownMenuLabelShim({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
