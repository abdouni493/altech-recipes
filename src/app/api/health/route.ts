import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Deployment check: which environment variables are set and whether the database and
 * supabase/schema.sql are in place. Reports booleans and error codes only, never secrets.
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DATABASE_URL_uses_pooler_pgbouncer: /pgbouncer=true/.test(process.env.DATABASE_URL ?? ""),
  };
  const checks: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = "ok";
    } catch (e) {
      const code = (e as { code?: string; errorCode?: string }).code ?? (e as { errorCode?: string }).errorCode;
      checks[name] = `error${code ? ` ${code}` : ""}: ${(e instanceof Error ? e.message : String(e)).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 200)}`;
    }
  };
  await run("database_connection", () => prisma.$queryRaw`select 1`);
  await run("schema_tables", () => prisma.siteSettings.findFirst());
  await run("schema_functions", () => prisma.$queryRaw`select public.admin_exists()`);
  const ok = Object.values(env).every(Boolean) && Object.values(checks).every((v) => v === "ok");
  return NextResponse.json({ ok, env, checks }, { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
