"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Eye, MapPin, Phone, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/basic";
import { EmptyState } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Thumb } from "@/components/shared/thumb";
import type { SupplierDTO } from "@/lib/suppliers";
import { lname } from "@/lib/i18n-data";
import { normalizeSearch } from "@/lib/utils";

/** Supplier cards with a search on name, phone numbers and product names. `actions` adds buttons next to "view". */
export function SupplierList({ suppliers, viewBase, actions, emptyAction }: {
  suppliers: SupplierDTO[];
  viewBase: string;
  actions?: (s: SupplierDTO) => React.ReactNode;
  emptyAction?: React.ReactNode;
}) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return suppliers;
    const digits = needle.replace(/\D/g, "");
    return suppliers.filter((s) =>
      normalizeSearch(s.fullName).includes(needle)
      || (digits.length > 0 && (s.phone.includes(digits) || s.phone2.includes(digits)))
      || s.products.some((p) => normalizeSearch(p.name).includes(needle) || normalizeSearch(p.nameAr).includes(needle)));
  }, [suppliers, query]);

  if (suppliers.length === 0) {
    return <EmptyState icon={<Truck />} title={t("emptyTitle")} description={t("emptyText")} action={emptyAction} />;
  }

  return (
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={tc("searchLabel")} className="ps-9" />
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
      ) : (
        <Stagger key={query} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <StaggerItem key={s.id}>
              <article className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sage-soft text-primary"><Truck className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-lg font-semibold">{s.fullName}</h3>
                    <Badge variant="lemon" className="mt-1">{t("productsCount", { count: s.products.length })}</Badge>
                  </div>
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /><span dir="ltr">{s.phone}{s.phone2 && ` · ${s.phone2}`}</span></li>
                  {s.address && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{s.address}</span></li>}
                </ul>
                {s.products.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.products.slice(0, 5).map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 py-0.5 pe-2.5 ps-0.5 text-xs">
                        <Thumb src={p.imageUrl} className="h-5 w-5 rounded-full" />{lname(p, locale)}
                      </span>
                    ))}
                    {s.products.length > 5 && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">+{s.products.length - 5}</span>}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-end gap-1 pt-1">
                  <Button asChild variant="outline" size="sm"><Link href={`${viewBase}/${s.id}`}><Eye />{tc("view")}</Link></Button>
                  {actions?.(s)}
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

/** Full supplier details and every product. */
export function SupplierDetail({ supplier }: { supplier: SupplierDTO }) {
  const t = useTranslations("suppliers");
  const locale = useLocale();
  const info = [
    { icon: Phone, label: t("phone"), value: supplier.phone, ltr: true },
    { icon: Phone, label: t("phone2"), value: supplier.phone2 || "—", ltr: true },
    { icon: MapPin, label: t("address"), value: supplier.address || "—", ltr: false },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="font-serif text-lg font-semibold">{t("details")}</h2>
        <dl className="space-y-3">
          {info.map(({ icon: Icon, label, value, ltr }) => (
            <div key={label} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm font-medium" dir={ltr ? "ltr" : undefined}>
                  {ltr && value !== "—" ? <a href={`tel:${value}`} className="hover:underline">{value}</a> : value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold">{t("products")}</h2>
          <Badge variant="lemon">{t("productsCount", { count: supplier.products.length })}</Badge>
        </div>
        {supplier.products.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {supplier.products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border bg-background/60 p-2.5">
                <Thumb src={p.imageUrl} className="h-12 w-12" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{lname(p, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
