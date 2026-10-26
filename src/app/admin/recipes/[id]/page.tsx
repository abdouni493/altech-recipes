import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Beaker, Boxes, Eye, EyeOff, Users } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic";
import { Thumb } from "@/components/shared/thumb";
import { formatDate, formatNumber } from "@/lib/format";
import { ldesc, lname } from "@/lib/i18n-data";
import { toNumber } from "@/lib/utils";
import { RecipeDetailActions } from "../recipe-actions";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const r = await prisma.recipe.findUnique({ where: { id: params.id }, select: { name: true } });
  return { title: r?.name ?? "—" };
}

export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
  await staffPageGuard("recipes.view");
  const t = await getTranslations("recipes");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const recipe = await prisma.recipe.findUnique({
    where: { id: params.id },
    include: {
      outputUnit: true,
      ingredients: { orderBy: { position: "asc" }, include: { product: true, unit: true } },
      packs: { include: { pack: true } },
      _count: { select: { permissions: true } },
    },
  });
  if (!recipe) notFound();
  const name = lname(recipe, locale);
  const output = `${formatNumber(toNumber(recipe.outputQuantity), locale)} ${recipe.outputUnit.symbol}`;

  return (
    <div>
      <PageHeader title={name} backHref="/admin/recipes" backLabel={t("title")} actions={<RecipeDetailActions id={recipe.id} name={name} />} />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            {recipe.imageUrl ? (
              <img src={recipe.imageUrl} alt={name} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="grid aspect-[16/10] place-items-center bg-muted text-muted-foreground"><Beaker className="h-12 w-12" /></div>
            )}
            <CardContent className="space-y-4 pt-6 sm:pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant={recipe.isVisibleOnWebsite ? "success" : "secondary"}>
                  {recipe.isVisibleOnWebsite ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {t("website")} : {recipe.isVisibleOnWebsite ? t("visibleBadge") : t("hiddenBadge")}
                </Badge>
                <Badge variant="lemon">{t("produces")} : {output}</Badge>
                <Badge variant="secondary">{tc("ingredientsCount", { count: recipe.ingredients.length })}</Badge>
              </div>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{ldesc(recipe, locale) || "—"}</p>
              <p className="text-xs text-muted-foreground">{tc("createdAt")} {formatDate(recipe.createdAt, locale)} · {tc("updatedAt")} {formatDate(recipe.updatedAt, locale)}</p>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("detailIngredients")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("detailBase", { quantity: formatNumber(toNumber(recipe.outputQuantity), locale), unit: recipe.outputUnit.symbol })}</p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-xl border">
                {recipe.ingredients.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-3">
                    <Thumb src={i.product.imageUrl} />
                    <span className="min-w-0 flex-1 truncate font-medium">{lname(i.product, locale)}</span>
                    <span className="whitespace-nowrap rounded-full bg-secondary px-3 py-1 font-mono text-sm">
                      {formatNumber(toNumber(i.quantity), locale)} {i.unit.symbol}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-sage-soft p-4">
                <span className="flex items-center gap-2 font-medium"><Beaker className="h-5 w-5 text-primary" />{t("output")}</span>
                <span className="font-serif text-xl font-semibold">{output}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" />{t("inPacks")}</CardTitle></CardHeader>
            <CardContent>
              {recipe.packs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noPacks")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recipe.packs.map((p) => (
                    <Link key={p.packId} href={`/admin/packs?edit=${p.packId}`} className="rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:border-primary hover:text-primary">
                      {lname(p.pack, locale)}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />{t("clientsWithAccess")} : <span className="font-semibold text-foreground">{recipe._count.permissions}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
