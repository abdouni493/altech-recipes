"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Thumb } from "@/components/shared/thumb";
import type { CommerceProductDTO } from "@/lib/commerce";
import { lname } from "@/lib/i18n-data";
import { normalizeSearch } from "@/lib/utils";
import { Money } from "./shared";

export function productSearchText(p: CommerceProductDTO) {
  return normalizeSearch(`${p.name} ${p.nameAr} ${p.description} ${p.descriptionAr} ${p.barcode ?? ""}`);
}

/** Product picker searching name, Arabic name, description and barcode. */
export function ProductSearch({ products, selectedIds, onSelect }: { products: CommerceProductDTO[]; selectedIds: string[]; onSelect: (p: CommerceProductDTO) => void }) {
  const t = useTranslations("commerce");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2 border-dashed sm:w-auto" aria-expanded={open}>
          <Plus />{t("addProduct")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(94vw,30rem)] p-0" align="start">
        <Command filter={(value, search) => (value.includes(normalizeSearch(search)) ? 1 : 0)}>
          <CommandInput placeholder={t("searchProductHint")} autoFocus />
          <CommandList>
            <CommandEmpty>{t("noProduct")}</CommandEmpty>
            <CommandGroup>
              {products.map((p) => {
                const added = selectedIds.includes(p.id);
                return (
                  <CommandItem key={p.id} value={`${productSearchText(p)} ${p.id}`} disabled={added} onSelect={() => { onSelect(p); setOpen(false); }}>
                    <Thumb src={p.imageUrl} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{lname(p, locale)}</div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{t("stock")}: {p.stockQuantity} {p.unitSymbol}</span>
                        {p.barcode && <span className="font-mono" dir="ltr">{p.barcode}</span>}
                      </div>
                    </div>
                    {added ? <Check className="h-4 w-4 text-primary" /> : <Money value={p.purchasePrice} className="text-xs text-muted-foreground" />}
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
