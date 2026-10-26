"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/basic";
import { Field } from "@/components/shared/form-fields";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { changeOwnPasswordAction } from "@/actions/portal";
import { passwordField, V } from "@/lib/validators";

const schema = z
  .object({ currentPassword: z.string().min(1, V.required), newPassword: passwordField, confirmPassword: z.string().min(1, V.required) })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: V.passwordMismatch });
type Values = z.infer<typeof schema>;

export function PasswordForm() {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const e = form.formState.errors;

  async function submit(v: Values) {
    const res = await changeOwnPasswordAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof Values, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("passwordChanged"));
    form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label={t("currentPassword")} htmlFor="pw-current" error={e.currentPassword?.message}>
        <Input id="pw-current" type="password" autoComplete="current-password" {...form.register("currentPassword")} aria-invalid={!!e.currentPassword} />
      </Field>
      <Field label={t("newPassword")} htmlFor="pw-new" error={e.newPassword?.message}>
        <Input id="pw-new" type="password" autoComplete="new-password" {...form.register("newPassword")} aria-invalid={!!e.newPassword} />
      </Field>
      <Field label={t("confirmPassword")} htmlFor="pw-confirm" error={e.confirmPassword?.message}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" {...form.register("confirmPassword")} aria-invalid={!!e.confirmPassword} />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}{tc("save")}
      </Button>
    </form>
  );
}
