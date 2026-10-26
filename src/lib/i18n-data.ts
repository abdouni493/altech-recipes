// Pick the localized variant of a bilingual DB field (name / nameAr, description / descriptionAr).
type Bilingual = { name: string; nameAr?: string | null; description?: string | null; descriptionAr?: string | null };

export function lname(obj: Pick<Bilingual, "name" | "nameAr">, locale: string) {
  return locale === "ar" && obj.nameAr ? obj.nameAr : obj.name;
}

export function ldesc(obj: Pick<Bilingual, "description" | "descriptionAr">, locale: string) {
  return (locale === "ar" && obj.descriptionAr ? obj.descriptionAr : obj.description) ?? "";
}
