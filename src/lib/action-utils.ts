import "server-only";
import { AuthError } from "@/lib/authz";
import { DbError } from "@/lib/db";
import type { ActionResult } from "@/lib/validators";

/** Postgres / PostgREST error codes raised by supabase/schema.sql that map to user-facing errors. */
export function isUnauthorized(e: unknown) {
  return e instanceof AuthError || (e instanceof DbError && (e.code === "42501" || /unauthorized|permission denied|row-level security/i.test(e.message)));
}
export function isConflict(e: unknown) {
  return e instanceof DbError && (e.code === "23505" || /already used/.test(e.message));
}
export function isForeignKey(e: unknown) {
  return e instanceof DbError && e.code === "23503";
}

/** Wraps a server action body: maps auth failures and unexpected errors to translated error keys. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (isUnauthorized(e)) return { ok: false, error: "common.unauthorized" };
    console.error(e);
    return { ok: false, error: "common.genericError" };
  }
}
