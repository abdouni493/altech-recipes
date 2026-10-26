// Plain serializable shapes passed from server components to client components.
import type { Unit } from "@/lib/db-types";
import { toNumber } from "@/lib/utils";

export type UnitDTO = { id: string; name: string; nameAr: string; symbol: string; dimension: string; factor: number };

export function unitDTO(u: Unit): UnitDTO {
  return { id: u.id, name: u.name, nameAr: u.nameAr, symbol: u.symbol, dimension: u.dimension, factor: toNumber(u.factor) };
}

export type ProductDTO = {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  imageUrl: string | null;
  unitId: string;
  unit: UnitDTO;
  recipeCount?: number;
};

export type RecipeLiteDTO = {
  id: string;
  name: string;
  nameAr: string;
  imageUrl: string | null;
};
