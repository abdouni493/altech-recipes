"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Calculator, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/basic";
import { formatNumber } from "@/lib/format";
import { ldesc, lname } from "@/lib/i18n-data";
import { FavoriteButton } from "./favorite-button";

export type PortalRecipeCard = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  outputQuantity: number; outputSymbol: string; ingredientsCount: number; favorite: boolean;
};

export function PortalRecipeCardView({ r }: { r: PortalRecipeCard }) {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const locale = useLocale();
  return (
    <article className="group flex h-full flex-col overflow-hidden border-b-4 border-b-transparent bg-card shadow-soft transition-all duration-500 hover:-translate-y-1.5 hover:border-b-lemon hover:shadow-lift">
      <Link href={`/client/recipes/${r.id}`} className="relative block overflow-hidden" tabIndex={-1} aria-hidden>
        {r.imageUrl
          ? <img src={r.imageUrl} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.08]" />
          : <div className="grid aspect-[4/3] place-items-center bg-muted"><BookOpen className="h-10 w-10 text-muted-foreground" /></div>}
        <Badge variant="lemon" className="absolute start-3 top-3 rounded-none border-0 bg-lemon font-label text-[11px] font-bold uppercase tracking-[0.15em] text-lemon-foreground">{formatNumber(r.outputQuantity, locale)} {r.outputSymbol}</Badge>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-serif text-lg font-bold leading-snug">
          <Link href={`/client/recipes/${r.id}`} className="hover:text-primary">{lname(r, locale)}</Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{ldesc(r, locale)}</p>
        <p className="text-xs text-muted-foreground">{tc("ingredientsCount", { count: r.ingredientsCount })}</p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <Button asChild size="sm" className="flex-1"><Link href={`/client/calculator?recipe=${r.id}`}><Calculator />{t("calculate")}</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={`/client/recipes/${r.id}`}><Eye />{t("details")}</Link></Button>
          <FavoriteButton recipeId={r.id} initial={r.favorite} className="h-8 w-8" />
        </div>
      </div>
    </article>
  );
}
