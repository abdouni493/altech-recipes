"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/basic";
import { EmptyState } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Thumb } from "@/components/shared/thumb";
import { lname } from "@/lib/i18n-data";
import { normalizeSearch } from "@/lib/utils";

export function RecipePicker({ recipes }: { recipes: { id: string; name: string; nameAr: string; imageUrl: string | null; output: string }[] }) {
  const t = useTranslations("calculator");
  const tp = useTranslations("portal");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (recipes.length === 0) return <EmptyState icon={<BookOpen />} title={tp("noRecipesTitle")} description={tp("noRecipesText")} />;
  const list = recipes.filter((r) => !q || normalizeSearch(`${r.name} ${r.nameAr}`).includes(normalizeSearch(q)));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold">{t("chooseRecipe")}</h2>
        <p className="text-sm text-muted-foreground">{t("chooseRecipeHint")}</p>
      </div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tp("searchRecipes")} className="ps-9" aria-label={tp("searchRecipes")} />
      </div>
      {list.length === 0 ? <p className="py-10 text-center text-muted-foreground">{tp("noResults")}</p> : (
        <Stagger key={q} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <StaggerItem key={r.id}>
              <Link href={`/client/calculator?recipe=${r.id}`}
                className="group flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Thumb src={r.imageUrl} className="h-14 w-14 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{lname(r, locale)}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">{r.output}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 flip-rtl rtl:group-hover:-translate-x-1" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
