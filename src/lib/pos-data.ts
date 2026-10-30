import "server-only";
import { getNextSerial, getPermissionCatalog } from "@/lib/client-queries";
import { hasPermission } from "@/lib/permissions";
import { listClientsLite, listCommerceProducts } from "@/lib/commerce-queries";
import type { Profile } from "@/lib/db-types";

/** Everything the point of sale needs (the "new client" wizard only for staff allowed to create clients). */
export async function loadPosData(user: Profile) {
  const canCreateClient = hasPermission(user, "clients.create");
  const [products, clients, catalog, nextSerial] = await Promise.all([
    listCommerceProducts(),
    listClientsLite().catch(() => []),
    canCreateClient ? getPermissionCatalog() : null,
    canCreateClient ? getNextSerial() : 0,
  ]);
  return { products, clients, wizard: catalog ? { nextSerial, packs: catalog.packs, recipes: catalog.recipes } : null };
}
