"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { contactSchema, siteSchema } from "@/lib/website-schemas";
import { db, q, snake } from "@/lib/db";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function saveContactSettingsAction(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("website.edit");
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    await q(db().from("contact_settings").upsert({ id: 1, ...snake(parsed.data) }));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function saveSiteSettingsAction(input: z.input<typeof siteSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("website.edit");
    const parsed = siteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    const data = { ...parsed.data, heroImages: JSON.stringify(parsed.data.heroImages) };
    await q(db().from("site_settings").upsert({ id: 1, ...snake(data) }));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
