import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import type { PublicRecipe } from "@/lib/public-queries";
import { ldesc, lname } from "@/lib/i18n-data";
import { formatMoney } from "@/lib/commerce";

/** Public card: image, name and description only. */
export function PublicRecipeCard({ recipe, locale, cta }: { recipe: PublicRecipe; locale: string; cta: string }) {
  const name = lname(recipe, locale);
  return (
    <Link href={`/recettes/${recipe.id}`} className="group block h-full focus-visible:outline-none">
      <article className="flex h-full flex-col">
        <div className="relative overflow-hidden bg-muted transition-shadow duration-500 group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-ring">
          {recipe.imageUrl
            ? <img src={recipe.imageUrl} alt={name} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]" />
            : <div className="grid aspect-[4/5] place-items-center"><BookOpen className="h-10 w-10 text-muted-foreground" /></div>}
          <span className="absolute inset-0 bg-primary/0 transition-colors duration-500 group-hover:bg-primary/15" />
          <span className="absolute bottom-3 end-3 grid h-10 w-10 translate-y-2 place-items-center rounded-full bg-lemon text-lemon-foreground opacity-0 shadow-sm backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4 flip-rtl" />
          </span>
        </div>
        <div className="space-y-2 pt-4 text-center">
          <h3 className="font-serif text-xl font-bold leading-snug transition-colors group-hover:text-primary">{name}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{ldesc(recipe, locale)}</p>
          {recipe.price !== null && recipe.price !== undefined && <p className="font-semibold text-primary">{formatMoney(Number(recipe.price), locale)}</p>}
          <span className="tag mt-1">{cta}</span>
        </div>
      </article>
    </Link>
  );
}
