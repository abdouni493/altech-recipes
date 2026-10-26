"use server";

import { revalidatePath } from "next/cache";
import { db, q, snake } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { isForeignKey, runAction } from "@/lib/action-utils";
import { packSchema, type PackInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function savePackAction(id: string | null, input: PackInput): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    await requireStaff(id ? "packs.edit" : "packs.create");
    const parsed = packSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const { recipeIds, ...data } = parsed.data;
    try {
      // save_pack() writes the pack and its recipes in one transaction.
      const pack = await q<{ id: string; name: string }>(
        db().rpc("save_pack", { p_id: id, p_data: snake(data), p_recipe_ids: Array.from(new Set(recipeIds)) }),
      );
      revalidatePath("/admin", "layout");
      revalidatePath("/", "layout");
      return { ok: true, data: pack };
    } catch (e) {
      if (isForeignKey(e)) return { ok: false, error: "validation.invalidSelection" };
      throw e;
    }
  });
}

export async function deletePackAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("packs.delete");
    // Permissions keep the recipe access; only the pack reference is cleared (on delete set null).
    await q(db().from("packs").delete().eq("id", id));
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
