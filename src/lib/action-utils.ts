import "server-only";
import { Prisma } from "@prisma/client";
import { AuthError } from "@/lib/authz";
import type { ActionResult } from "@/lib/validators";

/** Wraps a server action body: maps auth failures and unexpected errors to translated error keys. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "common.unauthorized" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { ok: false, error: "common.genericError" };
    console.error(e);
    return { ok: false, error: "common.genericError" };
  }
}
