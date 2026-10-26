"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => console.error(error), [error]);
  return (
    <div className="grid min-h-[50vh] place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="h-8 w-8" /></div>
        <h1 className="font-serif text-2xl font-semibold">{t("errorTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("errorText")}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">#{error.digest}</p>}
        <Button className="mt-6" onClick={reset}><RotateCw />{t("retry")}</Button>
      </div>
    </div>
  );
}
