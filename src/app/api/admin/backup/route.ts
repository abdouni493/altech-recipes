import { requireAdmin } from "@/lib/authz";
import { createBackupZip } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const buf = await createBackupZip();
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const name = `recettes-altech-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.zip`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
