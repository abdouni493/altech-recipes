import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, HandCoins, Receipt, Wallet } from "lucide-react";
import { Card } from "@/components/ui/basic";
import { db, q } from "@/lib/db";
import type { Profile } from "@/lib/db-types";
import { hasPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/commerce";
import { toNumber } from "@/lib/utils";

const sum = (rows: Record<string, unknown>[], key: string) => rows.reduce((s, r) => s + toNumber(r[key]), 0);

/** Today's sales, debts to collect / to pay and low-stock products, for staff allowed to see them. */
export async function CommerceStats({ user }: { user: Profile }) {
  const t = await getTranslations("dashboard.commerce");
  const locale = await getLocale();
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Algiers" }));
  today.setHours(0, 0, 0, 0);
  const canSales = hasPermission(user, "sales.view");
  const canPurchases = hasPermission(user, "purchases.view");
  const canProducts = hasPermission(user, "products.view");
  if (!canSales && !canPurchases && !canProducts) return null;

  const [todaySales, clientDebt, supplierDebt, stock] = await Promise.all([
    canSales ? q<{ total: number }[]>(db().from("sales").select("total").gte("sold_at", today.toISOString())).catch(() => []) : [],
    canSales ? q<{ remaining: number }[]>(db().from("sales").select("remaining").gt("remaining", 0)).catch(() => []) : [],
    canPurchases ? q<{ remaining: number }[]>(db().from("purchases").select("remaining").gt("remaining", 0)).catch(() => []) : [],
    canProducts ? q<{ stockQuantity: number; minStockAlert: number }[]>(db().from("products").select("stock_quantity, min_stock_alert")).catch(() => []) : [],
  ]);
  const low = stock.filter((p) => toNumber(p.stockQuantity) <= toNumber(p.minStockAlert)).length;

  const cards = [
    canSales && { key: "todaySales", value: formatMoney(sum(todaySales, "total"), locale), hint: t("salesCount", { count: todaySales.length }), icon: Receipt, href: "/admin/sales", tone: "bg-sage-soft text-primary" },
    canSales && { key: "toCollect", value: formatMoney(sum(clientDebt, "remaining"), locale), hint: t("invoicesCount", { count: clientDebt.length }), icon: HandCoins, href: "/admin/sales", tone: "bg-success/15 text-success" },
    canPurchases && { key: "toPay", value: formatMoney(sum(supplierDebt, "remaining"), locale), hint: t("purchasesCount", { count: supplierDebt.length }), icon: Wallet, href: "/admin/purchases", tone: "bg-destructive/12 text-destructive" },
    canProducts && { key: "lowStock", value: String(low), hint: t("lowStockHint"), icon: AlertTriangle, href: "/admin/products", tone: "bg-warning/15 text-warning" },
  ].filter(Boolean) as { key: string; value: string; hint: string; icon: typeof Receipt; href: string; tone: string }[];

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.key} href={c.href} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="flex h-full items-center gap-4 p-4 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lift sm:p-5">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${c.tone}`}><c.icon className="h-6 w-6" /></div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">{t(c.key)}</div>
              <div className="truncate text-xl font-bold tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.hint}</div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
