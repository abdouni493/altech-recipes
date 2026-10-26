"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeftRight, Beaker, CheckCircle2, ClipboardCopy, Keyboard, ListChecks, MessageCircle, Printer, RotateCcw, Save, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Input } from "@/components/ui/basic";
import { Checkbox, Progress, Switch } from "@/components/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Thumb } from "@/components/shared/thumb";
import { copyText } from "@/components/shared/copy-button";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { saveCalculationAction } from "@/actions/portal";
import type { UnitDTO } from "@/lib/dto";
import type { PortalRecipeDetail } from "@/lib/portal-queries";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { convert, isConvertible, roundTo, smartUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "../favorite-button";

const MULTIPLIERS = [0.5, 2, 5, 10];
const COMMON_TARGETS = [1, 5, 20, 50, 100];

export function CalculatorView({
  recipe, units, clientName, initialTarget, initialUnitId,
}: {
  recipe: PortalRecipeDetail;
  units: UnitDTO[];
  clientName: string;
  initialTarget?: number;
  initialUnitId?: string;
}) {
  const t = useTranslations("calculator");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const inputRef = useRef<HTMLInputElement>(null);

  const outUnit = recipe.outputUnit;
  // Units the target can be expressed in: same dimension as the recipe output (or only the output unit).
  const targetUnits = useMemo(() => {
    const list = isConvertible(outUnit) ? units.filter((u) => u.dimension === outUnit.dimension) : [outUnit];
    return list.sort((a, b) => b.factor - a.factor);
  }, [units, outUnit]);
  const baseUnit = targetUnits.find((u) => u.factor === 1) ?? outUnit;

  const startUnit = targetUnits.find((u) => u.id === initialUnitId) ?? outUnit;
  const [draft, setDraft] = useState(initialTarget ? String(initialTarget) : "");
  const [draftUnitId, setDraftUnitId] = useState(startUnit.id);
  const [committed, setCommitted] = useState<{ target: number; unitId: string } | null>(initialTarget ? { target: initialTarget, unitId: startUnit.id } : null);
  const [smart, setSmart] = useState(true);
  const [precision, setPrecision] = useState(2);
  const [checklist, setChecklist] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const p = localStorage.getItem("calc-precision");
      if (p !== null) setPrecision(Number(p));
      const s = localStorage.getItem("calc-smart");
      if (s !== null) setSmart(s === "1");
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("calc-precision", String(precision)); localStorage.setItem("calc-smart", smart ? "1" : "0"); } catch {} }, [precision, smart]);

  const unitById = useCallback((id: string) => targetUnits.find((u) => u.id === id) ?? outUnit, [targetUnits, outUnit]);

  const result = useMemo(() => {
    if (!committed) return null;
    const tu = unitById(committed.unitId);
    const targetInOut = convert(committed.target, tu, outUnit);
    if (targetInOut === null || !(recipe.outputQuantity > 0)) return null;
    const factor = targetInOut / recipe.outputQuantity;
    const rows = recipe.ingredients.map((i) => {
      const raw = i.quantity * factor;
      const shown = smart ? smartUnit(raw, i.unit, units) : { value: raw, unit: i.unit };
      return { ...i, baseUnit: i.unit, raw, value: roundTo(shown.value, precision), unit: shown.unit };
    });
    return { factor, rows, target: committed.target, targetUnit: tu };
  }, [committed, unitById, outUnit, recipe, smart, units, precision]);

  function calculate(target?: number, unitId?: string) {
    const value = target ?? Number(draft.replace(",", ".").trim());
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t("invalidTarget"));
      inputRef.current?.focus();
      return;
    }
    const u = unitId ?? draftUnitId;
    if (target !== undefined) setDraft(String(target));
    if (unitId) setDraftUnitId(unitId);
    setCommitted({ target: value, unitId: u });
    setChecked(new Set());
  }

  const fmt = (n: number) => formatNumber(n, locale, precision);
  const name = lname(recipe, locale);

  const sheetText = useCallback(() => {
    if (!result) return "";
    const lines = [
      `${t("sheetTitle")} — ${name}`,
      t("sheetTarget", { quantity: fmt(result.target), unit: result.targetUnit.symbol }),
      t("sheetFactor", { factor: formatNumber(result.factor, locale, 4) }),
      "",
      ...result.rows.map((r) => `• ${lname({ name: r.productName, nameAr: r.productNameAr }, locale)} : ${fmt(r.value)} ${r.unit.symbol}`),
      "",
      t("sheetFooter"),
    ];
    return lines.join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, locale, precision, name]);

  async function copy() {
    if (!result) return toast.error(t("enterTarget"));
    if (await copyText(sheetText())) toast.success(t("copiedText"));
  }
  function share() {
    if (!result) return toast.error(t("enterTarget"));
    window.open(`https://wa.me/?text=${encodeURIComponent(sheetText())}`, "_blank", "noopener,noreferrer");
  }
  function print() {
    if (!result) return toast.error(t("enterTarget"));
    window.print();
  }
  async function save() {
    if (!result || !committed) return toast.error(t("enterTarget"));
    setSaving(true);
    const res = await saveCalculationAction({ recipeId: recipe.id, targetQuantity: committed.target, unitId: committed.unitId });
    setSaving(false);
    if (!res.ok) return feedback.error(res);
    toast.success(t("saved"));
  }

  // Keyboard shortcuts (ignored while typing in a field, except Enter which submits the form).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || el.getAttribute("role") === "combobox";
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/" && !typing) { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); return; }
      if (typing) return;
      const k = e.key.toLowerCase();
      if (k === "p") { e.preventDefault(); print(); }
      else if (k === "c") { e.preventDefault(); copy(); }
      else if (k === "s") { e.preventDefault(); save(); }
      else if (k === "k") { e.preventDefault(); setChecklist((c) => !c); }
      else if (e.key === "?") { e.preventDefault(); setShortcutsOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const done = result ? result.rows.filter((r) => checked.has(r.id)).length : 0;
  const total = result?.rows.length ?? 0;

  const shortcuts: [string, string][] = [
    ["/", t("shortcut.search")], ["Entrée", t("shortcut.calculate")], ["P", t("shortcut.print")], ["C", t("shortcut.copy")],
    ["S", t("shortcut.save")], ["K", t("shortcut.checklist")], ["?", t("shortcut.help")],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      {/* ---------------- controls ---------------- */}
      <div className="space-y-6 no-print">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <Thumb src={recipe.imageUrl} className="h-16 w-16 rounded-xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-serif text-lg font-semibold">{name}</h2>
              <p className="text-sm text-muted-foreground">{t("base", { quantity: formatNumber(recipe.outputQuantity, locale), unit: outUnit.symbol })}</p>
              <Link href="/client/calculator" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <ArrowLeftRight className="h-3 w-3" />{t("changeRecipe")}
              </Link>
            </div>
            <FavoriteButton recipeId={recipe.id} initial={recipe.favorite} />
          </div>
        </Card>

        <Card>
          <CardContent className="space-y-5 pt-5 sm:pt-6">
            <form onSubmit={(e) => { e.preventDefault(); calculate(); }} className="space-y-3">
              <label htmlFor="calc-target" className="text-sm font-medium">{t("targetLabel")}</label>
              <div className="flex gap-2">
                <Input ref={inputRef} id="calc-target" inputMode="decimal" dir="ltr" autoFocus placeholder={t("targetPlaceholder")}
                  value={draft} onChange={(e) => setDraft(e.target.value)} className="h-12 flex-1 text-lg font-semibold" />
                <Select value={draftUnitId} onValueChange={(v) => { setDraftUnitId(v); if (committed) calculate(Number(draft.replace(",", ".")) || committed.target, v); }}>
                  <SelectTrigger className="h-12 w-28" aria-label={t("unit")}><SelectValue /></SelectTrigger>
                  <SelectContent>{targetUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.symbol}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" size="lg" className="w-full"><Sparkles />{t("calculate")}<kbd className="ms-auto hidden rounded bg-primary-foreground/20 px-1.5 text-[10px] sm:inline">↵</kbd></Button>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("multipliers")}</p>
              <div className="flex flex-wrap gap-2">
                {MULTIPLIERS.map((m) => (
                  <Button key={m} type="button" variant="secondary" size="sm" onClick={() => calculate(roundTo(recipe.outputQuantity * m, 6), outUnit.id)}>
                    ×{formatNumber(m, locale)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("commonTargets")}</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_TARGETS.map((n) => (
                  <Button key={n} type="button" variant="outline" size="sm" onClick={() => calculate(n, baseUnit.id)}>
                    {formatNumber(n, locale)} {baseUnit.symbol}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="calc-smart" className="text-sm font-medium">{t("smartDisplay")}</label>
                  <p className="text-xs text-muted-foreground">{t("smartDisplayHint")}</p>
                </div>
                <Switch id="calc-smart" checked={smart} onCheckedChange={setSmart} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium" id="calc-precision-label">{t("precision")}</span>
                <Select value={String(precision)} onValueChange={(v) => setPrecision(Number(v))}>
                  <SelectTrigger className="w-40" aria-labelledby="calc-precision-label"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3].map((d) => <SelectItem key={d} value={String(d)}>{t("decimals", { count: d })}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="calc-checklist" className="text-sm font-medium">{t("checklist")}</label>
                  <p className="text-xs text-muted-foreground">{t("checklistHint")}</p>
                </div>
                <Switch id="calc-checklist" checked={checklist} onCheckedChange={setChecklist} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- results ---------------- */}
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={print}><Printer />{t("print")}</Button>
          <Button variant="outline" size="sm" onClick={copy}><ClipboardCopy />{t("copy")}</Button>
          <Button variant="outline" size="sm" onClick={share}><MessageCircle />{t("share")}</Button>
          <Button size="sm" onClick={save} disabled={saving}><Save />{t("save")}</Button>
          <Popover open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="ms-auto"><Keyboard />{t("shortcuts")}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="mb-3 font-serif font-semibold">{t("shortcutsTitle")}</p>
              <ul className="space-y-2 text-sm">
                {shortcuts.map(([key, label]) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{label}</span>
                    <kbd className="min-w-7 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs">{key === "Entrée" ? (locale === "ar" ? "Enter" : "Entrée") : key}</kbd>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        <Card className="print-area overflow-hidden">
          {/* Printed header */}
          <div className="print-only border-b p-6">
            <h1 className="font-serif text-2xl font-semibold">{t("sheetTitle")} — {name}</h1>
            <p className="text-sm">{t("sheetDate", { date: formatDate(new Date(), locale, true) })} · {t("sheetClient", { name: clientName })}</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-sage-soft/50 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("results")}</p>
              <AnimatePresence mode="wait">
                <motion.h3 key={result ? `${result.target}-${result.targetUnit.id}` : "empty"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="font-serif text-2xl font-semibold">
                  {result ? t("resultsFor", { quantity: fmt(result.target), unit: result.targetUnit.symbol }) : t("enterTarget")}
                </motion.h3>
              </AnimatePresence>
            </div>
            {result && <Badge variant="lemon" className="text-sm">{t("factor")} ×{formatNumber(result.factor, locale, 4)}</Badge>}
          </div>

          {checklist && result && (
            <div className="no-print space-y-2 border-b p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><ListChecks className="h-4 w-4 text-primary" />{t("progress", { done, total })}</span>
                <Button variant="ghost" size="sm" onClick={() => setChecked(new Set())} disabled={done === 0}><RotateCcw />{t("resetChecklist")}</Button>
              </div>
              <Progress value={total ? (done / total) * 100 : 0} aria-label={t("progress", { done, total })} />
              {done === total && total > 0 && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" />{t("allDone")}
                </motion.p>
              )}
            </div>
          )}

          <CardContent className="p-0 sm:p-0">
            {!result ? (
              <div className="grid place-items-center gap-3 px-6 py-16 text-center text-muted-foreground">
                <Beaker className="h-10 w-10 text-primary/60" />
                <p className="max-w-xs text-sm">{t("enterTarget")}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {result.rows.map((r, idx) => {
                  const on = checked.has(r.id);
                  const productName = lname({ name: r.productName, nameAr: r.productNameAr }, locale);
                  return (
                    <motion.li key={r.id} initial={{ opacity: 0, x: locale === "ar" ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.035 }}
                      className={cn("flex items-center gap-4 px-5 py-3.5 transition-colors", on && "bg-success/5")}>
                      {checklist && (
                        <Checkbox className="no-print h-6 w-6" checked={on} aria-label={productName}
                          onCheckedChange={(c) => setChecked((s) => { const n = new Set(s); if (c === true) n.add(r.id); else n.delete(r.id); return n; })} />
                      )}
                      <Thumb src={r.imageUrl} className="h-12 w-12 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate font-medium", on && "text-muted-foreground line-through")}>{productName}</div>
                        <div className="text-xs text-muted-foreground">{t("base", { quantity: formatNumber(r.quantity, locale), unit: r.baseUnit.symbol })}</div>
                      </div>
                      <div className="text-end">
                        <div className="whitespace-nowrap font-serif text-2xl font-semibold tabular-nums" dir="ltr">{fmt(r.value)} <span className="text-base font-medium text-muted-foreground">{r.unit.symbol}</span></div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </CardContent>
          {result && <p className="print-only border-t p-6 text-sm">{t("sheetFooter")}</p>}
        </Card>
      </div>
    </div>
  );
}
