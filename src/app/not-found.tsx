import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-20 grain">
      <div className="max-w-md text-center">
        <p className="font-serif text-8xl font-semibold text-primary/25">404</p>
        <div className="mx-auto -mt-6 mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-accent text-accent-foreground"><Compass className="h-8 w-8" /></div>
        <h1 className="font-serif text-3xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("notFoundText")}</p>
        <Button asChild className="mt-8"><Link href="/">{t("goHome")}</Link></Button>
      </div>
    </div>
  );
}
