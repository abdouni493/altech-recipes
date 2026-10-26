"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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
    const unit = await prisma.unit.create({ data: parsed.data });
    revalidatePath("/admin", "layout");
    return { ok: true, data: unitDTO(unit) };
  });
}

export async function updateUnitAction(id: string, input: UnitInput): Promise<ActionResult<UnitDTO>> {
  return runAction(async () => {
    await requireAnyStaff(["products.edit", "recipes.edit"]);
    const parsed = unitSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const unit = await prisma.unit.update({ where: { id }, data: parsed.data });
    revalidatePath("/admin", "layout");
    return { ok: true, data: unitDTO(unit) };
  });
}

export type UnitUsage = { products: number; ingredients: number; recipes: number; history: number };

export async function getUnitsUsageAction(): Promise<ActionResult<Record<string, UnitUsage>>> {
  return runAction(async () => {
    await requireStaff();
    const units = await prisma.unit.findMany({
      select: { id: true, _count: { select: { products: true, ingredients: true, recipes: true, history: true } } },
    });
    return { ok: true, data: Object.fromEntries(units.map((u) => [u.id, u._count])) };
  });
}

export async function deleteUnitAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAnyStaff(["products.edit", "recipes.edit"]);
    const unit = await prisma.unit.findUnique({
      where: { id },
      select: { _count: { select: { products: true, ingredients: true, recipes: true, history: true } } },
    });
    if (!unit) return { ok: false, error: "common.genericError" };
    const c = unit._count;
    if (c.products + c.ingredients + c.recipes + c.history > 0) {
      return { ok: false, error: "validation.unitInUse", meta: c };
    }
    await prisma.unit.delete({ where: { id } });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
