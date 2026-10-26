"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { AccountConflictError, createAuthAccount, deleteAuthAccount, getAuthEmail, setAccountEmail, setAccountPassword } from "@/lib/accounts";
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

const conflict = (e: AccountConflictError): { ok: false; error: string; fieldErrors: Record<string, string> } => ({
  ok: false as const,
  error: "validation.usernameTaken",
  fieldErrors: /email/.test(e.message) && !/username/.test(e.message) ? { email: "auth.emailTaken" } : { username: "validation.usernameTaken" },
});

export async function createWorkerAction(input: WorkerInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    try {
      const id = await createAuthAccount(prisma, {
        email: d.email || loginEmailFor(d.username), password: d.password, username: d.username, name: d.name,
        role: "WORKER", permissions: normalizePermissions(d.permissions),
      });
      revalidatePath("/admin/workers");
      return { ok: true, data: { id } };
    } catch (e) {
      if (e instanceof AccountConflictError) return conflict(e);
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
    const worker = await prisma.user.findUnique({ where: { id } });
    if (!worker || worker.role !== "WORKER") return { ok: false, error: "common.genericError" };
    const taken = await prisma.user.findUnique({ where: { username: d.username } });
    if (taken && taken.id !== id) return { ok: false, error: "validation.usernameTaken", fieldErrors: { username: "validation.usernameTaken" } };

    const nextEmail = d.email || loginEmailFor(d.username);
    try {
      if (nextEmail !== (await getAuthEmail(id))) await setAccountEmail(id, nextEmail);
    } catch (e) {
      if (e instanceof AccountConflictError) return conflict(e);
      throw e;
    }
    if (d.password) await setAccountPassword(id, d.password);
    await prisma.user.update({
      where: { id },
      data: { name: d.name, username: d.username, email: d.email || null, permissions: normalizePermissions(d.permissions) },
    });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function deleteWorkerAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const worker = await prisma.user.findUnique({ where: { id } });
    if (!worker || worker.role !== "WORKER") return { ok: false, error: "common.genericError" };
    await deleteAuthAccount(id);
    revalidatePath("/admin/workers");
    return { ok: true };
  });
}
