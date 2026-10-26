"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientCanAccessRecipe, requireClient } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { setAccountPassword, verifyAccountPassword } from "@/lib/accounts";
import { passwordField, positiveNumber, V, zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function toggleFavoriteAction(recipeId: string): Promise<ActionResult<{ favorite: boolean }>> {
  return runAction(async () => {
    const client = await requireClient();
    if (!(await clientCanAccessRecipe(client.id, recipeId))) return { ok: false, error: "common.unauthorized" };
    const key = { clientId_recipeId: { clientId: client.id, recipeId } };
    const existing = await prisma.favorite.findUnique({ where: key });
    if (existing) await prisma.favorite.delete({ where: key });
    else await prisma.favorite.create({ data: { clientId: client.id, recipeId } });
    revalidatePath("/client", "layout");
    return { ok: true, data: { favorite: !existing } };
  });
}

const calcSchema = z.object({ recipeId: z.string().min(1), targetQuantity: positiveNumber, unitId: z.string().min(1) });

export async function saveCalculationAction(input: z.input<typeof calcSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const client = await requireClient();
    const parsed = calcSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "calculator.invalidTarget" };
    if (!(await clientCanAccessRecipe(client.id, parsed.data.recipeId))) return { ok: false, error: "common.unauthorized" };
    const unit = await prisma.unit.findUnique({ where: { id: parsed.data.unitId } });
    if (!unit) return { ok: false, error: "validation.invalid" };
    await prisma.calculationHistory.create({ data: { clientId: client.id, ...parsed.data } });
    revalidatePath("/client/history");
    return { ok: true };
  });
}

export async function deleteHistoryAction(id: string | "all"): Promise<ActionResult> {
  return runAction(async () => {
    const client = await requireClient();
    // Scoped to the logged-in client: an id belonging to someone else matches nothing.
    if (id === "all") await prisma.calculationHistory.deleteMany({ where: { clientId: client.id } });
    else await prisma.calculationHistory.deleteMany({ where: { id, clientId: client.id } });
    revalidatePath("/client/history");
    return { ok: true };
  });
}

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, V.required), newPassword: passwordField, confirmPassword: z.string().min(1, V.required) })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: V.passwordMismatch });

export async function changeOwnPasswordAction(input: z.input<typeof changePasswordSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const client = await requireClient();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const ok = await verifyAccountPassword(client.userId, parsed.data.currentPassword);
    if (!ok) return { ok: false, error: "validation.currentPasswordWrong", fieldErrors: { currentPassword: "validation.currentPasswordWrong" } };
    await setAccountPassword(client.userId, parsed.data.newPassword);
    return { ok: true };
  });
}
