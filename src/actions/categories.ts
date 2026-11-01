"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, q } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { isConflict, runAction } from "@/lib/action-utils";
import { optionalText, requiredText, zodFieldErrors, type ActionResult } from "@/lib/validators";
import type { CategoryDTO } from "@/lib/categories";

const categorySchema = z.object({ kind: z.enum(["PRODUCT", "RECIPE"]), name: requiredText(60), nameAr: optionalText(60) });

export async function createCategoryAction(input: z.input<typeof categorySchema>): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const { kind, name, nameAr } = parsed.data;
    await requireStaff(kind === "PRODUCT" ? "products.edit" : "recipes.edit");
    try {
      const row = await q<CategoryDTO>(db().from("categories").insert({ kind, name, name_ar: nameAr }).select("id, kind, name, name_ar").single());
      revalidatePath("/admin", "layout");
      revalidatePath("/", "layout");
      return { ok: true, data: row };
    } catch (e) {
      // Same name already exists: reuse it.
      if (isConflict(e)) return { ok: true, data: await q<CategoryDTO>(db().from("categories").select("id, kind, name, name_ar").eq("kind", kind).eq("name", name).single()) };
      throw e;
    }
  });
}
