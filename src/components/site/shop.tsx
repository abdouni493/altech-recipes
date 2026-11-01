"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, Check, ExternalLink, Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, Tag, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/basic";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlays";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import type { PublicCategory } from "@/lib/public-queries";
import { formatMoney } from "@/lib/commerce";
import { ldesc, lname } from "@/lib/i18n-data";
import { qtyLabel, tierSaving, type ShopItem } from "@/lib/shop";
import { sameLine, useSiteCart } from "@/lib/site-cart";
import { cn, normalizeSearch } from "@/lib/utils";

/** Adds to the basket; `go` then opens the order page ("order now"). */
function useAddToCart() {
  const t = useTranslations("shop");
  const locale = useLocale();
  const router = useRouter();
  const cart = useSiteCart();
  return {
    cart,
    add(item: ShopItem, quantity = 1, tierId: string | null = null, go = false) {
      if (item.out) return;
      cart.add(item.kind, item.id, quantity, tierId);
      if (go) router.push("/commander");
      else toast.success(t("added", { name: lname(item, locale) }));
    },
  };
}

/** Product / recipe card: image, name, price and quantity offers; click opens the details. */
export function ShopCard({ item, onOpen }: { item: ShopItem; onOpen: () => void }) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const { cart, add } = useAddToCart();
  const name = lname(item, locale);
  const inCart = cart.items.filter((i) => i.type === item.kind && i.id === item.id).reduce((s, i) => s + i.quantity, 0);
  const tiers = item.tiers ?? [];
  const best = item.price ? Math.max(0, ...tiers.map((tr) => tierSaving(item.price!, tr))) : 0;
  const Icon = item.kind === "RECIPE" ? BookOpen : Package;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift">
      <button type="button" onClick={onOpen} className="relative block aspect-square w-full overflow-hidden bg-gradient-to-br from-sage-soft via-background to-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={`${t("details")} — ${name}`}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
          : <span className="grid h-full place-items-center"><Icon className="h-10 w-10 text-primary/50" /></span>}
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute start-2 top-2 flex flex-col items-start gap-1">
          <Badge className="border-0 bg-background/90 text-[10px] text-foreground shadow-sm backdrop-blur sm:text-xs"><Icon className="h-3 w-3 text-primary" />{t(item.kind === "RECIPE" ? "recipe" : "product")}</Badge>
          {item.out && <Badge variant="destructive" className="text-[10px] sm:text-xs">{t("outOfStock")}</Badge>}
        </span>
        {best > 0 && <span className="absolute end-2 top-2 rounded-full bg-lemon px-2 py-0.5 text-[11px] font-bold text-lemon-foreground shadow-sm">{t("offerSave", { percent: best })}</span>}
        {inCart > 0 && <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow"><Check className="h-3 w-3" />{qtyLabel(inCart)}</span>}
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-4">
        <button type="button" onClick={onOpen} className="text-start">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-primary sm:text-base">{name}</h3>
        </button>
        <p className="hidden line-clamp-2 text-xs text-muted-foreground sm:block">{ldesc(item, locale)}</p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-1 pt-1">
          {item.price !== null
            ? <><span className="text-base font-extrabold text-primary sm:text-lg">{formatMoney(item.price, locale)}</span>
                {item.unitSymbol && <span className="text-[11px] text-muted-foreground">{t("perUnit", { unit: item.unitSymbol })}</span>}</>
            : <span className="text-xs font-medium text-muted-foreground">{t("priceOnRequest")}</span>}
        </div>
        {tiers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tiers.slice(0, 2).map((tr) => (
              <span key={tr.id} className="rounded-md bg-sage-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary sm:text-[11px]">
                {qtyLabel(tr.quantity)} {item.unitSymbol} · {formatMoney(tr.price, locale)}
              </span>
            ))}
            {tiers.length > 2 && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">+{tiers.length - 2}</span>}
          </div>
        )}
        <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" className="h-9 w-9" disabled={item.out} onClick={() => add(item)} aria-label={`${t("addToCart")} — ${name}`} title={t("addToCart")}>
            <ShoppingCart />
          </Button>
          <Button type="button" size="sm" className="h-9 px-2 text-xs sm:text-sm" disabled={item.out} onClick={() => add(item, 1, null, true)}>
            <Zap className="h-3.5 w-3.5" />{t("orderNow")}
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Full details with the quantity offers, a quantity stepper and the live total. */
export function ShopItemDialog({ item, onClose }: { item: ShopItem | null; onClose: () => void }) {
  const t = useTranslations("shop");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { cart, add } = useAddToCart();
  const [tierId, setTierId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Reset the choice each time another item opens.
  if (item && shownFor !== `${item.kind}:${item.id}`) { setShownFor(`${item.kind}:${item.id}`); setTierId(null); setQty(1); }
  if (!item) return null;
  const name = lname(item, locale);
  const tiers = item.tiers ?? [];
  const tier = tiers.find((x) => x.id === tierId) ?? null;
  const total = tier ? tier.price * qty : (item.price ?? 0) * qty;
  const inCart = cart.items.find((i) => sameLine(i, { type: item.kind, id: item.id, tierId }));
  const Icon = item.kind === "RECIPE" ? BookOpen : Package;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-y-auto p-0" closeLabel={tc("close")}>
        <div className="grid md:grid-cols-2">
          <div className="relative bg-gradient-to-br from-sage-soft to-accent">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={name} className="aspect-[4/3] h-full w-full object-cover md:aspect-auto" />
              : <div className="grid aspect-[4/3] place-items-center md:h-full"><Icon className="h-14 w-14 text-primary/50" /></div>}
            {item.out && <Badge variant="destructive" className="absolute start-3 top-3">{t("outOfStock")}</Badge>}
          </div>
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="space-y-2 pe-6">
              <Badge variant="secondary"><Icon className="h-3 w-3" />{t(item.kind === "RECIPE" ? "recipe" : "product")}</Badge>
              <DialogTitle className="font-serif text-2xl font-bold leading-tight">{name}</DialogTitle>
              {item.price !== null
                ? <p className="text-2xl font-extrabold text-primary">{formatMoney(item.price, locale)}{item.unitSymbol && <span className="ms-1 text-sm font-medium text-muted-foreground">{t("perUnit", { unit: item.unitSymbol })}</span>}</p>
                : <p className="text-sm text-muted-foreground">{t("priceOnRequest")}</p>}
            </div>
            <DialogDescription className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{ldesc(item, locale) || "—"}</DialogDescription>

            {tiers.length > 0 && item.price !== null && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Tag className="h-4 w-4 text-primary" />{t("chooseOffer")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[null, ...tiers].map((tr) => {
                    const active = (tr?.id ?? null) === tierId;
                    const saving = tr ? tierSaving(item.price!, tr) : 0;
                    return (
                      <button key={tr?.id ?? "unit"} type="button" onClick={() => setTierId(tr?.id ?? null)} aria-pressed={active}
                        className={cn("relative rounded-xl border-2 p-2.5 text-start transition", active ? "border-primary bg-sage-soft" : "hover:border-primary/40")}>
                        <span className="block text-sm font-bold">{tr ? `${qtyLabel(tr.quantity)} ${item.unitSymbol ?? ""}` : `1 ${item.unitSymbol ?? ""} · ${t("unitOffer")}`}</span>
                        <span className="block text-xs text-muted-foreground">{formatMoney(tr ? tr.price : item.price!, locale)}</span>
                        {saving > 0 && <span className="absolute -top-2 end-2 rounded-full bg-lemon px-1.5 text-[10px] font-bold text-lemon-foreground">{t("offerSave", { percent: saving })}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!item.out && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3">
                <div className="flex items-center rounded-lg border bg-background">
                  <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="-"><Minus className="h-4 w-4" /></button>
                  <Input inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} className="h-9 w-12 border-0 px-1 text-center" aria-label={t("quantity")} />
                  <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => setQty((q) => q + 1)} aria-label="+"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="text-end">
                  <div className="text-xs text-muted-foreground">{t("total")}{tier || item.unitSymbol ? ` · ${qtyLabel((tier?.quantity ?? 1) * qty)} ${item.unitSymbol ?? ""}` : ""}</div>
                  <div className="text-lg font-extrabold text-primary">{item.price !== null ? formatMoney(total, locale) : "—"}</div>
                </div>
              </div>
            )}

            <div className="mt-auto grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={item.out} onClick={() => add(item, qty, tierId)}>
                {inCart ? <Check /> : <ShoppingCart />}{t("addToCart")}
              </Button>
              <Button disabled={item.out} onClick={() => { add(item, qty, tierId, true); onClose(); }}><Zap />{t("orderNow")}</Button>
              {item.kind === "RECIPE" && (
                <Button asChild variant="ghost" className="col-span-2"><Link href={`/recettes/${item.id}`}><ExternalLink />{t("seeRecipe")}</Link></Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Searchable, category-filtered grid of shop cards (2 columns on phones). */
export function ShopCatalog({ items, categories, limit, className }: {
  items: ShopItem[]; categories: PublicCategory[]; limit?: number; className?: string;
}) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const { cart } = useAddToCart();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState<ShopItem | null>(null);
  // Only categories that have items here.
  const used = useMemo(() => categories.filter((c) => items.some((i) => i.categoryId === c.id)), [categories, items]);
  const list = useMemo(() => {
    const s = normalizeSearch(q);
    return items.filter((i) => (cat === "all" || i.categoryId === cat) && (!s || normalizeSearch(`${i.name} ${i.nameAr}`).includes(s)));
  }, [items, q, cat]);
  const shown = limit && !q && cat === "all" ? list.slice(0, limit) : list;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="h-11 rounded-full ps-10 shadow-soft" />
        </div>
        {cart.items.length > 0 && (
          <Button asChild className="sm:ms-auto"><Link href="/commander"><ShoppingBag />{t("cart")} ({cart.items.length})</Link></Button>
        )}
      </div>
      {used.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: "all", name: t("all"), nameAr: t("all") }, ...used].map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} aria-pressed={cat === c.id}
              className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                cat === c.id ? "border-primary bg-primary text-primary-foreground shadow-soft" : "bg-card hover:border-primary/50 hover:text-primary")}>
              {c.id === "all" ? c.name : lname(c, locale)}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-14 text-center text-sm text-muted-foreground">{t("noResults")}</p>
      ) : (
        <Stagger key={`${q}|${cat}`} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((i) => <StaggerItem key={`${i.kind}:${i.id}`} className="h-full"><ShopCard item={i} onOpen={() => setOpen(i)} /></StaggerItem>)}
        </Stagger>
      )}
      <ShopItemDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** "Add to basket" + "order now" buttons for a single item (recipe page). */
export function AddToCartButtons({ item }: { item: ShopItem }) {
  const t = useTranslations("shop");
  const { add } = useAddToCart();
  return (
    <div className="flex flex-wrap gap-3">
      <Button size="lg" variant="outline" onClick={() => add(item)}><ShoppingCart />{t("addToCart")}</Button>
      <Button size="lg" onClick={() => add(item, 1, null, true)}><Zap />{t("orderNow")}</Button>
    </div>
  );
}
