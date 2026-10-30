"use client";
// Small building blocks shared by purchases, sales, POS, clients and suppliers.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/basic";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { formatMoney, paymentStatus, type PartyDTO } from "@/lib/commerce";
import { cn, normalizeSearch } from "@/lib/utils";

export function Money({ value, className }: { value: number; className?: string }) {
  const locale = useLocale();
  return <span className={cn("whitespace-nowrap tabular-nums", className)}>{formatMoney(value, locale)}</span>;
}

export function useMoney() {
  const locale = useLocale();
  return (v: number) => formatMoney(v, locale);
}

export function PaymentStatusBadge({ total, paid }: { total: number; paid: number }) {
  const t = useTranslations("commerce.paymentStatus");
  const s = paymentStatus(total, paid);
  return <Badge variant={s === "PAID" ? "success" : s === "PARTIAL" ? "warning" : "destructive"}>{t(s)}</Badge>;
}

/** Two date inputs (yyyy-mm-dd). Empty = no bound. */
export function DateRange({ from, to, onChange, className }: { from: string; to: string; onChange: (from: string, to: string) => void; className?: string }) {
  const t = useTranslations("commerce");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t("from")}
        <Input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="h-9 w-[9.5rem]" />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t("to")}
        <Input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="h-9 w-[9.5rem]" />
      </label>
      {(from || to) && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange("", "")} aria-label={t("clearDates")}><X /></Button>
      )}
    </div>
  );
}

/** Keeps rows whose ISO date (yyyy-mm-dd…) is inside [from, to]. */
export function inRange(iso: string, from: string, to: string) {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

/** Searchable picker for a client or a supplier (name / phone). */
export function PartyCombobox({
  parties, value, onChange, placeholder, emptyLabel, clearLabel, id,
}: {
  parties: PartyDTO[]; value: string | null; onChange: (party: PartyDTO | null) => void;
  placeholder: string; emptyLabel: string; clearLabel?: string; id?: string;
}) {
  const t = useTranslations("commerce");
  const [open, setOpen] = useState(false);
  const selected = parties.find((p) => p.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="secondary" className="h-10 w-full justify-between font-sans text-sm normal-case tracking-normal" aria-expanded={open}>
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,24rem)] p-0" align="start">
        <Command filter={(v, s) => (normalizeSearch(v).includes(normalizeSearch(s)) ? 1 : 0)}>
          <CommandInput placeholder={t("searchParty")} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {selected && clearLabel && (
                <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false); }}>
                  <X className="h-4 w-4" />{clearLabel}
                </CommandItem>
              )}
              {parties.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.phone} ${p.id}`} onSelect={() => { onChange(p); setOpen(false); }}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{p.phone}</div>
                  </div>
                  {p.id === value && <Check className="h-4 w-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PrintLink({ href, label, size = "icon-sm" }: { href: string; label: string; size?: "icon-sm" | "sm" }) {
  return (
    <Button variant="ghost" size={size} asChild aria-label={label} title={label}>
      <a href={href} target="_blank" rel="noopener"><Printer />{size === "sm" && label}</a>
    </Button>
  );
}

/** Label / value row used in summaries. */
export function SummaryRow({ label, children, strong, className }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5 text-sm", strong && "text-base font-bold", className)}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
