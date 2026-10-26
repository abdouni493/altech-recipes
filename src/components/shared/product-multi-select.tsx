"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Thumb } from "./thumb";
import type { SupplierProductDTO } from "@/lib/suppliers";
import { lname } from "@/lib/i18n-data";
import { cn, normalizeSearch } from "@/lib/utils";

/** Searchable multi-select of products (thumbnails); selection shown as removable cards. */
export function ProductMultiSelect({ products, value, onChange, invalid }: { products: SupplierProductDTO[]; value: string[]; onChange: (ids: string[]) => void; invalid?: boolean }) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const selected = value.map((id) => products.find((p) => p.id === id)).filter(Boolean) as SupplierProductDTO[];
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={cn("rounded-xl border-dashed", invalid && "border-destructive")} aria-expanded={open}>
              <Plus className="text-primary" />{t("addProducts")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(92vw,26rem)] p-0" align="start">
            <Command filter={(v, s) => (normalizeSearch(v).includes(normalizeSearch(s)) ? 1 : 0)}>
              <CommandInput placeholder={t("searchProducts")} autoFocus />
              <CommandList>
                <CommandEmpty>{t("noProduct")}</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => {
                    const on = value.includes(p.id);
                    return (
                      <CommandItem key={p.id} value={`${p.name} ${p.nameAr} ${p.id}`} onSelect={() => toggle(p.id)}>
                        <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <Thumb src={p.imageUrl} className="h-9 w-9" />
                        <span className="flex-1 truncate">{lname(p, locale)}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <span className="text-sm text-muted-foreground">{tc("selected", { count: value.length })}</span>
        {value.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>{tc("deselectAll")}</Button>
        )}
        {value.length < products.length && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(products.map((p) => p.id))}>{tc("selectAll")}</Button>
        )}
      </div>
      {selected.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noneSelected")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {selected.map((p) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-3 rounded-xl border bg-background/60 p-2 pe-1">
                <Thumb src={p.imageUrl} className="h-10 w-10" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{lname(p, locale)}</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggle(p.id)} aria-label={`${tc("remove")} ${p.name}`}><X /></Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
