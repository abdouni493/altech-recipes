"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Field } from "@/components/shared/form-fields";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { PriceTypeSelect } from "@/components/commerce/price-type-select";
import { updateClientAction } from "@/actions/clients";
import type { PriceType } from "@/lib/commerce";
import { clientInfoSchema } from "@/lib/client-schemas";
import { usernameField } from "@/lib/validators";

const schema = clientInfoSchema.extend({ username: usernameField });
type Values = { fullName: string; phone: string; address: string; username: string; priceType: PriceType };

export function ClientEditForm({ id, initial }: { id: string; userId: string; initial: Values }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const feedback = useActionFeedback();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const e = form.formState.errors;

  async function submit(v: Values) {
    const res = await updateClientAction(id, v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof Values, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("updated"));
    router.push(`/admin/clients/${id}`);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6 sm:pt-6">
        <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
          <Field label={t("fullName")} htmlFor="e-name" error={e.fullName?.message}>
            <Input id="e-name" {...form.register("fullName")} aria-invalid={!!e.fullName} />
          </Field>
          <Field label={t("phone")} htmlFor="e-phone" error={e.phone?.message}>
            <Input id="e-phone" type="tel" dir="ltr" {...form.register("phone")} aria-invalid={!!e.phone} />
          </Field>
          <Field label={t("address")} htmlFor="e-address" optional optionalLabel={tc("optional")}>
            <Textarea id="e-address" rows={2} {...form.register("address")} />
          </Field>
          <Field label={t("priceType")} htmlFor="e-price-type" hint={t("priceTypeHint")}>
            <Controller control={form.control} name="priceType" render={({ field }) => <PriceTypeSelect id="e-price-type" value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label={t("username")} htmlFor="e-username" error={e.username?.message}>
            <Input id="e-username" dir="ltr" className="font-mono" {...form.register("username")} aria-invalid={!!e.username} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>{tc("cancel")}</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}{tc("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
