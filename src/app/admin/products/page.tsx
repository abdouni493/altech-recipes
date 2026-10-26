import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { staffPageGuard } from "@/lib/authz";
import { unitDTO, type ProductDTO } from "@/lib/dto";
import { PageHeader } from "@/components/shared/page-header";
import { UnitsProvider } from "@/components/shared/units";
import { ProductsView } from "./products-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("products"))("title") };
}

export default async function ProductsPage() {
  await staffPageGuard("products.view");
  const t = await getTranslations("products");
  const [products, units] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, include: { unit: true, _count: { select: { ingredients: true } } } }),
    prisma.unit.findMany({ orderBy: [{ dimension: "asc" }, { factor: "desc" }] }),
  ]);
  const data: ProductDTO[] = products.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr,
    imageUrl: p.imageUrl, unitId: p.unitId, unit: unitDTO(p.unit), recipeCount: p._count.ingredients,
  }));
  return (
    <UnitsProvider initial={units.map(unitDTO)}>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ProductsView products={data} />
    </UnitsProvider>
  );
}
