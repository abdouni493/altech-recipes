import "server-only";
import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";

// Data access through Supabase (project URL + anon key + the visitor's session cookies).
// Row Level Security and the RPC functions of supabase/schema.sql decide what each user may read or write.

/** One Supabase client per request. */
export const db = cache(() => createSupabaseServer());

export class DbError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

type CamelKey<S extends string> = S extends `${infer H}_${infer T}` ? `${H}${Capitalize<CamelKey<T>>}` : S;
export type Camel<T> = T extends (infer U)[] ? Camel<U>[] : T extends object ? { [K in keyof T as K extends string ? CamelKey<K> : K]: Camel<T[K]> } : T;

const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** snake_case rows from PostgREST → the camelCase shapes the UI uses. */
export function camel<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camel(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [toCamel(k), camel(v)])) as T;
  }
  return value as T;
}

/** camelCase input → snake_case columns (one level). */
export function snake(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnake(k), v]));
}

type Res = { data: unknown; error: { message: string; code?: string } | null };

/** Await a query; throw DbError on failure; return camelCase data. */
export async function q<T>(query: PromiseLike<Res>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new DbError(error.message, error.code);
  return camel<T>(data);
}

/** Await a `{ count: "exact", head: true }` query. */
export async function countOf(query: PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>) {
  const { count, error } = await query;
  if (error) throw new DbError(error.message, error.code);
  return count ?? 0;
}

/** Embedded `relation(count)` → number. */
export function n(v: unknown): number {
  return Array.isArray(v) ? Number((v[0] as { count?: number } | undefined)?.count ?? 0) : 0;
}
