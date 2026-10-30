import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Pack } from "@/lib/db-types";
import type { RecipeLiteDTO } from "@/lib/dto";
import { PageHeader } from "@/components/shared/page-header";
import { PacksView, type PackRow } from "./packs-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("packs"))("title") };
}

export default async function PacksPage() {
  await staffPageGuard("packs.view");
  const t = await getTranslations("packs");
  const [packs, recipes] = await Promise.all([
    q<(Pack & { recipes: { recipe: RecipeLiteDTO | null }[]; permissions: { clientId: string }[] })[]>(
      db().from("packs")
        .select("*, recipes:pack_recipes(recipe:recipes(id, name, name_ar, image_url)), permissions:client_permissions(client_id)")
        .order("created_at"),
    ),
    q<RecipeLiteDTO[]>(db().from("recipes").select("id, name, name_ar, image_url").order("name")),
  ]);
  const rows: PackRow[] = packs.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr, imageUrl: p.imageUrl,
    recipes: p.recipes.flatMap((r) => (r.recipe ? [r.recipe] : [])),
    clients: new Set(p.permissions.map((x) => x.clientId)).size,
    price: p.price === null || p.price === undefined ? null : Number(p.price),
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <PacksView packs={rows} recipes={recipes} />
    </>
  );
}
