"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, BookOpen, Boxes, Calculator, Check, ChefHat, Lock, Package, ShoppingCart, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/basic";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlays";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { WhatsAppIcon } from "@/components/site/social-icons";
import type { PublicPack } from "@/lib/public-queries";
import { formatMoney } from "@/lib/commerce";
import { ldesc, lname } from "@/lib/i18n-data";
import { qtyLabel } from "@/lib/shop";
import { useSiteCart } from "@/lib/site-cart";
import { cn, whatsappLink } from "@/lib/utils";

/** Advert for the automatic calculator: details, "locked" notice, buy a recipe or WhatsApp. */
export function CalculatorAd({ whatsappNumber, className }: { whatsappNumber: string; className?: string }) {
  const t = useTranslations("shop.calc");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={cn("group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[hsl(222_70%_35%)] p-5 text-start text-primary-foreground shadow-lift transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:p-7", className)}>
        <span className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-lemon/30 blur-2xl" />
        <span className="absolute -bottom-12 start-1/3 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <span className="relative flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur sm:h-16 sm:w-16"><Calculator className="h-7 w-7 sm:h-8 sm:w-8" /></span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-lemon px-2 py-0.5 text-[11px] font-bold text-lemon-foreground"><Sparkles className="h-3 w-3" />{t("badge")}</span>
            <span className="block font-serif text-lg font-bold leading-tight sm:text-2xl">{t("title")}</span>
            <span className="block text-sm text-primary-foreground/80">{t("short")}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-primary transition group-hover:gap-2 sm:inline-flex">{t("cta")}<ArrowRight className="h-4 w-4 flip-rtl" /></span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto" closeLabel={tc("close")}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 pe-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Calculator className="h-6 w-6" /></span>
              <DialogTitle className="font-serif text-xl font-bold leading-tight">{t("title")}</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">{t("description")}</DialogDescription>
            <ul className="space-y-2">
              {(["f1", "f2", "f3", "f4"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{t(k)}</li>
              ))}
            </ul>
            <div className="flex gap-3 rounded-2xl border-2 border-dashed border-warning/60 bg-warning/10 p-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="font-semibold">{t("lockedTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("locked")}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg"><Link href="/recettes" onClick={() => setOpen(false)}><ShoppingCart />{t("buy")}</Link></Button>
              {whatsappNumber && (
                <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                  <a href={whatsappLink(whatsappNumber, t("whatsappMessage"))} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-5 w-5" />{t("whatsapp")}</a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Link card to the personalized recipe builder. */
export function CustomRecipeCta({ className }: { className?: string }) {
  const t = useTranslations("shop.custom");
  return (
    <Link href="/recette-personnalisee"
      className={cn("group relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-lemon bg-gradient-to-br from-lemon/25 via-card to-sage-soft p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:p-7", className)}>
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-lemon text-lemon-foreground shadow-sm sm:h-16 sm:w-16"><ChefHat className="h-7 w-7 sm:h-8 sm:w-8" /></span>
      <span className="min-w-0 flex-1 space-y-1">
        <Badge variant="default" className="text-[11px]">{t("badge")}</Badge>
        <span className="block font-serif text-lg font-bold leading-tight sm:text-2xl">{t("title")}</span>
        <span className="block text-sm text-muted-foreground">{t("text")}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition group-hover:gap-2 sm:inline-flex">{t("cta")}<ArrowRight className="h-4 w-4 flip-rtl" /></span>
    </Link>
  );
}

type PackFilter = "all" | "recipes" | "products" | "mixed";
const packKind = (p: PublicPack): Exclude<PackFilter, "all"> => {
  const r = p.items.some((i) => i.itemType === "RECIPE");
  const pr = p.items.some((i) => i.itemType === "PRODUCT");
  return r && pr ? "mixed" : pr ? "products" : "recipes";
};

/** Packs (recipes, products or both) with type filters and basket buttons. */
export function PacksShowcase({ packs }: { packs: PublicPack[] }) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const router = useRouter();
  const cart = useSiteCart();
  const [filter, setFilter] = useState<PackFilter>("all");
  const kinds = useMemo(() => new Set(packs.map(packKind)), [packs]);
  const list = packs.filter((p) => filter === "all" || packKind(p) === filter);
  const filters = (["all", "recipes", "products", "mixed"] as const).filter((f) => f === "all" || kinds.has(f));
  const add = (p: PublicPack, go = false) => {
    cart.add("PACK", p.id);
    if (go) router.push("/commander");
    else toast.success(t("added", { name: lname(p, locale) }));
  };

  return (
    <div className="space-y-5">
      {filters.length > 2 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {filters.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                filter === f ? "border-primary bg-primary text-primary-foreground shadow-soft" : "bg-card hover:border-primary/50 hover:text-primary")}>
              {t(`packs.${f}`)}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-14 text-center text-sm text-muted-foreground">{t("packs.empty")}</p>
      ) : (
        <Stagger key={filter} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {list.map((p) => {
            const kind = packKind(p);
            return (
              <StaggerItem key={p.id} className="h-full">
                <article className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <div className="relative overflow-hidden">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      : <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-primary/20 via-sage-soft to-lemon/30"><Boxes className="h-12 w-12 text-primary" /></div>}
                    <Badge variant="lemon" className="absolute start-3 top-3 shadow-sm">{t(`packs.${kind}`)}</Badge>
                    {p.price !== null && <span className="absolute bottom-3 end-3 rounded-full bg-background/95 px-3 py-1 text-base font-extrabold text-primary shadow">{formatMoney(Number(p.price), locale)}</span>}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                    <div>
                      <h3 className="font-serif text-xl font-bold">{lname(p, locale)}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ldesc(p, locale)}</p>
                    </div>
                    {p.items.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("packs.contains")} · {t("packs.items", { count: p.items.length })}</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {p.items.slice(0, 6).map((i) => {
                            const Icon = i.itemType === "RECIPE" ? BookOpen : Package;
                            return (
                              <li key={`${i.itemType}:${i.itemId}`} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background/70 px-2 py-0.5 text-xs">
                                <Icon className="h-3 w-3 shrink-0 text-primary" />
                                <span className="truncate">{i.itemType === "PRODUCT" && i.quantity !== 1 ? `${qtyLabel(i.quantity)} × ` : ""}{lname(i, locale)}</span>
                              </li>
                            );
                          })}
                          {p.items.length > 6 && <li className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">+{p.items.length - 6}</li>}
                        </ul>
                      </div>
                    )}
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                      <Button variant="outline" onClick={() => add(p)}><ShoppingCart />{t("addToCart")}</Button>
                      <Button onClick={() => add(p, true)}><Zap />{t("orderNow")}</Button>
                    </div>
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
