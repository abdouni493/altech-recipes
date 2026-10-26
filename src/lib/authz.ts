import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { hasPermission, type Permission } from "@/lib/permissions";

export class AuthError extends Error {
  constructor(message = "unauthorized") {
    super(message);
  }
}

/** Profile of the logged-in Supabase user, re-read from the DB on every request (never trusted from the token). */
export const getSessionUser = cache(async () => {
  const supabase = createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return prisma.user.findUnique({ where: { id: data.user.id } });
});

/** ADMIN or WORKER; with `perm`, a worker must hold that permission. Throws otherwise. */
export async function requireStaff(perm?: Permission) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "WORKER")) throw new AuthError();
  if (perm && !hasPermission(user, perm)) throw new AuthError();
  return user;
}

/** Staff member holding at least one of the permissions. */
export async function requireAnyStaff(perms: Permission[]) {
  const user = await requireStaff();
  if (!perms.some((p) => hasPermission(user, p))) throw new AuthError();
  return user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") throw new AuthError();
  return user;
}

/** For server actions / route handlers: returns the Client row of the logged-in client, or throws. */
export async function requireClient() {
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") throw new AuthError();
  const client = await prisma.client.findUnique({ where: { userId: user.id }, include: { user: true } });
  if (!client) throw new AuthError();
  return client;
}

/** For staff pages: redirects to login when signed out, to /admin/forbidden when the permission is missing. */
export async function staffPageGuard(perm?: Permission | "ADMIN") {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "WORKER")) redirect("/login?expired=1");
  if (perm === "ADMIN" ? user.role !== "ADMIN" : perm && !hasPermission(user, perm)) redirect("/admin/forbidden");
  return user;
}

export async function clientPageGuard() {
  try {
    return await requireClient();
  } catch {
    redirect("/login?expired=1");
  }
}

export async function clientCanAccessRecipe(clientId: string, recipeId: string) {
  const perm = await prisma.clientPermission.findUnique({ where: { clientId_recipeId: { clientId, recipeId } } });
  return Boolean(perm);
}
