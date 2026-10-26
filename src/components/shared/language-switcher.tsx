"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { setLocaleAction } from "@/actions/locale";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

const options = [
  { value: "fr", label: "Français", short: "FR" },
  { value: "ar", label: "العربية", short: "ع" },
] as const;

export function LanguageSwitcher({ variant = "ghost", className, compact = false }: { variant?: "ghost" | "outline"; className?: string; compact?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  const current = options.find((o) => o.value === locale) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className={cn("gap-1.5 rounded-full", className)} aria-label={t("language")} disabled={pending}>
          <Languages className="h-4 w-4" />
          <span className={cn(compact && "sr-only sm:not-sr-only")}>{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => change(o.value)} lang={o.value} dir={o.value === "ar" ? "rtl" : "ltr"}>
            <span className="flex-1">{o.label}</span>
            {o.value === locale && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
