"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Thumb } from "./thumb";
import type { ProductDTO } from "@/lib/dto";
import { lname } from "@/lib/i18n-data";

/** Searchable product picker (thumbnail + default unit). Already-selected products are disabled. */
export function ProductCombobox({ products, selectedIds, onSelect }: { products: ProductDTO[]; selectedIds: string[]; onSelect: (p: ProductDTO) => void }) {
  const t = useTranslations("recipes");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground sm:w-auto" aria-expanded={open}>
          <Plus className="text-primary" />
          {t("addProduct")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,26rem)] p-0" align="start">
        <Command filter={(value, search) => (value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={t("searchProduct")} value={search} onValueChange={setSearch} autoFocus />
          <CommandList>
            <CommandEmpty>
              <p>{t("noProduct")}</p>
              <p className="mt-1 text-xs">{t("createProductHint")}</p>
            </CommandEmpty>
            <CommandGroup>
              {products.map((p) => {
                const added = selectedIds.includes(p.id);
                return (
                  <CommandItem key={p.id} value={`${p.name} ${p.nameAr} ${p.id}`} disabled={added}
                    onSelect={() => { onSelect(p); setOpen(false); }}>
                    <Thumb src={p.imageUrl} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{lname(p, locale)}</div>
                      <div className="text-xs text-muted-foreground">{t("defaultUnit", { symbol: p.unit.symbol })}</div>
                    </div>
                    {added && <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" />{t("alreadyAdded")}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
