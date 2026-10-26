"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { WILAYAS, wilayaLabel } from "@/lib/algeria";
import { cn, normalizeSearch } from "@/lib/utils";

function Combo({
  id, value, placeholder, searchPlaceholder, empty, options, onChange, disabled, invalid,
}: {
  id?: string; value: string; placeholder: string; searchPlaceholder: string; empty: string;
  options: { value: string; label: string; keywords: string }[]; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-invalid={invalid} disabled={disabled}
          className={cn("flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 text-start text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
            !selected && "text-muted-foreground")}>
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={`${id}-list`} className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
        <Command filter={(v, s) => (normalizeSearch(v).includes(normalizeSearch(s)) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.keywords} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("h-4 w-4 text-primary", o.value === value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Searchable wilaya + commune selects; communes are filtered by the chosen wilaya. Names follow the UI language. */
export function WilayaCommuneSelect({
  wilaya, commune, onWilayaChange, onCommuneChange, wilayaError, communeError, ids,
}: {
  wilaya: string; commune: string;
  onWilayaChange: (code: string) => void; onCommuneChange: (name: string) => void;
  wilayaError?: boolean; communeError?: boolean;
  ids?: { wilaya: string; commune: string };
}) {
  const t = useTranslations("site.form");
  const locale = useLocale();
  const w = WILAYAS.find((x) => x.code === wilaya);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor={ids?.wilaya} className="text-sm font-medium">{t("wilaya")}</label>
        <Combo id={ids?.wilaya} value={wilaya} invalid={wilayaError} placeholder={t("wilayaPlaceholder")} searchPlaceholder={t("searchWilaya")} empty={t("noMatch")}
          options={WILAYAS.map((x) => ({ value: x.code, label: wilayaLabel(x, locale), keywords: `${x.code} ${x.fr} ${x.ar}` }))}
          onChange={(code) => { onWilayaChange(code); onCommuneChange(""); }} />
      </div>
      <div className="space-y-2">
        <label htmlFor={ids?.commune} className="text-sm font-medium">{t("commune")}</label>
        <Combo id={ids?.commune} value={commune} invalid={communeError} disabled={!w}
          placeholder={w ? t("communePlaceholder") : t("communeFirst")} searchPlaceholder={t("searchCommune")} empty={t("noMatch")}
          options={(w?.communes ?? []).map((c) => ({ value: c.fr, label: locale === "ar" ? c.ar : c.fr, keywords: `${c.fr} ${c.ar}` }))}
          onChange={onCommuneChange} />
      </div>
    </div>
  );
}
