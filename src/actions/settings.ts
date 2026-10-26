"use server";

import { revalidatePath } from "next/cache";
import { db, q } from "@/lib/db";
import { getSessionEmail, requireStaff } from "@/lib/authz";
import { isConflict, runAction } from "@/lib/action-utils";
import { loginEmailFor } from "@/lib/permissions";
import { adminPasswordSchema, adminProfileSchema, type AdminPasswordInput, type AdminProfileInput } from "@/lib/settings-schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

/** Own profile of a staff member (admin or worker). */
export async function updateAdminProfileAction(input: AdminProfileInput): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireStaff();
    const parsed = adminProfileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };

    // Keep the Supabase Auth login e-mail in sync: a real e-mail wins, otherwise the one derived from the username.
    const authEmail = await getSessionEmail();
    const loginEmail = parsed.data.email
      || (authEmail === loginEmailFor(me.username) || !authEmail ? loginEmailFor(parsed.data.username) : authEmail);
    try {
      await q(db().rpc("update_own_profile", {
        p_name: parsed.data.name, p_username: parsed.data.username, p_email: parsed.data.email ?? "", p_login_email: loginEmail,
      }));
    } catch (e) {
      if (isConflict(e)) {
        return /username/.test((e as Error).message)
          ? { ok: false, error: "validation.usernameTaken", fieldErrors: { username: "validation.usernameTaken" } }
          : { ok: false, error: "validation.invalid", fieldErrors: { email: "auth.emailTaken" } };
      }
      throw e;
    }
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function updateAdminPasswordAction(input: AdminPasswordInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff();
    const parsed = adminPasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const ok = await q<boolean>(db().rpc("change_own_password", { p_current: parsed.data.currentPassword, p_new: parsed.data.newPassword }));
    if (!ok) return { ok: false, error: "validation.currentPasswordWrong", fieldErrors: { currentPassword: "validation.currentPasswordWrong" } };
    return { ok: true };
  });
}
