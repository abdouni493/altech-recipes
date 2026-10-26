"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { orderSchema, type OrderInput } from "@/lib/order-schema";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/authz";
import { runAction } from "@/lib/action-utils";
import { findWilaya } from "@/lib/algeria";
import { V, zodFieldErrors, type ActionResult } from "@/lib/validators";
import { padSerial } from "@/lib/utils";



// Simple in-memory rate limit: 5 orders / 10 minutes per IP.
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function createOrderAction(input: OrderInput): Promise<ActionResult<{ orderNumber: string }>> {
  return runAction(async () => {
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "site.orderError", fieldErrors: zodFieldErrors(parsed.error) };
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (rateLimited(ip)) return { ok: false, error: "site.tooMany" };

    const d = parsed.data;
    const wilaya = findWilaya(d.wilayaCode);
    if (!wilaya) return { ok: false, error: "site.orderError", fieldErrors: { wilayaCode: V.selectWilaya } };
    const commune = wilaya.communes.find((c) => c.fr === d.communeName);
    if (!commune) return { ok: false, error: "site.orderError", fieldErrors: { communeName: V.selectCommune } };

    let recipeId: string | null = null;
    let packId: string | null = null;
    const [kind, id] = d.item.split(":");
    if (kind === "recipe" && id) {
      const r = await prisma.recipe.findFirst({ where: { id, isVisibleOnWebsite: true }, select: { id: true } });
      recipeId = r?.id ?? null;
    } else if (kind === "pack" && id) {
      const p = await prisma.pack.findUnique({ where: { id }, select: { id: true } });
      packId = p?.id ?? null;
    }

    const order = await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({ where: { name: "order" }, create: { name: "order", value: 1 }, update: { value: { increment: 1 } } });
      return tx.order.create({
        data: {
          orderNumber: `CMD-${new Date().getFullYear()}-${padSerial(counter.value)}`,
          fullName: d.fullName, phone: d.phone, wilayaCode: wilaya.code, wilayaName: wilaya.fr, communeName: commune.fr,
          recipeId, packId, message: d.message, wantsClientAccount: d.wantsClientAccount,
        },
      });
    });
    revalidatePath("/admin", "layout");
    return { ok: true, data: { orderNumber: order.orderNumber } };
  });
}

export async function setOrderStatusAction(id: string, status: "CONFIRMED" | "CANCELLED" | "PENDING"): Promise<ActionResult<{ orderNumber: string }>> {
  return runAction(async () => {
    await requireStaff("orders.edit");
    if (!["CONFIRMED", "CANCELLED", "PENDING"].includes(status)) return { ok: false, error: "validation.invalid" };
    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        confirmedAt: status === "CONFIRMED" ? new Date() : null,
        cancelledAt: status === "CANCELLED" ? new Date() : null,
      },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, data: { orderNumber: order.orderNumber } };
  });
}

export async function deleteOrderAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff("orders.delete");
    await prisma.order.delete({ where: { id } });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
