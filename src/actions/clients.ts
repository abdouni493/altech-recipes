"use server";

import { revalidatePath } from "next/cache";
import { db, q } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { isConflict, isForeignKey, runAction } from "@/lib/action-utils";
import { loginEmailFor } from "@/lib/permissions";
import { clientInfoSchema, clientCreateSchema, permissionsSchema, type ClientCreateInput, type ClientInfoInput, type PermissionsInput } from "@/lib/client-schemas";
import type { PriceType } from "@/lib/commerce";
import { usernameField, zodFieldErrors, type ActionResult } from "@/lib/validators";

const EMAIL_DOMAIN = loginEmailFor("x").split("@")[1];
const usernameTaken = { ok: false as const, error: "validation.usernameTaken", fieldErrors: { username: "validation.usernameTaken" } };

/** Preview of the next serial number (not reserved). */
export async function nextSerialAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    await requireStaff("clients.create");
    return { ok: true, data: await q<number>(db().rpc("next_client_serial")) };
  });
}

export async function checkUsernameAction(username: string, excludeUserId?: string): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    await requireStaff();
    const parsed = usernameField.safeParse(username);
    if (!parsed.success) return { ok: true, data: { available: false } };
    // login_email() sees every account (profiles RLS hides workers from non-admins).
    const email = await q<string | null>(db().rpc("login_email", { p_identifier: parsed.data }));
    if (!email) return { ok: true, data: { available: true } };
    if (!excludeUserId) return { ok: true, data: { available: false } };
    const own = await q<{ username: string } | null>(db().from("profiles").select("username").eq("id", excludeUserId).maybeSingle());
    return { ok: true, data: { available: own?.username === parsed.data } };
  });
}

/** Deduplicate by recipe: the first occurrence wins. */
function dedupe(perms: PermissionsInput["permissions"]) {
  const seen = new Set<string>();
  return perms
    .filter((x) => (seen.has(x.recipeId) ? false : (seen.add(x.recipeId), true)))
    .map((p) => ({ recipeId: p.recipeId, packId: p.packId ?? null }));
}

export async function createClientAction(input: ClientCreateInput): Promise<ActionResult<{ id: string; serial: number; username: string; password: string; fullName: string; phone: string; priceType: PriceType }>> {
  return runAction(async () => {
    await requireStaff("clients.create");
    const parsed = clientCreateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const data = parsed.data;
    try {
      // staff_create_client() reserves the serial, creates the Supabase Auth user, the client and its access
      // in one transaction. With credentialsAuto, the credentials are recomputed with the definitive serial.
      const result = await q<{ id: string; serial: number; username: string; password: string }>(db().rpc("staff_create_client", {
        p_full_name: data.fullName, p_phone: data.phone, p_address: data.address,
        p_auto: data.credentialsAuto, p_username: data.username, p_password: data.password,
        p_permissions: dedupe(data.permissions), p_email_domain: EMAIL_DOMAIN,
      }));
      if (data.priceType !== "DETAIL") await q(db().rpc("set_client_price_type", { p_client_id: result.id, p_price_type: data.priceType }));
      revalidatePath("/admin", "layout");
      return { ok: true, data: { ...result, fullName: data.fullName, priceType: data.priceType, phone: data.phone } };
    } catch (e) {
      if (isConflict(e)) return usernameTaken;
      if (isForeignKey(e)) return { ok: false, error: "validation.invalidSelection" };
      throw e;
    }
  });
}

export async function updateClientAction(id: string, input: ClientInfoInput & { username: string }): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("clients.edit");
    const parsed = clientInfoSchema.extend({ username: usernameField }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    try {
      // A new username also changes the login e-mail derived from it.
      await q(db().rpc("staff_update_client", {
        p_id: id, p_full_name: parsed.data.fullName, p_phone: parsed.data.phone, p_address: parsed.data.address,
        p_username: parsed.data.username, p_login_email: loginEmailFor(parsed.data.username),
      }));
      await q(db().rpc("set_client_price_type", { p_client_id: id, p_price_type: parsed.data.priceType }));
    } catch (e) {
      if (isConflict(e)) return usernameTaken;
      throw e;
    }
    revalidatePath("/admin/clients", "layout");
    return { ok: true };
  });
}

export async function updatePermissionsAction(id: string, input: PermissionsInput): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    await requireStaff("clients.permissions");
    const parsed = permissionsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid" };
    try {
      const count = await q<number>(db().rpc("set_client_permissions", { p_client_id: id, p_permissions: dedupe(parsed.data.permissions) }));
      revalidatePath("/admin/clients", "layout");
      revalidatePath("/client", "layout");
      return { ok: true, data: { count } };
    } catch (e) {
      if (isForeignKey(e)) return { ok: false, error: "validation.invalidSelection" };
      throw e;
    }
  });
}

export async function resetClientPasswordAction(id: string): Promise<ActionResult<{ password: string }>> {
  return runAction(async () => {
    await requireStaff("clients.edit");
    const password = await q<string>(db().rpc("staff_reset_client_password", { p_id: id }));
    return { ok: true, data: { password } };
  });
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("clients.delete");
    // Deleting the auth user cascades to the profile, the client and its permissions, history and favorites.
    await q(db().rpc("staff_delete_client", { p_id: id }));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
