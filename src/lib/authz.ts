import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db, q } from "@/lib/db";
import type { Client, Profile } from "@/lib/db-types";
import { hasPermission, type Permission } from "@/lib/permissions";

export class AuthError extends Error {
  constructor(message = "unauthorized") {
    super(message);
  }
}

/** Profile of the logged-in Supabase user, re-read from the DB on every request (never trusted from the token). */
export const getSessionUser = cache(async (): Promise<Profile | null> => {
  const supabase = db();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  try {
    return await q<Profile | null>(supabase.from("profiles").select("*").eq("id", id).maybeSingle());
  } catch (e) {
    console.error("getSessionUser failed:", e);
    return null;
  }
});

/** Login e-mail of the signed-in user (from the session). */
export async function getSessionEmail() {
  const { data } = await db().auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
}

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

export type SessionClient = Client & { user: Profile };

/** For server actions / route handlers: returns the Client row of the logged-in client, or throws. */
export async function requireClient(): Promise<SessionClient> {
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") throw new AuthError();
  const client = await q<Client | null>(db().from("clients").select("*").eq("user_id", user.id).maybeSingle());
  if (!client) throw new AuthError();
  return { ...client, user };
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
  const row = await q<{ id: string } | null>(
    db().from("client_permissions").select("id").eq("client_id", clientId).eq("recipe_id", recipeId).maybeSingle(),
  );
  return Boolean(row);
}
