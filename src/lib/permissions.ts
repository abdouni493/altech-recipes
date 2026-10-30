// Worker permission keys. Must match the list in supabase/schema.sql (section 4).
// ADMIN implicitly has every key; WORKER only the keys stored in profiles.permissions.

export const PERMISSION_GROUPS = {
  dashboard: ["dashboard.view"],
  products: ["products.view", "products.create", "products.edit", "products.delete"],
  recipes: ["recipes.view", "recipes.create", "recipes.edit", "recipes.delete"],
  packs: ["packs.view", "packs.create", "packs.edit", "packs.delete"],
  clients: ["clients.view", "clients.create", "clients.edit", "clients.permissions", "clients.delete"],
  orders: ["orders.view", "orders.edit", "orders.delete"],
  website: ["website.view", "website.edit"],
  suppliers: ["suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete"],
  purchases: ["purchases.view", "purchases.create", "purchases.edit", "purchases.delete", "purchases.pay"],
  pos: ["pos.use"],
  sales: ["sales.view", "sales.create", "sales.edit", "sales.delete", "sales.pay"],
} as const;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;
export type Permission = (typeof PERMISSION_GROUPS)[PermissionGroup][number];
export type Role = "ADMIN" | "WORKER" | "CLIENT";

export const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flat() as Permission[];

export function isPermission(v: string): v is Permission {
  return (ALL_PERMISSIONS as string[]).includes(v);
}

/** Selecting any action of a module also grants its `.view`, so a worker never gets buttons on a page they cannot open. */
export function normalizePermissions(list: string[]): Permission[] {
  const set = new Set<string>(list.filter(isPermission));
  for (const p of Array.from(set)) set.add(`${p.split(".")[0]}.view`);
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

export function hasPermission(user: { role: string; permissions: string[] }, perm: Permission) {
  return user.role === "ADMIN" || (user.role === "WORKER" && user.permissions.includes(perm));
}

/** Staff pages, in sidebar order, with what is needed to open them (null = every staff member). */
export const STAFF_PAGES: { href: string; perm: Permission | "ADMIN" | null }[] = [
  { href: "/admin", perm: "dashboard.view" },
  { href: "/admin/products", perm: "products.view" },
  { href: "/admin/recipes", perm: "recipes.view" },
  { href: "/admin/packs", perm: "packs.view" },
  { href: "/admin/clients", perm: "clients.view" },
  { href: "/admin/suppliers", perm: "suppliers.view" },
  { href: "/admin/purchases", perm: "purchases.view" },
  { href: "/admin/pos", perm: "pos.use" },
  { href: "/admin/sales", perm: "sales.view" },
  { href: "/admin/orders", perm: "orders.view" },
  { href: "/admin/website", perm: "website.view" },
  { href: "/admin/workers", perm: "ADMIN" },
  { href: "/admin/settings", perm: null },
];

export function canOpen(user: { role: string; permissions: string[] }, perm: Permission | "ADMIN" | null) {
  return perm === null || (perm === "ADMIN" ? user.role === "ADMIN" : hasPermission(user, perm));
}

/** First page a staff member may open (workers without dashboard access land elsewhere). */
export function staffHome(user: { role: string; permissions: string[] }) {
  return STAFF_PAGES.find((p) => canOpen(user, p.perm))?.href ?? "/admin/settings";
}

/** Username → login e-mail for accounts created without a real e-mail. */
export function loginEmailFor(username: string) {
  const domain = process.env.NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN || "altech-recipes.app";
  return `${username.trim().toLowerCase()}@${domain}`;
}
