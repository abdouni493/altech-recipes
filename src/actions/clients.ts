"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { AccountConflictError, createAuthAccount, deleteAuthAccount, setAccountEmail, setAccountPassword } from "@/lib/accounts";
import { loginEmailFor } from "@/lib/permissions";
import { defaultCredential } from "@/lib/utils";
import { clientInfoSchema, clientCreateSchema, permissionsSchema, type ClientCreateInput, type ClientInfoInput, type PermissionsInput } from "@/lib/client-schemas";
import { usernameField, zodFieldErrors, type ActionResult } from "@/lib/validators";

/** Preview of the next serial number (not reserved). */
export async function nextSerialAction(): Promise<ActionResult<number>> {
  return runAction(async () => {
    await requireStaff("clients.create");
    const c = await prisma.counter.findUnique({ where: { name: "client" } });
    const max = await prisma.client.aggregate({ _max: { serialNumber: true } });
    return { ok: true, data: Math.max(c?.value ?? 0, max._max.serialNumber ?? 0) + 1 };
  });
}

export async function checkUsernameAction(username: string, excludeUserId?: string): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    await requireStaff();
    const parsed = usernameField.safeParse(username);
    if (!parsed.success) return { ok: true, data: { available: false } };
    const existing = await prisma.user.findUnique({ where: { username: parsed.data } });
    return { ok: true, data: { available: !existing || existing.id === excludeUserId } };
  });
}

async function validPermissions(perms: PermissionsInput["permissions"]) {
  const recipeIds = Array.from(new Set(perms.map((p) => p.recipeId)));
  const packIds = Array.from(new Set(perms.map((p) => p.packId).filter(Boolean))) as string[];
  const [r, p] = await Promise.all([
    prisma.recipe.count({ where: { id: { in: recipeIds } } }),
    prisma.pack.count({ where: { id: { in: packIds } } }),
  ]);
  if (r !== recipeIds.length || p !== packIds.length) return null;
  // Deduplicate by recipe: the first occurrence wins.
  const seen = new Set<string>();
  return perms.filter((x) => (seen.has(x.recipeId) ? false : (seen.add(x.recipeId), true)));
}

const usernameTaken = { ok: false as const, error: "validation.usernameTaken", fieldErrors: { username: "validation.usernameTaken" } };

export async function createClientAction(input: ClientCreateInput): Promise<ActionResult<{ id: string; serial: number; username: string; password: string; fullName: string }>> {
  return runAction(async () => {
    await requireStaff("clients.create");
    const parsed = clientCreateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const data = parsed.data;
    const perms = await validPermissions(data.permissions);
    if (!perms) return { ok: false, error: "validation.invalidSelection" };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Reserve the next serial number (monotonic, never reused).
        const max = await tx.client.aggregate({ _max: { serialNumber: true } });
        const current = await tx.counter.findUnique({ where: { name: "client" } });
        const serial = Math.max(current?.value ?? 0, max._max.serialNumber ?? 0) + 1;
        await tx.counter.upsert({ where: { name: "client" }, create: { name: "client", value: serial }, update: { value: serial } });

        // If the admin kept the generated credentials, recompute them with the definitive serial.
        const formula = defaultCredential(data.fullName, serial);
        const username = data.credentialsAuto ? formula : data.username;
        const password = data.credentialsAuto ? formula : data.password;

        // Supabase Auth user + profile (same transaction: rolled back if anything below fails).
        const userId = await createAuthAccount(tx, { email: loginEmailFor(username), password, username, name: data.fullName, role: "CLIENT" });
        const client = await tx.client.create({
          data: {
            serialNumber: serial, fullName: data.fullName, phone: data.phone, address: data.address, userId,
            permissions: { create: perms.map((p) => ({ recipeId: p.recipeId, packId: p.packId ?? null })) },
          },
        });
        return { id: client.id, serial, username, password };
      });
      revalidatePath("/admin", "layout");
      return { ok: true, data: { ...result, fullName: data.fullName } };
    } catch (e) {
      if (e instanceof AccountConflictError) return usernameTaken;
      throw e;
    }
  });
}

export async function updateClientAction(id: string, input: ClientInfoInput & { username: string }): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("clients.edit");
    const parsed = clientInfoSchema.extend({ username: usernameField }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const client = await prisma.client.findUnique({ where: { id }, include: { user: true } });
    if (!client) return { ok: false, error: "common.genericError" };
    const taken = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (taken && taken.id !== client.userId) return usernameTaken;

    // A new username also changes the login e-mail derived from it.
    if (parsed.data.username !== client.user.username) {
      try {
        await setAccountEmail(client.userId, loginEmailFor(parsed.data.username));
      } catch (e) {
        if (e instanceof AccountConflictError) return usernameTaken;
        throw e;
      }
    }
    await prisma.client.update({
      where: { id },
      data: {
        fullName: parsed.data.fullName, phone: parsed.data.phone, address: parsed.data.address,
        user: { update: { name: parsed.data.fullName, username: parsed.data.username, email: loginEmailFor(parsed.data.username) } },
      },
    });
    revalidatePath("/admin/clients", "layout");
    return { ok: true };
  });
}

export async function updatePermissionsAction(id: string, input: PermissionsInput): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    await requireStaff("clients.permissions");
    const parsed = permissionsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid" };
    const perms = await validPermissions(parsed.data.permissions);
    if (!perms) return { ok: false, error: "validation.invalidSelection" };
    await prisma.$transaction([
      prisma.clientPermission.deleteMany({ where: { clientId: id } }),
      prisma.clientPermission.createMany({ data: perms.map((p) => ({ clientId: id, recipeId: p.recipeId, packId: p.packId ?? null })) }),
      // Favorites of recipes that are no longer permitted are removed.
      prisma.favorite.deleteMany({ where: { clientId: id, recipeId: { notIn: perms.map((p) => p.recipeId) } } }),
    ]);
    revalidatePath("/admin/clients", "layout");
    revalidatePath("/client", "layout");
    return { ok: true, data: { count: perms.length } };
  });
}

export async function resetClientPasswordAction(id: string): Promise<ActionResult<{ password: string }>> {
  return runAction(async () => {
    await requireStaff("clients.edit");
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return { ok: false, error: "common.genericError" };
    const password = defaultCredential(client.fullName, client.serialNumber);
    await setAccountPassword(client.userId, password);
    return { ok: true, data: { password } };
  });
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("clients.delete");
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return { ok: false, error: "common.genericError" };
    // Deleting the auth user cascades to the profile, the client and its permissions, history and favorites.
    await deleteAuthAccount(client.userId);
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
