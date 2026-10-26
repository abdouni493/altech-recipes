import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { clientPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { CalculationHistory, Recipe, Unit } from "@/lib/db-types";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { toNumber } from "@/lib/utils";
import { HistoryList } from "./history-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("portal"))("historyTitle") };
}

export default async function HistoryPage() {
  const client = await clientPageGuard();
  const t = await getTranslations("portal");
  const locale = await getLocale();
  const [items, perms] = await Promise.all([
    q<(CalculationHistory & { recipe: Recipe | null; unit: Unit })[]>(
      db().from("calculation_history").select("*, recipe:recipes(*), unit:units(*)").eq("client_id", client.id).order("created_at", { ascending: false }).limit(100),
    ),
    q<{ recipeId: string }[]>(db().from("client_permissions").select("recipe_id").eq("client_id", client.id)),
  ]);
  const allowed = new Set(perms.map((p) => p.recipeId));
  const rows = items.filter((h): h is typeof h & { recipe: Recipe } => Boolean(h.recipe) && allowed.has(h.recipeId)).map((h) => ({
    id: h.id, recipeId: h.recipeId, recipeName: lname(h.recipe, locale), imageUrl: h.recipe.imageUrl,
    target: `${formatNumber(toNumber(h.targetQuantity), locale)} ${h.unit.symbol}`,
    href: `/client/calculator?recipe=${h.recipeId}&qty=${toNumber(h.targetQuantity)}&unit=${h.unitId}`,
    date: formatDate(h.createdAt, locale, true),
  }));
  return (
    <>
      <PageHeader title={t("historyTitle")} description={t("historySubtitle")} />
      <HistoryList rows={rows} />
    </>
  );
}
