import "server-only";
import AdmZip from "adm-zip";
import { prisma } from "@/lib/prisma";

export const BACKUP_FORMAT = "recettes-altech-backup";
export const BACKUP_VERSION = 2;

/**
 * Tables in insertion order (parents before children). Keys are Prisma client delegates.
 * Accounts (profiles / auth.users) are not part of the backup: they live in Supabase Auth.
 * Images live in Supabase Storage and are referenced by URL, so they need no copy either.
 */
export const TABLES = [
  "unit", "product", "recipe", "recipeIngredient", "pack", "packRecipe", "client", "clientPermission",
  "order", "siteSettings", "contactSettings", "calculationHistory", "favorite", "counter", "appMeta",
] as const;
type Table = (typeof TABLES)[number];

const delegate = (name: Table) => (prisma as any)[name] as { findMany: () => Promise<unknown[]> };

export async function createBackupZip() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await delegate(t).findMany();
  const zip = new AdmZip();
  zip.addFile("data.json", Buffer.from(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), data }, null, 2)));
  await prisma.appMeta.upsert({ where: { key: "lastBackupAt" }, create: { key: "lastBackupAt", value: new Date().toISOString() }, update: { value: new Date().toISOString() } });
  return zip.toBuffer();
}

export class BackupError extends Error {}

/** Validates and restores a backup archive. Replaces every data table; accounts are kept. */
export async function restoreBackupZip(buffer: Buffer) {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BackupError("invalid zip");
  }
  const entry = zip.getEntry("data.json");
  if (!entry) throw new BackupError("missing data.json");
  let parsed: { format?: string; version?: number; data?: Record<string, unknown> };
  try {
    parsed = JSON.parse(entry.getData().toString("utf8"));
  } catch {
    throw new BackupError("invalid json");
  }
  if (parsed.format !== BACKUP_FORMAT || typeof parsed.version !== "number" || parsed.version > BACKUP_VERSION || !parsed.data) {
    throw new BackupError("unknown format");
  }
  const data = parsed.data;
  for (const t of TABLES) if (data[t] !== undefined && !Array.isArray(data[t])) throw new BackupError(`bad table ${t}`);

  // Clients are restored only when their Supabase account still exists (and so are their rows).
  const existingUsers = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id));
  const clients = ((data.client as { id: string; userId: string }[] | undefined) ?? []).filter((c) => existingUsers.has(c.userId));
  const clientIds = new Set(clients.map((c) => c.id));
  const keep = (t: Table, r: Record<string, unknown>) =>
    t === "client" ? clientIds.has(r.id as string)
    : ["clientPermission", "calculationHistory", "favorite"].includes(t) ? clientIds.has(r.clientId as string)
    : !(t === "appMeta" && r.key === "lastBackupAt");

  const lastBackup = await prisma.appMeta.findUnique({ where: { key: "lastBackupAt" } });
  let count = 0;
  await prisma.$transaction(async (tx) => {
    const d = (name: Table) => (tx as any)[name];
    for (const t of [...TABLES].reverse()) await d(t).deleteMany();
    for (const t of TABLES) {
      const rows = (data[t] as Record<string, unknown>[] | undefined)?.filter((r) => keep(t, r)) ?? [];
      if (rows.length) await d(t).createMany({ data: rows });
      count += rows.length;
    }
    if (lastBackup) await d("appMeta").create({ data: lastBackup });
  }, { timeout: 60_000 });
  return count;
}
