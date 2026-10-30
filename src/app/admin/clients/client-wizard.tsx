"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Info, Loader2, MapPin, Phone, RefreshCw, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Field } from "@/components/shared/form-fields";
import { Stepper } from "@/components/shared/stepper";
import { CopyButton } from "@/components/shared/copy-button";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { PriceTypeSelect } from "@/components/commerce/price-type-select";
import { checkUsernameAction, createClientAction } from "@/actions/clients";
import type { PriceType } from "@/lib/commerce";
import { clientInfoSchema, credentialsSchema } from "@/lib/client-schemas";
import type { RecipeLiteDTO } from "@/lib/dto";
import { lname } from "@/lib/i18n-data";
import { defaultCredential, padSerial } from "@/lib/utils";
import { CredentialsCard } from "./credentials-card";
import { PermissionsEditor, stateToPermissions, type PackWithRecipes, type PermissionState } from "./permissions-editor";

const wizardSchema = clientInfoSchema.merge(credentialsSchema);
type WizardValues = { fullName: string; phone: string; address: string; priceType: PriceType; username: string; password: string; credentialsAuto: boolean };
export type CreatedClient = { id: string; serial: number; username: string; password: string; fullName: string; phone: string; priceType: PriceType };

export function ClientWizard({
  nextSerial, packs, recipes, prefill, onCreated, onCancel,
}: {
  nextSerial: number;
  packs: PackWithRecipes[];
  recipes: RecipeLiteDTO[];
  prefill?: { fullName?: string; phone?: string; orderNumber?: string; recipeId?: string | null; packId?: string | null };
  /** Embedded use (e.g. point of sale): called with the new client instead of the "what next" links. */
  onCreated?: (client: CreatedClient) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useActionFeedback();
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [direction, setDirection] = useState(1);
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<null | CreatedClient>(null);

  // Pre-select the pack/recipe requested in the originating order.
  const initialPerms = useMemo<PermissionState>(() => {
    const pack = packs.find((p) => p.id === prefill?.packId);
    if (pack) return { packs: [pack.id], recipes: Object.fromEntries(pack.recipeIds.map((id) => [id, pack.id])) };
    if (prefill?.recipeId) return { packs: [], recipes: { [prefill.recipeId]: null } };
    return { packs: [], recipes: {} };
  }, [packs, prefill]);
  const [perms, setPerms] = useState<PermissionState>(initialPerms);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: { fullName: prefill?.fullName ?? "", phone: prefill?.phone ?? "", address: "", priceType: "DETAIL", username: "", password: "", credentialsAuto: true },
    mode: "onTouched",
  });
  const values = form.watch();
  const e = form.formState.errors;
  const formula = defaultCredential(values.fullName || "", nextSerial);

  // Keep generated credentials in sync with the name while they are untouched.
  useEffect(() => {
    if (form.getValues("credentialsAuto")) {
      form.setValue("username", formula);
      form.setValue("password", formula);
    }
  }, [formula, form]);

  // Debounced uniqueness check.
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!values.username) return setUsernameState("idle");
    setUsernameState("checking");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await checkUsernameAction(values.username);
      setUsernameState(res.ok && res.data?.available ? "ok" : "taken");
    }, 400);
    return () => clearTimeout(timer.current);
  }, [values.username]);

  const steps = [
    { key: "info", title: t("steps.info"), hint: t("steps.infoHint") },
    { key: "credentials", title: t("steps.credentials"), hint: t("steps.credentialsHint") },
    { key: "permissions", title: t("steps.permissions"), hint: t("steps.permissionsHint") },
    { key: "review", title: t("steps.review"), hint: t("steps.reviewHint") },
  ];
  const stepFields: (keyof WizardValues)[][] = [["fullName", "phone", "address", "priceType"], ["username", "password"], [], []];

  async function goTo(target: number) {
    if (target > step) {
      for (let s = step; s < target; s++) {
        const ok = await form.trigger(stepFields[s]);
        if (!ok || (s === 1 && usernameState === "taken")) {
          if (s === 1 && usernameState === "taken") form.setError("username", { message: "validation.usernameTaken" });
          setStep(s);
          return;
        }
      }
    }
    setDirection(target > step ? 1 : -1);
    setStep(target);
    setMaxReached((m) => Math.max(m, target));
  }

  async function submit() {
    setSubmitting(true);
    const v = form.getValues();
    const res = await createClientAction({ ...v, permissions: stateToPermissions(perms) });
    setSubmitting(false);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof WizardValues, { message: m }));
      if (res.fieldErrors?.username) setStep(1);
      return feedback.error(res);
    }
    toast.success(t("created", { name: res.data!.fullName }));
    setCreated(res.data!);
    router.refresh();
  }

  if (created) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
        <Card>
          <CardContent className="space-y-6 pt-8 text-center sm:pt-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-9 w-9" />
            </motion.div>
            <div>
              <h2 className="font-serif text-2xl font-semibold">{t("successTitle")}</h2>
              <p className="mt-1 text-muted-foreground">{created.fullName} · #{padSerial(created.serial)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("successText")}</p>
            </div>
            <div className="text-start"><CredentialsCard {...created} /></div>
            {onCreated ? (
              <Button onClick={() => onCreated(created)}><CheckCircle2 />{t("useThisClient")}</Button>
            ) : <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline"><Link href="/admin/clients">{t("backToList")}</Link></Button>
              <Button asChild variant="outline"><Link href={`/admin/clients/${created.id}`}>{t("viewClient")}</Link></Button>
              <Button onClick={() => window.location.assign("/admin/clients/new")}><UserPlus />{t("createAnother")}</Button>
            </div>}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const permCount = Object.keys(perms.recipes).length;
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (step === 3) submit(); else goTo(step + 1); }} className="space-y-6" noValidate>
      {prefill?.orderNumber && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-sage-soft/50 px-4 py-3 text-sm">
          <Info className="h-4 w-4 text-primary" />{t("fromOrder", { number: prefill.orderNumber })}
        </div>
      )}
      <Card className="p-4 sm:p-5"><Stepper steps={steps} current={step} maxReached={maxReached} onStepClick={goTo} /></Card>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div key={step} initial={{ opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -24 }} transition={{ duration: 0.25 }}>
          <Card>
            <CardContent className="pt-6 sm:pt-6">
              {step === 0 && (
                <div className="grid max-w-2xl gap-5">
                  <Field label={t("fullName")} htmlFor="c-name" error={e.fullName?.message}>
                    <Input id="c-name" placeholder={t("fullNamePlaceholder")} autoComplete="off" {...form.register("fullName")} aria-invalid={!!e.fullName} autoFocus />
                  </Field>
                  <Field label={t("phone")} htmlFor="c-phone" error={e.phone?.message}>
                    <Input id="c-phone" type="tel" dir="ltr" placeholder={t("phonePlaceholder")} {...form.register("phone")} aria-invalid={!!e.phone} />
                  </Field>
                  <Field label={t("address")} htmlFor="c-address" optional optionalLabel={tc("optional")} error={e.address?.message}>
                    <Textarea id="c-address" rows={2} placeholder={t("addressPlaceholder")} {...form.register("address")} />
                  </Field>
                  <Field label={t("priceType")} htmlFor="c-price-type" hint={t("priceTypeHint")}>
                    <Controller control={form.control} name="priceType" render={({ field }) => <PriceTypeSelect id="c-price-type" value={field.value} onChange={field.onChange} />} />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="max-w-2xl space-y-5">
                  <div className="flex gap-3 rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{t("credentialsHelp")}</p>
                      <p className="mt-1 font-semibold">{t("serialPreview", { serial: padSerial(nextSerial) })}</p>
                      <p className="text-xs opacity-80">{t("serialPreviewHint")}</p>
                    </div>
                  </div>
                  <Field label={t("username")} htmlFor="c-username" error={e.username?.message}
                    hint={usernameState === "ok" ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" />{t("usernameAvailable")}</span>
                      : usernameState === "checking" ? t("checking") : undefined}>
                    <div className="flex gap-2">
                      <Input id="c-username" dir="ltr" className="font-mono" autoComplete="off" {...form.register("username", { onChange: () => form.setValue("credentialsAuto", false) })} aria-invalid={!!e.username || usernameState === "taken"} />
                      <CopyButton text={values.username} label={t("copyUsername")} className="h-10 w-10 shrink-0 rounded-lg" />
                    </div>
                    {usernameState === "taken" && !e.username && <p className="flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="h-3.5 w-3.5" />{feedback.message("validation.usernameTaken")}</p>}
                  </Field>
                  <Field label={t("password")} htmlFor="c-password" error={e.password?.message}
                    hint={values.password === values.username ? t("sameAsUsername") : undefined}>
                    <div className="flex gap-2">
                      <Input id="c-password" dir="ltr" className="font-mono" autoComplete="new-password" {...form.register("password", { onChange: () => form.setValue("credentialsAuto", false) })} aria-invalid={!!e.password} />
                      <CopyButton text={values.password} label={t("copyPassword")} className="h-10 w-10 shrink-0 rounded-lg" />
                    </div>
                  </Field>
                  <Button type="button" variant="outline" onClick={() => {
                    form.setValue("credentialsAuto", true);
                    form.setValue("username", formula, { shouldValidate: true });
                    form.setValue("password", formula, { shouldValidate: true });
                  }}>
                    <RefreshCw />{t("regenerate")}
                  </Button>
                </div>
              )}

              {step === 2 && <PermissionsEditor packs={packs} recipes={recipes} value={perms} onChange={setPerms} />}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-serif text-xl font-semibold">{t("reviewTitle")}</h2>
                    <p className="text-sm text-muted-foreground">{t("reviewText")}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 rounded-xl border p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("steps.info")}</div>
                      <div className="font-serif text-lg font-semibold">{values.fullName}</div>
                      <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{values.phone}</span></div>
                      {values.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{values.address}</div>}
                    </div>
                    <div className="space-y-2 rounded-xl border p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("steps.credentials")}</div>
                      <div className="text-sm">{t("username")} : <span className="font-mono font-semibold" dir="ltr">{values.credentialsAuto ? formula : values.username}</span></div>
                      <div className="text-sm">{t("password")} : <span className="font-mono font-semibold" dir="ltr">{values.credentialsAuto ? formula : values.password}</span></div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("permittedRecipes")} ({permCount})</div>
                    {permCount === 0 ? <p className="text-sm text-warning">{t("noPermissions")}</p> : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(perms.recipes).map(([rid, pid]) => {
                          const r = recipeMap.get(rid);
                          const p = packs.find((x) => x.id === pid);
                          return r ? (
                            <span key={rid} className="rounded-full border bg-background px-3 py-1 text-sm">
                              {lname(r, locale)}{p && <span className="text-xs text-muted-foreground"> · {lname(p, locale)}</span>}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => (step === 0 ? (onCancel ? onCancel() : router.back()) : goTo(step - 1))}>
          <ArrowLeft className="flip-rtl" />{step === 0 ? tc("cancel") : tc("previous")}
        </Button>
        {step < 3 ? (
          <Button type="submit">{tc("next")}<ArrowRight className="flip-rtl" /></Button>
        ) : (
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {submitting ? t("creating") : t("createAccount")}
          </Button>
        )}
      </div>
    </form>
  );
}
