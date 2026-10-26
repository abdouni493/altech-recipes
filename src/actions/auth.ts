"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AccountConflictError, adminExists, createFirstAdmin, getAuthEmail } from "@/lib/accounts";
import { staffHome } from "@/lib/permissions";
import { runAction } from "@/lib/action-utils";
import { optionalEmail, passwordField, requiredText, usernameField, V, zodFieldErrors, type ActionResult } from "@/lib/validators";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

/**
 * After login: if the visitor already picked a language (cookie), remember it on the user;
 * otherwise apply the user's saved preference to the cookie.
 */
async function syncUserLanguage(userId: string) {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    await prisma.user.update({ where: { id: userId }, data: { language: cookieLocale } });
  } else {
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    if (dbUser && isLocale(dbUser.language)) {
      cookies().set(LOCALE_COOKIE, dbUser.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
  }
}

/** Sign in with a username or an e-mail. Returns the home page of the account. */
export async function loginAction(input: { identifier: string; password: string }): Promise<ActionResult<{ home: string }>> {
  return runAction(async () => {
    const identifier = input.identifier?.trim().toLowerCase() ?? "";
    if (!identifier || !input.password) return { ok: false, error: "auth.invalid" };

    // Usernames are resolved to the e-mail stored in Supabase Auth.
    let email: string | null = identifier;
    if (!identifier.includes("@")) {
      const profile = await prisma.user.findUnique({ where: { username: identifier }, select: { id: true } });
      email = profile ? await getAuthEmail(profile.id) : null;
    }
    if (!email) return { ok: false, error: "auth.invalid" };

    const supabase = createSupabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error || !data.user) return { ok: false, error: "auth.invalid" };

    const profile = await prisma.user.findUnique({ where: { id: data.user.id } });
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, error: "auth.invalid" };
    }
    await syncUserLanguage(profile.id);
    return { ok: true, data: { home: profile.role === "CLIENT" ? "/client" : staffHome(profile) } };
  });
}

export async function logoutAction() {
  await createSupabaseServer().auth.signOut();
  return { ok: true as const };
}

export async function adminExistsAction() {
  return adminExists();
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
  // Prisma "Validation Error Count" = DATABASE_URL is not a postgresql:// connection string.
  if (/Validation Error Count|must start with the protocol|Error validating datasource/i.test(msg)) {
    return { ok: false, error: "auth.setupDbUrlInvalid" };
  }
  if (/P1001|P1000|Can't reach database|ENOTFOUND|tenant\/user|password authentication failed|Environment variable not found/i.test(msg)) {
    return { ok: false, error: "auth.setupDbUnreachable" };
  }
  if (/42883|42P01|does not exist/i.test(msg)) return { ok: false, error: "auth.setupSchemaMissing" };
  const detail = msg.split("\n").map((l) => l.trim()).filter(Boolean).pop()?.slice(0, 200) ?? "";
  return { ok: false, error: "auth.setupFailed", meta: { detail } };
}

/** First-run setup: creates the admin account (refused by the database once an admin exists), then signs in. */
export async function createFirstAdminAction(input: FirstAdminInput): Promise<ActionResult<{ home: string }>> {
  const parsed = firstAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    if (await adminExists()) return { ok: false, error: "auth.adminExists" };
    await createFirstAdmin({ email: d.email, password: d.password, username: d.username, name: d.name });
  } catch (e) {
    if (e instanceof AccountConflictError) {
      return { ok: false, error: "validation.usernameTaken", fieldErrors: /email/.test(e.message) ? { email: "auth.emailTaken" } : { username: "validation.usernameTaken" } };
    }
    if (e instanceof Error && /admin already exists/.test(e.message)) return { ok: false, error: "auth.adminExists" };
    return setupError(e);
  }
  const login = await loginAction({ identifier: d.email, password: d.password });
  // The account exists at this point: never tell the person to create it again.
  return login.ok ? login : { ok: false, error: "auth.setupLoginFailed" };
}
