"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, q } from "@/lib/db";
import { clientCanAccessRecipe, requireClient } from "@/lib/authz";
import { isForeignKey, runAction } from "@/lib/action-utils";
import { passwordField, positiveNumber, V, zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function toggleFavoriteAction(recipeId: string): Promise<ActionResult<{ favorite: boolean }>> {
  return runAction(async () => {
    const client = await requireClient();
    if (!(await clientCanAccessRecipe(client.id, recipeId))) return { ok: false, error: "common.unauthorized" };
    const existing = await q<{ recipeId: string } | null>(
      db().from("favorites").select("recipe_id").eq("client_id", client.id).eq("recipe_id", recipeId).maybeSingle(),
    );
    if (existing) await q(db().from("favorites").delete().eq("client_id", client.id).eq("recipe_id", recipeId));
    else await q(db().from("favorites").insert({ client_id: client.id, recipe_id: recipeId }));
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
    try {
      await q(db().from("calculation_history").insert({
        client_id: client.id, recipe_id: parsed.data.recipeId, target_quantity: parsed.data.targetQuantity, unit_id: parsed.data.unitId,
      }));
    } catch (e) {
      if (isForeignKey(e)) return { ok: false, error: "validation.invalid" };
      throw e;
    }
    revalidatePath("/client/history");
    return { ok: true };
  });
}

export async function deleteHistoryAction(id: string | "all"): Promise<ActionResult> {
  return runAction(async () => {
    const client = await requireClient();
    // Scoped to the logged-in client: an id belonging to someone else matches nothing (RLS too).
    let query = db().from("calculation_history").delete().eq("client_id", client.id);
    if (id !== "all") query = query.eq("id", id);
    await q(query);
    revalidatePath("/client/history");
    return { ok: true };
  });
}

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, V.required), newPassword: passwordField, confirmPassword: z.string().min(1, V.required) })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: V.passwordMismatch });

export async function changeOwnPasswordAction(input: z.input<typeof changePasswordSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireClient();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const ok = await q<boolean>(db().rpc("change_own_password", { p_current: parsed.data.currentPassword, p_new: parsed.data.newPassword }));
    if (!ok) return { ok: false, error: "validation.currentPasswordWrong", fieldErrors: { currentPassword: "validation.currentPasswordWrong" } };
    return { ok: true };
  });
}
