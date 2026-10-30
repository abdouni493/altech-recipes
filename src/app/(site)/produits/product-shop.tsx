"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Package, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/basic";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import type { PublicProduct } from "@/lib/public-queries";
import { formatMoney } from "@/lib/commerce";
import { ldesc, lname } from "@/lib/i18n-data";
import { useSiteCart } from "@/lib/site-cart";
import { normalizeSearch } from "@/lib/utils";

export function ProductShop({ products }: { products: PublicProduct[] }) {
  const t = useTranslations("site");
  const locale = useLocale();
  const cart = useSiteCart();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = normalizeSearch(q);
    return s ? products.filter((p) => normalizeSearch(`${p.name} ${p.nameAr} ${p.description} ${p.descriptionAr}`).includes(s)) : products;
  }, [products, q]);
  const count = cart.items.filter((i) => i.type === "PRODUCT").reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mt-10 space-y-8 pb-20">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("productsSearch")} className="h-11 ps-9" aria-label={t("productsSearch")} />
        </div>
        <Button asChild size="lg"><Link href="/commander"><ShoppingBag />{t("viewOrder")}{cart.items.length > 0 && ` (${cart.items.length})`}</Link></Button>
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground"><Package className="h-10 w-10" />{t("noProducts")}</div>
      ) : (
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => {
            const inCart = cart.items.find((i) => i.type === "PRODUCT" && i.id === p.id);
            return (
              <StaggerItem key={p.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="relative aspect-square bg-muted">
                    {p.imageUrl ? <img src={p.imageUrl} alt={lname(p, locale)} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-10 w-10 text-muted-foreground" /></div>}
                    {p.isOutOfStock && <Badge variant="destructive" className="absolute start-3 top-3 bg-destructive text-destructive-foreground">{t("outOfStock")}</Badge>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-serif text-lg font-bold leading-snug">{lname(p, locale)}</h3>
                    <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{ldesc(p, locale)}</p>
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <span className="text-lg font-bold text-primary">{formatMoney(p.price, locale)}</span>
                      <Button size="sm" disabled={p.isOutOfStock} variant={inCart ? "secondary" : "default"}
                        onClick={() => { cart.add("PRODUCT", p.id); toast.success(t("addedToOrder", { name: lname(p, locale) })); }}>
                        {inCart ? <Check /> : <ShoppingBag />}{inCart ? `${t("inOrder")} (${inCart.quantity})` : t("addToOrder")}
                      </Button>
                    </div>
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
      {count > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lift backdrop-blur">
          <span className="text-sm">{t("productsInOrder", { count })}</span>
          <Button asChild size="sm"><Link href="/commander">{t("finishOrder")}</Link></Button>
        </div>
      )}
    </div>
  );
}
