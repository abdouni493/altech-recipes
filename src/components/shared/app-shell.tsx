"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen, Boxes, Calculator, ChevronsLeft, ExternalLink, FlaskConical, Globe, Heart, History, LayoutDashboard,
  LifeBuoy, LogOut, Menu, Package, Settings, ShieldCheck, ShoppingBag, Truck, UserRound, Users, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/primitives";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Sheet, SheetContent,
} from "@/components/ui/overlays";
import { DialogTitle } from "@/components/ui/overlays";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { ScrollProgress } from "./motion";
import { logoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

type Area = "admin" | "client";
type NavItem = { href: string; key: string; icon: LucideIcon; exact?: boolean; badge?: "pendingOrders" };

const NAV: Record<Area, NavItem[]> = {
  admin: [
    { href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/products", key: "products", icon: FlaskConical },
    { href: "/admin/recipes", key: "recipes", icon: BookOpen },
    { href: "/admin/packs", key: "packs", icon: Boxes },
    { href: "/admin/clients", key: "clients", icon: Users },
    { href: "/admin/suppliers", key: "suppliers", icon: Truck },
    { href: "/admin/orders", key: "orders", icon: ShoppingBag, badge: "pendingOrders" },
    { href: "/admin/website", key: "website", icon: Globe },
    { href: "/admin/workers", key: "workers", icon: ShieldCheck },
    { href: "/admin/settings", key: "settings", icon: Settings },
  ],
  client: [
    { href: "/client", key: "recipes", icon: BookOpen, exact: true },
    { href: "/client/calculator", key: "calculator", icon: Calculator },
    { href: "/client/favorites", key: "favorites", icon: Heart },
    { href: "/client/history", key: "history", icon: History },
    { href: "/client/suppliers", key: "suppliers", icon: Truck },
    { href: "/client/help", key: "help", icon: LifeBuoy },
    { href: "/client/account", key: "account", icon: UserRound },
  ],
};

export function AppShell({
  area, siteName, logoUrl, user, badges, allowedHrefs, children,
}: {
  area: Area;
  siteName: string;
  logoUrl?: string | null;
  user: { name: string; username: string; subtitle?: string };
  badges?: { pendingOrders?: number };
  /** Staff area: only these pages are shown (worker permissions). */
  allowedHrefs?: string[];
  children: React.ReactNode;
}) {
  const tNav = useTranslations(`nav.${area}`);
  const t = useTranslations("common");
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const router = useRouter();

  async function logout() {
    await logoutAction();
    router.replace("/login");
    router.refresh();
  }

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(`sidebar-${area}`) === "1");
    } catch {}
  }, [area]);
  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(`sidebar-${area}`, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  const items = allowedHrefs ? NAV[area].filter((i) => allowedHrefs.includes(i.href)) : NAV[area];
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const initials = user.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
  const home = area === "admin" ? items[0]?.href ?? "/admin/settings" : "/client";

  const navList = (compact: boolean) => (
    <nav className="relative isolate flex flex-1 flex-col gap-1 px-3" aria-label={tNav("area")}>
      {items.map((item) => {
        const active = isActive(item.href, item.exact);
        const Icon = item.icon;
        const count = item.badge ? badges?.[item.badge] ?? 0 : 0;
        const link = (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-sm px-3 py-2.5 font-label text-[11px] font-bold uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lemon",
              active ? "text-lemon" : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground",
              compact && "justify-center px-0"
            )}>
            {active && <motion.span layoutId={`nav-active-${compact ? "c" : "f"}`} transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className="absolute inset-0 -z-10 rounded-sm bg-white/10 before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:bg-lemon" />}
            <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110" />
            {!compact && <span className="flex-1 truncate">{tNav(item.key)}</span>}
            {count > 0 && (
              <span className={cn(
                "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-5",
                "bg-lemon text-lemon-foreground",
                compact && "absolute -end-0.5 -top-0.5"
              )}>{count}</span>
            )}
          </Link>
        );
        return compact ? (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{tNav(item.key)}</TooltipContent>
          </Tooltip>
        ) : link;
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t("skipToContent")}
      </a>
      {/* Desktop sidebar — `start-0` places it on the right in RTL */}
      <aside className={cn(
        "fixed inset-y-0 start-0 z-40 hidden flex-col border-e-4 border-lemon bg-primary text-primary-foreground transition-[width] duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] dark:bg-card lg:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}>
        <div className={cn("flex h-16 items-center border-b border-white/10 px-5 [&_span]:text-primary-foreground", collapsed && "justify-center px-0")}>
          {collapsed ? <Logo name="" logoUrl={logoUrl} href={home} /> : <Logo name={siteName} logoUrl={logoUrl} href={home} />}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto py-4">{navList(collapsed)}</div>
        <div className="border-t border-white/10 p-3">
          <Button variant="ghost" size="sm" onClick={toggleCollapsed} className={cn("w-full justify-start gap-3 text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground", collapsed && "justify-center")}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}>
            <ChevronsLeft className={cn("transition-transform flip-rtl", collapsed && "rotate-180")} />
            {!collapsed && t("collapseSidebar")}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" className="w-72 border-e-4 border-lemon bg-primary p-0 pt-4 text-primary-foreground dark:bg-card [&_span]:text-primary-foreground" closeLabel={t("close")} aria-describedby={undefined}>
          <DialogTitle className="sr-only">{tNav("area")}</DialogTitle>
          <div className="px-5 pb-4"><Logo name={siteName} logoUrl={logoUrl} href={home} /></div>
          {navList(false)}
        </SheetContent>
      </Sheet>

      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-300", collapsed ? "lg:ps-[76px]" : "lg:ps-64")}>
        <ScrollProgress />
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("openMenu")}>
            <Menu />
          </Button>
          <div className="min-w-0 flex-1 truncate font-label text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
            <span className="hidden sm:inline"><span className="text-lemon">✦</span> {tNav("area")}</span>
          </div>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <a href="/" target="_blank" rel="noopener">
              <ExternalLink />
              {t("visitWebsite")}
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label={t("visitWebsite")}>
            <a href="/" target="_blank" rel="noopener"><ExternalLink /></a>
          </Button>
          <ThemeToggle />
          <LanguageSwitcher compact />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 pe-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("profile")}>
                <Avatar className="h-8 w-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">{user.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="space-y-0.5">
                <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
                <div className="truncate font-mono text-xs">{user.username}</div>
                {user.subtitle && <div className="text-xs">{user.subtitle}</div>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={area === "admin" ? "/admin/settings" : "/client/account"}>
                  {area === "admin" ? <Settings /> : <UserRound />}
                  {area === "admin" ? tNav("settings") : tNav("account")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/" target="_blank" rel="noopener"><Package />{t("visitWebsite")}</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void logout()}>
                <LogOut className="flip-rtl" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <motion.main id="main" key={pathname} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, clipPath: "inset(0% 0% 12% 0%)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
            className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </motion.main>
      </div>
    </div>
  );
}
