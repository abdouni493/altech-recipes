"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { AccountConflictError, getAuthEmail, setAccountEmail, setAccountPassword, verifyAccountPassword } from "@/lib/accounts";
import { loginEmailFor } from "@/lib/permissions";
import { adminPasswordSchema, adminProfileSchema, type AdminPasswordInput, type AdminProfileInput } from "@/lib/settings-schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

/** Own profile of a staff member (admin or worker). */
export async function updateAdminProfileAction(input: AdminProfileInput): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireStaff();
    const parsed = adminProfileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const taken = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (taken && taken.id !== me.id) return { ok: false, error: "validation.usernameTaken", fieldErrors: { username: "validation.usernameTaken" } };

    // Keep the Supabase Auth login e-mail in sync: a real e-mail wins, otherwise the one derived from the username.
    const authEmail = await getAuthEmail(me.id);
    const nextEmail = parsed.data.email || (authEmail === loginEmailFor(me.username) ? loginEmailFor(parsed.data.username) : authEmail);
    if (nextEmail && nextEmail !== authEmail) {
      try {
        await setAccountEmail(me.id, nextEmail);
      } catch (e) {
        if (e instanceof AccountConflictError) return { ok: false, error: "validation.invalid", fieldErrors: { email: "auth.emailTaken" } };
        throw e;
      }
    }
    await prisma.user.update({ where: { id: me.id }, data: { name: parsed.data.name, username: parsed.data.username, email: parsed.data.email || null } });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function updateAdminPasswordAction(input: AdminPasswordInput): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireStaff();
    const parsed = adminPasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    if (!(await verifyAccountPassword(me.id, parsed.data.currentPassword))) {
      return { ok: false, error: "validation.currentPasswordWrong", fieldErrors: { currentPassword: "validation.currentPasswordWrong" } };
    }
    await setAccountPassword(me.id, parsed.data.newPassword);
    return { ok: true };
  });
}
