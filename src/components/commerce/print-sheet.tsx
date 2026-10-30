"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A4 document shell: prints automatically once loaded; the toolbar is hidden on paper. */
export function PrintSheet({ children }: { children: React.ReactNode }) {
  const t = useTranslations("commerce");
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4 print:hidden">
        <Button variant="outline" onClick={() => window.close()}>{t("close")}</Button>
        <Button onClick={() => window.print()}><Printer />{t("print")}</Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-8 text-[13px] text-black shadow-soft print:max-w-none print:p-0 print:shadow-none">
        {children}
      </article>
    </div>
  );
}
