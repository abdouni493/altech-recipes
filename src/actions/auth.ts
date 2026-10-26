"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { camel, DbError } from "@/lib/db";
import type { Profile } from "@/lib/db-types";
import { createSupabaseServer } from "@/lib/supabase/server";
import { staffHome } from "@/lib/permissions";
import { isConflict, runAction } from "@/lib/action-utils";
import { optionalEmail, passwordField, requiredText, usernameField, V, zodFieldErrors, type ActionResult } from "@/lib/validators";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

type Supabase = ReturnType<typeof createSupabaseServer>;

/**
 * After login: if the visitor already picked a language (cookie), remember it on the user;
 * otherwise apply the user's saved preference to the cookie.
 */
async function syncUserLanguage(supabase: Supabase, profile: Profile) {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    await supabase.rpc("set_my_language", { p_language: cookieLocale });
  } else if (isLocale(profile.language)) {
    cookies().set(LOCALE_COOKIE, profile.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
}

/** Sign in with a username or an e-mail. Returns the home page of the account. */
export async function loginAction(input: { identifier: string; password: string }): Promise<ActionResult<{ home: string }>> {
  return runAction(async () => {
    const identifier = input.identifier?.trim().toLowerCase() ?? "";
    if (!identifier || !input.password) return { ok: false, error: "auth.invalid" };

    const supabase = createSupabaseServer();
    // Usernames are resolved to the e-mail stored in Supabase Auth.
    const { data: email, error: lookupError } = await supabase.rpc("login_email", { p_identifier: identifier });
    if (lookupError) throw new DbError(lookupError.message, lookupError.code);
    if (!email) return { ok: false, error: "auth.invalid" };

    const { data, error } = await supabase.auth.signInWithPassword({ email: email as string, password: input.password });
    if (error || !data.user) return { ok: false, error: "auth.invalid" };

    const { data: row } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    if (!row) {
      await supabase.auth.signOut();
      return { ok: false, error: "auth.invalid" };
    }
    const profile = camel<Profile>(row);
    await syncUserLanguage(supabase, profile);
    return { ok: true, data: { home: profile.role === "CLIENT" ? "/client" : staffHome(profile) } };
  });
}

export async function logoutAction() {
  await createSupabaseServer().auth.signOut();
  return { ok: true as const };
}

const firstAdminSchema = z
  .object({
    name: requiredText(80),
    username: usernameField,
    email: optionalEmail.refine((v) => v !== "", V.required),
    password: passwordField,
    confirmPassword: z.string().min(1, V.required),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: V.passwordMismatch });
export type FirstAdminInput = z.input<typeof firstAdminSchema>;

/** Turns a setup failure into a message the person can act on (only reachable before any admin exists). */
function setupError(e: unknown): ActionResult<{ home: string }> {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("createFirstAdminAction failed:", e);
  if (/fetch failed|ENOTFOUND|Invalid API key|No API key/i.test(msg)) return { ok: false, error: "auth.setupSupabaseUnreachable" };
  if (/PGRST202|42883|42P01|does not exist|Could not find the function/i.test(msg)) return { ok: false, error: "auth.setupSchemaMissing" };
  const detail = msg.split("\n").map((l) => l.trim()).filter(Boolean).pop()?.slice(0, 200) ?? "";
  return { ok: false, error: "auth.setupFailed", meta: { detail } };
}

/** First-run setup: creates the admin account (refused by the database once an admin exists), then signs in. */
export async function createFirstAdminAction(input: FirstAdminInput): Promise<ActionResult<{ home: string }>> {
  const parsed = firstAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    const { error } = await createSupabaseServer().rpc("create_first_admin", {
      p_email: d.email, p_password: d.password, p_username: d.username, p_name: d.name,
    });
    if (error) throw new DbError(error.message, error.code);
  } catch (e) {
    if (e instanceof Error && /admin already exists/.test(e.message)) return { ok: false, error: "auth.adminExists" };
    if (isConflict(e)) {
      return { ok: false, error: "validation.usernameTaken", fieldErrors: /email/.test((e as Error).message) ? { email: "auth.emailTaken" } : { username: "validation.usernameTaken" } };
    }
    return setupError(e);
  }
  const login = await loginAction({ identifier: d.email, password: d.password });
  // The account exists at this point: never tell the person to create it again.
  return login.ok ? login : { ok: false, error: "auth.setupLoginFailed" };
}
