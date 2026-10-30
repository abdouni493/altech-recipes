"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen, Boxes, Calculator, ChevronsLeft, ExternalLink, FlaskConical, Globe, Heart, History, LayoutDashboard,
  LifeBuoy, LogOut, Menu, Package, Receipt, ScanBarcode, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Truck, UserRound, Users, type LucideIcon,
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

type NavGroup = { key: string; items: NavItem[] };

const NAV: Record<Area, NavGroup[]> = {
  admin: [
    { key: "overview", items: [{ href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true }] },
    { key: "commerce", items: [
      { href: "/admin/pos", key: "pos", icon: ScanBarcode },
      { href: "/admin/sales", key: "sales", icon: Receipt },
      { href: "/admin/orders", key: "orders", icon: ShoppingBag, badge: "pendingOrders" },
      { href: "/admin/purchases", key: "purchases", icon: ShoppingCart },
    ] },
    { key: "catalog", items: [
      { href: "/admin/products", key: "products", icon: FlaskConical },
      { href: "/admin/recipes", key: "recipes", icon: BookOpen },
      { href: "/admin/packs", key: "packs", icon: Boxes },
    ] },
    { key: "people", items: [
      { href: "/admin/clients", key: "clients", icon: Users },
      { href: "/admin/suppliers", key: "suppliers", icon: Truck },
    ] },
    { key: "system", items: [
      { href: "/admin/website", key: "website", icon: Globe },
      { href: "/admin/workers", key: "workers", icon: ShieldCheck },
      { href: "/admin/settings", key: "settings", icon: Settings },
    ] },
  ],
  client: [
    { key: "workspace", items: [
      { href: "/client", key: "recipes", icon: BookOpen, exact: true },
      { href: "/client/favorites", key: "favorites", icon: Heart },
      { href: "/client/history", key: "history", icon: History },
    ] },
    { key: "tools", items: [
      { href: "/client/calculator", key: "calculator", icon: Calculator },
      { href: "/client/suppliers", key: "suppliers", icon: Truck },
    ] },
    { key: "account", items: [
      { href: "/client/help", key: "help", icon: LifeBuoy },
      { href: "/client/account", key: "account", icon: UserRound },
    ] },
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

  const tGroup = useTranslations("nav.groups");
  const groups = NAV[area]
    .map((g) => ({ ...g, items: allowedHrefs ? g.items.filter((i) => allowedHrefs.includes(i.href)) : g.items }))
    .filter((g) => g.items.length > 0);
  const items = groups.flatMap((g) => g.items);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const initials = user.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
  const home = area === "admin" ? items[0]?.href ?? "/admin/settings" : "/client";

  const navLink = (item: NavItem, compact: boolean) => {
    const active = isActive(item.href, item.exact);
    const Icon = item.icon;
    const count = item.badge ? badges?.[item.badge] ?? 0 : 0;
    const link = (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
          active ? "text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
          compact && "justify-center px-0 py-2.5"
        )}>
        {active && <motion.span layoutId={`nav-active-${compact ? "c" : "f"}`} transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 shadow-lg shadow-blue-900/40" />}
        <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-white" : "text-slate-500 group-hover:text-sky-300")} />
        {!compact && <span className="flex-1 truncate">{tNav(item.key)}</span>}
        {count > 0 && (
          <span className={cn(
            "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-5",
            active ? "bg-white text-blue-700" : "bg-amber-400 text-slate-900",
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
  };

  const navList = (compact: boolean) => (
    <nav className="relative isolate flex flex-1 flex-col gap-5 px-3" aria-label={tNav("area")}>
      {groups.map((group, i) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          {compact
            ? i > 0 && <div className="mx-3 mb-2 h-px bg-white/10" />
            : <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{tGroup(group.key)}</div>}
          {group.items.map((item) => navLink(item, compact))}
        </div>
      ))}
    </nav>
  );

  const userCard = (compact: boolean) => (
    <div className={cn("flex items-center gap-3 rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/10", compact && "justify-center bg-transparent p-0 ring-0")}>
      <Avatar className="h-9 w-9 ring-2 ring-sky-500/40">
        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-semibold text-white">{initials}</AvatarFallback>
      </Avatar>
      {!compact && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-100">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{user.subtitle ?? user.username}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t("skipToContent")}
      </a>
      {/* Desktop sidebar — `start-0` places it on the right in RTL */}
      <aside className={cn(
        "fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-white/5 bg-slate-950 bg-[radial-gradient(120%_60%_at_0%_0%,rgba(37,99,235,0.2),transparent_60%)] text-slate-100 transition-[width] duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] lg:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}>
        <div className={cn("flex h-16 items-center border-b border-white/5 px-5 [&_span]:text-white", collapsed && "justify-center px-0")}>
          {collapsed ? <Logo name="" logoUrl={logoUrl} href={home} /> : <Logo name={siteName} logoUrl={logoUrl} href={home} />}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto py-5 [scrollbar-width:thin]">{navList(collapsed)}</div>
        <div className="space-y-2 border-t border-white/5 p-3">
          {userCard(collapsed)}
          <Button variant="ghost" size="sm" onClick={toggleCollapsed} className={cn("w-full justify-start gap-3 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100", collapsed && "justify-center")}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}>
            <ChevronsLeft className={cn("transition-transform flip-rtl", collapsed && "rotate-180")} />
            {!collapsed && t("collapseSidebar")}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" className="flex w-72 flex-col border-e border-white/5 bg-slate-950 p-0 pt-4 text-slate-100" closeLabel={t("close")} aria-describedby={undefined}>
          <DialogTitle className="sr-only">{tNav("area")}</DialogTitle>
          <div className="border-b border-white/5 px-5 pb-4 [&_span]:text-white"><Logo name={siteName} logoUrl={logoUrl} href={home} /></div>
          <div className="flex-1 overflow-y-auto py-5">{navList(false)}</div>
          <div className="border-t border-white/5 p-3">{userCard(false)}</div>
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
