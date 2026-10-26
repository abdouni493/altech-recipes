// Unit conversion & smart display helpers (pure, usable on client and server).
import type { UnitDTO } from "@/lib/dto";

export function isConvertible(u: Pick<UnitDTO, "dimension">) {
  return u.dimension === "VOLUME" || u.dimension === "MASS" || u.dimension === "COUNT";
}

export function sameDimension(a: UnitDTO, b: UnitDTO) {
  return a.id === b.id || (isConvertible(a) && a.dimension === b.dimension);
}

/** Convert a value between two units of the same dimension. Returns null when not convertible. */
export function convert(value: number, from: UnitDTO, to: UnitDTO): number | null {
  if (from.id === to.id) return value;
  if (!sameDimension(from, to)) return null;
  return (value * from.factor) / to.factor;
}

/**
 * Pick the most readable unit for a value: the largest unit of the same dimension
 * in which the value is ≥ 1 (e.g. 1500 g → 1.5 kg, 0.25 L → 250 mL).
 */
export function smartUnit(value: number, unit: UnitDTO, units: UnitDTO[]): { value: number; unit: UnitDTO } {
  if (unit.dimension !== "VOLUME" && unit.dimension !== "MASS") return { value, unit };
  const candidates = units.filter((u) => u.dimension === unit.dimension && u.factor > 0).sort((a, b) => b.factor - a.factor);
  if (candidates.length === 0) return { value, unit };
  const base = value * unit.factor;
  for (const c of candidates) {
    const v = base / c.factor;
    if (v >= 1) return { value: v, unit: c };
  }
  const smallest = candidates[candidates.length - 1];
  return { value: base / smallest.factor, unit: smallest };
}

/** Round to a number of decimals without floating noise. */
export function roundTo(value: number, decimals: number) {
  const p = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * p) / p;
}
