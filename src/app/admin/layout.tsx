import { getLocale } from "next-intl/server";
import { AppShell } from "@/components/shared/app-shell";
import { StaffPermissionsProvider } from "@/components/shared/staff-permissions";
import { staffPageGuard } from "@/lib/authz";
import { canOpen, hasPermission, STAFF_PAGES } from "@/lib/permissions";
import { countOf, db } from "@/lib/db";
import { getSiteSettings, localized } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await staffPageGuard();
  const [settings, pendingOrders, locale] = await Promise.all([
    getSiteSettings(),
    hasPermission(user, "orders.view")
      ? countOf(db().from("orders").select("id", { count: "exact", head: true }).eq("status", "PENDING")).catch(() => 0)
      : 0,
    getLocale(),
  ]);
  return (
    <StaffPermissionsProvider role={user.role} permissions={user.permissions}>
      <AppShell
        area="admin"
        siteName={localized(settings, "siteName", locale)}
        logoUrl={settings.logoUrl}
        user={{ name: user.name, username: user.username }}
        badges={{ pendingOrders }}
        allowedHrefs={STAFF_PAGES.filter((p) => canOpen(user, p.perm)).map((p) => p.href)}
      >
        {children}
      </AppShell>
    </StaffPermissionsProvider>
  );
}
