"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, q } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { isConflict, runAction } from "@/lib/action-utils";
import { loginEmailFor, normalizePermissions } from "@/lib/permissions";
import { optionalEmail, passwordField, requiredText, usernameField, zodFieldErrors, type ActionResult } from "@/lib/validators";

const baseSchema = z.object({
  name: requiredText(80),
  username: usernameField,
  email: optionalEmail,
  permissions: z.array(z.string()).max(100),
});
const createSchema = baseSchema.extend({ password: passwordField });
const updateSchema = baseSchema.extend({ password: z.union([z.literal(""), passwordField]).optional() });

export type WorkerInput = z.input<typeof updateSchema>;

const conflict = (e: unknown): { ok: false; error: string; fieldErrors: Record<string, string> } => ({
  ok: false as const,
  error: "validation.usernameTaken",
  fieldErrors: /email/.test((e as Error).message) && !/username/.test((e as Error).message) ? { email: "auth.emailTaken" } : { username: "validation.usernameTaken" },
});

export async function createWorkerAction(input: WorkerInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    try {
      const id = await q<string>(db().rpc("admin_create_worker", {
        p_name: d.name, p_username: d.username, p_login_email: d.email || loginEmailFor(d.username),
        p_password: d.password, p_permissions: normalizePermissions(d.permissions),
      }));
      revalidatePath("/admin/workers");
      return { ok: true, data: { id } };
    } catch (e) {
      if (isConflict(e)) return conflict(e);
      throw e;
    }
  });
}

export async function updateWorkerAction(id: string, input: WorkerInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    try {
      await q(db().rpc("admin_update_worker", {
        p_id: id, p_name: d.name, p_username: d.username, p_email: d.email ?? "", p_login_email: d.email || loginEmailFor(d.username),
        p_password: d.password ?? "", p_permissions: normalizePermissions(d.permissions),
      }));
    } catch (e) {
      if (isConflict(e)) return conflict(e);
      throw e;
    }
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function deleteWorkerAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    await q(db().rpc("admin_delete_worker", { p_id: id }));
    revalidatePath("/admin/workers");
    return { ok: true };
  });
}
