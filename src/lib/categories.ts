import "server-only";
import { db, q } from "@/lib/db";

export type CategoryDTO = { id: string; kind: "PRODUCT" | "RECIPE"; name: string; nameAr: string };

/** Categories of one kind (empty when supabase/website-3.sql has not been run yet). */
export function getCategories(kind: CategoryDTO["kind"]): Promise<CategoryDTO[]> {
  return q<CategoryDTO[]>(db().from("categories").select("id, kind, name, name_ar").eq("kind", kind).order("position").order("name")).catch(() => []);
}
