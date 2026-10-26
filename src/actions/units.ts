"use server";

import { revalidatePath } from "next/cache";
import { db, q, snake } from "@/lib/db";
import type { Unit } from "@/lib/db-types";
import { requireAnyStaff, requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { unitSchema, type UnitInput } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";
import { unitDTO, type UnitDTO } from "@/lib/dto";

export async function createUnitAction(input: UnitInput): Promise<ActionResult<UnitDTO>> {
  return runAction(async () => {
    await requireAnyStaff(["products.create", "products.edit", "recipes.create", "recipes.edit"]);
    const parsed = unitSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const unit = await q<Unit>(db().from("units").insert(snake(parsed.data)).select("*").single());
    revalidatePath("/admin", "layout");
    return { ok: true, data: unitDTO(unit) };
  });
}

export async function updateUnitAction(id: string, input: UnitInput): Promise<ActionResult<UnitDTO>> {
  return runAction(async () => {
    await requireAnyStaff(["products.edit", "recipes.edit"]);
    const parsed = unitSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const unit = await q<Unit>(db().from("units").update(snake(parsed.data)).eq("id", id).select("*").single());
    revalidatePath("/admin", "layout");
    return { ok: true, data: unitDTO(unit) };
  });
}

export type UnitUsage = { products: number; ingredients: number; recipes: number; history: number };

async function unitUsage(): Promise<Record<string, UnitUsage>> {
  const rows = await q<({ unitId: string } & UnitUsage)[]>(db().rpc("unit_usage"));
  return Object.fromEntries(rows.map(({ unitId, ...c }) => [unitId, {
    products: Number(c.products), ingredients: Number(c.ingredients), recipes: Number(c.recipes), history: Number(c.history),
  }]));
}

export async function getUnitsUsageAction(): Promise<ActionResult<Record<string, UnitUsage>>> {
  return runAction(async () => {
    await requireStaff();
    return { ok: true, data: await unitUsage() };
  });
}

export async function deleteUnitAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAnyStaff(["products.edit", "recipes.edit"]);
    const c = (await unitUsage())[id];
    if (!c) return { ok: false, error: "common.genericError" };
    if (c.products + c.ingredients + c.recipes + c.history > 0) {
      return { ok: false, error: "validation.unitInUse", meta: c };
    }
    await q(db().from("units").delete().eq("id", id));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
