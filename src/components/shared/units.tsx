"use client";
// Units: shared client-side list (context), UnitSelect with inline "+ Nouvelle unité", and the "Gérer les unités" dialog.
import { createContext, useContext, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Badge } from "@/components/ui/basic";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/overlays";
import { Field } from "./form-fields";
import { ConfirmDialog } from "./confirm-dialog";
import { useActionFeedback } from "./use-action-feedback";
import { createUnitAction, deleteUnitAction, getUnitsUsageAction, updateUnitAction, type UnitUsage } from "@/actions/units";
import { DIMENSIONS, KNOWN_UNITS, unitSchema, type UnitInput } from "@/lib/schemas";
import type { UnitDTO } from "@/lib/dto";
import { lname } from "@/lib/i18n-data";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ context */

type UnitsCtx = { units: UnitDTO[]; upsert: (u: UnitDTO) => void; remove: (id: string) => void };
const Ctx = createContext<UnitsCtx | null>(null);

export function UnitsProvider({ initial, children }: { initial: UnitDTO[]; children: React.ReactNode }) {
  const [units, setUnits] = useState(initial);
  useEffect(() => setUnits(initial), [initial]);
  const upsert = (u: UnitDTO) => setUnits((list) => (list.some((x) => x.id === u.id) ? list.map((x) => (x.id === u.id ? u : x)) : [...list, u]));
  const remove = (id: string) => setUnits((list) => list.filter((x) => x.id !== id));
  return <Ctx.Provider value={{ units, upsert, remove }}>{children}</Ctx.Provider>;
}

export function useUnits() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}

/* ------------------------------------------------------------ form dialog */

