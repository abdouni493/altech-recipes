// Algeria administrative divisions: 69 wilayas (incl. 59–69 from Law 26-06 of 4 April 2026) and 1,541 communes.
// Source: geoalgeria@1.3.0 (MIT), cross-checked against othmanus/algeria-cities (1,541 communes, 58 wilayas).
import data from "@data/algeria.json";

export type Commune = { fr: string; ar: string };
export type Wilaya = { code: string; fr: string; ar: string; communes: Commune[] };

export const WILAYAS: Wilaya[] = data.wilayas;

export function findWilaya(code: string) {
  return WILAYAS.find((w) => w.code === code);
}

export function wilayaLabel(w: Pick<Wilaya, "code" | "fr" | "ar">, locale: string) {
  return `${w.code} — ${locale === "ar" ? w.ar : w.fr}`;
}
