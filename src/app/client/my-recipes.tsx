"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/basic";
import { EmptyState } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { lname } from "@/lib/i18n-data";
import { cn, normalizeSearch } from "@/lib/utils";
import { PortalRecipeCardView, type PortalRecipeCard } from "./recipe-card";

export function MyRecipes({ recipes, packs }: { recipes: (PortalRecipeCard & { packIds: string[] })[]; packs: { id: string; name: string; nameAr: string }[] }) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [pack, setPack] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (recipes.length === 0) return <EmptyState icon={<BookOpen />} title={t("noRecipesTitle")} description={t("noRecipesText")} />;

  const filtered = recipes.filter((r) =>
    (pack === "all" || r.packIds.includes(pack)) &&
    (!q || normalizeSearch(`${r.name} ${r.nameAr} ${r.description}`).includes(normalizeSearch(q)))
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchRecipes")} className="pe-10 ps-9" aria-label={t("searchRecipes")} />
          <kbd className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">/</kbd>
        </div>
        {packs.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group">
            {[{ id: "all", name: t("allPacks"), nameAr: t("allPacks") }, ...packs].map((p) => (
              <button key={p.id} type="button" onClick={() => setPack(p.id)} aria-pressed={pack === p.id}
                className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  pack === p.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50")}>
                {p.id === "all" ? p.name : lname(p, locale)}
              </button>
            ))}
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="py-14 text-center text-muted-foreground">{t("noResults")}</p>
      ) : (
        <Stagger key={`${q}-${pack}`} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((r) => <StaggerItem key={r.id}><PortalRecipeCardView r={r} /></StaggerItem>)}
        </Stagger>
      )}
    </div>
  );
}