export function UnitFormDialog({
  open, onOpenChange, unit, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit?: UnitDTO | null;
  onSaved?: (u: UnitDTO) => void;
}) {
  const t = useTranslations("units");
  const tc = useTranslations("common");
  const { upsert } = useUnits();
  const feedback = useActionFeedback();
  const [touchedDimension, setTouchedDimension] = useState(false);
  const form = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: "", nameAr: "", symbol: "", dimension: "OTHER", factor: 1 },
  });

  useEffect(() => {
    if (!open) return;
    setTouchedDimension(!!unit);
    form.reset(unit
      ? { name: unit.name, nameAr: unit.nameAr, symbol: unit.symbol, dimension: unit.dimension as UnitInput["dimension"], factor: unit.factor }
      : { name: "", nameAr: "", symbol: "", dimension: "OTHER", factor: 1 });
  }, [open, unit, form]);

  const symbol = form.watch("symbol");
  const dimension = form.watch("dimension");
  useEffect(() => {
    if (touchedDimension) return;
    const known = KNOWN_UNITS[(symbol || "").trim().toLowerCase()];
    if (known) {
      form.setValue("dimension", known.dimension);
      form.setValue("factor", known.factor);
    }
  }, [symbol, touchedDimension, form]);

  async function submit(values: UnitInput) {
    const res = unit ? await updateUnitAction(unit.id, values) : await createUnitAction(values);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof UnitInput, { message: m }));
      return feedback.error(res);
    }
    upsert(res.data!);
    toast.success(unit ? t("updated") : t("created", { name: res.data!.name }));
    onSaved?.(res.data!);
    onOpenChange(false);
  }

  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{unit ? t("editTitle") : t("createTitle")}</DialogTitle>
          {!unit && <DialogDescription>{t("createDescription")}</DialogDescription>}
        </DialogHeader>
        {/* stopPropagation: this form is rendered through a portal inside other forms */}
        <form onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(submit)(e); }} className="space-y-4" noValidate>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label={t("name")} htmlFor="unit-name" error={errors.name?.message}>
              <Input id="unit-name" placeholder={t("namePlaceholder")} autoFocus {...form.register("name")} aria-invalid={!!errors.name} />
            </Field>
            <Field label={t("symbol")} htmlFor="unit-symbol" error={errors.symbol?.message}>
              <Input id="unit-symbol" placeholder={t("symbolPlaceholder")} dir="ltr" {...form.register("symbol")} aria-invalid={!!errors.symbol} />
            </Field>
          </div>
          <Field label={t("nameAr")} htmlFor="unit-nameAr" optional optionalLabel={tc("optional")} error={errors.nameAr?.message}>
            <Input id="unit-nameAr" dir="rtl" lang="ar" {...form.register("nameAr")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("dimension")} hint={t("dimensionHint")} error={errors.dimension?.message}>
              <Controller control={form.control} name="dimension" render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { setTouchedDimension(true); field.onChange(v); if (v === "OTHER" || v === "COUNT") form.setValue("factor", 1); }}>
                  <SelectTrigger aria-label={t("dimension")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{t(`dimensions.${d}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </Field>
            {dimension !== "OTHER" && (
              <Field label={t("factor")} htmlFor="unit-factor" error={errors.factor?.message}
                hint={t("factorHint", { symbol: symbol || "?", base: t(`base.${dimension}`) })}>
                <Input id="unit-factor" inputMode="decimal" dir="ltr" {...form.register("factor")} aria-invalid={!!errors.factor} />
              </Field>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {unit ? tc("save") : tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ select */

export function UnitSelect({
  value, onChange, id, invalid, className, allowCreate = true, filterDimension,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
  id?: string;
  invalid?: boolean;
  className?: string;
  allowCreate?: boolean;
  /** Only list units of the same dimension (used by the calculator). */
  filterDimension?: string;
}) {
  const t = useTranslations("units");
  const locale = useLocale();
  const { units } = useUnits();
  const [open, setOpen] = useState(false);
  const list = filterDimension ? units.filter((u) => u.dimension === filterDimension) : units;
  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id={id} aria-invalid={invalid} className="min-w-0 flex-1">
          <SelectValue placeholder={t("select")} />
        </SelectTrigger>
        <SelectContent>
          {list.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <span className="font-medium">{u.symbol}</span>
              <span className="text-muted-foreground"> · {lname(u, locale)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {allowCreate && (
        <>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-lg" onClick={() => setOpen(true)} aria-label={t("newUnit")} title={t("newUnit")}>
            <Plus />
          </Button>
          <UnitFormDialog open={open} onOpenChange={setOpen} onSaved={(u) => onChange(u.id)} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ manage dialog */

export function ManageUnitsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const t = useTranslations("units");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { units, remove } = useUnits();
  const feedback = useActionFeedback();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<Record<string, UnitUsage>>({});
  const [editing, setEditing] = useState<UnitDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    getUnitsUsageAction().then((r) => r.ok && r.data && setUsage(r.data));
  }, [open, units.length]);

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button type="button" variant="outline"><Ruler />{t("manage")}</Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl" closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("manage")}</DialogTitle>
            <DialogDescription>{t("manageDescription")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pe-1">
            {units.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
            {units.map((u) => {
              const use = usage[u.id];
              const total = use ? use.products + use.ingredients + use.recipes + use.history : 0;
              return (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-background/50 p-3">
                  <span className="grid h-10 min-w-10 place-items-center rounded-lg bg-sage-soft px-2 font-mono text-sm font-semibold text-primary">{u.symbol}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{lname(u, locale)}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{t(`dimensions.${u.dimension}` as never)}</span>
                      {use && (total > 0
                        ? <Badge variant="secondary" className="font-normal">{t("inUse", { products: use.products, ingredients: use.ingredients, recipes: use.recipes })}</Badge>
                        : <Badge variant="outline" className="font-normal">{t("notUsed")}</Badge>)}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={tc("edit")} onClick={() => { setEditing(u); setFormOpen(true); }}>
                    <Pencil />
                  </Button>
                  {total > 0 && use ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={tc("delete")} className="text-muted-foreground"
                      onClick={() => toast.error(t("inUseTitle"), { description: t("inUse", { products: use.products, ingredients: use.ingredients, recipes: use.recipes }) })}>
                      <Trash2 />
                    </Button>
                  ) : (
                    <ConfirmDialog
                      trigger={<Button type="button" variant="ghost" size="icon-sm" aria-label={tc("delete")} className="text-destructive hover:text-destructive"><Trash2 /></Button>}
                      title={tc("deleteConfirmTitle")}
                      description={tc("deleteConfirmText", { name: `${u.name} (${u.symbol})` })}
                      onConfirm={async () => {
                        const res = await deleteUnitAction(u.id);
                        if (!res.ok) {
                          if (res.meta) setUsage((m) => ({ ...m, [u.id]: res.meta as unknown as UnitUsage }));
                          toast.error(t("inUseTitle"), { description: res.meta ? t("inUse", res.meta as never) : feedback.message(res.error) });
                          return;
                        }
                        remove(u.id);
                        toast.success(t("deleted"));
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus />{t("newUnit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnitFormDialog open={formOpen} onOpenChange={setFormOpen} unit={editing} />
    </>
  );
}
