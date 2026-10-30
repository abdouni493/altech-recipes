"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Logo } from "@/components/shared/logo";
import { ScrollProgress } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

export function SiteHeader({ siteName, logoUrl, role }: { siteName: string; logoUrl: string | null; role: string | null }) {
  const t = useTranslations("nav.site");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: "/", label: t("home") },
    { href: "/recettes", label: t("recipes") },
    { href: "/produits", label: t("products") },
    { href: "/commander", label: t("order") },
    { href: "/#contact", label: t("contact") },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href));
  // Transparent header with light text while it floats over the home hero.
  const overHero = pathname === "/" && !scrolled && !open;
  const areaHref = role === "ADMIN" || role === "WORKER" ? "/admin" : role === "CLIENT" ? "/client" : "/login";
  const areaLabel = role ? t("myArea") : `${t("clientArea")}`;

  return (
    <>
    <ScrollProgress />
    <div className="relative z-50 bg-primary py-2 text-center font-label text-[11px] font-bold uppercase tracking-[0.25em] text-primary-foreground">
      <span className="text-lemon">✦</span> {t("recipes")} · {t("order")} <span className="text-lemon">✦</span>
    </div>
    <header className={cn("sticky top-0 z-40 transition-all duration-500", scrolled || open ? "border-b bg-background/90 shadow-sm backdrop-blur-md" : "bg-background/0", overHero && "text-white")}>
      <div className="container flex h-16 items-center gap-4 md:h-20">
        <Logo name={siteName} logoUrl={logoUrl} />
        <nav className="ms-6 hidden items-center gap-1 md:flex" aria-label={tc("openMenu")}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
              className={cn("group relative px-4 py-2 font-label text-xs font-bold uppercase tracking-[0.18em] transition-colors hover:text-primary",
                overHero ? (isActive(l.href) ? "text-lemon" : "text-white/85 hover:text-white") : isActive(l.href) ? "text-primary" : "text-foreground/80")}>
              {l.label}
              <span aria-hidden className={cn("absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100 rtl:origin-right", overHero ? "bg-white" : "bg-primary")} />
              {isActive(l.href) && <motion.span layoutId="nav-underline" className={cn("absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full", overHero ? "bg-lemon" : "bg-primary")} />}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <div className={cn("flex items-center gap-1", overHero && "[&_button:hover]:bg-white/15 [&_button:hover]:text-white")}>
            <ThemeToggle />
            <LanguageSwitcher compact />
          </div>
          <Button asChild size="sm" className="ms-1 hidden sm:inline-flex">
            <Link href={areaHref}><UserRound />{areaLabel}{!role && <span className="hidden lg:inline"> / {t("login")}</span>}</Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={tc("openMenu")}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t bg-background md:hidden">
            <div className="container flex flex-col gap-1 py-4">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className={cn("rounded-sm px-4 py-3 font-label text-sm font-bold uppercase tracking-[0.15em]", isActive(l.href) ? "bg-sage-soft text-primary" : "hover:bg-secondary")}>{l.label}</Link>
              ))}
              <Button asChild className="mt-2"><Link href={areaHref}><UserRound />{areaLabel}</Link></Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}
