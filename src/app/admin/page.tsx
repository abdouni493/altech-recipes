import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, Boxes, CheckCircle2, Clock, FlaskConical, Plus, Users } from "lucide-react";
import { countOf, db, n, q } from "@/lib/db";
import type { Order, Pack, Recipe, Unit } from "@/lib/db-types";
import { redirect } from "next/navigation";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission, staffHome } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/basic";
import { Button } from "@/components/ui/button";
import { AnimatedCounter, Reveal, Stagger, StaggerItem, TextReveal } from "@/components/shared/motion";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { formatDate, formatMonth, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { toNumber } from "@/lib/utils";
import { OrdersChart } from "./orders-chart";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("dashboard"))("title") };
}

export default async function DashboardPage() {
  const admin = await staffPageGuard();
  if (!hasPermission(admin, "dashboard.view")) redirect(staffHome(admin));
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(admin, p);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  const count = (table: string) => countOf(db().from(table).select("*", { count: "exact", head: true })).catch(() => 0);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [products, recipes, packs, clients, pending, confirmed, latestOrders, recentRecipes, chartOrders] = await Promise.all([
    // A worker only sees the modules their permissions allow (RLS): anything else counts as empty.
    count("products"),
    count("recipes"),
    count("packs"),
    count("clients"),
    countOf(db().from("orders").select("id", { count: "exact", head: true }).eq("status", "PENDING")).catch(() => 0),
    countOf(db().from("orders").select("id", { count: "exact", head: true }).eq("status", "CONFIRMED")).catch(() => 0),
    q<(Order & { recipe: Recipe | null; pack: Pack | null })[]>(
      db().from("orders").select("*, recipe:recipes(*), pack:packs(*)").order("created_at", { ascending: false }).limit(6),
    ).catch(() => []),
    q<(Recipe & { outputUnit: Unit; ingredients: unknown })[]>(
      db().from("recipes").select("*, outputUnit:units!recipes_output_unit_id_fkey(*), ingredients:recipe_ingredients(count)")
        .order("created_at", { ascending: false }).limit(5),
    ).catch(() => []),
    q<{ createdAt: string }[]>(db().from("orders").select("created_at").gte("created_at", sixMonthsAgo.toISOString())).catch(() => []),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(sixMonthsAgo);
    d.setMonth(sixMonthsAgo.getMonth() + i);
    return d;
  });
  const chartData = months.map((m) => ({
    month: formatMonth(m, locale),
    count: chartOrders.map((o) => new Date(o.createdAt)).filter((d) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth()).length,
  }));

  const stats = [
    { key: "products", value: products, icon: FlaskConical, href: "/admin/products", tone: "bg-sage-soft text-primary" },
    { key: "recipes", value: recipes, icon: BookOpen, href: "/admin/recipes", tone: "bg-accent text-accent-foreground" },
    { key: "packs", value: packs, icon: Boxes, href: "/admin/packs", tone: "bg-secondary text-secondary-foreground" },
    { key: "clients", value: clients, icon: Users, href: "/admin/clients", tone: "bg-sage-soft text-primary" },
    { key: "pendingOrders", value: pending, icon: Clock, href: "/admin/orders?status=PENDING", tone: "bg-warning/15 text-[hsl(30_70%_35%)] dark:text-warning" },
    { key: "confirmedOrders", value: confirmed, icon: CheckCircle2, href: "/admin/orders?status=CONFIRMED", tone: "bg-success/15 text-success" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{t("title")}</p>
          <TextReveal as="h1" inView={false} delay={0.2} text={t("greeting", { name: admin.name })} className="mt-2 block font-serif text-3xl font-bold sm:text-5xl" />
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("products.create") && <Button asChild variant="outline" size="sm"><Link href="/admin/products?new=1"><Plus />{t("newProduct")}</Link></Button>}
          {can("clients.create") && <Button asChild variant="outline" size="sm"><Link href="/admin/clients/new"><Plus />{t("newClient")}</Link></Button>}
          {can("recipes.create") && <Button asChild size="sm"><Link href="/admin/recipes/new"><Plus />{t("newRecipe")}</Link></Button>}
        </div>
      </div>

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StaggerItem key={s.key}>
            <Link href={s.href} className="group block h-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="relative h-full overflow-hidden border-t-4 border-t-primary p-4 transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-lift sm:p-5">
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-lemon transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100 rtl:origin-right" />
                <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${s.tone} transition-transform duration-500 group-hover:rotate-12`}><s.icon className="h-5 w-5" /></div>
                <div className="font-serif text-4xl font-bold"><AnimatedCounter value={s.value} /></div>
                <div className="mt-1 font-label text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{t(`stats.${s.key}`)}</div>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>{t("ordersPerMonth")}</CardTitle>
              <CardDescription>{t("ordersPerMonthHint")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent><OrdersChart data={chartData} label={t("orders")} /></CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t("recentRecipes")}</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/admin/recipes">{t("seeAll")}<ArrowRight className="flip-rtl" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentRecipes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("noRecipes")}</p>}
            {recentRecipes.map((r) => (
              <Link key={r.id} href={`/admin/recipes/${r.id}`} className="flex items-center gap-3 rounded-sm p-2 transition-all duration-300 hover:bg-sage-soft hover:ps-3">
                {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-lemon/60" /> : <div className="h-12 w-12 rounded-full bg-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{lname(r, locale)}</div>
                  <div className="text-xs text-muted-foreground">
                    {tc("ingredientsCount", { count: n(r.ingredients) })} · {formatNumber(toNumber(r.outputQuantity), locale)} {r.outputUnit.symbol}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t("latestOrders")}</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link href="/admin/orders">{t("seeAll")}<ArrowRight className="flip-rtl" /></Link></Button>
        </CardHeader>
        <CardContent>
          {latestOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noOrders")}</p>
          ) : (
            <ul className="divide-y">
              {latestOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders?open=${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/60">
                    <span className="font-mono text-xs text-muted-foreground">{o.orderNumber}</span>
                    <span className="min-w-[8rem] flex-1 font-medium">{o.fullName}</span>
                    <span className="hidden text-sm text-muted-foreground md:inline">{o.wilayaCode} · {o.wilayaName}</span>
                    <span className="hidden text-sm text-muted-foreground lg:inline">{o.recipe ? lname(o.recipe, locale) : o.pack ? lname(o.pack, locale) : "—"}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(o.createdAt, locale)}</span>
                    <OrderStatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </Reveal>
    </div>
  );
}
