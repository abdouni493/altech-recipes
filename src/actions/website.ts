"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { contactSchema, siteSchema } from "@/lib/website-schemas";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { zodFieldErrors, type ActionResult } from "@/lib/validators";

export async function saveContactSettingsAction(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("website.edit");
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation.invalid", fieldErrors: zodFieldErrors(parsed.error) };
    await prisma.contactSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
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
    await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
