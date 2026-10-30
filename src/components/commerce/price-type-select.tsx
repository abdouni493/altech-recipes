"use client";

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { PRICE_TYPES, type PriceType } from "@/lib/commerce";

export function PriceTypeSelect({ value, onChange, id, className }: { value: PriceType; onChange: (v: PriceType) => void; id?: string; className?: string }) {
  const t = useTranslations("commerce.priceTypes");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PriceType)}>
      <SelectTrigger id={id} className={className}><SelectValue /></SelectTrigger>
      <SelectContent>{PRICE_TYPES.map((p) => <SelectItem key={p} value={p}>{t(p)}</SelectItem>)}</SelectContent>
    </Select>
  );
}
