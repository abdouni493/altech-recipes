import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Beaker, Calculator } from "lucide-react";
import { clientPageGuard, getSessionUser } from "@/lib/authz";
import { db, q } from "@/lib/db";
import { getPermittedRecipe } from "@/lib/portal-queries";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic";
import { Button } from "@/components/ui/button";
import { Thumb } from "@/components/shared/thumb";
import { formatNumber } from "@/lib/format";
import { ldesc, lname } from "@/lib/i18n-data";
import { FavoriteButton } from "../../favorite-button";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // Only reveal the name to a client who has access.
  const user = await getSessionUser();
  if (!user) return {};
  const client = await q<{ id: string } | null>(db().from("clients").select("id").eq("user_id", user.id).maybeSingle()).catch(() => null);
  if (!client) return {};
  const r = await getPermittedRecipe(client.id, params.id);
  return { title: r?.name };
}

export default async function ClientRecipePage({ params }: { params: { id: string } }) {
  const client = await clientPageGuard();
  const recipe = await getPermittedRecipe(client.id, params.id);
  if (!recipe) notFound();
  const t = await getTranslations("portal");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const output = `${formatNumber(recipe.outputQuantity, locale)} ${recipe.outputUnit.symbol}`;

  return (
    <div>
      <PageHeader title={lname(recipe, locale)} backHref="/client" backLabel={t("backToRecipes")}
        actions={<>
          <FavoriteButton recipeId={recipe.id} initial={recipe.favorite} withLabel />
          <Button asChild><Link href={`/client/calculator?recipe=${recipe.id}`}><Calculator />{t("openCalculator")}</Link></Button>
        </>} />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          {recipe.imageUrl
            ? <img src={recipe.imageUrl} alt={lname(recipe, locale)} className="aspect-[16/10] w-full object-cover" />
            : <div className="grid aspect-[16/10] place-items-center bg-muted"><Beaker className="h-12 w-12 text-muted-foreground" /></div>}
          <CardContent className="space-y-3 pt-6 sm:pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="lemon">{t("baseOutput")} : {output}</Badge>
              <Badge variant="secondary">{tc("ingredientsCount", { count: recipe.ingredients.length })}</Badge>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{ldesc(recipe, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("baseIngredients")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("produces", { quantity: formatNumber(recipe.outputQuantity, locale), unit: recipe.outputUnit.symbol })}</p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {recipe.ingredients.map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-3">
                  <Thumb src={i.imageUrl} />
                  <span className="min-w-0 flex-1 truncate font-medium">{lname({ name: i.productName, nameAr: i.productNameAr }, locale)}</span>
                  <span className="whitespace-nowrap rounded-full bg-secondary px-3 py-1 font-mono text-sm">{formatNumber(i.quantity, locale)} {i.unit.symbol}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-sage-soft p-4">
              <span className="flex items-center gap-2 font-medium"><Beaker className="h-5 w-5 text-primary" />{t("baseOutput")}</span>
              <span className="font-serif text-xl font-semibold">{output}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
