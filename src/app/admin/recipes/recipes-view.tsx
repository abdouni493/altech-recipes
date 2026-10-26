"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, EyeOff, LayoutGrid, Plus, Rows3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/basic";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Thumb } from "@/components/shared/thumb";
import { formatNumber } from "@/lib/format";
import { ldesc, lname } from "@/lib/i18n-data";
import { cn, excerpt } from "@/lib/utils";
import { RecipeRowMenu } from "./recipe-actions";

export type RecipeRow = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  ingredients: number; packs: number; outputQuantity: number; outputSymbol: string; visible: boolean; createdAt: string;
};

const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function RecipesView({ rows }: { rows: RecipeRow[] }) {
  const t = useTranslations("recipes");
  const tc = useTranslations("common");
  const locale = useLocale();
  const can = useCan();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      const v = localStorage.getItem("recipes-view");
      if (v === "grid" || v === "table") setView(v);
    } catch {}
  }, []);
  function changeView(v: "grid" | "table") {
    setView(v);
    try { localStorage.setItem("recipes-view", v); } catch {}
  }

  const columns = useMemo<ColumnDef<RecipeRow, unknown>[]>(() => [
    { id: "image", header: tc("image"), enableSorting: false, meta: { className: "w-16" }, cell: ({ row }) => <Thumb src={row.original.imageUrl} /> },
    {
      id: "name", accessorFn: (r) => lname(r, locale), header: tc("name"),
      cell: ({ row }) => (
        <Link href={`/admin/recipes/${row.original.id}`} className="font-medium hover:text-primary hover:underline">
          {lname(row.original, locale)}
          {!row.original.visible && <EyeOff className="ms-2 inline h-3.5 w-3.5 text-muted-foreground" aria-label={t("hiddenBadge")} />}
        </Link>
      ),
    },
    { id: "ingredients", accessorKey: "ingredients", header: t("ingredientsCount"), cell: ({ row }) => <Badge variant="secondary">{row.original.ingredients}</Badge> },
    {
      id: "output", accessorFn: (r) => r.outputQuantity, header: t("output"),
      cell: ({ row }) => <span className="font-mono text-sm">{formatNumber(row.original.outputQuantity, locale)} {row.original.outputSymbol}</span>,
    },
    { id: "actions", header: () => <span className="sr-only">{tc("actions")}</span>, enableSorting: false, meta: { className: "w-14 text-end" },
      cell: ({ row }) => <RecipeRowMenu id={row.original.id} name={lname(row.original, locale)} /> },
  ], [locale, t, tc]);

  const filtered = rows.filter((r) => !q || norm(`${r.name} ${r.nameAr} ${r.description}`).includes(norm(q)));

  const toggle = (
    <div className="inline-flex rounded-full border bg-card p-1" role="group" aria-label={`${tc("grid")} / ${tc("table")}`}>
      <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => changeView("grid")} aria-pressed={view === "grid"}><LayoutGrid />{tc("grid")}</Button>
      <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => changeView("table")} aria-pressed={view === "table"}><Rows3 />{tc("table")}</Button>
    </div>
  );

  if (rows.length === 0) {
    return <EmptyState icon={<BookOpen />} title={t("emptyTitle")} description={t("emptyText")}
      action={can("recipes.create") ? <Button asChild><Link href="/admin/recipes/new"><Plus />{t("new")}</Link></Button> : undefined} />;
  }

  if (view === "table") return <DataTable columns={columns} data={rows} toolbar={toggle} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc("search")} className="ps-9" aria-label={tc("searchLabel")} />
        </div>
        {toggle}
      </div>
      {filtered.length === 0 ? (
        <p className="py-14 text-center text-muted-foreground">{tc("noResults")}</p>
      ) : (
        <Stagger key={q} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((r) => (
            <StaggerItem key={r.id}>
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <Link href={`/admin/recipes/${r.id}`} className="block overflow-hidden" tabIndex={-1} aria-hidden>
                  {r.imageUrl
                    ? <img src={r.imageUrl} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    : <div className="grid aspect-[4/3] place-items-center bg-muted"><BookOpen className="h-10 w-10 text-muted-foreground" /></div>}
                </Link>
                {!r.visible && <Badge variant="secondary" className="absolute start-3 top-3 bg-card/90 backdrop-blur"><EyeOff className="h-3 w-3" />{t("hiddenBadge")}</Badge>}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg font-semibold leading-snug">
                      <Link href={`/admin/recipes/${r.id}`} className="hover:text-primary">{lname(r, locale)}</Link>
                    </h3>
                    <RecipeRowMenu id={r.id} name={lname(r, locale)} />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt(ldesc(r, locale), 120)}</p>
                  <div className={cn("mt-auto flex flex-wrap gap-2 pt-2")}>
                    <Badge variant="secondary">{tc("ingredientsCount", { count: r.ingredients })}</Badge>
                    <Badge variant="lemon">{formatNumber(r.outputQuantity, locale)} {r.outputSymbol}</Badge>
                  </div>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
