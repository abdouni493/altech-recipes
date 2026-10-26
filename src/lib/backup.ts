import "server-only";
import AdmZip from "adm-zip";
import { db, DbError } from "@/lib/db";

export const BACKUP_FORMAT = "recettes-altech-backup";
export const BACKUP_VERSION = 3;

/**
 * Tables exported as raw rows (snake_case), keyed by table name. Accounts (profiles / auth.users)
 * are not part of the backup: they live in Supabase Auth. Images live in Supabase Storage.
 */
export const TABLES = [
  "units", "products", "recipes", "recipe_ingredients", "packs", "pack_recipes", "clients", "client_permissions",
  "orders", "site_settings", "contact_settings", "calculation_history", "favorites", "counters", "app_meta",
] as const;

async function allRows(table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select("*").range(from, from + 999);
    if (error) throw new DbError(error.message, error.code);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function createBackupZip() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await allRows(t);
  const zip = new AdmZip();
  zip.addFile("data.json", Buffer.from(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), data }, null, 2)));
  await db().from("app_meta").upsert({ key: "lastBackupAt", value: new Date().toISOString() });
  return zip.toBuffer();
}

export class BackupError extends Error {}

/** Validates a backup archive and restores it in one transaction (restore_backup RPC). Accounts are kept. */
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
  // Version 3+ only: older archives used another table layout.
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION || !parsed.data) throw new BackupError("unknown format");
  for (const t of TABLES) if (parsed.data[t] !== undefined && !Array.isArray(parsed.data[t])) throw new BackupError(`bad table ${t}`);
  const { data, error } = await db().rpc("restore_backup", { p_data: parsed.data });
  if (error) throw new DbError(error.message, error.code);
  return Number(data ?? 0);
}
