import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { BackupError, restoreBackupZip } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX = 500 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX || !file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const count = await restoreBackupZip(Buffer.from(await file.arrayBuffer()));
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    if (e instanceof BackupError) return NextResponse.json({ error: "invalid", detail: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
