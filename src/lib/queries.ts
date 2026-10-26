import "server-only";
import { prisma } from "@/lib/prisma";
import { unitDTO, type ProductDTO } from "@/lib/dto";

export async function getUnitsDTO() {
  const units = await prisma.unit.findMany({ orderBy: [{ dimension: "asc" }, { factor: "desc" }, { name: "asc" }] });
  return units.map(unitDTO);
}

export async function getProductsDTO(): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" }, include: { unit: true } });
  return products.map((p) => ({
    id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr,
    imageUrl: p.imageUrl, unitId: p.unitId, unit: unitDTO(p.unit),
  }));
}
