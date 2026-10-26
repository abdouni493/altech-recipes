import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";

type Tx = Prisma.TransactionClient | typeof prisma;

// Thin wrappers around the SECURITY DEFINER functions of supabase/schema.sql (section 5).
// Accounts are real Supabase Auth users, so they sign in with supabase.auth.signInWithPassword.

export class AccountConflictError extends Error {}

function mapConflict(e: unknown): never {
  const msg = e instanceof Error ? e.message : "";
  if (/already used|23505/.test(msg)) throw new AccountConflictError(msg);
  throw e;
}

export async function createAuthAccount(
  tx: Tx,
  a: { email: string; password: string; username: string; name: string; role: Role; permissions?: string[] },
): Promise<string> {
  try {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      select public.create_app_user(${a.email}, ${a.password}, ${a.username}, ${a.name}, ${a.role}, ${a.permissions ?? []}::text[])::text as id`;
    return rows[0].id;
  } catch (e) {
    mapConflict(e);
  }
}

export async function createFirstAdmin(a: { email: string; password: string; username: string; name: string }) {
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      select public.create_first_admin(${a.email}, ${a.password}, ${a.username}, ${a.name})::text as id`;
    return rows[0].id;
  } catch (e) {
    mapConflict(e);
  }
}

export async function adminExists() {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`select public.admin_exists() as exists`;
  return Boolean(rows[0]?.exists);
}

export async function setAccountPassword(userId: string, password: string) {
  await prisma.$executeRaw`select public.set_user_password(${userId}::uuid, ${password})`;
}

export async function verifyAccountPassword(userId: string, password: string) {
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`select public.verify_user_password(${userId}::uuid, ${password}) as ok`;
  return Boolean(rows[0]?.ok);
}

export async function setAccountEmail(userId: string, email: string) {
  try {
    await prisma.$executeRaw`select public.set_user_email(${userId}::uuid, ${email})`;
  } catch (e) {
    mapConflict(e);
  }
}

export async function deleteAuthAccount(userId: string) {
  await prisma.$executeRaw`select public.delete_app_user(${userId}::uuid)`;
}

/** Login e-mail stored in auth.users for a profile. */
export async function getAuthEmail(userId: string) {
  const rows = await prisma.$queryRaw<{ email: string | null }[]>`select email from auth.users where id = ${userId}::uuid`;
  return rows[0]?.email ?? null;
}
