import { NextResponse } from "next/server";
import { db, q } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Deployment check: the two Supabase variables are set and supabase/schema.sql has been run.
 * Reports booleans and error messages only, never secrets.
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").startsWith("eyJ"),
  };
  const checks: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = "ok";
    } catch (e) {
      const code = (e as { code?: string }).code;
      checks[name] = `error${code ? ` ${code}` : ""}: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
    }
  };
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    await run("schema_tables", () => q(db().from("site_settings").select("id").limit(1)));
    await run("schema_functions", () => q(db().rpc("admin_exists")));
    await run("schema_app_functions", () => q(db().rpc("login_email", { p_identifier: "health-check" })));
  }
  const ok = Object.values(env).every(Boolean) && Object.values(checks).every((v) => v === "ok");
  return NextResponse.json({ ok, env, checks }, { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
