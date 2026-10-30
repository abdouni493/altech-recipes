import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db, n, q } from "@/lib/db";
import type { Product, Unit } from "@/lib/db-types";
import { staffPageGuard } from "@/lib/authz";
import { unitDTO } from "@/lib/dto";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { UnitsProvider } from "@/components/shared/units";
import { ProductsView, type StockProductDTO } from "./products-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("products"))("title") };
}

type LastPurchaseRow = { productId: string; unitCost: number; purchase: { purchasedAt: string; createdAt: string; supplier: { fullName: string } | null } | null };

export default async function ProductsPage() {
  await staffPageGuard("products.view");
  const t = await getTranslations("products");
  const [products, units, lines] = await Promise.all([
    q<(Product & { unit: Unit; ingredients: unknown })[]>(db().from("products").select("*, unit:units(*), ingredients:recipe_ingredients(count)").order("name")),
    q<Unit[]>(db().from("units").select("*").order("dimension").order("factor", { ascending: false })),
    q<LastPurchaseRow[]>(db().from("purchase_items").select("product_id, unit_cost, purchase:purchases(purchased_at, created_at, supplier:suppliers(full_name))")).catch(() => []),
  ]);
  // Most recent purchase line per product.
  const last = new Map<string, LastPurchaseRow>();
  for (const l of lines) {
    const key = (r: LastPurchaseRow) => `${r.purchase?.purchasedAt ?? ""}${r.purchase?.createdAt ?? ""}`;
    const cur = last.get(l.productId);
    if (!cur || key(l) > key(cur)) last.set(l.productId, l);
  }
  const data: StockProductDTO[] = products.map((p) => {
    const lp = last.get(p.id);
    return {
      id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr,
      imageUrl: p.imageUrl, unitId: p.unitId, unit: unitDTO(p.unit), recipeCount: n(p.ingredients),
      barcode: p.barcode, purchasePrice: toNumber(p.purchasePrice), priceDetail: toNumber(p.priceDetail), priceReseller: toNumber(p.priceReseller),
      priceWholesale: toNumber(p.priceWholesale), stockQuantity: toNumber(p.stockQuantity), minStockAlert: toNumber(p.minStockAlert),
      isVisibleOnWebsite: p.isVisibleOnWebsite, isOutOfStock: p.isOutOfStock,
      lastPurchase: lp ? { date: lp.purchase?.purchasedAt ?? null, supplier: lp.purchase?.supplier?.fullName ?? null, unitCost: toNumber(lp.unitCost) } : null,
    };
  });
  return (
    <UnitsProvider initial={units.map(unitDTO)}>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ProductsView products={data} />
    </UnitsProvider>
  );
}
