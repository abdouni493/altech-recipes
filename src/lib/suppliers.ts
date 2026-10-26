import "server-only";
import { db, q } from "@/lib/db";

export type SupplierProductDTO = { id: string; name: string; nameAr: string; imageUrl: string | null };
export type SupplierDTO = {
  id: string; fullName: string; address: string; phone: string; phone2: string; createdAt: string;
  products: SupplierProductDTO[];
};

type Row = Omit<SupplierDTO, "products"> & { products: { product: SupplierProductDTO | null }[] };

const SELECT = "id, full_name, address, phone, phone2, created_at, products:supplier_products(product:products(id, name, name_ar, image_url))";

const toDTO = (r: Row): SupplierDTO => ({
  ...r,
  products: r.products.flatMap((p) => (p.product ? [p.product] : [])).sort((a, b) => a.name.localeCompare(b.name)),
});

/** Suppliers with their products (RLS: staff with suppliers.view, or any client). */
export async function listSuppliers() {
  const rows = await q<Row[]>(db().from("suppliers").select(SELECT).order("full_name"));
  return rows.map(toDTO);
}

export async function getSupplier(id: string) {
  const row = await q<Row | null>(db().from("suppliers").select(SELECT).eq("id", id).maybeSingle());
  return row ? toDTO(row) : null;
}
