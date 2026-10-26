import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, BookOpen, Lock, ShoppingBag } from "lucide-react";
import { getPublicRecipe, getPublicRecipes } from "@/lib/public-queries";
import { Button } from "@/components/ui/button";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/motion";
import { PublicRecipeCard } from "@/components/site/public-recipe-card";
import { ldesc, lname } from "@/lib/i18n-data";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const r = await getPublicRecipe(params.id);
  if (!r) return {};
  const locale = await getLocale();
  return { title: lname(r, locale), description: ldesc(r, locale).slice(0, 160), openGraph: { images: r.imageUrl ? [r.imageUrl] : undefined } };
}

export default async function PublicRecipePage({ params }: { params: { id: string } }) {
  const recipe = await getPublicRecipe(params.id);
  if (!recipe) notFound();
  const locale = await getLocale();
  const t = await getTranslations("site");
  const others = (await getPublicRecipes()).filter((r) => r.id !== recipe.id).slice(0, 3);
  const name = lname(recipe, locale);

  return (
    <div className="container pt-8 md:pt-12">
      <Link href="/recettes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 flip-rtl" />{t("backToRecipes")}
      </Link>
      <div className="mt-6 grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-muted shadow-lift">
            {recipe.imageUrl ? <img src={recipe.imageUrl} alt={name} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center"><BookOpen className="h-12 w-12 text-muted-foreground" /></div>}
          </div>
        </Reveal>
        <Reveal delay={0.1} className="space-y-6">
          <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">{name}</h1>
          <p className="whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{ldesc(recipe, locale)}</p>
          <div className="flex gap-3 rounded-2xl border border-dashed border-primary/40 bg-sage-soft/40 p-4 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t("recipeTeaser")}
          </div>
          <Button asChild size="lg"><Link href={`/commander?recipe=${recipe.id}`}><ShoppingBag />{t("orderThis")}</Link></Button>
        </Reveal>
      </div>
      {others.length > 0 && (
        <section className="mt-24">
          <h2 className="font-serif text-2xl font-semibold sm:text-3xl">{t("featuredTitle")}</h2>
          <Stagger className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((r) => <StaggerItem key={r.id}><PublicRecipeCard recipe={r} locale={locale} cta={t("discover")} /></StaggerItem>)}
          </Stagger>
        </section>
      )}
    </div>
  );
}
