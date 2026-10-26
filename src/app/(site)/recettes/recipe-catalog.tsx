"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/basic";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { EmptyState } from "@/components/shared/page-header";
import { PublicRecipeCard } from "@/components/site/public-recipe-card";
import type { PublicRecipe } from "@/lib/public-queries";
import { normalizeSearch } from "@/lib/utils";

export function RecipeCatalog({ recipes }: { recipes: PublicRecipe[] }) {
  const t = useTranslations("site");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const list = recipes.filter((r) => !q || normalizeSearch(`${r.name} ${r.nameAr} ${r.description} ${r.descriptionAr}`).includes(normalizeSearch(q)));

  if (recipes.length === 0) return <EmptyState className="mt-12" icon={<BookOpen />} title={t("noRecipesYet")} />;
  return (
    <>
      <div className="relative mx-auto mt-10 max-w-md">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchRecipes")} aria-label={t("searchRecipes")} className="h-12 rounded-full ps-11 shadow-soft" />
      </div>
      {list.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("noRecipes")}</p>
      ) : (
        <Stagger key={q} className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((r) => <StaggerItem key={r.id}><PublicRecipeCard recipe={r} locale={locale} cta={t("discover")} /></StaggerItem>)}
        </Stagger>
      )}
    </>
  );
}
