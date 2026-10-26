import "server-only";
import { db, q } from "@/lib/db";
import type { Product, Unit } from "@/lib/db-types";
import { unitDTO, type ProductDTO } from "@/lib/dto";

export async function getUnitsDTO() {
  const units = await q<Unit[]>(
    db().from("units").select("*").order("dimension").order("factor", { ascending: false }).order("name"),
  );
  return units.map(unitDTO);
}

export async function getProductsDTO(): Promise<ProductDTO[]> {
  const products = await q<(Product & { unit: Unit })[]>(db().from("products").select("*, unit:units(*)").order("name"));
  return products.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr,
    imageUrl: p.imageUrl, unitId: p.unitId, unit: unitDTO(p.unit),
  }));
}
