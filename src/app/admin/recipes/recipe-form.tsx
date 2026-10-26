"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Beaker, Eye, EyeOff, Languages, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Input, Textarea } from "@/components/ui/basic";
import { Switch } from "@/components/ui/primitives";
import { Field, FieldError } from "@/components/shared/form-fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { ProductCombobox } from "@/components/shared/product-combobox";
import { Stepper } from "@/components/shared/stepper";
import { Thumb } from "@/components/shared/thumb";
import { UnitSelect, useUnits } from "@/components/shared/units";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { saveRecipeAction } from "@/actions/recipes";
import { recipeSchema, type RecipeInput } from "@/lib/schemas";
import type { ProductDTO } from "@/lib/dto";
import { ldesc, lname } from "@/lib/i18n-data";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEP_FIELDS: (keyof RecipeInput)[][] = [
  ["name", "nameAr", "description", "descriptionAr", "imageUrl"],
  ["ingredients"],
  ["outputQuantity", "outputUnitId"],
  [],
];

export function RecipeForm({ products, initial, recipeId }: { products: ProductDTO[]; initial?: RecipeInput; recipeId?: string }) {
  const t = useTranslations("recipes");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useActionFeedback();
  const { units } = useUnits();
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(recipeId ? 3 : 0);
  const [showAr, setShowAr] = useState(Boolean(initial?.nameAr || initial?.descriptionAr));
  const [direction, setDirection] = useState(1);

  const form = useForm<RecipeInput>({
    resolver: zodResolver(recipeSchema),
    defaultValues: initial ?? {
      name: "", nameAr: "", description: "", descriptionAr: "", imageUrl: null, isVisibleOnWebsite: true,
      ingredients: [], outputQuantity: "" as unknown as number, outputUnitId: units.find((u) => u.symbol === "L")?.id ?? "",
    },
    mode: "onTouched",
  });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "ingredients" });
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const values = form.watch();
  const errors = form.formState.errors;

  const steps = [
    { key: "info", title: t("steps.info"), hint: t("steps.infoHint") },
    { key: "ingredients", title: t("steps.ingredients"), hint: t("steps.ingredientsHint") },
    { key: "output", title: t("steps.output"), hint: t("steps.outputHint") },
    { key: "summary", title: t("steps.summary"), hint: t("steps.summaryHint") },
  ];

  async function goTo(target: number) {
    if (target > step) {
      for (let s = step; s < target; s++) {
        const ok = await form.trigger(STEP_FIELDS[s] as never);
        if (!ok) {
          setStep(s);
          toast.error(t("missingStep"));
          return;
        }
      }
    }
    setDirection(target > step ? 1 : -1);
    setStep(target);
    setMaxReached((m) => Math.max(m, target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(v: RecipeInput) {
    const res = await saveRecipeAction(recipeId ?? null, v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as never, { message: m }));
      return feedback.error(res);
    }
    toast.success(recipeId ? t("updated", { name: res.data!.name }) : t("created", { name: res.data!.name }));
    router.push(`/admin/recipes/${res.data!.id}`);
    router.refresh();
  }

  const ingredientsError = (errors.ingredients as { root?: { message?: string }; message?: string } | undefined);
  const outUnit = unitMap.get(values.outputUnitId);
  const outQty = Number(String(values.outputQuantity ?? "").replace(",", "."));

  return (
    <form onSubmit={form.handleSubmit(submit, () => toast.error(t("missingStep")))} className="space-y-6" noValidate
      onKeyDown={(e) => {
        // Enter in a field moves to the next step instead of submitting early.
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && step < 3 && e.currentTarget.contains(e.target as Node)) {
          e.preventDefault();
          goTo(step + 1);
        }
      }}>
      <Card className="p-4 sm:p-5"><Stepper steps={steps} current={step} maxReached={maxReached} onStepClick={goTo} /></Card>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div key={step} custom={direction}
          initial={{ opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}>
          {step === 0 && (
            <Card>
              <CardContent className="grid gap-6 pt-6 sm:pt-6 md:grid-cols-[280px_1fr]">
                <Field label={t("image")} htmlFor="recipe-image">
                  <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUpload id="recipe-image" bucket="recipes" preset="product" value={field.value} onChange={field.onChange} />} />
                </Field>
                <div className="space-y-5">
                  <Field label={t("name")} htmlFor="recipe-name" error={errors.name?.message}>
                    <Input id="recipe-name" placeholder={t("namePlaceholder")} {...form.register("name")} aria-invalid={!!errors.name} />
                  </Field>
                  <Field label={t("description")} htmlFor="recipe-description" optional optionalLabel={tc("optional")} error={errors.description?.message}>
                    <Textarea id="recipe-description" rows={5} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />
                  </Field>
                  <div className="flex items-start justify-between gap-4 rounded-xl border bg-background/50 p-4">
                    <div>
                      <label htmlFor="recipe-visible" className="text-sm font-medium">{t("visible")}</label>
                      <p className="text-xs text-muted-foreground">{t("visibleHint")}</p>
                    </div>
                    <Controller control={form.control} name="isVisibleOnWebsite" render={({ field }) => (
                      <Switch id="recipe-visible" checked={!!field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>
                  <div className="rounded-xl border bg-background/50">
                    <button type="button" onClick={() => setShowAr((s) => !s)} aria-expanded={showAr} className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm font-medium">
                      <Languages className="h-4 w-4 text-primary" />
                      <span className="flex-1">{tc("arabic")}</span>
                    </button>
                    {showAr && (
                      <div className="space-y-4 border-t p-4" dir="rtl" lang="ar">
                        <Field label={t("nameAr")} htmlFor="recipe-nameAr" error={errors.nameAr?.message}>
                          <Input id="recipe-nameAr" {...form.register("nameAr")} />
                        </Field>
                        <Field label={t("descriptionAr")} htmlFor="recipe-descriptionAr" error={errors.descriptionAr?.message}>
                          <Textarea id="recipe-descriptionAr" rows={4} {...form.register("descriptionAr")} />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardContent className="space-y-4 pt-6 sm:pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <ProductCombobox
                    products={products}
                    selectedIds={values.ingredients?.map((i) => i.productId) ?? []}
                    onSelect={(p) => append({ productId: p.id, quantity: "" as unknown as number, unitId: p.unitId })}
                  />
                  <span className="text-sm text-muted-foreground">{tc("ingredientsCount", { count: fields.length })}</span>
                </div>
                <FieldError message={ingredientsError?.root?.message ?? ingredientsError?.message} />
                {fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                    <Beaker className="mx-auto mb-2 h-8 w-8 text-primary/60" />
                    {t("ingredientsEmpty")}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {fields.map((f, index) => {
                        const product = productMap.get(values.ingredients?.[index]?.productId ?? f.productId);
                        const rowErr = (errors.ingredients as unknown as { quantity?: { message?: string }; unitId?: { message?: string } }[] | undefined)?.[index];
                        return (
                          <motion.li key={f.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                            className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border bg-background/60 p-3 xl:grid-cols-[auto_minmax(0,1fr)_9rem_14rem_auto]">
                            <Thumb src={product?.imageUrl} />
                            <div className="min-w-0 self-center">
                              <div className="truncate font-medium">{product ? lname(product, locale) : "—"}</div>
                              {product && <div className="text-xs text-muted-foreground">{t("defaultUnit", { symbol: product.unit.symbol })}</div>}
                            </div>
                            <div className="flex items-center gap-0.5 xl:order-last">
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={tc("moveUp")}><ArrowUp /></Button>
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} aria-label={tc("moveDown")}><ArrowDown /></Button>
                              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => remove(index)} aria-label={tc("remove")}><Trash2 /></Button>
                            </div>
                            <div className="col-span-3 grid grid-cols-[minmax(6rem,9rem)_1fr] gap-2 xl:col-span-2 xl:grid-cols-[9rem_14rem]">
                              <div className="space-y-1">
                                <Input inputMode="decimal" dir="ltr" placeholder={t("quantity")} aria-label={`${t("quantity")} — ${product?.name ?? ""}`}
                                  {...form.register(`ingredients.${index}.quantity` as const)} aria-invalid={!!rowErr?.quantity} />
                                <FieldError message={rowErr?.quantity?.message} />
                              </div>
                              <div className="space-y-1">
                                <Controller control={form.control} name={`ingredients.${index}.unitId` as const} render={({ field }) => (
                                  <UnitSelect value={field.value} onChange={field.onChange} invalid={!!rowErr?.unitId} />
                                )} />
                                <FieldError message={rowErr?.unitId?.message} />
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardContent className="space-y-6 pt-6 sm:pt-6">
                <p className="max-w-2xl text-sm text-muted-foreground">{t("outputHint")}</p>
                <div className="grid max-w-xl gap-4 sm:grid-cols-[1fr_1.4fr]">
                  <Field label={t("outputQuantity")} htmlFor="recipe-output" error={errors.outputQuantity?.message}>
                    <Input id="recipe-output" inputMode="decimal" dir="ltr" placeholder="20" {...form.register("outputQuantity")} aria-invalid={!!errors.outputQuantity} />
                  </Field>
                  <Field label={t("outputUnit")} htmlFor="recipe-output-unit" error={errors.outputUnitId?.message}>
                    <Controller control={form.control} name="outputUnitId" render={({ field }) => (
                      <UnitSelect id="recipe-output-unit" value={field.value} onChange={field.onChange} invalid={!!errors.outputUnitId} />
                    )} />
                  </Field>
                </div>
                {outUnit && outQty > 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-sage-soft p-4 text-sm">
                    <Beaker className="h-5 w-5 shrink-0 text-primary" />
                    {t("outputExplain", { quantity: formatNumber(outQty, locale), unit: outUnit.symbol })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-[320px_1fr]">
                <div className="relative bg-muted">
                  {values.imageUrl ? <img src={values.imageUrl} alt="" className="h-full max-h-80 w-full object-cover md:max-h-none" /> : <div className="grid h-48 place-items-center text-muted-foreground"><Beaker className="h-10 w-10" /></div>}
                </div>
                <div className="space-y-5 p-6">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wider text-primary">{t("summaryTitle")}</p>
                    <h2 className="mt-1 font-serif text-2xl font-semibold">{lname({ name: values.name, nameAr: values.nameAr }, locale) || "—"}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{ldesc({ description: values.description, descriptionAr: values.descriptionAr }, locale)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={values.isVisibleOnWebsite ? "success" : "secondary"}>
                        {values.isVisibleOnWebsite ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {values.isVisibleOnWebsite ? t("visibleBadge") : t("hiddenBadge")}
                      </Badge>
                      {outUnit && outQty > 0 && <Badge variant="lemon">{t("produces")} : {formatNumber(outQty, locale)} {outUnit.symbol}</Badge>}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t("ingredients")} ({values.ingredients?.length ?? 0})</h3>
                    <ul className="divide-y rounded-xl border">
                      {values.ingredients?.map((ing, i) => {
                        const p = productMap.get(ing.productId);
                        const u = unitMap.get(ing.unitId);
                        const q = Number(String(ing.quantity ?? "").replace(",", "."));
                        return (
                          <li key={`${ing.productId}-${i}`} className="flex items-center gap-3 px-3 py-2">
                            <Thumb src={p?.imageUrl} className="h-8 w-8" />
                            <span className="flex-1 text-sm">{p ? lname(p, locale) : "—"}</span>
                            <span className={cn("font-mono text-sm", !(q > 0) && "text-destructive")}>{q > 0 ? formatNumber(q, locale) : "?"} {u?.symbol}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("summaryText")}</p>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => (step === 0 ? router.back() : goTo(step - 1))}>
          <ArrowLeft className="flip-rtl" />
          {step === 0 ? tc("cancel") : tc("previous")}
        </Button>
        <div className="flex gap-2">
          {recipeId && step < 3 && (
            <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}><Save />{tc("save")}</Button>
          )}
          {step < 3 ? (
            <Button type="button" onClick={() => goTo(step + 1)}>{tc("next")}<ArrowRight className="flip-rtl" /></Button>
          ) : (
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
              {form.formState.isSubmitting ? tc("saving") : tc("save")}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
